import { useGame } from "@/features/game/model/game-store";
import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import {
Activity
} from "lucide-react";
import { useEffect,useState } from "react";
export function ScanGame({ finish }: { finish: () => void }) {
  const s = useGame();
  const me = s.room?.players.find((p) => p.id === s.id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    playTaskSound("beep");
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          playTaskSound("success");
          setTimeout(finish, 600);
          return 100;
        }
        return prev + 10;
      });
    }, 280);

    return () => clearInterval(interval);
  }, [finish]);

  return (
    <div className="task-game scan-game">
      <div className="medbay-scanner">
        <div className="scan-beam-visual" />
        <Activity size={32} className="scan-icon" />

        <div className="bio-readout">
          <h4>BIOMETRIC SCAN IN PROGRESS</h4>
          <div className="bio-row">
            <span>SUBJECT:</span>
            <strong>{me?.name || "EXPLORER"}</strong>
          </div>
          <div className="bio-row">
            <span>ID:</span>
            <strong>#9904-BIO</strong>
          </div>
          <div className="bio-row">
            <span>STATUS:</span>
            <strong className="clean-status">NOMINAL CREWMATE</strong>
          </div>
        </div>

        <div className="task-meter">
          <i style={{ width: `${progress}%` }} />
        </div>
        <small>{progress < 100 ? "Hold position on the diagnostic pad…" : "Diagnostic Complete."}</small>
      </div>
    </div>
  );
}