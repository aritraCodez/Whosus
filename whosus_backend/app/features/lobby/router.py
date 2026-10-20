from fastapi import APIRouter

from app.dependencies import RuntimeDependency

from .schemas import PublicRoom
from .service import public_rooms

router = APIRouter(tags=["lobby"])


@router.get("/api/rooms", response_model=list[PublicRoom], status_code=200)
async def list_public_rooms(runtime: RuntimeDependency) -> list[PublicRoom]:
    # Stay on the owning event loop while reading temporary room state.
    return public_rooms(runtime.rooms.values())
