import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
export function CameraRig({ menu, lobby }: { menu: boolean; lobby: boolean }) {
  const { camera, size } = useThree();
  const map = useGame((s) => s.map);
  useFrame((_, dt) => {
    const cam = camera as THREE.OrthographicCamera;
    const target = new THREE.Vector3(
      menu
        ? -2
        : lobby
          ? size.width > 900
            ? 1.8
            : 0
          : map
            ? 0
            : motion.renderX,
      0,
      menu ? 0 : lobby ? -1 : map ? 0 : motion.renderZ,
    );
    const desired = target.clone().add(new THREE.Vector3(13, 19, 18));
    cam.position.lerp(desired, 1 - Math.exp(-dt * 14));
    cam.lookAt(cam.position.x - 13, cam.position.y - 19, cam.position.z - 18);
    const zoom = menu
      ? Math.min(size.width / 35, size.height / 29)
      : lobby
        ? Math.min(size.width / (size.width > 900 ? 22 : 19), size.height / 16)
        : map
          ? Math.min(size.width / 34, size.height / 32)
          : size.width > 900
            ? Math.min(size.width / 8.2, size.height / 5.9)
            : Math.max(size.width / 7.5, size.height / 13.5);
    cam.zoom = THREE.MathUtils.damp(cam.zoom, zoom, 5, dt);
    cam.updateProjectionMatrix();
  }, -1);
  return null;
}
