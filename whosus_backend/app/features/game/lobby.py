from __future__ import annotations

import math
from typing import TYPE_CHECKING

from app.core.security import clean_text
from app.features.appearance.catalog import COSMETICS

from .entities import Player
from .exceptions import GameError
from .types import ActionValue
from .validation import integer, number
from .world import COLORS, LOBBY_SEATS, SEAT_RANGE

if TYPE_CHECKING:
    from .service import Room


def handle_lobby_action(
    room: Room, p: Player, action: str, target: str, value: ActionValue
) -> bool:
    pid = p.id
    if action in ("sit", "stand"):
        room.require(room.phase == "lobby", "Use the chairs in the waiting room.")
        if action == "stand":
            room.stand(p)
            return True
        room.require(p.seat < 0, "You are already sitting.")
        chair = integer(value, 0, len(LOBBY_SEATS) - 1, "Choose a chair.")
        room.require(
            not any(q.seat == value for q in room.players.values()), "That chair is occupied."
        )
        x, z = LOBBY_SEATS[chair]
        room.require(math.hypot(p.x - x, p.z - z) <= SEAT_RANGE, "Walk closer to the chair to sit.")
        p.seat = chair
        p.x, p.z = x, z
        p.seated_until = 0
        p.inputs.clear()
        return True
    if action == "settings":
        room.require(pid == room.host, "Only the host can modify mission settings.")
        room.require(room.phase == "lobby", "Change mission settings in the waiting room.")
        numeric = {
            "capacity": ("capacity", 4, 12),
            "killers": ("killers", 1, 3),
            "killCooldown": ("kill_cooldown", 10, 60),
            "discussion": ("discussion", 10, 90),
            "voting": ("voting", 10, 120),
            "emergencyMeetings": ("emergency_meetings", 0, 3),
            "meetingCooldown": ("meeting_cooldown", 10, 60),
        }
        if target in numeric:
            attr, low, high = numeric[target]
            setting = integer(value, low, high, "Invalid setting value.")
            if target == "capacity":
                room.require(
                    setting >= len(room.players), "Remove players before reducing capacity."
                )
            setattr(room, attr, setting)
        elif target == "movementSpeed":
            room.movement_speed = number(value, 0.5, 2, "Speed must be between 0.5 and 2.")
        elif target in ("public", "visualTasks"):
            room.require(type(value) is bool, "Choose on or off.")
            setattr(room, "public" if target == "public" else "visual_tasks", value)
        elif target == "taskBarMode":
            if not isinstance(value, str) or value not in ("always", "meetings", "never"):
                raise GameError("Unknown task bar mode.")
            room.task_bar_mode = value
        else:
            raise GameError("Unknown setting.")
        for q in room.players.values():
            q.ready = False
            q.inputs.clear()
        return True
    if action == "customize":
        room.require(room.phase == "lobby", "Change your outfit in the waiting room.")
        room.require(target in COSMETICS and value in COSMETICS[target], "Unknown wardrobe item.")
        setattr(p, target, value)
        return True
    if action == "color":
        room.require(room.phase == "lobby", "Change colors in the waiting room.")
        color = integer(value, 0, len(COLORS) - 1, "Unknown color.")
        room.require(
            not any(q.id != pid and q.color == COLORS[color] for q in room.players.values()),
            "That color is already taken.",
        )
        p.color = COLORS[color]
        return True
    if action == "kick":
        room.require(
            pid == room.host and room.phase == "lobby",
            "Only the host can kick players in the waiting room.",
        )
        room.require(target != pid and target in room.players, "Choose another player to kick.")
        room.players.pop(target)
        return True
    if action == "rename":
        room.require(room.phase == "lobby", "Change your name in the waiting room.")
        name = clean_text(target)
        room.require(1 <= len(name) <= 18, "Choose a name with 1–18 characters.")
        p.name = name
        return True
    if action == "ready":
        room.require(room.phase == "lobby", "Already launched.")
        p.ready = not p.ready
        return True
    if action == "start":
        room.start(pid)
        return True
    if action == "rematch":
        room.require(
            pid == room.host and room.phase == "gameover",
            "Only the host can return everyone to the lobby.",
        )
        room.phase = "lobby"
        room.bodies.clear()
        room.votes.clear()
        room.eliminations.clear()
        for i, q in enumerate(room.players.values()):
            q.ready = False
            q.alive = True
            q.role = "crew"
            q.vent = -1
            q.x = (i % 4 - 1.5) * 1.1
            q.z = 2 + i // 4 * 0.6
            q.challenge = None
            q.animation_until = 0
            q.seat = -1
            q.seated_until = 0
            q.inputs.clear()
        return True
    return False
