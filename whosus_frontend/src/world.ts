export const FLOORS = [
  [-4, 4, -4, 4],
  [-14, -6, -4, 4],
  [6, 14, -4, 4],
  [-4, 4, -14, -6],
  [-4, 4, 6, 14],
  [-10, 10, -1.6, 1.6],
  [-1.6, 1.6, -10, 10],
];
export const OBSTACLES = [
  [-12.5, -10.5, 1.5, 3],
  [10.5, 12.5, 1.5, 3],
  [-3, -1.5, -12.5, -10.5],
  [1.5, 3, 10.5, 12.5],
  [-0.8, 0.8, -10.8, -9.2],
  [-0.9, 0.9, -0.9, 0.9],
];
export const STATIONS = [
  {
    id: "garden",
    name: "Balance the biofilter",
    room: "Botanical",
    x: -12,
    z: -2,
  },
  { id: "relay", name: "Align the relay", room: "Comms", x: 12, z: -2 },
  { id: "reactor", name: "Restore the core", room: "Reactor", x: 2, z: -12 },
  { id: "cargo", name: "Sort the samples", room: "Cargo", x: -2, z: 12 },
];
export const VENTS = [
  [-11, 0],
  [0, -11],
  [11, 0],
];
export const LOBBY_OBSTACLES = [
  [-4.5, -2.7, -1.6, 0.2],
  [2.7, 4.5, -1.6, 0.2],
  [-1, 1, -4.4, -3.2],
];
export function walkable(x: number, z: number, lobby = false) {
  if (lobby)
    return (
      x >= -5.7 &&
      x <= 5.7 &&
      z >= -4.7 &&
      z <= 4.7 &&
      !LOBBY_OBSTACLES.some(
        ([a, b, c, d]) =>
          x > a - 0.3 && x < b + 0.3 && z > c - 0.3 && z < d + 0.3,
      )
    );
  return (
    FLOORS.some(
      ([a, b, c, d]) =>
        x >= a + 0.3 && x <= b - 0.3 && z >= c + 0.3 && z <= d - 0.3,
    ) &&
    !OBSTACLES.some(
      ([a, b, c, d]) =>
        x > a - 0.3 && x < b + 0.3 && z > c - 0.3 && z < d + 0.3,
    )
  );
}
export function move(
  x: number,
  z: number,
  dx: number,
  dz: number,
  ghost = false,
  lobby = false,
  step = 1,
) {
  const n = Math.max(1, Math.hypot(dx, dz));
  const nx = x + (dx / n) * 0.21 * step,
    nz = z + (dz / n) * 0.21 * step;
  if (ghost)
    return [Math.max(-14, Math.min(14, nx)), Math.max(-14, Math.min(14, nz))];
  if (walkable(nx, z, lobby)) x = nx;
  if (walkable(x, nz, lobby)) z = nz;
  return [x, z];
}
