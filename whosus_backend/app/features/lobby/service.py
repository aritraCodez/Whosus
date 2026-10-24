from collections.abc import Iterable

from app.features.game.service import Room

from .schemas import PublicRoom


def public_rooms(rooms: Iterable[Room]) -> list[PublicRoom]:
    return [
        PublicRoom(
            mapId=room.map_id,
            code=room.code,
            players=len(room.players),
            capacity=room.capacity,
            host=room.players[room.host].name if room.host in room.players else "Explorer",
        )
        for room in rooms
        if room.public and room.phase == "lobby" and len(room.players) < room.capacity
    ]
