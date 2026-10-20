from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING

from .entities import Player
from .types import CharacterSnapshot, EliminationSnapshot, PlayerSnapshot, Snapshot
from .world import STATIONS

if TYPE_CHECKING:
    from .service import Room


def character_snapshot(player: Player) -> CharacterSnapshot:
    return {
        "id": player.id,
        "name": player.name,
        "color": player.color,
        "hat": player.hat,
        "outfit": player.outfit,
        "visor": player.visor,
        "accessory": player.accessory,
        "boots": player.boots,
        "x": player.x,
        "z": player.z,
    }


def build_snapshot(room: Room, pid: str) -> Snapshot:
    me = room.players[pid]
    players: list[PlayerSnapshot] = []
    for p in room.players.values():
        if p.id != pid and room.phase not in (
            "lobby",
            "gameover",
            "discussion",
            "voting",
            "results",
        ):
            if (not p.alive and me.alive) or p.vent >= 0:
                continue
        row: PlayerSnapshot = {
            "id": p.id,
            "name": p.name,
            "color": p.color,
            "hat": p.hat,
            "outfit": p.outfit,
            "visor": p.visor,
            "accessory": p.accessory,
            "boots": p.boots,
            "x": p.x,
            "z": p.z,
            "alive": p.alive,
            "connected": p.connected,
            "ready": p.ready,
            "ack": p.ack,
            "seat": p.seat,
            "voted": p.id in room.votes,
        }
        if p.id == pid or room.phase == "gameover" or me.role == "killer" and p.role == "killer":
            row["role"] = p.role
        players.append(row)
    crew = [p for p in room.players.values() if p.role == "crew"]
    real_progress = sum(len(p.done) for p in crew) / max(1, sum(len(p.tasks) for p in crew))
    if room.phase in ("discussion", "voting", "results", "gameover"):
        room.meeting_progress = real_progress

    if room.task_bar_mode == "always":
        prog = real_progress
    elif room.task_bar_mode == "meetings":
        prog = room.meeting_progress
    else:
        prog = -1.0

    room.active_visuals = [v for v in room.active_visuals if room.now < v["until"]]
    eliminations: list[EliminationSnapshot] = [
        {
            "id": e["id"],
            "style": e["style"],
            "attacker": e["attacker"],
            "victim": e["victim"],
            "elapsed": room.now - e["started"],
        }
        for e in room.eliminations
        if pid in e["recipients"] and room.now - e["started"] < 2.4
    ]
    return {
        "code": room.code,
        "host": room.host,
        "public": room.public,
        "capacity": room.capacity,
        "movementSpeed": room.movement_speed,
        "rules": {
            "killCooldown": room.kill_cooldown,
            "discussion": room.discussion,
            "voting": room.voting,
            "emergencyMeetings": room.emergency_meetings,
            "meetingCooldown": room.meeting_cooldown,
        },
        "killers": room.killers,
        "phase": room.phase,
        "round": room.round,
        "players": players,
        "bodies": room.bodies,
        "remaining": max(0, room.deadline - room.now),
        "result": room.result,
        "winner": room.winner,
        "sabotage": max(0, room.sabotage_until - room.now),
        "killCooldown": max(0, me.kill_at - room.now),
        "sabotageCooldown": max(0, room.sabotage_at - room.now),
        "meetingCooldown": max(0, room.meeting_at - room.now),
        "emergency": me.emergency,
        "vent": me.vent,
        "tasks": [{**s, "done": s["id"] in me.done} for s in STATIONS if s["id"] in me.tasks],
        "challenge": me.challenge,
        "progress": prog,
        "taskBarMode": room.task_bar_mode,
        "visualTasks": room.visual_tasks,
        "visuals": [v for v in room.active_visuals if v["player"] == pid],
        "tally": dict(Counter(room.votes.values()))
        if room.phase in ("results", "gameover")
        else {},
        "population": len(room.players),
        "eliminations": eliminations,
        "movementLock": max(0, me.animation_until - room.now),
    }
