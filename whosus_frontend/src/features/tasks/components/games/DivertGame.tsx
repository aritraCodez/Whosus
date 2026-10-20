import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import {
Sliders
} from "lucide-react";
import { useState } from "react";
export function DivertGame({ finish }: { finish: () => void }) {
  const [switches, setSwitches] = useState([false, false, false, false]);
  const targetIdx = 2; // Divert to target conduit

  const toggle = (idx: number) => {
    playTaskSound("click");
    const next = [...switches];
    next[idx] = !next[idx];
    setSwitches(next);

    if (idx === targetIdx && next[idx]) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game divert-game">
      <div className="task-instructions">
        <h3>Divert auxiliary power</h3>
        <p>Push breaker #3 to energize Cloudline secondary sub-systems.</p>
      </div>

      <div className="breakers-panel">
        {switches.map((on, i) => (
          <div key={i} className="breaker-slot">
            <span className="slot-num">CH 0{i + 1}</span>
            <button
              className={`breaker-switch ${on ? "on" : "off"} ${i === targetIdx ? "target" : ""}`}
              onClick={() => toggle(i)}
            >
              <Sliders size={20} />
              <span>{on ? "ROUTE" : "IDLE"}</span>
            </button>
            {i === targetIdx && <span className="target-indicator">TARGET</span>}
          </div>
        ))}
      </div>
    </div>
  );
}