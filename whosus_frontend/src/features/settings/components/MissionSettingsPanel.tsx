import { GameSelect } from "@/components/ui/GameSelect";
import { Modal } from "@/components/ui/Modal";
import { useGame } from "@/features/game/model/game-store";
import { act, leave } from "@/features/game/network/game-client";
import { RoomRules } from "@/features/lobby/components/RoomRules";

export function MissionSettingsPanel() {
  const s = useGame();
  if (!s.room) return null;
  return (
    <Modal
      title="Mission Settings"
      close={() => s.set({ missionSettings: false })}
    >
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
      <button
        className="danger full"
        onClick={() => {
          s.set({ missionSettings: false });
          leave();
        }}
      >
        Leave expedition
      </button>
    </Modal>
  );
}
