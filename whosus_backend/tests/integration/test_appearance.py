from contextlib import ExitStack

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import until


def test_create_join_live_changes_and_resume_keep_full_appearance():
    with TestClient(app) as client, ExitStack() as stack:

        def connect():
            return stack.enter_context(
                client.websocket_connect("/ws", headers={"origin": "http://localhost:5173"})
            )

        host, guest = connect(), connect()
        look = dict(hat="wizard", outfit="dress", visor="glasses", accessory="wings", boots="gold")
        host.send_json(dict(type="create", name="Dressed host", **look))
        identity = until(host, "joined")
        snapshot = until(host, "snapshot")["room"]
        assert all(snapshot["players"][0][slot] == value for slot, value in look.items())
        guest.send_json(
            dict(type="join", name="Guest", code=snapshot["code"], outfit="lab", hat="beanie")
        )
        guest_id = until(guest, "joined")["id"]
        host.send_json(dict(type="action", action="customize", target="outfit", value="captain"))
        snapshot = until(
            guest,
            "snapshot",
            lambda m: any(
                p["id"] == identity["id"] and p["outfit"] == "captain" for p in m["room"]["players"]
            ),
        )["room"]
        assert next(p for p in snapshot["players"] if p["id"] == guest_id)["outfit"] == "lab"
        host.close()
        resumed = connect()
        resumed.send_json(dict(type="resume", token=identity["token"]))
        assert until(resumed, "joined")["id"] == identity["id"]
        player = next(
            p for p in until(resumed, "snapshot")["room"]["players"] if p["id"] == identity["id"]
        )
        assert (
            player["outfit"] == "captain"
            and player["hat"] == "wizard"
            and player["boots"] == "gold"
        )
