import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";
import { type Player } from "@/features/game/model/types";
import {
LOBBY_SEATS
} from "@/features/game/model/world";

import { AnimatedPip } from '@/features/scene/components/AnimatedPip';
import {
Html
} from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
export function Avatar({ p, local = false }: { p: Player; local?: boolean }) {
  const group = useRef<THREE.Group>(null),
    previous = useRef([p.x, p.z]);
  const initialPosition = useRef<[number, number, number]>([p.x, 0, p.z]);
  const walking = useRef(false);
  const seated = (p.seat ?? -1) >= 0;
  const seat = seated ? LOBBY_SEATS[p.seat!] : undefined;
  const lastSeat = useRef(p.seat);
  const transitionUntil = useRef(0);
  const speaking = useGame((s) => s.speaking.includes(p.id));
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    if (lastSeat.current !== p.seat) {
      lastSeat.current = p.seat;
      transitionUntil.current = clock.elapsedTime + .5;
    }
    const x = local ? motion.renderX : p.x,
      z = local ? motion.renderZ : p.z;
    const dx = x - g.position.x,
      dz = z - g.position.z;
    walking.current = !seated && (
      Math.hypot(x - previous.current[0], z - previous.current[1]) > 0.001 ||
      Math.hypot(dx, dz) > 0.035);
    const immediate = local && clock.elapsedTime >= transitionUntil.current;
    g.position.x = immediate ? x : THREE.MathUtils.damp(g.position.x, x, 12, dt);
    g.position.z = immediate ? z : THREE.MathUtils.damp(g.position.z, z, 12, dt);
    if (seat || walking.current) {
      const target = seat ? -seat.side * Math.PI / 2 : Math.atan2(dx, dz);
      g.rotation.y +=
        Math.atan2(
          Math.sin(target - g.rotation.y),
          Math.cos(target - g.rotation.y),
        ) * Math.min(1, dt * 12);
    }
    previous.current = [x, z];
  });
  return (
    <group ref={group} position={initialPosition.current} rotation={[0, seat ? -seat.side * Math.PI / 2 : 0, 0]}>
      <AnimatedPip
        outfit={p.outfit} visor={p.visor} accessory={p.accessory} boots={p.boots}
        color={p.color}
        hat={p.hat}
        ghost={!p.alive}
        seated={seated}
        walking={walking}
      />
      {/* Keep nameplates in screen pixels; distanceFactor multiplies orthographic zoom. */}
      <Html
        position={[0, 2.05, 0]}
        center
        pointerEvents="none"
        style={{ pointerEvents: "none" }}
        zIndexRange={[10, 0]}
      >
        <div
          className={`nameplate ${local ? "you" : ""} ${speaking ? "speaking" : ""}`}
        >
          {speaking && <span>▥ </span>}
          {p.name}
          {local ? " · you" : ""}
        </div>
      </Html>
      {local && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.52, 0.58, 32]} />
          <meshBasicMaterial color="#f6bd4f" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}
