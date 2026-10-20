import { playTaskSound } from "@/features/tasks/audio/task-sounds";
import { CreditCard } from "lucide-react";
import { useRef, useState } from "react";
export function SwipeGame({ finish }: { finish: () => void }) {
  const [status, setStatus] = useState<
    "idle" | "reading" | "fast" | "slow" | "accepted"
  >("idle");
  const [progress, setProgress] = useState(0);
  const startTime = useRef(0);
  const isDragging = useRef(false);

  const startSwipe = () => {
    startTime.current = Date.now();
    isDragging.current = true;
    setStatus("reading");
    playTaskSound("beep");
  };

  const handleDrag = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setProgress(val);
    if (val === 100 && isDragging.current) {
      isDragging.current = false;
      const duration = (Date.now() - startTime.current) / 1000;
      if (duration < 0.25) {
        setStatus("fast");
        playTaskSound("buzz");
        setTimeout(() => {
          setProgress(0);
          setStatus("idle");
        }, 1200);
      } else if (duration > 1.8) {
        setStatus("slow");
        playTaskSound("buzz");
        setTimeout(() => {
          setProgress(0);
          setStatus("idle");
        }, 1200);
      } else {
        setStatus("accepted");
        playTaskSound("success");
        setTimeout(finish, 800);
      }
    }
  };

  return (
    <div className="task-game swipe-game">
      <div className="card-reader">
        <div className="reader-header">
          <CreditCard size={18} />
          <span>ADMIN ACCESS PORTAL</span>
          <div className="status-lights">
            <span
              className={`light red ${status === "idle" || status === "fast" || status === "slow" ? "on" : ""}`}
            />
            <span
              className={`light yellow ${status === "reading" ? "on" : ""}`}
            />
            <span
              className={`light green ${status === "accepted" ? "on" : ""}`}
            />
          </div>
        </div>

        <div className="reader-screen">
          {status === "idle" && "PLEASE SWIPE CARD"}
          {status === "reading" && "READING MAGNETIC STRIP..."}
          {status === "fast" && "TOO FAST. TRY AGAIN."}
          {status === "slow" && "TOO SLOW. TRY AGAIN."}
          {status === "accepted" && "ACCEPTED. THANK YOU."}
        </div>

        <div className="card-slot">
          <div className="card-track">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              disabled={status === "accepted"}
              onPointerDown={startSwipe}
              onChange={handleDrag}
              className="card-slider"
            />
            <div
              className={`crew-id-card ${progress > 10 ? "swiping" : ""}`}
              style={{ transform: `translateX(${progress * 2.2}px)` }}
            >
              <div className="id-photo" />
              <div className="id-details">
                <strong>CREW ID</strong>
                <span>#4902-A</span>
              </div>
            </div>
          </div>
        </div>

        <div className="swipe-hint">
          <span>Drag card smoothly from left to right</span>
        </div>
      </div>
    </div>
  );
}
