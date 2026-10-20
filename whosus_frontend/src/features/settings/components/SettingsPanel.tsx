import { Modal } from "@/components/ui/Modal";
import { useGame } from "@/features/game/model/game-store";
import { GameSelect } from "@/components/ui/GameSelect";
import { Headphones } from "lucide-react";
export function SettingsPanel() {
  const s = useGame();
  return (
    <Modal title="Station Settings" close={() => s.set({ settings: false })}>
      <label className="toggle-line">
        <span>
          <strong>Station sounds</strong>
          <small>Interaction tones and meeting alerts</small>
        </span>
        <input
          type="checkbox"
          checked={s.sound}
          onChange={(e) => s.set({ sound: e.target.checked })}
        />
      </label>
      <div className="toggle-line">
        <span>
          <strong>Graphics</strong>
          <small>Low reduces shadows and resolution</small>
        </span>
        <GameSelect
          value={s.quality}
          options={[
            { value: "high", label: "High" },
            { value: "low", label: "Low / mobile" },
          ]}
          onChange={(v) => s.set({ quality: v })}
        />
      </div>
      <div className="settings-voice">
        <Headphones />
        <h3>A good alibi deserves good audio.</h3>
        <p>
          Headphones recommended. Microphone access needs HTTPS on Android, or
          localhost on desktop. Joining voice requests microphone permission;
          your mic stays off until you unmute or hold to talk.
        </p>
      </div>
      <p className="hint">
        Voice changes with the game: everyone in the lobby, nearby living
        players during exploration, all living players in meetings, and ghosts
        with ghosts.
      </p>
    </Modal>
  );
}
