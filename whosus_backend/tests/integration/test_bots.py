from contextlib import ExitStack

from fastapi.testclient import TestClient

from tests.helpers import ORIGIN, until


def population(socket, count):
    for _ in range(100):
        room = until(socket, "snapshot")["room"]
        if room["population"] == count:
            return room
    raise AssertionError(f"Room never reached {count} players")


def test_host_fills_bots_over_existing_socket_without_creating_sessions(application):
    with TestClient(application) as client, ExitStack() as stack:
        host, guest = [
            stack.enter_context(client.websocket_connect("/ws", headers=ORIGIN)) for _ in range(2)
        ]
        host.send_json({"type": "create", "name": "Host", "capacity": 8})
        host_id = until(host, "joined")["id"]
        code = until(host, "snapshot")["room"]["code"]
        guest.send_json({"type": "join", "name": "Guest", "code": code})
        guest_id = until(guest, "joined")["id"]
        guest.send_json({"type": "action", "action": "fill_bots"})
        assert "Only the host" in until(guest, "error")["message"]
        host.send_json({"type": "action", "action": "fill_bots"})
        room = population(host, 8)
        bots = [p for p in room["players"] if p.get("bot")]
        assert len(bots) == 6
        assert {p["name"] for p in bots} == {f"bot-{i}" for i in range(1, 7)}
        assert all(p["ready"] and p["connected"] for p in bots)
        assert all("role" not in p for p in bots)
        assert len(application.state.runtime.sessions) == 2
        assert {p["id"] for p in population(guest, 8)["players"]} == {
            p["id"] for p in room["players"]
        }
        host.send_json({"type": "action", "action": "kick", "target": bots[0]["id"]})
        assert bots[0]["id"] not in {p["id"] for p in population(host, 7)["players"]}
        assert len(application.state.runtime.rooms[code].bots) == 5
        host.send_json({"type": "leave"})
        until(host, "left")
        remaining = population(guest, 6)
        assert remaining["host"] == guest_id and remaining["host"] != host_id
        guest.send_json({"type": "action", "action": "fill_bots"})
        assert len([p for p in population(guest, 8)["players"] if p.get("bot")]) == 7
