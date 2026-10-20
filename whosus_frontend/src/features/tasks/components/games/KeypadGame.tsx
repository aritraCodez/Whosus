import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import {
Check
} from "lucide-react";
import { useState } from "react";
export function KeypadGame({ finish }: { finish: () => void }) {
  const [targetCode] = useState(() =>
    String(Math.floor(10000 + Math.random() * 90000)),
  );
  const [entered, setEntered] = useState("");
  const [success, setSuccess] = useState(false);

  const pressDigit = (digit: string) => {
    if (success || entered.length >= 5) return;
    playTaskSound("beep");
    const next = entered + digit;
    setEntered(next);
  };

  const clear = () => {
    playTaskSound("click");
    setEntered("");
  };

  const check = () => {
    if (entered === targetCode) {
      setSuccess(true);
      playTaskSound("success");
      setTimeout(finish, 800);
    } else {
      playTaskSound("buzz");
      setEntered("");
    }
  };

  return (
    <div className="task-game keypad-game">
      <div className="keypad-unit">
        <div className="sticky-note">
          <small>SEC ID CODE</small>
          <strong>{targetCode}</strong>
        </div>

        <div className={`keypad-display ${success ? "success" : ""}`}>
          <span>{entered.padEnd(5, "•")}</span>
          {success && <Check className="check-icon" size={20} />}
        </div>

        <div className="keypad-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => pressDigit(d)} className="key-btn">
              {d}
            </button>
          ))}
          <button onClick={clear} className="key-btn action-key clear">
            CLR
          </button>
          <button onClick={() => pressDigit("0")} className="key-btn">
            0
          </button>
          <button onClick={check} className="key-btn action-key enter">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}