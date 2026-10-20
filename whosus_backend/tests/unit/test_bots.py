import math
import random

import pytest

from app.features.game.bots import Bot
from app.features.game.exceptions import GameError
from app.features.game.navigation import find_path
from app.features.game.service import Room
from app.features.game.world import DT, SPEED, STATIONS, walkable
from app.features.voice.service import VoiceService
from app.runtime import Runtime, Session
from app.services.simulation import tick


def match(role="crew", speed=1):
    room = Room("BOTAI", movement_speed=speed, kill_cooldown=10)
    host = room.add("Human")
    players = [host, room.add("bot-1"), room.add("Other"), room.add("Another")]
    for p in players:
        p.ready = True
    room.start(host.id)
    bot = players[1]
    bot.bot = True
    room.bots[bot.id] = Bot()
    for p in players:
        p.role = "crew"
    (host if role == "crew" else bot).role = "killer"
    room.tick(room.deadline)
    return room, host, bot


@pytest.mark.parametrize("capacity", [4, 8, 12])
def test_fill_bots_is_bounded_identifiable_unique_and_idempotent(capacity):
    room = Room("FILL", capacity=capacity)
    host = room.add("bot-1")  # A name alone never gives a human bot privileges.
    room.action(host.id, "fill_bots")
    assert len(room.players) == capacity
    bots = [p for p in room.players.values() if p.bot]
    assert len(bots) == len(room.bots) == capacity - 1
    assert all(p.ready and p.connected and p.muted for p in bots)
    assert {p.name for p in bots} == {f"bot-{i}" for i in range(2, capacity + 1)}
    assert len({p.color for p in room.players.values()}) == capacity
    assert not host.bot and not host.ready
    ids = set(room.players)
    room.action(host.id, "fill_bots")
    assert set(room.players) == ids
    payload = room.snapshot(host.id)["players"]
    assert all(p.get("bot", False) == (p["id"] != host.id) for p in payload)
    assert all("role" not in p for p in payload if p["id"] != host.id)


def test_only_lobby_host_can_fill_and_kicking_removes_bot_controller():
    room = Room("HOST")
    host = room.add("Host")
    guest = room.add("Guest")
    with pytest.raises(GameError, match="Only the host"):
        room.action(guest.id, "fill_bots")
    assert len(room.players) == 2
    room.action(host.id, "fill_bots")
    bot = next(p for p in room.players.values() if p.bot)
    room.action(host.id, "kick", bot.id)
    assert bot.id not in room.players and bot.id not in room.bots
    room.action(host.id, "fill_bots")
    room.phase = "playing"
    with pytest.raises(GameError, match="Only the host"):
        room.action(host.id, "fill_bots")


@pytest.mark.parametrize("station", STATIONS, ids=lambda s: s["id"])
def test_navigation_reaches_each_task_without_crossing_walls(station):
    path = find_path((2, 0), (station["x"], station["z"]))
    assert path and math.dist(path[-1], (station["x"], station["z"])) < 0.6
    assert all(walkable(x, z) for x, z in path)
    assert all(math.dist(a, b) == 0.5 for a, b in zip(path, path[1:], strict=False))


@pytest.mark.parametrize("speed", [0.5, 1, 2])
@pytest.mark.parametrize("seed", [1, 7, 42])
def test_crew_bot_walks_to_and_completes_all_real_tasks(speed, seed, monkeypatch):
    monkeypatch.setattr("app.features.game.bots.secrets.choice", random.Random(seed).choice)
    room, _, bot = match(speed=speed)
    for _ in range(20_000):
        previous = bot.x, bot.z
        room.tick(room.now + DT)
        assert math.dist(previous, (bot.x, bot.z)) <= SPEED * DT * speed + 1e-6
        assert walkable(bot.x, bot.z)
        if len(bot.done) == len(bot.tasks):
            break
    assert bot.done == set(bot.tasks), f"Bot stuck at {(bot.x, bot.z)}: {bot.done}"
    assert bot.challenge is None
    assert room.snapshot(bot.id)["progress"] > 0


def test_bot_task_waits_at_station_and_ghost_continues_tasks():
    room, _, bot = match()
    bot.x, bot.z = 2, -3
    bot.tasks = ["swipe"]
    room.tick(room.now + DT)
    assert bot.challenge and bot.challenge["id"] == "swipe"
    for _ in range(60):
        room.tick(room.now + DT)
    assert not bot.done
    bot.alive = False
    bot.tasks.append("garden")
    for _ in range(2000):
        room.tick(room.now + DT)
        if len(bot.done) == len(bot.tasks):
            break
    assert bot.done == set(bot.tasks)


def test_impostor_bot_pursues_crew_and_obeys_cooldown_range_and_animation():
    room, host, bot = match("killer")
    bot.x, bot.z = -12, -12
    host.x, host.z = 12, 12
    for p in room.players.values():
        if p not in (bot, host):
            p.x, p.z = 12, 10
    before = bot.kill_at
    for _ in range(3000):
        previous = bot.x, bot.z
        was_alive = {p.id: p.alive for p in room.players.values()}
        room.tick(room.now + DT)
        assert math.dist(previous, (bot.x, bot.z)) <= SPEED * DT + 1e-6
        assert walkable(bot.x, bot.z)
        victims = [p for p in room.players.values() if was_alive[p.id] and not p.alive]
        if victims:
            assert room.now >= before
            assert math.hypot(bot.x - victims[0].x, bot.z - victims[0].z) <= 1.8
            assert bot.kill_at == pytest.approx(room.now + room.kill_cooldown)
            locked = bot.x, bot.z
            room.tick(room.now + 0.5)
            assert (bot.x, bot.z) == locked
            break
    else:
        pytest.fail("Impostor never reached a victim")


@pytest.mark.parametrize("phase", ["reveal", "discussion", "results", "gameover"])
def test_bots_pause_actions_outside_exploration(phase):
    room, _, bot = match()
    room.phase = phase
    room.deadline = room.now + 100
    initial = bot.x, bot.z
    for _ in range(20):
        room.tick(room.now + DT)
    assert (bot.x, bot.z) == initial
    assert not bot.done and not bot.challenge


def test_bots_skip_vote_and_stay_ready_after_rule_changes_and_rematch():
    room, host, bot = match()
    room.phase = "voting"
    room.deadline = room.now + 30
    room.tick(room.now + DT)
    room.tick(room.now + 2)
    assert room.votes[bot.id] == "skip"
    room.phase = "gameover"
    room.action(host.id, "rematch")
    assert bot.ready and not host.ready
    room.action(host.id, "settings", "discussion", 30)
    assert bot.ready and not host.ready


def test_bot_room_expires_without_humans_and_bots_never_become_host():
    runtime = Runtime(voice=VoiceService())
    room = Room("EXPIRY")
    host = room.add("Host")
    room.action(host.id, "fill_bots")
    guest = next(iter(room.bots))
    # Free a slot for another real player who can inherit hosting.
    room.action(host.id, "kick", guest)
    human = room.add("Other human")
    runtime.rooms[room.code] = room
    runtime.sessions["token"] = Session(room, host.id, "token")
    host.connected = False
    host.disconnected_at = room.now
    tick(runtime, room.now + 1)
    assert room.host == human.id
    human.connected = False
    human.disconnected_at = room.now
    tick(runtime, room.now + 91)
    assert not runtime.rooms and not runtime.sessions
