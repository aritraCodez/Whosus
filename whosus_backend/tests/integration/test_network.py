from contextlib import ExitStack

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import ORIGIN, until


def test_four_clients_chat_role_secrecy_and_resume():
    with TestClient(app) as client, ExitStack() as stack:
        sockets = [
            stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN)) for _ in range(4)
        ]
        sockets[0].send_json({"type": "create", "name": "Host", "public": True})
        identities = [until(sockets[0], "joined")]
        room = until(sockets[0], "snapshot")["room"]
        code = room["code"]
        assert client.get("/api/rooms").json()[0]["code"] == code
        for i, ws in enumerate(sockets[1:]):
            ws.send_json({"type": "join", "code": code, "name": f"Crew{i}"})
            identities.append(until(ws, "joined"))
        sockets[0].send_json({"type": "chat", "text": "hello crew"})
        for ws in sockets:
            assert until(ws, "chat")["message"]["text"] == "hello crew"
        for ws in sockets:
            ws.send_json({"type": "action", "action": "ready"})
        # Wait until host sees every ready state before launching.
        for _ in range(100):
            room = until(sockets[0], "snapshot")["room"]
            if len(room["players"]) == 4 and all(p["ready"] for p in room["players"]):
                break
        sockets[0].send_json({"type": "action", "action": "start"})
        for ws, identity in zip(sockets, identities, strict=True):
            for _ in range(100):
                room = until(ws, "snapshot")["room"]
                if room["phase"] == "reveal":
                    break
            assert sum("role" in p for p in room["players"]) == 1
            assert next(p for p in room["players"] if p["id"] == identity["id"])["role"] in (
                "crew",
                "killer",
            )
        sockets[2].close()
        resumed = stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN))
        resumed.send_json({"type": "resume", "token": identities[2]["token"]})
        assert until(resumed, "joined")["id"] == identities[2]["id"]
        assert until(resumed, "snapshot")["room"]["code"] == code
        forged = stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN))
        forged.send_json({"type": "resume", "token": "not-a-token"})
        assert until(forged, "expired")


def test_unknown_rooms_and_server_validation():
    with TestClient(app) as client, client.websocket_connect("/ws", headers=ORIGIN) as ws:
        ws.send_json({"type": "join", "code": "XXXXXX"})
        assert "No room" in until(ws, "error")["message"]
        ws.send_json({"type": "create", "name": "Host", "capacity": 500})
        assert until(ws, "error")["message"] == "Invalid request."
        ws.send_json({"type": "create", "name": "Host"})
        until(ws, "joined")
        ws.send_json({"type": "action", "action": "start"})
        assert "four" in until(ws, "error")["message"]


def test_api_allows_configured_frontend_origin():
    with TestClient(app) as client:
        response = client.get("/api/rooms", headers=ORIGIN)

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN["origin"]


def test_host_settings_kick_and_revoked_resume_over_websocket():
    with TestClient(app) as client, ExitStack() as stack:
        host, guest = [
            stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN)) for _ in range(2)
        ]
        host.send_json(
            {"type": "create", "name": "Host", "capacity": 12, "movement_speed": 1.5, "voting": 60}
        )
        host_id = until(host, "joined")["id"]
        r = until(host, "snapshot")["room"]
        assert r["capacity"] == 12 and r["movementSpeed"] == 1.5 and r["rules"]["voting"] == 60
        guest.send_json({"type": "join", "name": "Guest", "code": r["code"], "color": 0})
        identity = until(guest, "joined")
        r = until(guest, "snapshot")["room"]
        assert len({p["color"] for p in r["players"]}) == 2
        guest.send_json({"type": "action", "action": "settings", "target": "public", "value": True})
        assert "Only the host" in until(guest, "error")["message"]
        host.send_json({"type": "action", "action": "settings", "target": "public", "value": True})
        for _ in range(100):
            if until(guest, "snapshot")["room"]["public"]:
                break
        else:
            raise AssertionError("Privacy was not shared")
        assert client.get("/api/rooms").json()[0]["code"] == r["code"]
        host.send_json(
            {"type": "action", "action": "settings", "target": "taskBarMode", "value": "meetings"}
        )
        for _ in range(100):
            if until(guest, "snapshot")["room"]["taskBarMode"] == "meetings":
                break
        else:
            raise AssertionError("String setting was not shared")
        host.send_json({"type": "action", "action": "kick", "target": identity["id"]})
        assert until(guest, "kicked")["message"]
        guest.send_json({"type": "action", "action": "ready"})
        assert until(guest, "error")["message"] == "Join a room first."
        resumed = stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN))
        resumed.send_json({"type": "resume", "token": identity["token"]})
        assert until(resumed, "expired")
        for _ in range(100):
            r = until(host, "snapshot")["room"]
            if r["population"] == 1:
                break
        assert r["players"][0]["id"] == host_id and r["population"] == 1
