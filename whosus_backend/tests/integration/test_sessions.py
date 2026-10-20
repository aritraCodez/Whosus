from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tests.helpers import ORIGIN, until


def test_takeover_revokes_old_connection_without_disconnect_of_new_session(application):
    with TestClient(application) as client, ExitStack() as stack:
        old, first, latest = [
            stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN)) for _ in range(3)
        ]
        old.send_json({"type": "create", "name": "Host"})
        identity = until(old, "joined")
        for previous, replacement in [(old, first), (first, latest)]:
            replacement.send_json({"type": "resume", "token": identity["token"]})
            assert until(replacement, "joined") == identity
            with pytest.raises(WebSocketDisconnect) as closed:
                until(previous, "pong")
            assert closed.value.code == 4001
            snapshot = until(replacement, "snapshot")["room"]
            assert snapshot["players"][0]["connected"]
        latest.send_json({"type": "ping"})
        assert until(latest, "pong") == {"type": "pong"}


def test_session_capacity_failure_keeps_existing_room_and_socket(application, monkeypatch):
    monkeypatch.setattr("app.features.realtime.service.MAX_SESSIONS", 1)
    with TestClient(application) as client, ExitStack() as stack:
        host, extra = [
            stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN)) for _ in range(2)
        ]
        host.send_json({"type": "create"})
        until(host, "joined")
        extra.send_json({"type": "create"})
        assert until(extra, "error")["message"] == "Server is at capacity."
        assert len(application.state.runtime.rooms) == len(application.state.runtime.sessions) == 1
        extra.send_json({"type": "ping"})
        until(extra, "pong")
