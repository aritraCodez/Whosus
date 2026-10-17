import asyncio
import contextlib
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .game import DT
from .models import IceCandidate, Message
from .routes import api_router, websocket_router
from .state import ORIGINS, rooms, sessions, voice


async def simulation():
    next_tick = time.monotonic()
    while True:
        now = time.monotonic()
        for code, room in list(rooms.items()):
            room.tick(now)
            for pid, p in list(room.players.items()):
                if not p.connected and now - p.disconnected_at > 90:
                    if room.phase in ('lobby', 'gameover'):
                        room.players.pop(pid, None)
                        for token, session in list(sessions.items()):
                            if session['pid'] == pid:
                                sessions.pop(token, None)
            if (
                not any(p.connected for p in room.players.values())
                and all(now - p.disconnected_at > 90 for p in room.players.values())
            ):
                rooms.pop(code, None)
                for token, session in list(sessions.items()):
                    if session['room'] is room:
                        sessions.pop(token, None)
                continue
            if room.host not in room.players or not room.players[room.host].connected:
                room.host = next(
                    (p.id for p in room.players.values() if p.connected),
                    room.host,
                )
            for session in list(sessions.values()):
                if session['room'] is room and session['conn'] and session['pid'] in room.players:
                    session['conn'].send({
                        'type': 'snapshot',
                        'room': room.snapshot(session['pid']),
                        'speaking': voice.speaking(room, session['pid']),
                    })
        next_tick += DT
        if next_tick < now - DT:
            next_tick = now + DT
        await asyncio.sleep(max(0, next_tick - time.monotonic()))


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(simulation())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    await voice.shutdown()
    rooms.clear()
    sessions.clear()


app = FastAPI(title='WhoSus? authority', lifespan=lifespan)
app.include_router(api_router)
app.include_router(websocket_router)
