"""Temporary room-owned bots. Every action uses the regular game authority."""

from __future__ import annotations

import math
import secrets
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .entities import Player
from .navigation import Point, find_path
from .world import DT, SPEED, STATIONS, distance

if TYPE_CHECKING:
    from .service import Room


@dataclass
class Bot:
    path: list[Point] = field(default_factory=list)
    destination: Point | None = None
    plan_at: float = 0
    action_at: float = 0
    idle_until: float = 0
    round: int = -1
    phase: str = ""
    task_id: str = ""


def fill_bots(room: Room) -> None:
    names = {p.name.casefold() for p in room.players.values()}
    number = 1
    while len(room.players) < room.capacity:
        while f"bot-{number}" in names:
            number += 1
        name = f"bot-{number}"
        player = room.add(name, color=(number - 1) % 12)
        player.bot = True
        player.ready = True
        room.bots[player.id] = Bot()
        names.add(name)
    for player in room.players.values():
        if player.bot:
            player.ready = True


def walk(room: Room, player: Player, bot: Bot, goal: Point, radius: float = 0.2) -> bool:
    if math.hypot(player.x - goal[0], player.z - goal[1]) <= radius:
        bot.path.clear()
        return True
    if not player.alive:
        bot.path = [goal]
    elif (
        bot.destination is None
        or (math.dist(bot.destination, goal) > 0.75 and room.now >= bot.plan_at)
        or (not bot.path and room.now >= bot.plan_at)
    ):
        bot.path = find_path(
            (player.x, player.z),
            goal,
            room.phase == "lobby",
            tuple(
                (q.x, q.z)
                for q in room.players.values()
                if q.id != player.id and q.alive and q.connected and q.vent < 0
            ),
        )
        bot.destination = goal
        bot.plan_at = room.now + 1
    while bot.path and math.hypot(player.x - bot.path[0][0], player.z - bot.path[0][1]) < 0.08:
        bot.path.pop(0)
    if bot.path:
        x, z = bot.path[0]
        dx, dz = x - player.x, z - player.z
        scale = max(math.hypot(dx, dz), SPEED * DT * room.movement_speed)
        room.enqueue(player, player.last_seq + 1, dx / scale, dz / scale, room.round)
    return False


def wander(room: Room, player: Player, bot: Bot) -> None:
    if room.now < bot.idle_until:
        return
    if bot.destination is None:
        if room.phase == "lobby":
            bot.destination = secrets.choice([(-4.0, -2.0), (0.0, 2.0), (4.0, 3.0), (-3.0, 3.0)])
        else:
            station = secrets.choice(STATIONS)
            bot.destination = float(station["x"]), float(station["z"])
        bot.path = find_path((player.x, player.z), bot.destination, room.phase == "lobby")
    if walk(room, player, bot, bot.destination, 0.2 if room.phase == "lobby" else 1.9):
        bot.destination = None
        bot.idle_until = room.now + 1.5


def crew(room: Room, player: Player, bot: Bot) -> None:
    challenge = player.challenge
    if challenge:
        if room.now >= bot.action_at:
            value = (
                challenge["sequence"][challenge["step"]]
                if challenge["kind"] == "sequence"
                else None
            )
            room.action(player.id, "task_step", challenge["nonce"], value)
            bot.action_at = room.now + 0.6
            if player.challenge is None:
                bot.destination = None
                bot.path.clear()
                bot.task_id = ""
        return
    if player.alive and room.sabotage_until:
        if walk(room, player, bot, (2.0, -12.0), 1.8):
            room.action(player.id, "repair")
        return
    tasks = [s for s in STATIONS if s["id"] in player.tasks and s["id"] not in player.done]
    if not tasks:
        wander(room, player, bot)
        return
    if bot.task_id not in {s["id"] for s in tasks}:
        nearby = sorted(tasks, key=lambda s: math.hypot(player.x - s["x"], player.z - s["z"]))[:3]
        bot.task_id = secrets.choice(nearby)["id"]
        bot.destination = None
        bot.path.clear()
    task = next(s for s in tasks if s["id"] == bot.task_id)
    if walk(room, player, bot, (float(task["x"]), float(task["z"])), 1.9):
        room.action(player.id, "task_begin", task["id"])
        bot.action_at = room.now + (6 if task["category"] == "long" else 4)


def killer(room: Room, player: Player, bot: Bot) -> None:
    targets = [
        q
        for q in room.players.values()
        if q.alive
        and q.connected
        and q.role == "crew"
        and q.vent < 0
        and room.now >= q.animation_until
    ]
    if not targets or room.now + 3 < player.kill_at:
        wander(room, player, bot)
        return
    target = min(targets, key=lambda q: distance(player, q))
    if distance(player, target) <= 1.8 and room.now >= player.kill_at:
        room.action(player.id, "kill", target.id)
        bot.destination = None
        bot.path.clear()
    else:
        walk(room, player, bot, (target.x, target.z), 1.3)


def tick_bots(room: Room) -> None:
    if not any(p.connected and not p.bot for p in room.players.values()):
        return
    for pid in list(room.bots):
        player = room.players.get(pid)
        if player is None:
            room.bots.pop(pid, None)
            continue
        bot = room.bots[pid]
        if bot.round != room.round or bot.phase != room.phase:
            bot = room.bots[pid] = Bot(round=room.round, phase=room.phase, action_at=room.now + 1.5)
        if room.phase == "lobby":
            player.ready = True
            if player.seat < 0:
                wander(room, player, bot)
        elif room.phase == "voting" and player.alive:
            if pid not in room.votes and room.now >= bot.action_at:
                room.action(pid, "vote", "skip")
        elif room.phase == "playing" and room.now >= player.animation_until:
            if player.role == "crew":
                crew(room, player, bot)
            elif player.alive:
                killer(room, player, bot)
