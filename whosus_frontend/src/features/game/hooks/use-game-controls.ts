import {
  eliminate,
  interact,
  report,
} from "@/features/game/actions/game-actions";
import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";
import { STATIONS } from "@/features/game/model/world";
import { act } from "@/features/game/network/game-client";
import { voice } from "@/features/voice/voice-client";
import { useEffect } from "react";
export function useGameControls() {
  useEffect(() => {
    let swipe:
      { pointerId: number; startX: number; startY: number } | undefined;
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,dialog,.task-list",
        )
      )
        return;
      if (e.code === "Tab") {
        e.preventDefault();
        if (!e.repeat && useGame.getState().room?.phase !== "lobby")
          useGame.setState({ map: !useGame.getState().map });
        return;
      }
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Space",
        ].includes(e.code)
      )
        e.preventDefault();
      motion.keys.add(e.code);
      if (e.code === "KeyF") {
        eliminate();
        return;
      }
      if (e.code === "KeyE") {
        if (
          !e.repeat ||
          STATIONS.some((t) => Math.hypot(t.x - motion.x, t.z - motion.z) < 2)
        )
          interact();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyV") voice.ptt(true);
      if (e.code === "KeyM") voice.mute();
      if (e.code === "KeyR") report();
      if (e.code === "KeyQ") act("vent");
      if (e.code === "Enter") useGame.setState({ chatOpen: true });
    };
    const up = (e: KeyboardEvent) => {
      motion.keys.delete(e.code);
      if (e.code === "KeyV") voice.ptt(false);
    };
    const reset = () => {
      motion.keys.clear();
      motion.dx = motion.dz = 0;
      swipe = undefined;
      voice.ptt(false);
    };
    const pointerDown = (e: PointerEvent) => {
      if (
        e.pointerType !== "touch" ||
        useGame.getState().room ||
        !(e.target instanceof Element) ||
        !e.target.closest(".scene-wrap") ||
        e.target.closest("button,input,select,a,dialog")
      )
        return;
      swipe = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
    };
    const pointerMove = (e: PointerEvent) => {
      if (!swipe || e.pointerId !== swipe.pointerId) return;
      const dx = e.clientX - swipe.startX;
      const dy = e.clientY - swipe.startY;
      motion.dx =
        Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
    };
    const pointerUp = (e: PointerEvent) => {
      if (!swipe || e.pointerId !== swipe.pointerId) return;
      swipe = undefined;
      motion.dx = 0;
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", reset);
    window.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("pointermove", pointerMove, true);
    window.addEventListener("pointerup", pointerUp, true);
    window.addEventListener("pointercancel", pointerUp, true);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("pointermove", pointerMove, true);
      window.removeEventListener("pointerup", pointerUp, true);
      window.removeEventListener("pointercancel", pointerUp, true);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);
}
