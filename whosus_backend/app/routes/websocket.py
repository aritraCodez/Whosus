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
from ..voice import ice_config

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
    media_task = None
    last_offer = -100.
    bucket = 100.
    last = time.monotonic()

    async def negotiate(s, message):
        try:
            answer = await voice.offer(s['room'], s['pid'], message.sdp, message.generation)
            if s['conn'] is not conn or s.get('voice_generation') != message.generation:
                return
            while s['voice_pending']:
                candidate = s['voice_pending'].pop(0)
                await voice.add_ice(s['pid'], message.generation, candidate)
            s['voice_ready'] = True
            conn.send({'type': 'voice_answer', 'sdp': answer, 'generation': message.generation})
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception('Voice negotiation failed')
            if s['conn'] is conn and s.get('voice_generation') == message.generation:
                await voice.close(s['pid'])
                conn.send({
                    'type': 'voice_error',
                    'generation': message.generation,
                    'message': 'Voice connection failed. Retry microphone and check network configuration.',
                })

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
                        p = room.add(name, m.color, m.hat)
                        token = secrets.token_urlsafe(32)
                        session = {'room': room, 'pid': p.id, 'token': token, 'conn': None}
                        sessions[token] = session
                    session['conn'] = conn
                    session['voice_generation'] = None
                    session['voice_pending'] = []
                    session['voice_ready'] = False
                    p = session['room'].players[session['pid']]
                    p.connected = True
                    p.muted = True
                    p.inputs.clear()
                    p.last_seq = p.ack
                    conn.send({
                        'type': 'joined',
                        'id': p.id,
                        'token': session['token'],
                        'iceServers': ice_config(voice.stun_urls),
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
                elif m.type == 'voice_offer':
                    if now - last_offer < 3:
                        conn.send({
                            'type': 'voice_error',
                            'generation': m.generation,
                            'message': 'Voice is still connecting. Wait a few seconds and retry.',
                        })
                        continue
                    if 'm=video' in m.sdp or m.sdp.count('m=audio') != 1 or 'm=application' in m.sdp:
                        conn.send({
                            'type': 'voice_error',
                            'generation': m.generation,
                            'message': 'Only one audio channel is supported.',
                        })
                        continue
                    if media_task and not media_task.done():
                        media_task.cancel()
                        with contextlib.suppress(asyncio.CancelledError):
                            await media_task
                    session['voice_generation'] = m.generation
                    session['voice_pending'] = []
                    session['voice_ready'] = False
                    last_offer = now
                    media_task = asyncio.create_task(negotiate(session, m))
                elif m.type == 'voice_ice':
                    if m.generation != session.get('voice_generation'):
                        continue
                    candidate = m.candidate.model_dump() if m.candidate else None
                    if (
                        candidate and candidate['candidate']
                        and candidate['sdpMid'] is None
                        and candidate['sdpMLineIndex'] is None
                    ):
                        raise GameError('ICE candidate is missing its audio channel.')
                    if session['voice_ready']:
                        try:
                            await voice.add_ice(pid, m.generation, candidate)
                        except ValueError:
                            raise GameError('Invalid ICE candidate.')
                    elif len(session['voice_pending']) < 64:
                        session['voice_pending'].append(candidate)
                    else:
                        raise GameError('Too many pending ICE candidates.')
                elif m.type == 'voice_stop':
                    if m.generation != session.get('voice_generation'):
                        continue
                    session['voice_generation'] = None
                    session['voice_pending'] = []
                    session['voice_ready'] = False
                    p.muted = True
                    if media_task and not media_task.done():
                        media_task.cancel()
                        with contextlib.suppress(asyncio.CancelledError):
                            await media_task
                    await voice.close(pid)
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
        if media_task and not media_task.done():
            media_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await media_task
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
