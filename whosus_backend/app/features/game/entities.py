from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from .types import Challenge


@dataclass
class Player:
    id: str
    name: str
    color: str
    hat: str = "sprout"
    x: float = 0
    z: float = 2
    role: str = "crew"
    alive: bool = True
    connected: bool = True
    ready: bool = False
    tasks: list[str] = field(default_factory=list)
    done: set[str] = field(default_factory=set)
    inputs: deque[tuple[int, float, float]] = field(default_factory=lambda: deque(maxlen=20))
    ack: int = 0
    last_seq: int = 0
    kill_at: float = 0
    emergency: int = 1
    vent: int = -1
    challenge: Challenge | None = None
    last_chat: float = -100
    muted: bool = True
    deafened: bool = False
    disconnected_at: float = 0
    animation_until: float = 0
    outfit: str = "none"
    visor: str = "none"
    accessory: str = "none"
    boots: str = "original"
    seat: int = -1
    seated_until: float = 0
