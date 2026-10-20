import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import {
Wind
} from "lucide-react";
import { useRef,useState } from "react";
export function CleanGame({ finish }: { finish: () => void }) {
  const [cleaned, setCleaned] = useState(0);
  const total = 4;
  const [leaves, setLeaves] = useState(() =>
    Array.from({ length: total }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 55,
      y: 20 + Math.random() * 55,
      removed: false,
      ejecting: false,
    }))
  );
  const ejectedLeaves = useRef(new Set<number>());

  const ejectLeaf = (id: number) => {
    if (ejectedLeaves.current.has(id)) return;
    ejectedLeaves.current.add(id);
    playTaskSound("spark");
    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ejecting: true } : l))
    );
    setTimeout(() => {
      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, removed: true } : l))
      );
    }, 550);
    const next = ejectedLeaves.current.size;
    setCleaned(next);

    if (next >= total) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game clean-game">
      <div className="task-instructions">
        <h3>Flush intake filter</h3>
        <p>Tap and eject the botanical debris from the oxygen vent.</p>
      </div>

      <div className="vent-chamber">
        <div className="chute-target">
          <Wind size={24} />
          <span>EJECT CHUTE</span>
        </div>

        {leaves.map((leaf) => (
          !leaf.removed && (
            <button
              key={leaf.id}
              className={`debris-item ${leaf.ejecting ? "ejecting" : "floating"}`}
              style={{
                left: `${leaf.x}%`,
                top: `${leaf.y}%`,
                animationDelay: `${-leaf.id * 0.8}s`,
              }}
              disabled={leaf.ejecting}
              aria-label="Eject filter debris"
              onClick={() => ejectLeaf(leaf.id)}
            >
              🍂
            </button>
          )
        ))}
      </div>

      <div className="task-meter">
        <i style={{ width: `${(cleaned / total) * 100}%` }} />
      </div>
    </div>
  );
}