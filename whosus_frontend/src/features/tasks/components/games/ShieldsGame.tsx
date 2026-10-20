import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import {
ShieldAlert
} from "lucide-react";
import { useState } from "react";
export function ShieldsGame({ finish }: { finish: () => void }) {
  // 7 hexes: indices 0 to 6. Some initially red (false), goal is all true.
  const [shields, setShields] = useState<boolean[]>([false, true, false, false, true, false, false]);

  const toggleHex = (idx: number) => {
    playTaskSound("spark");
    const next = [...shields];
    next[idx] = true;
    setShields(next);

    if (next.every(Boolean)) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game shields-game">
      <div className="task-instructions">
        <h3>Engage magnetic shield generators</h3>
        <p>Tap all red depleted shield nodes to activate them.</p>
      </div>

      <div className="hex-grid">
        {shields.map((active, i) => (
          <button
            key={i}
            className={`hex-tile ${active ? "active" : "depleted"}`}
            disabled={active}
            onClick={() => toggleHex(i)}
          >
            <ShieldAlert size={24} />
            <span>{active ? "ONLINE" : "OFFLINE"}</span>
          </button>
        ))}
      </div>

      <div className="shields-status">
        STATUS: <strong>{shields.filter(Boolean).length} / 7 NODES ENGAGED</strong>
      </div>
    </div>
  );
}