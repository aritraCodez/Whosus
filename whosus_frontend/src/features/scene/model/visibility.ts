import { walkable } from "@/features/game/model/world";
export function isVisibleToPlayer(
  targetX: number,
  targetZ: number,
  localX: number,
  localZ: number,
  isGhost: boolean,
  phase: string | undefined,
): boolean {
  if (phase !== "playing" || isGhost) return true;
  const dist = Math.hypot(targetX - localX, targetZ - localZ);
  if (dist > 7.5) return false;
  // Disconnected room occlusion checks: living players cannot see through walls
  if (localX < -4.5 && targetX > -3.8) return false;
  if (targetX < -4.5 && localX > -3.8) return false;
  if (localX > 4.5 && targetX < 3.8) return false;
  if (targetX > 4.5 && localX < 3.8) return false;
  if (localZ < -4.5 && targetZ > -3.8) return false;
  if (targetZ < -4.5 && localZ > -3.8) return false;
  if (localZ > 4.5 && targetZ < 3.8) return false;
  if (targetZ > 4.5 && localZ < 3.8) return false;
  return true;
}

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
