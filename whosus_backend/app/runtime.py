"""One process's temporary matches and resumable game sessions.

No accounts or durable user data live here. Restarting invalidates all sessions.
"""

import asyncio
from dataclasses import dataclass, field

from app.features.game.service import Room
from app.features.realtime.connection import Connection
from app.features.voice.service import VoiceService


@dataclass
class Session:
    room: Room
    pid: str
    token: str = field(repr=False)
    conn: Connection | None = None
    takeover: asyncio.Lock = field(default_factory=asyncio.Lock)


@dataclass
class Runtime:
    voice: VoiceService
    simulation_failed: bool = False
    rooms: dict[str, Room] = field(default_factory=dict)
    sessions: dict[str, Session] = field(default_factory=dict, repr=False)

    def recipient(self, room: Room, pid: str) -> Connection | None:
        for session in self.sessions.values():
            if session.room is room and session.pid == pid:
                if session.conn and not session.conn.closed:
                    return session.conn
        return None

    async def shutdown(self) -> None:
        try:
            await asyncio.gather(*(s.conn.close(1012) for s in self.sessions.values() if s.conn))
        finally:
            await self.voice.shutdown()
            self.rooms.clear()
            self.sessions.clear()
