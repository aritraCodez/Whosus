import { walkable } from "@/features/game/model/world";
export function heroCanOccupy(x: number, z: number) {
  const radius = 0.42;
  return (
    walkable(x, z) &&
    walkable(x - radius, z) &&
    walkable(x + radius, z) &&
    walkable(x, z - radius) &&
    walkable(x, z + radius) &&
    walkable(x - radius, z - radius) &&
    walkable(x - radius, z + radius) &&
    walkable(x + radius, z - radius) &&
    walkable(x + radius, z + radius)
  );
}
