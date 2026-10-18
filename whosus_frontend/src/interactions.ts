import { act, motion } from "./network";
import { useGame } from "./store";
import { STATIONS } from "./world";

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
  if (!r || r.challenge || s.fakeChallenge || r.movementLock > 0) return;
  if (r.phase === "lobby") {
    openPractice();
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
          : `${task.name} is not assigned to you this round. Follow your highlighted consoles.`,
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
      error: "Move closer to an assigned task console or the meeting beacon.",
    });
}
