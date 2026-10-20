import type { Challenge } from "@/features/game/model/types";
import { act } from "@/features/game/network/game-client";
import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import { useState } from "react";
export function SequenceGame({
  c,
  finish,
}: {
  c: Challenge;
  finish: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [localStep, setLocalStep] = useState(c.step || 0);
  const [localError, setLocalError] = useState("");

  const symbols = ["●", "◆", "▲", "✦"];
  const handlePress = (idx: number) => {
    if (busy) return;
    playTaskSound("click");
    setBusy(true);

    if (c.fake || c.practice) {
      if (idx === c.sequence[localStep]) {
        setLocalError("");
        const next = localStep + 1;
        setLocalStep(next);
        if (next >= c.sequence.length) {
          playTaskSound("success");
          setTimeout(finish, 400);
          return;
        }
      } else {
        playTaskSound("buzz");
        setLocalStep(0);
        setLocalError("Wrong symbol. Start matching again from the first symbol.");
      }
      setTimeout(() => setBusy(false), 300);
    } else {
      act("task_step", c.nonce, idx);
      setTimeout(() => setBusy(false), 350);
    }
  };

  const currentStep = c.fake || c.practice ? localStep : c.step;

  return (
    <div className="task-game sequence-game">
      <div className="task-instructions">
        <h3>Follow the signal sequence</h3>
        <p>Match the symbols in order. A wrong symbol resets this task.</p>
        {(c.error || localError) && <p className="task-retry" role="status">{c.error || localError}</p>}
      </div>

      <div className="sequence-display">
        {c.sequence.map((v, i) => (
          <span
            key={i}
            className={`seq-node ${i < currentStep ? "complete" : i === currentStep ? "current pulse" : ""}`}
          >
            {symbols[v]}
          </span>
        ))}
      </div>

      <div className="circuit-buttons">
        {symbols.map((sym, idx) => (
          <button
            key={sym}
            aria-label={`Match symbol ${idx + 1}`}
            disabled={busy || currentStep >= c.sequence.length}
            className="circuit-btn"
            onClick={() => handlePress(idx)}
          >
            {sym}
          </button>
        ))}
      </div>

      <div className="task-meter">
        <i style={{ width: `${(currentStep / c.sequence.length) * 100}%` }} />
      </div>
    </div>
  );
}