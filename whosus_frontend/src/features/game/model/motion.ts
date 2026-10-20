import { useGame } from "./game-store";
import { move } from "./world";
type Input = { seq: number; dx: number; dz: number };
export const motion = {
  x: 0,
  z: 2,
  dx: 0,
  dz: 0,
  keys: new Set<string>(),
  pending: [] as Input[],
  seq: 0,
  steppedAt: 0,
  renderX: 0,
  renderZ: 2,
  revision: 0,
};
// Controls are relative to the screen, matching the isometric camera.
export function movementInput(): [number, number] {
  const s = useGame.getState(),
    r = s.room;
  if (
    !r ||
    s.status !== "connected" ||
    !["playing", "lobby"].includes(r.phase) ||
    r.vent >= 0 ||
    r.movementLock > 0 ||
    s.settings ||
    r.challenge ||
    document.querySelector("dialog[open]") ||
    document.activeElement?.matches(
      "input,textarea,select,[contenteditable=true],.task-header,.task-content",
    )
  )
    return [0, 0];
  const held = (a: string, b: string) =>
    motion.keys.has(a) || motion.keys.has(b) ? 1 : 0;
  let x = motion.dx + held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft"),
    z = motion.dz + held("KeyS", "ArrowDown") - held("KeyW", "ArrowUp");
  const n = Math.max(1, Math.hypot(x, z));
  x /= n;
  z /= n;
  const length = Math.hypot(18, 13);
  return [(18 * x + 13 * z) / length, (-13 * x + 18 * z) / length];
}
export function renderPosition() {
  const r = useGame.getState().room;
  const [dx, dz] = movementInput();
  const me = r?.players.find((p) => p.id === useGame.getState().id);
  const fraction = Math.min(1, (performance.now() - motion.steppedAt) / 50);
  const [x, z] = move(
    motion.x,
    motion.z,
    dx,
    dz,
    me ? !me.alive : false,
    r?.phase === "lobby",
    r?.movementSpeed ?? 1,
  );
  // Interpolate toward the same full step the client and server will accept.
  // Testing a fractional step against collision can walk into a gap that the
  // full step cannot enter, then snap back on every input tick.
  return [
    motion.x + (x - motion.x) * fraction,
    motion.z + (z - motion.z) * fraction,
  ];
}
