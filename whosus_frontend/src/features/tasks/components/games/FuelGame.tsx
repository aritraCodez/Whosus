import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import {
Fuel
} from "lucide-react";
import { useEffect,useRef,useState } from "react";
export function FuelGame({ finish }: { finish: () => void }) {
  const [level, setLevel] = useState(0);
  const holding = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  const startFill = () => {
    if (holding.current) return;
    holding.current = true;
    playTaskSound("beep");
    timer.current = setInterval(() => {
      setLevel((prev) => {
        if (prev >= 100) {
          clearInterval(timer.current);
          playTaskSound("success");
          setTimeout(finish, 600);
          return 100;
        }
        return prev + 5;
      });
    }, 120);
  };

  const stopFill = () => {
    holding.current = false;
    clearInterval(timer.current);
  };

  return (
    <div className="task-game fuel-game">
      <div className="fuel-canister">
        <div className="canister-gauge">
          <div className="fuel-liquid" style={{ height: `${level}%` }}>
            <span className="bubble b1" />
            <span className="bubble b2" />
          </div>
          <span className="fill-mark">MAX</span>
        </div>

        <div className="fuel-controls">
          <button
            className="fuel-dispense-btn"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startFill(); }}
            onPointerUp={stopFill}
            onPointerCancel={stopFill}
            onLostPointerCapture={stopFill}
            disabled={level >= 100}
          >
            <Fuel size={28} />
            <strong>{level >= 100 ? "TANK FULL" : "HOLD TO DISPENSE"}</strong>
          </button>
          <small>{level}% Transferred</small>
        </div>
      </div>
    </div>
  );
}