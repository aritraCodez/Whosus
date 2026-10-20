import { GameSelect } from "@/components/ui/GameSelect";
import { Modal } from "@/components/ui/Modal";
import { useGame } from "@/features/game/model/game-store";
import { act, leave } from "@/features/game/network/game-client";
import { RoomRules } from "@/features/lobby/components/RoomRules";
import { voice } from "@/features/voice/voice-client";
import { Headphones } from "lucide-react";
export function SettingsPanel() {
  const s = useGame();
  return (
    <Modal
      title="Station & Mission Settings"
      close={() => s.set({ settings: false })}
    >
      {s.room && (
        <div className="mission-rules-group">
          <span className="eyebrow">MISSION RULES</span>
          <RoomRules />
          <div className="toggle-line">
            <span>
              <strong>Task Progress Bar</strong>
              <small>
                {s.id === s.room.host
                  ? "Choose when crew progress updates"
                  : `Current rule: ${s.room.taskBarMode || "always"}`}
              </small>
            </span>
            <GameSelect
              ariaLabel="Task Progress Bar"
              value={s.room.taskBarMode || "always"}
              disabled={s.id !== s.room.host || s.room.phase !== "lobby"}
              options={[
                { value: "always", label: "Always (Real-time)" },
                { value: "meetings", label: "Meetings Only" },
                { value: "never", label: "Never (Hidden)" },
              ]}
              onChange={(v) => act("settings", "taskBarMode", String(v))}
            />
          </div>
          <label className="toggle-line">
            <span>
              <strong>Visual Tasks</strong>
              <small>
                Show completion lights and effects only to the player doing the
                task
              </small>
            </span>
            <input
              type="checkbox"
              checked={s.room.visualTasks ?? true}
              aria-label="Visual Tasks"
              disabled={s.id !== s.room.host || s.room.phase !== "lobby"}
              onChange={(e) => act("settings", "visualTasks", e.target.checked)}
            />
          </label>
        </div>
      )}
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
        {s.room && (
          <button
            className="secondary full"
            onClick={() => void voice.enable(false)}
          >
            Join / reconnect voice (mic off)
          </button>
        )}
      </div>
      <p className="hint">
        Voice changes with the game: everyone in the lobby, nearby living
        players during exploration, all living players in meetings, and ghosts
        with ghosts.
      </p>
      {s.room && (
        <button
          className="danger full"
          onClick={() => {
            s.set({ settings: false });
            leave();
          }}
        >
          Leave expedition
        </button>
      )}
    </Modal>
  );
}
