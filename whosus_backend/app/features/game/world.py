from __future__ import annotations

import math
from typing import Protocol

from .types import Station


class Position(Protocol):
    x: float
    z: float


DT = 1 / 20
SPEED = 4.2
COLORS = [
    "#f6bd4f",
    "#6ad9c5",
    "#f47785",
    "#a99af4",
    "#75b8ed",
    "#f59e6d",
    "#c5db79",
    "#e69ed0",
    "#ded9cc",
    "#73a49c",
    "#cb8b75",
    "#8e9bd1",
]
FLOORS = [
    # 1. The Commons (Center)
    (-4, 4, -4, 4),
    # 2. MedBay / Botanical (West)
    (-14, -6, -4, 4),
    # 3. Reactor (North)
    (-4, 4, -14, -6),
    # 4. Comms & Admin (East)
    (6, 14, -4, 4),
    # 5. Storage (South)
    (-4, 4, 6, 14),
    # 6. Security (Northwest)
    (-14, -6, -14, -6),
    # 7. Weapons & O2 (Northeast)
    (6, 14, -14, -6),
    # 8. Electrical (Southwest)
    (-14, -6, 6, 14),
    # 9. Shields & Navigation (Southeast)
    (6, 14, 6, 14),
    # --- Connecting Corridors & Loops ---
    # Match the visible hall floors and client collision in world.ts.
    (-12, 12, -1.6, 1.6),
    (-1.6, 1.6, -12, 12),
    (-11.5, -8.5, -16, -4),
    (8.5, 11.5, -16, -4),
    (-11.5, -8.5, 4, 16),
    (8.5, 11.5, 4, 16),
    (-12, 12, -11.5, -8.5),
    (-12, 12, 8.5, 11.5),
]
OBSTACLES = [
    (-0.9, 0.9, -0.9, 0.9),
    (-12.5, -10.5, 1.5, 3),
    (10.5, 12.5, 1.5, 3),
    (-3, -1.5, -12.5, -10.5),
    (1.5, 3, 10.5, 12.5),
    (-0.8, 0.8, -10.8, -9.2),
    (-12.5, -10.5, -8.5, -7),
    (10.5, 12.5, -8.5, -7),
    (-12.5, -10.5, 7, 8.5),
    (10.5, 12.5, 7, 8.5),
]
STATIONS: list[Station] = [
    {
        "id": "security",
        "name": "Tune Security Signal",
        "room": "Security",
        "x": -12,
        "z": -12,
        "category": "short",
        "kind": "dial",
        "visual": False,
    },
    {
        "id": "reactor_monitor",
        "name": "Calibrate Reactor Monitor",
        "room": "Reactor",
        "x": 2,
        "z": -12,
        "category": "short",
        "kind": "dial",
        "visual": False,
    },
    {
        "id": "garden",
        "name": "Balance the biofilter",
        "room": "Botanical",
        "x": -12,
        "z": -2,
        "category": "long",
        "kind": "sequence",
        "visual": False,
    },
    {
        "id": "swipe",
        "name": "Swipe Card",
        "room": "The Commons",
        "x": 2,
        "z": -3,
        "category": "common",
        "kind": "swipe",
        "visual": False,
    },
    {
        "id": "id_code",
        "name": "Enter ID Code",
        "room": "Comms",
        "x": 8,
        "z": 2,
        "category": "common",
        "kind": "keypad",
        "visual": False,
    },
    {
        "id": "wires",
        "name": "Fix Wiring",
        "room": "Electrical",
        "x": -11,
        "z": 12,
        "category": "common",
        "kind": "wires",
        "visual": False,
    },
    {
        "id": "relay",
        "name": "Align the Relay",
        "room": "Comms",
        "x": 12,
        "z": -2,
        "category": "short",
        "kind": "dial",
        "visual": False,
    },
    {
        "id": "prime_shields",
        "name": "Prime Shields",
        "room": "Shields",
        "x": 12,
        "z": 10,
        "category": "short",
        "kind": "shields",
        "visual": True,
        "visual_kind": "shields",
    },
    {
        "id": "chart_course",
        "name": "Chart Course",
        "room": "Navigation",
        "x": 8,
        "z": 12,
        "category": "short",
        "kind": "course",
        "visual": False,
    },
    {
        "id": "clear_asteroids",
        "name": "Clear Asteroids",
        "room": "Weapons",
        "x": 12,
        "z": -10,
        "category": "short",
        "kind": "asteroids",
        "visual": True,
        "visual_kind": "asteroids",
    },
    {
        "id": "clean_filter",
        "name": "Clean O2 Filter",
        "room": "Life Support",
        "x": 8,
        "z": -12,
        "category": "short",
        "kind": "clean",
        "visual": False,
    },
    {
        "id": "start_reactor",
        "name": "Start Reactor",
        "room": "Reactor",
        "x": -2,
        "z": -8,
        "category": "long",
        "kind": "sequence",
        "visual": False,
    },
    {
        "id": "submit_scan",
        "name": "Submit Scan",
        "room": "MedBay",
        "x": -8,
        "z": 2,
        "category": "long",
        "kind": "scan",
        "visual": True,
        "visual_kind": "scan",
    },
    {
        "id": "divert_power",
        "name": "Divert Power",
        "room": "Electrical",
        "x": -8,
        "z": 10,
        "category": "long",
        "kind": "divert",
        "visual": False,
    },
    {
        "id": "fuel_engines",
        "name": "Fuel Engines",
        "room": "Storage",
        "x": -2,
        "z": 12,
        "category": "long",
        "kind": "fuel",
        "visual": False,
    },
]
VENTS = [
    (-11, 0),
    (0, -11),
    (11, 0),
    (-10, -10),
    (10, -10),
    (-10, 10),
    (0, 10),
    (10, 10),
]
LOBBY_OBSTACLES = [(2.7, 4.5, -1.6, 0.2), (-1, 1, -4.4, -3.2)]
LOBBY_SEATS = [(side * 5.3, z) for side in (-1, 1) for z in (-3.75, -2.25, -0.75, 0.75, 2.25, 3.75)]
SEAT_RANGE = 1.35
ARRIVAL_SEAT_TIME = 2.0


