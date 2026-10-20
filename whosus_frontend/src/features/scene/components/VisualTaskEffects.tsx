import { useGame } from "@/features/game/model/game-store";
import type { VisualEffect } from "@/features/game/model/types";
import * as THREE from "three";
export const EMPTY_VISUALS: VisualEffect[] = [];

export function VisualTaskEffects() {
  const visuals = useGame((s) => s.room?.visuals ?? EMPTY_VISUALS);
  const id = useGame((s) => s.id);
  return (
    <>
      {visuals.map((v, i) => {
        if (v.player !== id) return null;
        if (v.kind === "scan") {
          return (
            <group key={i} position={[-8, 0, 2]}>
              <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.9, 0.9, 2.4, 32, 1, true]} />
                <meshBasicMaterial color="#4ef6c5" transparent opacity={0.35} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.7, 0.95, 32]} />
                <meshBasicMaterial color="#4ef6c5" transparent opacity={0.8} />
              </mesh>
            </group>
          );
        }
        if (v.kind === "shields") {
          return (
            <group key={i} position={[12, 0.5, 10]}>
              <mesh position={[0, 1, 0]}>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshBasicMaterial color="#6ad9c5" transparent opacity={0.25} wireframe />
              </mesh>
            </group>
          );
        }
        if (v.kind === "asteroids") {
          return (
            <group key={i} position={[12, 1.5, -10]}>
              <mesh rotation={[0, 0.4, 0]}>
                <boxGeometry args={[0.2, 0.2, 3]} />
                <meshBasicMaterial color="#ff4466" />
              </mesh>
            </group>
          );
        }
        return null;
      })}
    </>
  );
}