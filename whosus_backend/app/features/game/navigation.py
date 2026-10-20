"""Bounded, cached paths through the same collision map used by players."""

import heapq
import math
from functools import lru_cache

from .world import LOBBY_OBSTACLES, walkable

Point = tuple[float, float]
Cell = tuple[int, int]


@lru_cache(maxsize=2)
def cells(lobby: bool) -> frozenset[Cell]:
    def allowed(x: float, z: float) -> bool:
        if not lobby:
            # Stay inside floor edges so floating-point movement cannot strand
            # a bot while turning at a room/corridor boundary.
            return all(
                walkable(x + dx, z + dz)
                for dx, dz in ((0, 0), (-0.06, 0), (0.06, 0), (0, -0.06), (0, 0.06))
            )
        return (
            -5.5 <= x <= 5.5
            and -4.5 <= z <= 4.5
            and not any(
                a - 0.36 < x < b + 0.36 and c - 0.36 < z < d + 0.36
                for a, b, c, d in LOBBY_OBSTACLES
            )
        )

    return frozenset(
        (x, z) for x in range(-28, 29) for z in range(-28, 29) if allowed(x / 2, z / 2)
    )


def nearest(point: Point, lobby: bool) -> Cell:
    x, z = round(point[0] * 2), round(point[1] * 2)
    available = cells(lobby)
    if (x, z) in available:
        return x, z
    return min(
        available, key=lambda cell: math.hypot(cell[0] / 2 - point[0], cell[1] / 2 - point[1])
    )


@lru_cache(maxsize=256)
def route(start: Cell, goal: Cell, lobby: bool) -> tuple[Point, ...]:
    available = cells(lobby)
    frontier: list[tuple[int, Cell]] = [(0, start)]
    parents: dict[Cell, Cell] = {}
    costs = {start: 0}
    while frontier:
        _, current = heapq.heappop(frontier)
        if current == goal:
            path = [current]
            while current in parents:
                current = parents[current]
                path.append(current)
            return tuple((x / 2, z / 2) for x, z in reversed(path))
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            neighbor = current[0] + dx, current[1] + dz
            cost = costs[current] + 1
            if neighbor not in available or cost >= costs.get(neighbor, 10_000):
                continue
            costs[neighbor] = cost
            parents[neighbor] = current
            priority = cost + abs(neighbor[0] - goal[0]) + abs(neighbor[1] - goal[1])
            heapq.heappush(frontier, (priority, neighbor))
    return ()


def find_path(start: Point, goal: Point, lobby: bool = False) -> list[Point]:
    return list(route(nearest(start, lobby), nearest(goal, lobby), lobby))
