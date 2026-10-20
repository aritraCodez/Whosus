import { interactWithStation } from "@/features/game/actions/interactions";
import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";
import { act } from "@/features/game/network/game-client";
export function interact() { interactWithStation(); }

export function report() {
  const r = useGame.getState().room;
  const b = r?.bodies.find(
    (b) => Math.hypot(b.x - motion.x, b.z - motion.z) <= 2.5,
  );
  if (b) act("report", b.id);
  else
    useGame.setState({ error: "No fallen explorer within reporting range." });
}

export function eliminate() {
  const s = useGame.getState();
  if (
    s.room?.phase !== "playing" ||
    s.room.killCooldown > 0 ||
    s.room.movementLock > 0
  )
    return;
  const me = s.room.players.find((p) => p.id === s.id);
  if (!me?.alive || me.role !== "killer" || s.room.vent >= 0) return;
  const q = s.room?.players
    .filter(
      (p) =>
        p.id !== s.id &&
        p.alive &&
        p.role !== "killer" &&
        Math.hypot(p.x - motion.x, p.z - motion.z) <= 1.8,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - motion.x, a.z - motion.z) -
        Math.hypot(b.x - motion.x, b.z - motion.z),
    )[0];
  if (q) act("kill", q.id, -1);
}