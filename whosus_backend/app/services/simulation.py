import asyncio
import time

from app.core.limits import SESSION_RETENTION
from app.features.game.world import DT
from app.features.realtime.schemas import SnapshotEvent
from app.runtime import Runtime


def tick(runtime: Runtime, now: float) -> None:
    """Advance authority, expire temporary state, and queue recipient snapshots."""
    for code, room in list(runtime.rooms.items()):
        room.tick(now)
        for pid, player in list(room.players.items()):
            if not player.connected and now - player.disconnected_at > SESSION_RETENTION:
                if room.phase in ("lobby", "gameover"):
                    room.players.pop(pid, None)
                    for token, session in list(runtime.sessions.items()):
                        if session.pid == pid:
                            runtime.sessions.pop(token, None)
        humans = [p for p in room.players.values() if not p.bot]
        if not any(p.connected for p in humans) and all(
            now - p.disconnected_at > SESSION_RETENTION for p in humans
        ):
            runtime.rooms.pop(code, None)
            for token, session in list(runtime.sessions.items()):
                if session.room is room:
                    runtime.sessions.pop(token, None)
            continue
        if room.host not in room.players or not room.players[room.host].connected:
            room.host = next(
                (p.id for p in room.players.values() if p.connected and not p.bot), room.host
            )
        for session in list(runtime.sessions.values()):
            if session.room is room and session.conn and session.pid in room.players:
                session.conn.send(
                    SnapshotEvent(
                        room=room.snapshot(session.pid),
                        speaking=runtime.voice.speaking(room, session.pid),
                        voicePeers=runtime.voice.peers(room, session.pid),
                    )
                )


async def simulate(runtime: Runtime) -> None:
    next_tick = time.monotonic()
    while True:
        now = time.monotonic()
        tick(runtime, now)
        next_tick += DT
        if next_tick < now - DT:
            next_tick = now + DT
        await asyncio.sleep(max(0, next_tick - time.monotonic()))
