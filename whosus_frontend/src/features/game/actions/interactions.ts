import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";
import { STATIONS,nearWardrobe,nearestLobbySeat } from "@/features/game/model/world";
import { act } from "@/features/game/network/game-client";

export function interactWithSeat(index?: number) {
  const s = useGame.getState(), r = s.room;
  if (r?.phase !== "lobby" || s.wardrobe || s.practiceOpen || s.settings) return;
  const me = r.players.find(p => p.id === s.id);
  if ((me?.seat ?? -1) >= 0) { act("stand"); return; }
  const nearest = nearestLobbySeat(motion.x, motion.z, r.players.map(p => p.seat ?? -1));
  if (nearest === undefined || (index !== undefined && nearest !== index)) return;
  act("sit", "", nearest);
}

export function openWardrobe() {
  const s = useGame.getState();
  if (s.room?.phase !== "lobby" || s.practiceOpen || s.settings) return;
  if (!nearWardrobe(motion.x, motion.z)) {
    s.set({ error: "Walk closer to the wardrobe box to change your outfit." });
    return;
  }
  s.set({ wardrobe: true });
}

export function openPractice() {
  const s = useGame.getState();
  if (s.room?.phase !== "lobby") return;
  if (Math.hypot(motion.x, motion.z + 3.8) > 2.5) {
    s.set({ error: "Walk to the practice console beside the departure door." });
    return;
  }
  s.set({ practiceOpen: true });
}

export function interactWithStation(id?: string) {
  const s = useGame.getState(),
    r = s.room;
  if (!r || r.challenge || s.fakeChallenge || s.wardrobe || s.practiceOpen || s.settings || r.movementLock > 0) return;
  if (r.phase === "lobby") {
    const me = r.players.find(p => p.id === s.id);
    const seat = nearestLobbySeat(motion.x, motion.z, r.players.map(p => p.seat ?? -1));
    if ((me?.seat ?? -1) >= 0 || seat !== undefined) interactWithSeat(seat);
    else if (nearWardrobe(motion.x, motion.z)) openWardrobe();
    else if (Math.hypot(motion.x, motion.z + 3.8) <= 2.5) openPractice();
    else s.set({ error: "Walk closer to a chair, the wardrobe box or the practice console." });
    return;
  }
  if (r.phase !== "playing") return;
  const me = r.players.find((p) => p.id === s.id);
  if (!me || r.vent >= 0) return;
  if (
    r.sabotage &&
    me.alive &&
    Math.hypot(motion.x - 2, motion.z + 12) <= 2 &&
    (!id || id === "reactor_monitor")
  ) {
    act("repair");
    return;
  }
  const near = STATIONS.filter(
    (t) => Math.hypot(t.x - motion.x, t.z - motion.z) <= 2.5,
  );
  const task = id
    ? near.find((t) => t.id === id)
    : near.find((t) =>
        r.tasks.some((a) => a.id === t.id && !a.done && !s.fakeDone[t.id]),
      );
  if (task) {
    const assigned = r.tasks.find((t) => t.id === task.id);
    if (!assigned || assigned.done || s.fakeDone[task.id]) {
      s.set({
        error: assigned
          ? "You have finished this task."
          : "This room uses an older task list. Start a new round to unlock every console.",
      });
      return;
    }
    if (me.role === "crew") act("task_begin", task.id);
    else
      s.set({
        fakeChallenge: {
          ...assigned,
          nonce: `fake_${Date.now()}`,
          sequence: [0, 1, 2, 3],
          step: 0,
          started: Date.now() / 1000,
          fake: true,
        },
      });
    return;
  }
  if (!id && me.alive && Math.hypot(motion.x, motion.z) < 2.5) act("meeting");
  else
    s.set({
      error: "Move closer to an unfinished task console or the meeting beacon.",
    });
}
