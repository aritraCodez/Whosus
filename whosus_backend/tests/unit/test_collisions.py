import math

import pytest

from app.features.game.service import Room
from app.features.game.world import PLAYER_SPACING, STATIONS, VENTS, move, open_position, walkable


@pytest.mark.parametrize("speed", [0.5, 1, 2])
@pytest.mark.parametrize("station", STATIONS, ids=lambda s: s["id"])
def test_console_blocks_body_but_remains_in_task_range(station, speed):
    x, z = open_position(station["x"], station["z"])
    for _ in range(40):
        x, z = move(x, z, station["x"] - x, station["z"] - z, speed=speed)
        assert walkable(x, z)
    assert math.hypot(x - station["x"], z - station["z"]) <= 2.5
    assert abs(x - station["x"]) >= 1.11 or abs(z - station["z"]) >= 0.96


@pytest.mark.parametrize("speed", [0.5, 1, 2])
def test_players_stop_before_other_bodies_and_can_slide_away(speed):
    x, z = 0.0, 2.0
    for _ in range(50):
        x, z = move(x, z, 1, 0, speed=speed, blockers=((2, 2),))
        assert math.hypot(x - 2, z - 2) >= PLAYER_SPACING
    before = x, z
    x, z = move(x, z, 0, 1, speed=speed, blockers=((2, 2),))
    assert z > before[1]
    assert move(2, 2, 1, 0, blockers=((2, 2),))[0] > 2  # Can escape old overlaps.
    assert move(2, 2, 1, 0, ghost=True, blockers=((2, 2),))[0] > 2


@pytest.mark.parametrize("count", range(4, 13))
def test_match_spawns_do_not_intersect_consoles_or_players(count):
    room = Room("SOLID", capacity=count)
    players = [room.add(str(i)) for i in range(count)]
    for p in players:
        p.ready = True
    room.start(room.host)
    for i, p in enumerate(players):
        assert walkable(p.x, p.z)
        assert all(math.hypot(p.x - q.x, p.z - q.z) >= PLAYER_SPACING for q in players[i + 1 :])


def test_duct_exits_find_free_space():
    for x, z in VENTS:
        a, b = open_position(x, z, blockers=((x, z),))
        assert walkable(a, b)
        assert math.hypot(a - x, b - z) >= PLAYER_SPACING


def test_server_resolves_two_players_moving_toward_each_other():
    room = Room("HEADON")
    players = [room.add(str(i)) for i in range(4)]
    for p in players:
        p.ready = True
    room.start(room.host)
    room.tick(room.deadline)
    a, b = players[:2]
    a.x, a.z, b.x, b.z = 0, 2, 3, 2
    for i, p in enumerate(players[2:]):
        p.x, p.z = -10 + i * 2, 0
    for seq in range(1, 51):
        room.enqueue(a, seq, 1, 0, room.round)
        room.enqueue(b, seq, -1, 0, room.round)
        room.tick(room.now + 0.05)
        assert math.hypot(a.x - b.x, a.z - b.z) >= PLAYER_SPACING
        assert a.ack == b.ack == seq
