import pytest
from pydantic import ValidationError

from app.features.game.exceptions import GameError
from app.features.game.maps import stations_for
from app.features.game.service import Room
from app.features.game.world import STATIONS, walkable
from app.features.realtime.schemas import Message, SnapshotEvent


def test_map_selection_is_validated_and_only_host_can_change_it_in_lobby():
    assert Message(type="create", map_id="mosslight", character="mosslight").map_id == "mosslight"
    with pytest.raises(ValidationError):
        Message(type="create", map_id="missing")
    with pytest.raises(ValidationError):
        Message(type="join", character="missing")
    room = Room("FOREST", map_id="mosslight")
    host, guest = room.add("Host", character="mosslight"), room.add("Guest")
    host.ready = guest.ready = True
    with pytest.raises(GameError):
        room.action(guest.id, "settings", "mapId", "cloudline")
    room.action(host.id, "settings", "mapId", "cloudline")
    assert room.map_id == "cloudline" and not host.ready and not guest.ready
    room.action(host.id, "settings", "mapId", "mosslight")
    for value in ("missing", None, 1):
        with pytest.raises(GameError):
            room.action(host.id, "settings", "mapId", value)
    room.phase = "playing"
    with pytest.raises(GameError):
        room.action(host.id, "settings", "mapId", "cloudline")
    assert room.map_id == "mosslight"


def test_forest_tasks_keep_collision_positions_and_use_forest_challenges():
    assert [(s["id"], s["x"], s["z"], s["kind"]) for s in stations_for("mosslight")] == [
        (s["id"], s["x"], s["z"], s["kind"]) for s in STATIONS
    ]
    room = Room("FOREST", map_id="mosslight")
    for i in range(4):
        room.add(str(i), character="mosslight").ready = True
    room.start(room.host)
    room.tick(room.deadline)
    assert all(walkable(p.x, p.z) for p in room.players.values())
    crew = next(p for p in room.players.values() if p.role == "crew")
    crew.x, crew.z = -12, -0.5
    room.action(crew.id, "task_begin", "garden")
    assert crew.challenge["name"] == "Restore the moss garden"
    snapshot = room.snapshot(crew.id)
    assert snapshot["mapId"] == "mosslight"
    assert all(p["character"] == "mosslight" for p in snapshot["players"])
    assert SnapshotEvent(room=snapshot, speaking=[], voicePeers=[]).room == snapshot
    assert next(t for t in snapshot["tasks"] if t["id"] == "garden")["room"] == "Fern Sanctuary"


def test_creature_survives_elimination_ghost_and_rematch_snapshots():
    room = Room("FOREST", map_id="mosslight")
    for i in range(4):
        room.add(str(i), character="mosslight").ready = True
    room.start(room.host)
    room.tick(room.deadline)
    killer = next(p for p in room.players.values() if p.role == "killer")
    victim = next(p for p in room.players.values() if p.role == "crew")
    killer.x, killer.z = 2, 0
    victim.x, victim.z = 3.2, 0
    killer.kill_at = 0
    room.action(killer.id, "kill", victim.id)
    assert not victim.alive
    assert room.bodies[0]["character"] == "mosslight"
    assert room.eliminations[0]["victim"]["character"] == "mosslight"
    ghost = next(p for p in room.snapshot(victim.id)["players"] if p["id"] == victim.id)
    assert ghost["character"] == "mosslight" and not ghost["alive"]
    room.phase = "gameover"
    room.action(room.host, "rematch")
    assert room.map_id == "mosslight" and all(p.alive for p in room.players.values())
