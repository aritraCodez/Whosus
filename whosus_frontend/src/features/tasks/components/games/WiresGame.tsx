import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import { useRef,useState } from "react";
export function WiresGame({ finish }: { finish: () => void }) {
  const COLORS = ["#f47785", "#75b8ed", "#f6bd4f", "#e69ed0"];
  const COLOR_NAMES = ["red", "blue", "yellow", "pink"];

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [connections, setConnections] = useState<Record<number, number>>({});
  const [retry, setRetry] = useState(false);
  const rightOrder = useRef([2, 0, 3, 1]); // Shuffled right terminals

  const handleLeftClick = (leftIdx: number) => {
    playTaskSound("click");
    setSelectedLeft(leftIdx);
  };

  const handleRightClick = (rightIdx: number) => {
    if (selectedLeft === null) return;
    const rightColor = rightOrder.current[rightIdx];

    if (selectedLeft === rightColor) {
      setRetry(false);
      // Valid connection!
      playTaskSound("spark");
      const next = { ...connections, [selectedLeft]: rightIdx };
      setConnections(next);
      setSelectedLeft(null);
      if (Object.keys(next).length === 4) {
        playTaskSound("success");
        setTimeout(finish, 700);
      }
    } else {
      playTaskSound("buzz");
      setSelectedLeft(null);
      setConnections({});
      setRetry(true);
    }
  };

  return (
    <div className="task-game wires-game">
      <div className="task-instructions">
        <h3>Match and reconnect color conduits</h3>
        <p>Select a wire on the left, then connect it to its matching color terminal.</p>
        {retry && <p className="task-retry" role="status">Wrong connection. Match all wires again from the start.</p>}
      </div>

      <div className="wires-junction">
        {/* Left Terminals */}
        <div className="terminals-col left">
          {COLORS.map((col, idx) => {
            const isConnected = connections[idx] !== undefined;
            const isSelected = selectedLeft === idx;
            return (
              <button
                key={idx}
                className={`terminal-btn ${isSelected ? "selected" : ""} ${isConnected ? "connected" : ""}`}
                style={{ "--wire-color": col } as React.CSSProperties}
                disabled={isConnected}
                onClick={() => handleLeftClick(idx)}
              >
                <span className="wire-stub" style={{ background: col }} />
                <span className="terminal-label">{COLOR_NAMES[idx].toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        {/* Center Canvas / SVG Connections */}
        <div className="wires-center">
          <svg className="wires-svg" viewBox="0 0 100 160">
            {Object.entries(connections).map(([left, right]) => {
              const y1 = 20 + Number(left) * 40;
              const y2 = 20 + Number(right) * 40;
              const color = COLORS[Number(left)];
              return (
                <path
                  key={left}
                  d={`M 0,${y1} C 50,${y1} 50,${y2} 100,${y2}`}
                  stroke={color}
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        </div>

        {/* Right Terminals */}
        <div className="terminals-col right">
          {rightOrder.current.map((colIdx, idx) => {
            const isConnected = Object.values(connections).includes(idx);
            const col = COLORS[colIdx];
            return (
              <button
                key={idx}
                className={`terminal-btn right ${isConnected ? "connected" : ""}`}
                style={{ "--wire-color": col } as React.CSSProperties}
                disabled={isConnected}
                onClick={() => handleRightClick(idx)}
              >
                <span className="terminal-label">{COLOR_NAMES[colIdx].toUpperCase()}</span>
                <span className="wire-stub" style={{ background: col }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}