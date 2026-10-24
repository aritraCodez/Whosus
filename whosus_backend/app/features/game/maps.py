"""Map presentation. Both expeditions use the same authoritative path network."""

from typing import Literal

from .types import Station
from .world import STATIONS

MapId = Literal["cloudline", "mosslight"]
MAPS = ("cloudline", "mosslight")
MOSS_TASKS = {
    "security": ("Tune the firefly signal", "Firefly Lookout"),
    "reactor_monitor": ("Balance the amber heart", "Amber Heart"),
    "garden": ("Restore the moss garden", "Fern Sanctuary"),
    "swipe": ("Read the grove pass", "Gathering Grove"),
    "id_code": ("Decode the ancient rune", "Echo Glade"),
    "wires": ("Reconnect the root network", "Rootworks"),
    "relay": ("Align the echo stones", "Echo Glade"),
    "prime_shields": ("Light the ward stones", "Moonwell"),
    "chart_course": ("Chart the forest trail", "Moonwell"),
    "clear_asteroids": ("Clear drifting spores", "Spore Meadow"),
    "clean_filter": ("Clean the spore filter", "Spore Meadow"),
    "start_reactor": ("Awaken the amber heart", "Amber Heart"),
    "submit_scan": ("Scan the forest life", "Fern Sanctuary"),
    "divert_power": ("Channel the root energy", "Rootworks"),
    "fuel_engines": ("Collect golden nectar", "Nectar Hollow"),
}


def stations_for(map_id: str) -> list[Station]:
    if map_id != "mosslight":
        return STATIONS
    return [{**s, "name": MOSS_TASKS[s["id"]][0], "room": MOSS_TASKS[s["id"]][1]} for s in STATIONS]
