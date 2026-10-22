import { Modal } from "@/components/ui/Modal";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useGame } from "@/features/game/model/game-store";
import { leave } from "@/features/game/network/game-client";
import { RoomRules } from "@/features/lobby/components/RoomRules";
import { useState } from "react";

export function MissionSettingsPanel() {
  const s = useGame();
  const [section, setSection] = useState<"room" | "meetings">("room");
  if (!s.room) return null;
  return (
    <Modal
      title="Mission Settings"
      className="mission-settings-dialog"
      close={() => s.set({ missionSettings: false })}
    >
      <nav className="mission-sections" aria-label="Mission settings sections">
        {(["room", "meetings"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={section === item}
            onClick={() => setSection(item)}
          >
            {item === "room" ? "Room" : "Meetings"}
          </button>
        ))}
      </nav>
      <ScrollArea key={section} label={`${section} settings`}>
        <div className="mission-rules-group">
          <RoomRules section={section} />
        </div>
      </ScrollArea>
      <footer className="mission-settings-footer">
        <button
          className="primary"
          onClick={() => s.set({ missionSettings: false })}
        >
          Done
        </button>
        <button
          className="text-button error-text"
          onClick={() => {
            s.set({ missionSettings: false });
            leave();
          }}
        >
          Leave expedition
        </button>
      </footer>
    </Modal>
  );
}
