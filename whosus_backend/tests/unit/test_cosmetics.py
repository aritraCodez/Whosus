import pytest
from pydantic import ValidationError

from app.features.appearance.catalog import COSMETICS
from app.features.game.exceptions import GameError
from app.features.game.service import Room
from app.features.realtime.schemas import Message


@pytest.mark.parametrize("slot,items", COSMETICS.items())
def test_catalog_items_can_be_equipped_and_shared(slot, items):
    room = Room("DRESS")
    player, witness = room.add("Host"), room.add("Guest")
    for item in items:
        Message(type="join", **{slot: item})
        room.action(player.id, "customize", slot, item)
        public = next(p for p in room.snapshot(witness.id)["players"] if p["id"] == player.id)
        assert public[slot] == item


def test_unknown_items_and_non_cosmetic_fields_cannot_be_equipped():
    room = Room("DRESS")
    player = room.add("Host")
    for slot, value in [("hat", "missing"), ("role", "killer"), ("alive", False), ("outfit", None)]:
        with pytest.raises(GameError):
            room.action(player.id, "customize", slot, value)
    assert player.role == "crew" and player.alive and player.hat == "sprout"
    with pytest.raises(ValidationError):
        Message(type="create", outfit="missing")
    with pytest.raises(GameError):
        room.add("Invalid", hat="missing")


@pytest.mark.parametrize("phase", ["reveal", "playing", "meeting", "gameover"])
def test_clothing_locked_after_launch(phase):
    room = Room("DRESS")
    player = room.add("Host", outfit="dress", hat="crown")
    room.phase = phase
    with pytest.raises(GameError):
        room.action(player.id, "customize", "outfit", "lab")
    assert player.outfit == "dress"
