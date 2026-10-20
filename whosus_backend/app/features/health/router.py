from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.dependencies import RuntimeDependency

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    ok: bool = True
    game: Literal["WhoSus?"] = "WhoSus?"
    rooms: int


@router.get(
    "/api/health",
    response_model=HealthResponse,
    status_code=200,
    responses={503: {"model": HealthResponse, "description": "Game simulation is unavailable"}},
)
async def health(response: Response, runtime: RuntimeDependency) -> HealthResponse:
    if runtime.simulation_failed:
        response.status_code = 503
    return HealthResponse(ok=not runtime.simulation_failed, rooms=len(runtime.rooms))
