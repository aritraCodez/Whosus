from contextlib import ExitStack

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import until


def test_pokemon_roster_changes_are_shared_and_survive_reconnect():
    with TestClient(app) as client, ExitStack() as stack:

        def connect():
            return stack.enter_context(
                client.websocket_connect("/ws", headers={"origin": "http://localhost:5173"})
            )

        host, witness = connect(), connect()
        host.send_json(dict(type="create", name="Trainer", map_id="mosslight", character="eevee"))
        identity = until(host, "joined")
        room = until(host, "snapshot")["room"]
        assert room["players"][0]["character"] == "eevee"
        witness.send_json(dict(type="join", name="Friend", code=room["code"], character="pikachu"))
        guest = until(witness, "joined")
        for character in [
            "rowlet",
            "sprigatito",
            "piplup",
            "jigglypuff",
            "togepi",
            "squirtle",
            "charizard",
        ]:
            host.send_json(
                dict(type="action", action="customize", target="character", value=character)
            )
            shared = until(
                witness,
                "snapshot",
                lambda message, character=character: any(
                    player["id"] == identity["id"] and player["character"] == character
                    for player in message["room"]["players"]
                ),
            )["room"]
            assert (
                next(p for p in shared["players"] if p["id"] == guest["id"])["character"]
                == "pikachu"
            )
        host.close()
        resumed = connect()
        resumed.send_json(dict(type="resume", token=identity["token"]))
        assert until(resumed, "joined")["id"] == identity["id"]
        shared = until(resumed, "snapshot")["room"]
        assert shared["mapId"] == "mosslight"
        assert (
            next(p for p in shared["players"] if p["id"] == identity["id"])["character"]
            == "charizard"
        )
