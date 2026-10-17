import { useGame } from "./store";
let context: AudioContext | undefined;
export function sound(kind: "click" | "alarm" | "task" | "meeting" = "click") {
  if (!useGame.getState().sound) return;
  context ??= new AudioContext();
  void context.resume();
  const osc = context.createOscillator(),
    gain = context.createGain();
  osc.connect(gain);
  gain.connect(context.destination);
  osc.type = kind === "alarm" ? "sawtooth" : "sine";
  const t = context.currentTime;
  osc.frequency.setValueAtTime(
    kind === "task"
      ? 550
      : kind === "meeting"
        ? 220
        : kind === "alarm"
          ? 140
          : 460,
    t,
  );
  osc.frequency.exponentialRampToValueAtTime(
    kind === "task" ? 880 : 100,
    t + 0.2,
  );
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.start();
  osc.stop(t + 0.3);
}
