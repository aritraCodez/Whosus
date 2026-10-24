import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import Settings
from app.features.game.service import Room
from app.main import create_app
from tests.helpers import ORIGIN, until


def test_health_discovery_and_openapi_contract(application):
    with TestClient(application) as client:
        assert client.get("/api/health").json() == {"ok": True, "game": "WhoSus?", "rooms": 0}
        assert client.get("/api/rooms").json() == []
        runtime = application.state.runtime
        for code, public, phase, capacity in [
            ("PUBLIC", True, "lobby", 8),
            ("HIDDEN", False, "lobby", 8),
            ("ACTIVE", True, "playing", 8),
            ("FULL", True, "lobby", 4),
        ]:
            room = Room(code, public=public, capacity=capacity)
            for i in range(capacity if code == "FULL" else 1):
                room.add("Host" if i == 0 else f"Guest {i}")
            room.phase = phase
            runtime.rooms[code] = room
        response = client.get("/api/rooms", headers=ORIGIN)
        assert response.status_code == 200
        assert response.json() == [
            {"mapId": "cloudline", "code": "PUBLIC", "players": 1, "capacity": 8, "host": "Host"}
        ]
        assert response.headers["access-control-allow-origin"] == ORIGIN["origin"]
        denied = client.get("/api/rooms", headers={"origin": "https://other.example"})
        assert "access-control-allow-origin" not in denied.headers
        assert client.post("/api/rooms").status_code == 405
        paths = client.get("/openapi.json").json()["paths"]
        assert set(paths) == {"/api/health", "/api/rooms"}
        assert paths["/api/health"]["get"]["responses"]["200"]["content"]["application/json"][
            "schema"
        ]["$ref"].endswith("HealthResponse")


def test_apps_have_independent_runtime_and_session_tokens(application):
    other = create_app(Settings(_env_file=None, allowed_origins=[ORIGIN["origin"]], stun_url=[]))
    with TestClient(application) as first, TestClient(other) as second:
        with (
            first.websocket_connect("/ws", headers=ORIGIN) as host,
            second.websocket_connect("/ws", headers=ORIGIN) as guest,
        ):
            host.send_json({"type": "create", "name": "Host", "public": True})
            identity = until(host, "joined")
            until(host, "snapshot")
            assert first.get("/api/health").json()["rooms"] == 1
            assert second.get("/api/health").json()["rooms"] == 0
            guest.send_json({"type": "resume", "token": identity["token"]})
            assert (
                until(guest, "expired")["message"] == "Your session expired. Join a new expedition."
            )


@pytest.mark.parametrize(
    "headers", [{}, {"origin": "https://untrusted.example"}, {"origin": "null"}]
)
def test_websocket_origin_is_checked_before_accept(application, headers):
    with TestClient(application) as client:
        with pytest.raises(WebSocketDisconnect) as rejected:
            with client.websocket_connect("/ws", headers=headers):
                pass
        assert rejected.value.code == 1008


@pytest.mark.parametrize("binary", [False, True])
def test_transport_limits_close_invalid_frames(application, binary):
    with TestClient(application) as client, client.websocket_connect("/ws", headers=ORIGIN) as ws:
        if binary:
            ws.send_bytes(b"not JSON text")
        else:
            ws.send_text("x" * 20_001)
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code == (1003 if binary else 1008)


def test_invalid_requests_do_not_destroy_connection_or_leak_validation_details(application):
    with TestClient(application) as client, client.websocket_connect("/ws", headers=ORIGIN) as ws:
        for payload in ["{", '{"type":"input","dx":NaN}', '{"type":"chat","sender":"spoofed"}']:
            ws.send_text(payload)
            assert until(ws, "error") == {"type": "error", "message": "Invalid request."}
        ws.send_json({"type": "create", "name": "  "})
        assert until(ws, "error")["message"] == "Choose an explorer name."
        assert not application.state.runtime.rooms and not application.state.runtime.sessions
        ws.send_json({"type": "ping"})
        assert until(ws, "pong") == {"type": "pong"}


def test_health_exposes_stopped_simulation_with_same_response_fields(application):
    with TestClient(application) as client:
        application.state.runtime.simulation_failed = True
        response = client.get("/api/health")
        assert response.status_code == 503
        assert response.json() == {"ok": False, "game": "WhoSus?", "rooms": 0}


def test_unexpected_errors_close_safely_without_logging_credentials(
    application, monkeypatch, caplog
):
    async def fail(*args):
        raise RuntimeError("private-token-do-not-log")

    monkeypatch.setattr("app.features.realtime.service.GameService.dispatch", fail)
    with TestClient(application) as client, client.websocket_connect("/ws", headers=ORIGIN) as ws:
        ws.send_json({"type": "ping"})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code == 1011
    assert "Unexpected game connection failure (RuntimeError)" in caplog.text
    assert "private-token-do-not-log" not in caplog.text
