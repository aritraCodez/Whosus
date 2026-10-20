import { motion } from "@/features/game/model/motion";

import { useEffect, useRef, useState } from "react";
export function Joystick() {
  const [pos, setPos] = useState([0, 0]);
  const pointer = useRef<number | null>(null);
  const joystickEl = useRef<HTMLDivElement>(null);

  function updateCoords(clientX: number, clientY: number) {
    if (!joystickEl.current) return;
    const box = joystickEl.current.getBoundingClientRect();
    let x = clientX - box.left - box.width / 2,
      z = clientY - box.top - box.height / 2;
    const radius = box.width * 0.32;
    const n = Math.max(1, Math.hypot(x, z) / radius);
    x /= n;
    z /= n;
    setPos([x, z]);
    const dead = Math.hypot(x, z) < 5;
    motion.dx = dead ? 0 : x / radius;
    motion.dz = dead ? 0 : z / radius;
  }

  function stop() {
    pointer.current = null;
    setPos([0, 0]);
    motion.dx = motion.dz = 0;
  }

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (pointer.current === e.pointerId) {
        updateCoords(e.clientX, e.clientY);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pointer.current === e.pointerId) {
        stop();
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      motion.dx = motion.dz = 0;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);

  return (
    <div
      ref={joystickEl}
      className="joystick"
      aria-label="Movement joystick"
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateCoords(e.clientX, e.clientY);
      }}
    >
      <div style={{ transform: `translate(${pos[0]}px,${pos[1]}px)` }} />
      <span>MOVE</span>
    </div>
  );
}
