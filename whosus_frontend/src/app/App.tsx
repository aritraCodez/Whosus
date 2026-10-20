import { usePlayerSession } from "@/app/hooks/use-player-session";
import { SceneBoundary } from '@/components/feedback/SceneBoundary';
import { Wardrobe } from "@/features/appearance/components/Wardrobe";
import { GameHUD } from '@/features/game/components/GameHUD';
import { useGameControls } from "@/features/game/hooks/use-game-controls";
import { useGame } from "@/features/game/model/game-store";
import { Menu } from '@/features/lobby/components/Menu';
import Scene from "@/features/scene/components/Scene";
import { SettingsPanel } from '@/features/settings/components/SettingsPanel';
import {
X
} from "lucide-react";
import { useEffect } from "react";
export default function App() {
  const s = useGame();
  const { name, setName, color, setColor, hat } = usePlayerSession();
  useGameControls();
  useEffect(() => {
    if (!s.error) return;
    const timer = setTimeout(() => useGame.setState({ error: "" }), 7000);
    return () => clearTimeout(timer);
  }, [s.error]);
  return (
    <div
      className={`app ${s.room ? "in-game" : "at-menu"} ${s.room?.phase === "lobby" ? "in-lobby" : ""}`}
    >
      <div className="scene-wrap">
        <SceneBoundary>
          <Scene menu={!s.room} color={color} hat={hat} />
        </SceneBoundary>
      </div>
      {s.room ? (
        <GameHUD />
      ) : (
        <Menu {...{ name, setName, color, setColor, hat }} />
      )}
      {s.settings && <SettingsPanel />}
      {s.wardrobe && <SceneBoundary><Wardrobe /></SceneBoundary>}
      {(s.error || s.voiceError) && (
        <div className="toast" role="alert">
          <span>{s.error || s.voiceError}</span>
          <button
            aria-label="Dismiss error"
            onClick={() => s.set({ error: "", voiceError: "" })}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {s.status === "connecting" && (
        <div className="connecting">
          <span className="live-dot" /> Connecting to your expedition…
        </div>
      )}
    </div>
  );
}