import asyncio
import contextlib
import json
import logging
import secrets
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..connection import Connection
from ..game import GameError, Room
from ..models import Message
from ..config import ORIGINS, rooms, sessions, voice

log = logging.getLogger('whosus')
router = APIRouter()


@router.websocket('/ws')
async def socket(ws: WebSocket):
    if ws.headers.get('origin') not in ORIGINS:
        await ws.close(code=1008)
        return
    await ws.accept()
    conn = Connection(ws)
    writer = asyncio.create_task(conn.writer())
    session = None
    bucket = 100.
    last = time.monotonic()

    try:
        while True:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=45)
            now = time.monotonic()
            bucket = min(100, bucket + (now - last) * 45)
            last = now
            if len(raw) > 20000 or bucket < 1:
                await ws.close(code=1008)
                break
            bucket -= 1
            try:
                m = Message.model_validate_json(raw)
                if m.type == 'ping':
                    conn.send({'type': 'pong'})
                    continue
                if m.type in ('create', 'join', 'resume'):
                    if session:
                        raise GameError('Already in a room.')
                    if m.type == 'resume':
                        session = sessions.get(m.token)
                        if not session or session['pid'] not in session['room'].players:
                            session = None
                            conn.send({
                                'type': 'expired',
                                'message': 'Your session expired. Join a new expedition.',
                            })
                            continue
                        old = session['conn']
                        if old:
                            old.closed = True
                            await old.ws.close(code=4001)
                        await voice.close(session['pid'])
                    else:
                        if len(sessions) >= 1000:
                            raise GameError('Server is at capacity.')
                        if m.type == 'create':
                            code = ''.join(
                                secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
                                for _ in range(6)
                            )
                            while code in rooms:
                                code = ''.join(
                                    secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
                                    for _ in range(6)
                                )
                            room = Room(
                                code, m.public, m.capacity, m.killers,
                                m.kill_cooldown, m.discussion,
                                m.movement_speed, m.voting, m.emergency_meetings, m.meeting_cooldown,
                            )
                            rooms[code] = room
                        else:
                            room = rooms.get(m.code.upper())
                            if not room:
                                raise GameError('No room with that code. Check it and try again.')
                        name = ''.join(c for c in m.name.strip() if c.isprintable())
                        if not name:
                            raise GameError('Choose an explorer name.')
                        p = room.add(name, m.color, m.hat, m.outfit, m.visor, m.accessory, m.boots)
                        token = secrets.token_urlsafe(32)
                        session = {'room': room, 'pid': p.id, 'token': token, 'conn': None}
                        sessions[token] = session
                    session['conn'] = conn
                    p = session['room'].players[session['pid']]
                    p.connected = True
                    p.muted = True
                    p.inputs.clear()
                    p.last_seq = p.ack
                    conn.send({
                        'type': 'joined',
                        'id': p.id,
                        'token': session['token'],
                        'iceServers': voice.ice_servers,
                    })
                    continue
                if not session or session['conn'] is not conn:
                    raise GameError('Join a room first.')
                room, pid = session['room'], session['pid']
                p = room.players[pid]
                if m.type == 'input':
                    room.enqueue(p, m.seq, m.dx, m.dz, m.round)
                elif m.type == 'action':
                    room.action(pid, m.action, m.target, m.value)
                    if m.action == 'kick':
                        for token, removed in list(sessions.items()):
                            if removed['room'] is room and removed['pid'] == m.target:
                                if removed['conn']:
                                    removed['conn'].send({'type': 'kicked', 'message': 'The host removed you from the room.'})
                                removed['conn'] = None
                                sessions.pop(token, None)
                        await voice.close(m.target)
                elif m.type == 'chat':
                    text = ''.join(c for c in m.text.strip() if c.isprintable())
                    if not text:
                        continue
                    msg = room.add_chat(pid, text)
                    for s in sessions.values():
                        if s['room'] is room and s['pid'] in msg['recipients'] and s['conn']:
                            s['conn'].send({
                                'type': 'chat',
                                'message': {k: v for k, v in msg.items() if k != 'recipients'},
                            })
                elif m.type == 'voice_state':
                    p.muted = m.muted
                    p.deafened = m.deafened
                    voice.state(pid, m.enabled, m.talking and not m.muted)
                elif m.type == 'voice_signal':
                    if not voice.can_signal(room, pid, m.to):
                        continue
                    target = next((s for s in sessions.values()
                                   if s['room'] is room and s['pid'] == m.to
                                   and s['conn'] and not s['conn'].closed), None)
                    if not target:
                        continue
                    signal = {'type': 'voice_signal', 'from': pid, 'kind': m.kind, 'generation': m.generation}
                    if m.kind in ('offer', 'answer'):
                        if 'm=video' in m.sdp or m.sdp.count('m=audio') != 1 or 'm=application' in m.sdp:
                            raise GameError('Only one audio channel is supported.')
                        signal['sdp'] = m.sdp
                    elif m.kind == 'ice':
                        candidate = m.candidate.model_dump() if m.candidate else None
                        if candidate and candidate['candidate']:
                            if not candidate['candidate'].startswith('candidate:'):
                                raise GameError('Invalid ICE candidate.')
                            if candidate['sdpMid'] is None and candidate['sdpMLineIndex'] is None:
                                raise GameError('ICE candidate is missing its audio channel.')
                        signal['candidate'] = candidate
                    target['conn'].send(signal)
                elif m.type == 'leave':
                    p.connected = False
                    p.disconnected_at = now - 91
                    p.muted = True
                    if room.phase not in ('lobby', 'gameover'):
                        p.alive = False
                        if p.role == 'crew':
                            p.done.update(p.tasks)
                        room.check_win()
                    await voice.close(pid)
                    session['conn'] = None
                    sessions.pop(session['token'], None)
                    session = None
                    conn.send({'type': 'left'})
            except (ValidationError, GameError, json.JSONDecodeError) as e:
                conn.send({
                    'type': 'error',
                    'message': str(e) if isinstance(e, GameError) else 'Invalid request.',
                })
    except (WebSocketDisconnect, asyncio.TimeoutError, RuntimeError):
        pass
    finally:
        if session and session['conn'] is conn:
            session['conn'] = None
            p = session['room'].players.get(session['pid'])
            if p:
                p.connected = False
                p.disconnected_at = time.monotonic()
                p.muted = True
                p.inputs.clear()
            await voice.close(session['pid'])
        conn.closed = True
        writer.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await writer
