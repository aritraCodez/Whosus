import { motion,renderPosition } from "@/features/game/model/motion";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
export function MotionFrame() {
  const revision = useRef(-1);
  useFrame((_, dt) => {
    const [x, z] = renderPosition();
    const snap =
      revision.current !== motion.revision ||
      Math.hypot(x - motion.renderX, z - motion.renderZ) > 3;
    motion.renderX = snap ? x : THREE.MathUtils.damp(motion.renderX, x, 60, dt);
    motion.renderZ = snap ? z : THREE.MathUtils.damp(motion.renderZ, z, 60, dt);
    revision.current = motion.revision;
  }, -2);
  return null;
}