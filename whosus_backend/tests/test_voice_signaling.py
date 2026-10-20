from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import ORIGINS, sessions, voice
from app.main import app
from app.models import Message
from app.game import Room
from app.voice import VoiceRouter
from test_network import until, ORIGIN


def test_default_origins_are_whole_urls():
    assert all(origin.startswith(('http://', 'https://')) for origin in ORIGINS)


def test_webrtc_signaling_is_forwarded_in_room_without_a_server_media_connection():
    with TestClient(app) as client, ExitStack() as stack:
        sockets = [stack.enter_context(client.websocket_connect('/ws', headers=ORIGIN)) for _ in range(3)]
        identities = []
        code = ''
        for index, ws in enumerate(sockets):
            ws.send_json({'type': 'join' if index == 1 else 'create', 'code': code, 'name': f'Peer {index}'})
            identities.append(until(ws, 'joined'))
            snapshot = until(ws, 'snapshot')
            if index == 0: code = snapshot['room']['code']
            ws.send_json({'type': 'voice_state', 'enabled': True, 'muted': False})
            ws.send_json({'type': 'ping'})
            until(ws, 'pong')
        a, b, outsider = identities
        assert a['iceServers'] == voice.ice_servers
        assert 'voiceTransport' not in a
        sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
        signal = {'type': 'voice_signal', 'to': b['id'], 'kind': 'offer', 'sdp': sdp, 'generation': 123}
        sockets[0].send_json(signal)
        received = until(sockets[1], 'voice_signal')
        assert received == {'type': 'voice_signal', 'from': a['id'], 'kind': 'offer', 'sdp': sdp, 'generation': 123}
        candidate = {'candidate': 'candidate:1 1 udp 2130706431 127.0.0.1 50000 typ host', 'sdpMid': '0', 'sdpMLineIndex': 0}
        sockets[0].send_json({**signal, 'kind': 'ice', 'candidate': candidate})
        assert until(sockets[1], 'voice_signal')['candidate']['candidate'] == candidate['candidate']
        sockets[1].send_json({**signal, 'to': a['id'], 'kind': 'answer'})
        assert until(sockets[0], 'voice_signal')['kind'] == 'answer'
        sockets[0].send_json({**signal, 'to': outsider['id']})
        sockets[2].send_json({'type': 'ping'})
        while True:
            message = sockets[2].receive_json()
            assert message['type'] != 'voice_signal', 'Different rooms must never exchange voice setup'
            if message['type'] == 'pong': break
        sockets[0].send_json({**signal, 'sdp': sdp + 'm=video 9 RTP/AVP 96\r\n'})
        assert 'audio' in until(sockets[0], 'error')['message']
        room = sessions[a['token']]['room']
        assert [peer['id'] for peer in voice.peers(room, a['id'])] == [b['id']]
        sockets[1].send_json({'type': 'voice_state', 'enabled': False})
        sockets[1].send_json({'type': 'ping'})
        until(sockets[1], 'pong')
        assert voice.peers(room, a['id']) == []


def test_voice_topology_and_gains_follow_ghost_phase_distance_and_deafen_rules():
    room = Room('VOICEP')
    a, b = room.add('Alice'), room.add('Bob')
    a.muted = b.muted = False
    router = VoiceRouter()
    router.state(a.id, True, True)
    router.state(b.id, True, False)
    assert router.peers(room, a.id)[0]['gain'] == 1
    room.phase = 'playing'
    a.alive = False
    assert not router.can_signal(room, a.id, b.id)
    assert router.peers(room, b.id) == []
    assert a.id not in router.speaking(room, b.id)
    b.alive = False
    assert router.can_signal(room, a.id, b.id)
    assert router.peers(room, b.id)[0]['gain'] == 1
    a.alive = b.alive = True
    a.x, a.z, b.x, b.z = 0, 0, 13, 0
    assert router.peers(room, b.id)[0]['gain'] == 0
    room.phase = 'discussion'
    assert router.peers(room, b.id)[0]['gain'] == 1
    b.deafened = True
    assert router.peers(room, b.id)[0]['gain'] == 0
    b.deafened = False
    a.alive = False
    assert not router.can_signal(room, a.id, b.id)
    room.phase = 'gameover'
    assert router.can_signal(room, a.id, b.id)


def test_voice_signal_payloads_are_bounded_and_cannot_spoof_the_sender():
    with pytest.raises(ValidationError):
        Message.model_validate({'type': 'voice_signal', 'from': 'another-player'})
    with pytest.raises(ValidationError):
        Message.model_validate({'type': 'voice_signal', 'candidate': {'candidate': 'x' * 2049}})
    with pytest.raises(ValidationError):
        Message.model_validate({'type': 'voice_signal', 'sdp': 'x' * 16001})
