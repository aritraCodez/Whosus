from collections.abc import Callable

from pydantic import JsonValue
from starlette.testclient import WebSocketTestSession

ORIGIN = {"origin": "http://localhost:5173"}


def until(
    socket: WebSocketTestSession,
    kind: str,
    predicate: Callable[[dict[str, JsonValue]], bool] = lambda _: True,
) -> dict[str, JsonValue]:
    for _ in range(100):
        message: dict[str, JsonValue] = socket.receive_json()
        if message["type"] == kind and predicate(message):
            return message
    raise AssertionError(f"No {kind} message")
