import asyncio

from fastapi import WebSocket, WebSocketDisconnect

from app.core.limits import SEND_QUEUE_SIZE, WRITE_TIMEOUT

from .schemas import ServerEvent, VoiceSignalEvent


class Connection:
    """A bounded output queue keeps slow clients out of the simulation loop."""

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self.queue: asyncio.Queue[ServerEvent] = asyncio.Queue(maxsize=SEND_QUEUE_SIZE)
        self.closed = False
        self.close_task: asyncio.Task[None] | None = None

    def send(self, message: ServerEvent) -> None:
        if self.closed:
            return
        try:
            self.queue.put_nowait(message)
        except asyncio.QueueFull:
            self.closed = True
            self.close_task = asyncio.create_task(self.close(1013))

    async def close(self, code: int = 1000) -> None:
        self.closed = True
        try:
            await asyncio.wait_for(self.ws.close(code=code), timeout=WRITE_TIMEOUT)
        except (WebSocketDisconnect, RuntimeError, TimeoutError):
            pass

    async def writer(self) -> None:
        try:
            while True:
                message = await self.queue.get()
                payload = message.model_dump(mode="json", by_alias=True)
                if isinstance(message, VoiceSignalEvent):
                    for optional in ("sdp", "candidate"):
                        if optional not in message.model_fields_set:
                            payload.pop(optional)
                await asyncio.wait_for(self.ws.send_json(payload), timeout=WRITE_TIMEOUT)
        except (WebSocketDisconnect, RuntimeError, TimeoutError):
            await self.close(1013)
