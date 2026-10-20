import math

from .exceptions import GameError
from .types import ActionValue


def integer(value: ActionValue, low: int, high: int, message: str) -> int:
    if type(value) is not int or not low <= value <= high:
        raise GameError(message)
    return value


def number(value: ActionValue, low: float, high: float, message: str) -> float:
    if type(value) is not int and type(value) is not float:
        raise GameError(message)
    if not math.isfinite(value) or not low <= value <= high:
        raise GameError(message)
    return value