def distance(a: Position, b: Position) -> float:
    return math.hypot(a.x - b.x, a.z - b.z)


PLAYER_RADIUS = 0.55
PLAYER_SPACING = PLAYER_RADIUS * 2


def walkable(x: float, z: float, lobby: bool = False) -> bool:
    if lobby:
        return (
            -5.7 <= x <= 5.7
            and -4.7 <= z <= 4.7
            and not any(
                a - PLAYER_RADIUS < x < b + PLAYER_RADIUS
                and c - PLAYER_RADIUS < z < d + PLAYER_RADIUS
                for a, b, c, d in LOBBY_OBSTACLES
            )
        )
    return (
        -13.7 <= x <= 13.7
        and -13.7 <= z <= 13.7
        and any(a <= x <= b and c <= z <= d for a, b, c, d in FLOORS)
        and not any(
            a - PLAYER_RADIUS < x < b + PLAYER_RADIUS and c - PLAYER_RADIUS < z < d + PLAYER_RADIUS
            for a, b, c, d in OBSTACLES
        )
        and not any(
            abs(x - s["x"]) < 0.56 + PLAYER_RADIUS and abs(z - s["z"]) < 0.41 + PLAYER_RADIUS
            for s in STATIONS
        )
    )


def move(
    x: float,
    z: float,
    dx: float,
    dz: float,
    ghost: bool = False,
    lobby: bool = False,
    speed: float = 1,
    blockers: tuple[tuple[float, float], ...] = (),
) -> tuple[float, float]:
    norm = max(1, math.hypot(dx, dz))
    nx, nz = x + dx / norm * SPEED * DT * speed, z + dz / norm * SPEED * DT * speed
    if ghost:
        return max(-14, min(14, nx)), max(-14, min(14, nz))

    def allowed(a: float, b: float) -> bool:
        for other_x, other_z in blockers:
            separation = math.hypot(a - other_x, b - other_z)
            if (
                separation < PLAYER_SPACING
                and separation <= math.hypot(x - other_x, z - other_z) + 0.000001
            ):
                return False
        return walkable(a, b, lobby)

    if allowed(nx, z):
        x = nx
    if allowed(x, nz):
        z = nz
    return x, z


def open_position(
    x: float, z: float, lobby: bool = False, blockers: tuple[tuple[float, float], ...] = ()
) -> tuple[float, float]:
    """Find a free standing position for spawns, chairs, and duct exits."""

    def clear(a: float, b: float) -> bool:
        return walkable(a, b, lobby) and all(
            math.hypot(a - px, b - pz) >= PLAYER_SPACING for px, pz in blockers
        )

    if clear(x, z):
        return x, z
    for ring in range(1, 41):
        for angle in range(32):
            a = x + math.cos(angle * math.tau / 32) * ring * 0.2
            b = z + math.sin(angle * math.tau / 32) * ring * 0.2
            if clear(a, b):
                return a, b
    raise ValueError("No free standing position")
