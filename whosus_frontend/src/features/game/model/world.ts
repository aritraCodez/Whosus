export const FLOORS = [
  // 1. The Commons (Center)
  [-4, 4, -4, 4],
  // 2. MedBay / Botanical (West)
  [-14, -6, -4, 4],
  // 3. Reactor (North)
  [-4, 4, -14, -6],
  // 4. Comms & Admin (East)
  [6, 14, -4, 4],
  // 5. Storage (South)
  [-4, 4, 6, 14],
  // 6. Security (Northwest)
  [-14, -6, -14, -6],
  // 7. Weapons & O2 (Northeast)
  [6, 14, -14, -6],
  // 8. Electrical (Southwest)
  [-14, -6, 6, 14],
  // 9. Shields & Navigation (Southeast)
  [6, 14, 6, 14],
  // --- Connecting Corridors & Loops ---
  // Keep these bounds identical to the visible hall floors and server collision.
  [-12, 12, -1.6, 1.6],
  [-1.6, 1.6, -12, 12],
  [-11.5, -8.5, -16, -4],
  [8.5, 11.5, -16, -4],
  [-11.5, -8.5, 4, 16],
  [8.5, 11.5, 4, 16],
  [-12, 12, -11.5, -8.5],
  [-12, 12, 8.5, 11.5],
];

export const OBSTACLES = [
  [-0.9, 0.9, -0.9, 0.9],
  [-12.5, -10.5, 1.5, 3],
  [10.5, 12.5, 1.5, 3],
  [-3, -1.5, -12.5, -10.5],
  [1.5, 3, 10.5, 12.5],
  [-0.8, 0.8, -10.8, -9.2],
  [-12.5, -10.5, -8.5, -7],
  [10.5, 12.5, -8.5, -7],
  [-12.5, -10.5, 7, 8.5],
  [10.5, 12.5, 7, 8.5],
];

export const STATIONS = [
  {
    id: "security",
    name: "Tune Security Signal",
    room: "Security",
    x: -12,
    z: -12,
    category: "short",
    kind: "dial",
    visual: false,
  },
  {
    id: "reactor_monitor",
    name: "Calibrate Reactor Monitor",
    room: "Reactor",
    x: 2,
    z: -12,
    category: "short",
    kind: "dial",
    visual: false,
  },
  {
    id: "garden",
    name: "Balance the biofilter",
    room: "Botanical",
    x: -12,
    z: -2,
    category: "long",
    kind: "sequence",
    visual: false,
  },
  {
    id: "swipe",
    name: "Swipe Card",
    room: "The Commons",
    x: 2,
    z: -3,
    category: "common",
    kind: "swipe",
    visual: false,
  },
  {
    id: "id_code",
    name: "Enter ID Code",
    room: "Comms",
    x: 8,
    z: 2,
    category: "common",
    kind: "keypad",
    visual: false,
  },
  {
    id: "wires",
    name: "Fix Wiring",
    room: "Electrical",
    x: -11,
    z: 12,
    category: "common",
    kind: "wires",
    visual: false,
  },
  {
    id: "relay",
    name: "Align the Relay",
    room: "Comms",
    x: 12,
    z: -2,
    category: "short",
    kind: "dial",
    visual: false,
  },
  {
    id: "prime_shields",
    name: "Prime Shields",
    room: "Shields",
    x: 12,
    z: 10,
    category: "short",
    kind: "shields",
    visual: true,
    visual_kind: "shields",
  },
  {
    id: "chart_course",
    name: "Chart Course",
    room: "Navigation",
    x: 8,
    z: 12,
    category: "short",
    kind: "course",
    visual: false,
  },
  {
    id: "clear_asteroids",
    name: "Clear Asteroids",
    room: "Weapons",
    x: 12,
    z: -10,
    category: "short",
    kind: "asteroids",
    visual: true,
    visual_kind: "asteroids",
  },
  {
    id: "clean_filter",
    name: "Clean O2 Filter",
    room: "Life Support",
    x: 8,
    z: -12,
    category: "short",
    kind: "clean",
    visual: false,
  },
  {
    id: "start_reactor",
    name: "Start Reactor",
    room: "Reactor",
    x: -2,
    z: -8,
    category: "long",
    kind: "sequence",
    visual: false,
  },
  {
    id: "submit_scan",
    name: "Submit Scan",
    room: "MedBay",
    x: -8,
    z: 2,
    category: "long",
    kind: "scan",
    visual: true,
    visual_kind: "scan",
  },
  {
    id: "divert_power",
    name: "Divert Power",
    room: "Electrical",
    x: -8,
    z: 10,
    category: "long",
    kind: "divert",
    visual: false,
  },
  {
    id: "fuel_engines",
    name: "Fuel Engines",
    room: "Storage",
    x: -2,
    z: 12,
    category: "long",
    kind: "fuel",
    visual: false,
  },
];

export const VENTS = [
  [-11, 0],
  [0, -11],
  [11, 0],
  [-10, -10],
  [10, -10],
  [-10, 10],
  [0, 10],
  [10, 10],
];
export const LOBBY_OBSTACLES = [
  [2.7, 4.5, -1.6, 0.2],
  [-1, 1, -4.4, -3.2],
];
// The right-hand cargo box doubles as the departure bay's wardrobe.
export const WARDROBE_STATION = {
  x: (LOBBY_OBSTACLES[0][0] + LOBBY_OBSTACLES[0][1]) / 2,
  z: (LOBBY_OBSTACLES[0][2] + LOBBY_OBSTACLES[0][3]) / 2,
  range: 2.25,
};
export function nearWardrobe(x: number, z: number) {
  return (
    Math.hypot(x - WARDROBE_STATION.x, z - WARDROBE_STATION.z) <=
    WARDROBE_STATION.range
  );
}
export const SEAT_RANGE = 1.35;
export const LOBBY_SEATS = [-1, 1].flatMap((side) =>
  [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75].map((z) => ({
    x: side * 5.3,
    z,
    side,
  })),
);
export function nearestLobbySeat(x: number, z: number, occupied: number[]) {
  return LOBBY_SEATS.map((seat, index) => ({
    index,
    distance: Math.hypot(x - seat.x, z - seat.z),
  }))
    .filter(
      (seat) => seat.distance <= SEAT_RANGE && !occupied.includes(seat.index),
    )
    .sort((a, b) => a.distance - b.distance)[0]?.index;
}
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
    x >= -13.7 &&
    x <= 13.7 &&
    z >= -13.7 &&
    z <= 13.7 &&
    FLOORS.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d) &&
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
