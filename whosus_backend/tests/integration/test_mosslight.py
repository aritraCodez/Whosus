from contextlib import ExitStack

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import until


def test_map_and_creature_are_shared_discoverable_and_retained_after_resume():
    with TestClient(app) as client, ExitStack() as stack:

        def connect():
            return stack.enter_context(
                client.websocket_connect("/ws", headers={"origin": "http://localhost:5173"})
            )

        host, guest = connect(), connect()
        host.send_json(
            dict(
                type="create",
                name="Moss host",
                public=True,
                map_id="mosslight",
                character="mosslight",
            )
        )
        identity = until(host, "joined")
        room = until(host, "snapshot")["room"]
        assert room["mapId"] == "mosslight"
        entry = next(r for r in client.get("/api/rooms").json() if r["code"] == room["code"])
        assert entry["mapId"] == "mosslight"
        guest.send_json(dict(type="join", name="Witness", code=room["code"]))
        until(guest, "joined")
        shared = until(guest, "snapshot")["room"]
        assert shared["mapId"] == "mosslight"
        assert (
            next(p for p in shared["players"] if p["id"] == identity["id"])["character"]
            == "mosslight"
        )
        host.close()
        resumed = connect()
        resumed.send_json(dict(type="resume", token=identity["token"]))
        assert until(resumed, "joined")["id"] == identity["id"]
        shared = until(resumed, "snapshot")["room"]
        assert shared["mapId"] == "mosslight"
        assert (
            next(p for p in shared["players"] if p["id"] == identity["id"])["character"]
            == "mosslight"
        )
