import pytest

from app.features.game.exceptions import GameError
from app.features.game.service import Room
from app.features.game.world import DT, move


def match():
    room = Room("EFFECT", capacity=8, kill_cooldown=10)
    for i in range(6):
        room.add(f"Pilot {i}").ready = True
    room.start(room.host)
    room.tick(room.deadline + 11)
    killer = next(p for p in room.players.values() if p.role == "killer")
    crew = [p for p in room.players.values() if p.role == "crew"]
    killer.x, killer.z = 0, 2
    crew[0].x, crew[0].z = 1, 2
    crew[1].x, crew[1].z = 2, 2
    crew[2].x, crew[2].z = 12, 2
    return room, killer, crew


def test_lobby_name_edits_are_validated_and_shared():
    room = Room("EFFECT")
    a, b = room.add("Original"), room.add("Witness")
    room.action(a.id, "rename", "  New Pilot  ")
    assert next(p["name"] for p in room.snapshot(b.id)["players"] if p["id"] == a.id) == "New Pilot"
    for name in ("  ", "a" * 19):
        with pytest.raises(GameError):
            room.action(a.id, "rename", name)
    room.phase = "playing"
    with pytest.raises(GameError):
        room.action(a.id, "rename", "Midmatch")


def test_lobby_has_its_own_floor_and_crate_collisions():
    # The center is open in the bay, unlike the station's meeting beacon.
    assert move(0, 0, 1, 0, lobby=True) == pytest.approx((0.21, 0))
    assert move(2.3, -0.5, 1, 0, lobby=True) == (2.3, -0.5)
    x, z = 0, 2
    for _ in range(100):
        x, z = move(x, z, 1, 0, lobby=True)
    assert 5.4 < x <= 5.7


@pytest.mark.parametrize("style", range(4))
def test_elimination_styles_sync_only_to_participants_and_witnesses(style):
    room, killer, crew = match()
    victim, witness, distant = crew[:3]
    room.action(killer.id, "kill", victim.id, style)
    for player in (killer, victim, witness):
        event = room.snapshot(player.id)["eliminations"][0]
        assert event["style"] == style
        assert event["attacker"]["id"] == killer.id
        assert event["victim"]["id"] == victim.id
        assert "recipients" not in event and "started" not in event
    assert room.snapshot(distant.id)["eliminations"] == []
    assert not victim.alive and len(room.bodies) == 1
    before = (killer.x, killer.z)
    room.enqueue(killer, 1, 1, 0, room.round)
    room.tick(room.now + DT)
    assert (killer.x, killer.z) == before and not killer.inputs
    assert room.snapshot(killer.id)["movementLock"] > 0
    room.tick(room.now + 2.5)
    assert not room.snapshot(killer.id)["eliminations"]
    room.enqueue(killer, 2, 1, 0, room.round)
    room.tick(room.now + DT)
    assert killer.ack == 2 and killer.x > before[0]


def test_invalid_elimination_style_does_not_kill_or_broadcast():
    room, killer, crew = match()
    with pytest.raises(GameError):
        room.action(killer.id, "kill", crew[0].id, 99)
    assert crew[0].alive and not room.eliminations and not room.bodies


def test_finishing_kill_keeps_effect_until_expiration():
    room, killer, crew = match()
    for p in crew[2:]:
        p.alive = False
    room.action(killer.id, "kill", crew[0].id, 3)
    assert room.phase == "gameover"
    assert room.snapshot(crew[0].id)["eliminations"]
    room.tick(room.now + 3)
    assert room.snapshot(crew[0].id)["eliminations"] == []
