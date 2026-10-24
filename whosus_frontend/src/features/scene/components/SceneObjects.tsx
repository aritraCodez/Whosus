import {
  interactWithStation,
  openPractice,
} from "@/features/game/actions/interactions";
import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";
import { stationsFor } from "@/features/game/model/maps";

import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
export function Plant({
  at,
  scale = 1,
}: {
  at: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={at} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.25, 0.5, 8]} />
        <meshStandardMaterial color="#e7ccb2" />
      </mesh>
      {[-0.5, 0.5, 0].map((r, i) => (
        <mesh
          key={i}
          position={[r * 0.3, 0.65 + i * 0.12, 0]}
          rotation={[r, 0, r]}
          scale={[0.22, 0.55, 0.22]}
          castShadow
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={["#679878", "#9ab974", "#81ab8d"][i]} />
        </mesh>
      ))}
    </group>
  );
}

export function Console({
  x,
  z,
  color,
  stationId,
  practice = false,
  touchControls,
}: {
  x: number;
  z: number;
  color: string;
  stationId?: string;
  practice?: boolean;
  touchControls: boolean;
}) {
  const { scene } = useGLTF("/models/task-console.glb");
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);
  const s = useGame(),
    r = s.room;
  const me = r?.players.find((p) => p.id === s.id);
  const task = r?.tasks.find((t) => t.id === stationId);
  const forest = !practice && r?.mapId === "mosslight";
  const definition = stationsFor(r?.mapId).find((t) => t.id === stationId);
  const done = !!task?.done || !!(stationId && s.fakeDone[stationId]);
  const success = !!r?.visuals?.some(
    (v) => v.player === s.id && v.task === stationId,
  );
  const repair = stationId === "reactor_monitor" && !!r?.sabotage;
  const active = practice || repair || (!!task && !done);
  const near = !!me && Math.hypot(me.x - x, me.z - z) <= 2.5;
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      ring.current.rotation.z = clock.elapsedTime * 0.7;
      ring.current.position.y = 1.42 + Math.sin(clock.elapsedTime * 2) * 0.07;
    }
  });
  const statusColor = done ? "#6ad9c5" : active ? color : "#718d91";
  const activate = () =>
    practice ? openPractice() : interactWithStation(stationId);
  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        activate();
      }}
    >
      {forest ? (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.8, 0.8]} />
            <meshStandardMaterial color="#526d50" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.87, 0]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[0.72, 0.12, 0.53]} />
            <meshStandardMaterial
              color="#b7cc8f"
              emissive="#66894f"
              emissiveIntensity={0.2}
            />
          </mesh>
          <mesh position={[0, 1.12, -0.13]}>
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial
              color={statusColor}
              emissive={statusColor}
              emissiveIntensity={0.45}
            />
          </mesh>
        </group>
      ) : (
        <primitive object={model} />
      )}
      <mesh ref={ring} position={[0, 1.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.025, 8, 24, Math.PI * 1.65]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={success ? 3 : active ? 1.2 : 0.15}
        />
      </mesh>
      {(active || success) && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, success ? 0.95 : 0.75, 32]} />
          <meshBasicMaterial
            color={statusColor}
            transparent
            opacity={success ? 1 : near ? 0.8 : 0.3}
          />
        </mesh>
      )}
      {(near || practice) && (
        <Html position={[0, 1.95, 0]} center zIndexRange={[10, 1]}>
          <button
            className={`station-label ${practice ? "practice" : ""} ${active ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              activate();
            }}
          >
            <strong>
              {practice
                ? "Practice station"
                : repair
                  ? forest
                    ? "Restore the amber heart"
                    : "Repair reactor"
                  : definition?.name}
            </strong>
            <small>
              {success
                ? "Task complete"
                : near
                  ? active
                    ? touchControls
                      ? "Tap to interact"
                      : "Tap or press E"
                    : done
                      ? "Complete"
                      : "Task console"
                  : "Walk closer to try tasks"}
            </small>
          </button>
        </Html>
      )}
    </group>
  );
}

export function FloorLabel({
  name,
  x,
  z,
}: {
  name: string;
  x: number;
  z: number;
}) {
  const label = useRef<HTMLSpanElement>(null);
  useFrame(() => {
    if (!label.current) return;
    const near =
      Math.hypot(motion.renderX - x, motion.renderZ - (z + 3.2)) < 2.5;
    label.current.style.opacity = near ? "0" : "";
  });
  return (
    <Html
      position={[x, 0.05, z + 3.2]}
      center
      transform
      rotation={[-Math.PI / 2, 0, 0]}
      distanceFactor={4}
      zIndexRange={[1, 0]}
    >
      <span ref={label} className="floor-label">
        {name}
      </span>
    </Html>
  );
}
