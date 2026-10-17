import asyncio

from fastapi import WebSocket, WebSocketDisconnect


class Connection:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.queue = asyncio.Queue(maxsize=64)
        self.closed = False

    def send(self, message):
        if self.closed:
            return
        try:
            self.queue.put_nowait(message)
        except asyncio.QueueFull:
            self.closed = True
            asyncio.create_task(self.ws.close(code=1013))

    async def writer(self):
        try:
            while True:
                await asyncio.wait_for(self.ws.send_json(await self.queue.get()), timeout=5)
        except (WebSocketDisconnect, RuntimeError, asyncio.TimeoutError):
            self.closed = True
