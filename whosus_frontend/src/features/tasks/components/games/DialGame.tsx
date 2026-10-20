import { playTaskSound } from "@/features/tasks/audio/task-sounds";
import { Radio } from "lucide-react";
import { useState } from "react";
export function DialGame({ finish }: { finish: () => void }) {
  const [val, setVal] = useState(15);
  const target = 75;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVal(v);
    if (Math.abs(v - target) <= 2) {
      playTaskSound("success");
      setTimeout(finish, 700);
    } else {
      playTaskSound("click");
    }
  };

  const locked = Math.abs(val - target) <= 2;

  return (
    <div className="task-game dial-game">
      <div className="task-instructions">
        <h3>Calibrate Security Relay</h3>
        <p>Rotate the tuner to align frequency to 75.0 MHz.</p>
      </div>

      <div className="dial-display">
        <Radio size={28} />
        <div className="dial-readout">
          <strong>{val}.0 MHz</strong>
          <span className={locked ? "locked" : ""}>
            {locked ? "LOCKED" : "SEARCHING..."}
          </span>
        </div>
      </div>

      <div className="dial-control">
        <input
          type="range"
          min="0"
          max="100"
          value={val}
          disabled={locked}
          onChange={handleChange}
          className="dial-slider"
        />
      </div>
    </div>
  );
}
