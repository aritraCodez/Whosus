import asyncio
import contextlib
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.core.limits import MAX_MESSAGE_SIZE, RECEIVE_TIMEOUT
from app.core.security import TokenBucket
from app.dependencies import RuntimeDependency
from app.features.game.exceptions import GameError
from app.runtime import Session

from .connection import Connection
from .schemas import Message, NoticeEvent
from .service import GameService

log = logging.getLogger("whosus.realtime")
router = APIRouter()


@router.websocket("/ws")
async def socket(ws: WebSocket, runtime: RuntimeDependency) -> None:
    if ws.headers.get("origin") not in ws.app.state.settings.allowed_origins:
        await ws.close(code=1008)
        return
    await ws.accept()
    conn = Connection(ws)
    writer = asyncio.create_task(conn.writer())
    service = GameService(runtime)
    session: Session | None = None
    bucket = TokenBucket()
    try:
        while True:
            if conn.closed:
                break
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=RECEIVE_TIMEOUT)
            except KeyError:
                await conn.close(1003)
                break
            if len(raw) > MAX_MESSAGE_SIZE or not bucket.consume(time.monotonic()):
                await conn.close(1008)
                break
            try:
                message = Message.model_validate_json(raw)
                session = await service.dispatch(message, conn, session)
            except (ValidationError, GameError) as error:
                conn.send(
                    NoticeEvent(
                        type="error",
                        message=str(error) if isinstance(error, GameError) else "Invalid request.",
                    )
                )
    except (WebSocketDisconnect, TimeoutError):
        pass
    except Exception as error:
        log.error("Unexpected game connection failure (%s)", type(error).__name__)
        await conn.close(1011)
    finally:
        await service.disconnect(session, conn)
        writer.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await writer
        if conn.close_task:
            await conn.close_task
        await conn.close()
