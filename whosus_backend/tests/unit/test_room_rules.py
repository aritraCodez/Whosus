import pytest
from pydantic import ValidationError

from app.features.game.exceptions import GameError
from app.features.game.service import Room
from app.features.game.world import DT, STATIONS, walkable
from app.features.realtime.schemas import Message


def test_full_room_assigns_unique_colors_and_releases_kicked_color():
    room = Room("COLORS", capacity=12)
    players = [room.add(str(i), 0) for i in range(12)]
    assert len({p.color for p in players}) == 12
    with pytest.raises(GameError):
        room.action(players[1].id, "color", value=0)
    with pytest.raises(GameError):
        room.add("Overflow")
    room.action(room.host, "kick", players[5].id)
    replacement = room.add("Replacement", 0)
    assert replacement.color == players[5].color
    assert len(room.players) == 12


@pytest.mark.parametrize(
    "key,value,attribute",
    [
        ("public", True, "public"),
        ("capacity", 12, "capacity"),
        ("movementSpeed", 1.75, "movement_speed"),
        ("killCooldown", 45, "kill_cooldown"),
        ("discussion", 60, "discussion"),
        ("voting", 90, "voting"),
        ("emergencyMeetings", 3, "emergency_meetings"),
        ("meetingCooldown", 45, "meeting_cooldown"),
        ("taskBarMode", "meetings", "task_bar_mode"),
        ("visualTasks", False, "visual_tasks"),
    ],
)
def test_rules_require_lobby_host_and_reset_ready(key, value, attribute):
    room = Room("RULES")
    host, guest = room.add("Host"), room.add("Guest")
    host.ready = guest.ready = True
    with pytest.raises(GameError):
        room.action(guest.id, "settings", key, value)
    # Exercise the wire schema too: booleans, strings and fractional speed survive parsing.
    m = Message(type="action", action="settings", target=key, value=value)
    room.action(host.id, m.action, m.target, m.value)
    assert getattr(room, attribute) == value
    assert not host.ready and not guest.ready
    room.phase = "playing"
    with pytest.raises(GameError):
        room.action(host.id, "settings", key, value)


@pytest.mark.parametrize(
    "key,value",
    [
        ("movementSpeed", float("nan")),
        ("movementSpeed", 5),
        ("capacity", 3),
        ("killCooldown", True),
        ("public", 1),
        ("visualTasks", "false"),
        ("taskBarMode", "invalid"),
        ("voting", -5),
        ("discussion", 1.5),
        ("unknown", 1),
    ],
)
def test_invalid_rules_are_rejected(key, value):
    room = Room("RULES")
    room.add("Host")
    with pytest.raises(GameError):
        room.action(room.host, "settings", key, value)


def test_capacity_cannot_shrink_below_population_and_kick_is_host_only():
    room = Room("RULES")
    players = [room.add(str(i)) for i in range(6)]
    with pytest.raises(GameError):
        room.action(room.host, "settings", "capacity", 4)
    with pytest.raises(GameError):
        room.action(players[1].id, "kick", room.host)
    with pytest.raises(GameError):
        room.action(room.host, "kick", room.host)
    room.phase = "playing"
    with pytest.raises(GameError):
        room.action(room.host, "kick", players[1].id)


@pytest.mark.parametrize("speed", [0.5, 1, 1.75, 2])
def test_speed_and_meeting_rules_are_used_by_simulation(speed):
    room = Room(
        "RULES",
        movement_speed=speed,
        discussion=45,
        voting=90,
        emergency_meetings=2,
        meeting_cooldown=30,
        kill_cooldown=60,
    )
    for i in range(4):
        room.add(str(i)).ready = True
    p = room.players[room.host]
    room.action(p.id, "stand")
    p.x, p.z = 0, 2
    room.enqueue(p, 1, 1, 0, room.round)
    room.tick(room.now + DT)
    assert p.x == pytest.approx(0.21 * speed)
    room.start(room.host)
    assert all(q.emergency == 2 and q.kill_at == room.now + 60 for q in room.players.values())
    room.tick(room.deadline)
    assert room.meeting_at == room.now + 30
    room.tick(room.meeting_at)
    room.meeting(p)
    assert room.deadline == room.now + 45
    room.tick(room.deadline)
    assert room.phase == "voting" and room.deadline == room.now + 90
    snapshot = room.snapshot(p.id)
    assert snapshot["movementSpeed"] == speed and snapshot["rules"]["killCooldown"] == 60


def test_every_task_has_an_accessible_console_location():
    from app.features.game.navigation import find_path

    for task in STATIONS:
        assert not walkable(task["x"], task["z"])
        path = find_path((2, 0), (task["x"], task["z"]))
        assert path and walkable(*path[-1])
        assert (path[-1][0] - task["x"]) ** 2 + (path[-1][1] - task["z"]) ** 2 <= 2.5**2
    assert any(t["room"] == "Security" for t in STATIONS)


def test_create_speed_is_bounded():
    for speed in (0, 3, float("inf")):
        with pytest.raises(ValidationError):
            Message(type="create", movement_speed=speed)


def test_task_stays_open_throughout_its_interaction_range():
    room = Room("RANGE")
    for i in range(4):
        room.add(str(i)).ready = True
    room.start(room.host)
    room.tick(room.deadline)
    p = next(p for p in room.players.values() if p.role == "crew")
    p.x, p.z = -9.7, -2
    room.action(p.id, "task_begin", "garden")
    room.tick(room.now + DT)
    assert p.challenge is not None
