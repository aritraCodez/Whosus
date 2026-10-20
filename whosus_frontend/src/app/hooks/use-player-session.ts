import { useAppearance } from "@/features/appearance/model/appearance-store";
import { useGame } from "@/features/game/model/game-store";
import { COLORS } from "@/features/game/model/types";
import { initializeNetwork } from "@/features/game/network/game-client";
import { makeDefaultName } from "@/features/lobby/utils/player-name";
import { useEffect,useState } from "react";
export function usePlayerSession() {
  const s = useGame(),
    [name, setName] = useState(() => {
      const savedName = localStorage.getItem("whosus-name");
      return savedName && savedName !== "Miso" ? savedName : makeDefaultName();
    });
  const { appearance, update: updateAppearance } = useAppearance();
  const { color, hat } = appearance;
  const setColor = (color: number) => updateAppearance({ color });
  const roomLook = s.room?.players.find(p => p.id === s.id);
  useEffect(() => {
    if (roomLook) updateAppearance({ color: COLORS.indexOf(roomLook.color), hat: roomLook.hat, outfit: roomLook.outfit, visor: roomLook.visor, accessory: roomLook.accessory, boots: roomLook.boots });
  }, [roomLook?.color, roomLook?.hat, roomLook?.outfit, roomLook?.visor, roomLook?.accessory, roomLook?.boots, updateAppearance]);
  useEffect(() => initializeNetwork(), []);
  useEffect(() => {
    localStorage.setItem("whosus-name", name);
  }, [name]);
  const roomName = s.room?.players.find((p) => p.id === s.id)?.name;
  useEffect(() => {
    if (roomName) setName(roomName);
  }, [roomName]);

return { name, setName, color, setColor, hat };
}