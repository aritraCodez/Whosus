from __future__ import annotations

import secrets
import time
from typing import TYPE_CHECKING

from .types import ChatRecord
from .world import distance

if TYPE_CHECKING:
    from .service import Room


def voice_gain(room: Room, source: str, recipient: str) -> float:
    a, b = room.players.get(source), room.players.get(recipient)
    if not a or not b or a is b or not a.connected or not b.connected or a.muted or b.deafened:
        return 0.0
    if room.phase in ("lobby", "gameover"):
        return 1.0
    if a.alive != b.alive:
        return 0.0
    if not a.alive or room.phase in ("discussion", "voting", "results"):
        return 1.0
    if room.phase == "reveal" or a.vent >= 0 or b.vent >= 0:
        return 0.0
    d = distance(a, b)
    return max(0.0, min(1.0, (9 - d) / 6)) ** 2


def can_chat(room: Room, source: str, recipient: str) -> bool:
    a, b = room.players[source], room.players[recipient]
    if room.phase in ("lobby", "gameover"):
        return True
    if a.alive != b.alive:
        return False
    return True


def add_chat(room: Room, pid: str, text: str) -> ChatRecord:
    p = room.players[pid]
    room.require(room.can_chat(pid, pid), "You cannot chat right now.")
    room.require(room.now - p.last_chat >= 1, "Please wait a moment between messages.")
    p.last_chat = room.now
    msg: ChatRecord = {
        "id": secrets.token_hex(6),
        "name": p.name,
        "player": pid,
        "text": text,
        "time": int(time.time() * 1000),
        "channel": "ghost" if not p.alive and room.phase != "gameover" else room.phase,
        "recipients": [i for i in room.players if room.can_chat(pid, i)],
    }
    room.chat.append(msg)
    return msg
