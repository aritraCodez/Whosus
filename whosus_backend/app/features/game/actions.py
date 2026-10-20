from __future__ import annotations

import math
import secrets
from typing import TYPE_CHECKING

from .entities import Player
from .exceptions import GameError
from .snapshot import character_snapshot
from .types import ActionValue, Challenge
from .validation import integer
from .world import STATIONS, VENTS, distance

if TYPE_CHECKING:
    from .service import Room


def handle_match_action(
    room: Room, p: Player, action: str, target: str, value: ActionValue
) -> None:
    pid = p.id
    if action == "vote":
        room.require(
            room.phase == "voting" and p.alive and pid not in room.votes, "You cannot vote now."
        )
        room.require(
            target == "skip" or target in room.players and room.players[target].alive,
            "Invalid vote.",
        )
        room.votes[pid] = target
        return
    room.require(room.phase == "playing", "Wait for exploration to begin.")
    room.require(room.now >= p.animation_until, "Elimination animation is finishing.")
    if action == "kill":
        q = room.players.get(target)
        if q is None:
            raise GameError("No eligible target in range, or eliminator cooling down.")
        room.require(
            p.alive
            and p.role == "killer"
            and p.vent < 0
            and room.now >= p.kill_at
            and q is not None
            and q.alive
            and q.role == "crew"
            and q.vent < 0
            and distance(p, q) <= 1.8,
            "No eligible target in range, or eliminator cooling down.",
        )
        room.require(room.now >= q.animation_until, "That explorer is busy.")
        style = secrets.randbelow(4) if value is None or value == -1 else value
        style = integer(style, 0, 3, "Unknown elimination style.")
        room.eliminations.append(
            {
                "id": secrets.token_hex(8),
                "started": room.now,
                "style": style,
                "attacker": character_snapshot(p),
                "victim": character_snapshot(q),
                "recipients": [
                    v.id
                    for v in room.players.values()
                    if v.id in (p.id, q.id) or distance(v, q) <= 6
                ],
            }
        )
        p.animation_until = q.animation_until = room.now + 2.4
        p.inputs.clear()
        q.inputs.clear()
        q.alive = False
        q.challenge = None
        room.bodies.append({"id": q.id, "x": q.x, "z": q.z, "color": q.color})
        p.kill_at = room.now + room.kill_cooldown
        room.check_win()
    elif action == "report":
        room.meeting(p, target)
    elif action == "meeting":
        room.meeting(p)
    elif action == "sabotage":
        room.require(
            p.alive
            and p.role == "killer"
            and room.now >= room.sabotage_at
            and not room.sabotage_until,
            "Sabotage is unavailable.",
        )
        room.sabotage_until = room.now + 55
        room.sabotage_at = room.now + 80
    elif action == "repair":
        room.require(
            p.alive and p.vent < 0 and room.sabotage_until and math.hypot(p.x - 2, p.z + 12) <= 2,
            "Approach the reactor console to repair it.",
        )
        room.sabotage_until = 0
    elif action == "vent":
        room.require(p.role == "killer" and p.alive, "Only killers can use service ducts.")
        if p.vent >= 0:
            if target == "next":
                p.vent = (p.vent + 1) % len(VENTS)
                p.x, p.z = VENTS[p.vent]
            else:
                p.vent = -1
        else:
            idx = min(
                range(len(VENTS)), key=lambda i: math.hypot(p.x - VENTS[i][0], p.z - VENTS[i][1])
            )
            room.require(
                math.hypot(p.x - VENTS[idx][0], p.z - VENTS[idx][1]) <= 1.7,
                "Approach a service duct.",
            )
            p.vent = idx
            p.x, p.z = VENTS[idx]
        p.inputs.clear()
    elif action == "task_cancel":
        p.challenge = None
    elif action == "task_begin":
        s = next((s for s in STATIONS if s["id"] == target), None)
        if s is None:
            raise GameError("Approach an unfinished task station.")
        room.require(
            p.role == "crew"
            and target in p.tasks
            and target not in p.done
            and s
            and math.hypot(p.x - s["x"], p.z - s["z"]) <= 2.5,
            "Approach an unfinished task station.",
        )
        sequence = [secrets.randbelow(4) for _ in range(4)] if s.get("kind") == "sequence" else []
        challenge: Challenge = {
            "id": s["id"],
            "name": s["name"],
            "room": s["room"],
            "x": s["x"],
            "z": s["z"],
            "category": s["category"],
            "kind": s["kind"],
            "visual": s["visual"],
            "nonce": secrets.token_hex(12),
            "sequence": sequence,
            "step": 0,
            "started": room.now,
        }
        if "visual_kind" in s:
            challenge["visual_kind"] = s["visual_kind"]
        p.challenge = challenge
    elif action == "task_step":
        c = p.challenge
        if c is None:
            raise GameError("This task has expired.")
        room.require(
            c and target == c["nonce"] and math.hypot(p.x - c["x"], p.z - c["z"]) <= 2.5,
            "This task has expired.",
        )
        if c.get("kind") == "sequence":
            room.require(type(value) is int and 0 <= value < 4, "Choose a circuit symbol.")
            if value != c["sequence"][c["step"]]:
                c["step"] = 0
                c["started"] = room.now
                c["error"] = "Wrong symbol. Start matching again from the first symbol."
                return
            room.require(
                room.now - c["started"] >= (c["step"] + 1) * 0.3,
                "Slow down and let the circuit settle.",
            )
            c.pop("error", None)
            c["step"] += 1
            if c["step"] == len(c["sequence"]):
                complete_task(room, p, c)
        else:
            complete_task(room, p, c)
    else:
        raise GameError("Unknown action.")


def complete_task(room: Room, player: Player, challenge: Challenge) -> None:
    player.done.add(challenge["id"])
    player.challenge = None
    if room.visual_tasks:
        room.active_visuals.append(
            {
                "player": player.id,
                "task": challenge["id"],
                "kind": challenge.get("visual_kind", "glow"),
                "until": room.now + 4,
            }
        )
    room.check_win()
