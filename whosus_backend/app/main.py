import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import partial

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.features.health.router import router as health_router
from app.features.lobby.router import router as lobby_router
from app.features.realtime.router import router as realtime_router
from app.features.voice.service import VoiceService
from app.runtime import Runtime
from app.services.simulation import simulate

log = logging.getLogger("whosus.simulation")


def report_simulation_failure(runtime: Runtime, task: asyncio.Task[None]) -> None:
    if not task.cancelled():
        runtime.simulation_failed = True
        log.error("Game simulation stopped unexpectedly", exc_info=task.exception())


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings if settings is not None else Settings()
    runtime = Runtime(voice=VoiceService(config.stun_url))

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        runtime.simulation_failed = False
        task = asyncio.create_task(simulate(runtime), name="whosus-simulation")
        task.add_done_callback(partial(report_simulation_failure, runtime))
        try:
            yield
        finally:
            task.cancel()
            try:
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            finally:
                await runtime.shutdown()

    application = FastAPI(title="WhoSus? authority", lifespan=lifespan)
    application.state.settings = config
    application.state.runtime = runtime
    application.add_middleware(
        CORSMiddleware,
        allow_origins=config.allowed_origins,
        allow_methods=["GET"],
        allow_headers=[],
    )
    application.include_router(health_router)
    application.include_router(lobby_router)
    application.include_router(realtime_router)
    return application


app = create_app()
