"""Room-scoped WebRTC signaling policy. Audio travels between browsers."""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING

from .types import IceServer, VoicePeer

if TYPE_CHECKING:
    from app.features.game.service import Room

import time


def ice_config(stun_urls: Sequence[str]) -> list[IceServer]:
    return [{"urls": url} for url in stun_urls]


class VoiceService:
    def __init__(self, stun_urls: Sequence[str] = ()) -> None:
        self.ice_servers = ice_config(stun_urls)
        self.enabled: set[str] = set()
        self.talking: dict[str, float] = {}

    def can_signal(self, room: Room, source: str, recipient: str) -> bool:
        a, b = room.players.get(source), room.players.get(recipient)
        return bool(
            a
            and b
            and a is not b
            and a.connected
            and b.connected
            and source in self.enabled
            and recipient in self.enabled
            and (room.phase in ("lobby", "gameover") or a.alive == b.alive)
        )

    def peers(self, room: Room, pid: str) -> list[VoicePeer]:
        return [
            {
                "id": other,
                "gain": room.voice_gain(other, pid),
                "sendGain": room.voice_gain(pid, other),
            }
            for other in room.players
            if self.can_signal(room, pid, other)
        ]

    def state(self, pid: str, enabled: bool, talking: bool) -> None:
        if enabled:
            self.enabled.add(pid)
        else:
            self.enabled.discard(pid)
        if enabled and talking:
            self.talking[pid] = time.monotonic()
        else:
            self.talking.pop(pid, None)

    def speaking(self, room: Room, pid: str) -> list[str]:
        now = time.monotonic()
        return [
            source
            for source, at in self.talking.items()
            if now - at < 0.7
            and source in room.players
            and (room.voice_gain(source, pid) > 0 or source == pid and not room.players[pid].muted)
        ]

    async def close(self, pid: str) -> None:
        self.enabled.discard(pid)
        self.talking.pop(pid, None)

    async def shutdown(self) -> None:
        self.enabled.clear()
        self.talking.clear()
