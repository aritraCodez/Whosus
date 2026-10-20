import pytest

from app.features.game.service import Room
from app.features.realtime.schemas import SnapshotEvent


@pytest.mark.parametrize(
    "phase", ["lobby", "reveal", "playing", "discussion", "voting", "results", "gameover"]
)
def test_typed_serialization_preserves_snapshot_shape_and_optional_fields(phase):
    room = Room("SCHEMA")
    for i in range(4):
        room.add(str(i)).ready = True
    room.start(room.host)
    room.tick(room.deadline)
    player = next(p for p in room.players.values() if p.role == "crew")
    player.x, player.z = -12, -2
    room.action(player.id, "task_begin", "garden")
    room.phase = phase
    original = room.snapshot(player.id)
    payload = SnapshotEvent(room=original, speaking=[], voicePeers=[]).model_dump(mode="json")
    assert payload == {"type": "snapshot", "room": original, "speaking": [], "voicePeers": []}
    assert "recipients" not in str(payload)
    if phase != "gameover":
        assert all("role" not in p for p in payload["room"]["players"] if p["id"] != player.id)
