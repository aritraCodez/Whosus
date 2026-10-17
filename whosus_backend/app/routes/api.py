from fastapi import APIRouter

from ..state import rooms

router = APIRouter()


@router.get('/api/health')
def health():
    return {'ok': True, 'game': 'WhoSus?', 'rooms': len(rooms)}


@router.get('/api/rooms')
def public_rooms():
    return [
        {
            'code': room.code,
            'players': len(room.players),
            'capacity': room.capacity,
            'host': room.players[room.host].name if room.host in room.players else 'Explorer',
        }
        for room in rooms.values()
        if room.public and room.phase == 'lobby' and len(room.players) < room.capacity
    ]
