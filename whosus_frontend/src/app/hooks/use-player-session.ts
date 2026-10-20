import { useAppearance } from "@/features/appearance/model/appearance-store";
import { useGame } from "@/features/game/model/game-store";
import { COLORS } from "@/features/game/model/types";
import { initializeNetwork } from "@/features/game/network/game-client";
import { makeDefaultName } from "@/features/lobby/utils/player-name";
import { useEffect, useState } from "react";
export function usePlayerSession() {
  const s = useGame(),
    [name, setName] = useState(() => {
      const savedName = localStorage.getItem("whosus-name");
      return savedName && savedName !== "Miso" ? savedName : makeDefaultName();
    });
  const { appearance, update: updateAppearance } = useAppearance();
  const { color, hat } = appearance;
  const setColor = (color: number) => updateAppearance({ color });
  const roomLook = s.room?.players.find((p) => p.id === s.id);
  const roomColor = roomLook?.color;
  const roomHat = roomLook?.hat;
  const roomOutfit = roomLook?.outfit;
  const roomVisor = roomLook?.visor;
  const roomAccessory = roomLook?.accessory;
  const roomBoots = roomLook?.boots;
  useEffect(() => {
    if (roomColor !== undefined)
      updateAppearance({
        color: COLORS.indexOf(roomColor),
        hat: roomHat,
        outfit: roomOutfit,
        visor: roomVisor,
        accessory: roomAccessory,
        boots: roomBoots,
      });
  }, [
    roomColor,
    roomHat,
    roomOutfit,
    roomVisor,
    roomAccessory,
    roomBoots,
    updateAppearance,
  ]);
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
