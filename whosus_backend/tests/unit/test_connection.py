import asyncio
import contextlib
import json

import pytest
from starlette.websockets import WebSocket

from app.features.realtime.connection import Connection
from app.features.realtime.schemas import IceCandidate, SimpleEvent, VoiceSignalEvent


async def socket_for(send):
    async def receive():
        return {"type": "websocket.connect"}

    ws = WebSocket({"type": "websocket"}, receive, send)
    await ws.accept()
    return ws


@pytest.mark.asyncio
async def test_slow_consumer_queue_is_bounded_and_closes_once():
    sent = []

    async def send(message):
        sent.append(message)

    conn = Connection(await socket_for(send))
    for _ in range(80):
        conn.send(SimpleEvent(type="pong"))
    assert conn.closed and conn.queue.qsize() == 64
    await conn.close_task
    assert [m for m in sent if m["type"] == "websocket.close"] == [
        {"type": "websocket.close", "code": 1013, "reason": ""}
    ]


@pytest.mark.asyncio
async def test_stalled_writer_has_a_deadline(monkeypatch):
    sent = []

    async def send(message):
        if message["type"] == "websocket.send":
            await asyncio.Event().wait()
        sent.append(message)

    monkeypatch.setattr("app.features.realtime.connection.WRITE_TIMEOUT", 0.01)
    conn = Connection(await socket_for(send))
    conn.send(SimpleEvent(type="pong"))
    await asyncio.wait_for(conn.writer(), timeout=1)
    assert conn.closed and sent[-1]["code"] == 1013


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["offer", "ice", "reset"])
async def test_signal_serialization_preserves_optional_fields_and_aliases(kind):
    sent = []
    delivered = asyncio.Event()

    async def send(message):
        if message["type"] == "websocket.send":
            sent.append(json.loads(message["text"]))
            delivered.set()

    conn = Connection(await socket_for(send))
    if kind == "offer":
        event = VoiceSignalEvent(from_="sender", kind=kind, generation=1, sdp="audio-sdp")
    elif kind == "ice":
        event = VoiceSignalEvent(
            from_="sender", kind=kind, generation=1, candidate=IceCandidate(candidate="")
        )
    else:
        event = VoiceSignalEvent(from_="sender", kind=kind, generation=1)
    conn.send(event)
    writer = asyncio.create_task(conn.writer())
    try:
        await asyncio.wait_for(delivered.wait(), timeout=1)
    finally:
        writer.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await writer
    payload = sent[0]
    assert payload["from"] == "sender" and "from_" not in payload
    assert ("sdp" in payload) == (kind == "offer")
    assert ("candidate" in payload) == (kind == "ice")
    if kind == "ice":
        assert payload["candidate"] == {
            "candidate": "",
            "sdpMid": None,
            "sdpMLineIndex": None,
            "usernameFragment": None,
        }
