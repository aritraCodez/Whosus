import asyncio

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import ORIGINS, voice
from app.voice import VoiceRouter
from app.main import app
from app.models import Message
from test_network import until, ORIGIN


def test_default_origins_are_whole_urls():
    # A set of individual URL characters rejects every browser WebSocket.
    assert all(origin.startswith(('http://', 'https://')) for origin in ORIGINS)


def test_ice_is_queued_until_offer_ready_and_stale_generations_are_ignored(monkeypatch):
    received = []

    async def offer(room, pid, sdp, generation):
        await asyncio.sleep(.1)
        return 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'

    async def add_ice(pid, generation, candidate):
        received.append((generation, candidate))

    monkeypatch.setattr(voice, 'offer', offer)
    monkeypatch.setattr(voice, 'add_ice', add_ice)
    with TestClient(app) as client, client.websocket_connect('/ws', headers=ORIGIN) as ws:
        ws.send_json({'type': 'create', 'name': 'Voice tester'})
        until(ws, 'joined')
        ws.send_json({'type': 'voice_offer', 'generation': 7, 'sdp': 'm=audio 9 UDP/TLS/RTP/SAVPF 111'})
        candidate = {'candidate': 'candidate:1 1 udp 2130706431 127.0.0.1 50000 typ host', 'sdpMid': '0', 'sdpMLineIndex': 0}
        ws.send_json({'type': 'voice_ice', 'generation': 6, 'candidate': candidate})
        ws.send_json({'type': 'voice_ice', 'generation': 7, 'candidate': candidate})
        ws.send_json({'type': 'voice_ice', 'generation': 7, 'candidate': None})
        assert until(ws, 'voice_answer')['generation'] == 7
        assert len(received) == 2
        assert received[0][0] == 7 and received[0][1]['candidate'] == candidate['candidate']
        assert received[1] == (7, None)
        ws.send_json({'type': 'voice_stop', 'generation': 7})
        ws.send_json({'type': 'voice_ice', 'generation': 7, 'candidate': candidate})
        ws.send_json({'type': 'ping'})
        until(ws, 'pong')
        assert len(received) == 2


@pytest.mark.asyncio
async def test_router_applies_candidates_only_to_the_matching_transport():
    class Peer:
        def __init__(self): self.candidates = []
        async def addIceCandidate(self, candidate): self.candidates.append(candidate)

    router = VoiceRouter()
    pc = Peer()
    router.peers['alice'] = pc
    router.generations['alice'] = 9
    candidate = {'candidate': 'candidate:1 1 udp 2130706431 127.0.0.1 50000 typ host', 'sdpMid': '0', 'sdpMLineIndex': 0}
    await router.add_ice('alice', 8, candidate)
    await router.add_ice('bob', 9, candidate)
    assert pc.candidates == []
    await router.add_ice('alice', 9, candidate)
    await router.add_ice('alice', 9, None)
    assert len(pc.candidates) == 2
    assert pc.candidates[0].ip == '127.0.0.1'
    assert pc.candidates[0].sdpMid == '0'
    assert pc.candidates[1] is None
    with pytest.raises(ValueError):
        await router.add_ice('alice', 9, {'candidate': 'not-an-ice-candidate', 'sdpMid': '0'})


def test_ice_payload_cannot_choose_another_player_or_grow_unbounded():
    with pytest.raises(ValidationError):
        Message.model_validate({'type': 'voice_ice', 'generation': 1, 'to': 'another-player'})
    with pytest.raises(ValidationError):
        Message.model_validate({'type': 'voice_ice', 'candidate': {'candidate': 'x' * 2049}})
