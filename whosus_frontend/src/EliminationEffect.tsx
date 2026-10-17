import { useRef, type ComponentType } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Elimination } from "./types";

export const ELIMINATION_NAMES = [
  "Plasma shot",
  "Energy blade",
  "Head spin",
  "Monster chomp",
];

// All effects follow a server-confirmed event; they never decide a kill locally.
export function EliminationEffect({
  event,
  Actor,
}: {
  event: Elimination;
  Actor: ComponentType<{
    color: string;
    hat?: string;
    headTurn?: React.RefObject<number>;
  }>;
}) {
  const attacker = useRef<THREE.Group>(null),
    victim = useRef<THREE.Group>(null);
  const weapon = useRef<THREE.Group>(null),
    burst = useRef<THREE.Group>(null);
  const monster = useRef<THREE.Group>(null),
    jaw = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const headTurn = useRef(0);
  const time = useRef(event.elapsed);
  const distance = Math.max(
    0.6,
    Math.hypot(
      event.victim.x - event.attacker.x,
      event.victim.z - event.attacker.z,
    ),
  );
  const angle = Math.atan2(
    event.victim.x - event.attacker.x,
    event.victim.z - event.attacker.z,
  );
  useFrame((_, dt) => {
    const t = (time.current = Math.min(2.4, time.current + Math.min(dt, 0.1)));
    const hit = THREE.MathUtils.smoothstep(t, 0.65, 1.15);
    const settle = THREE.MathUtils.smoothstep(t, 1.5, 2.3);
    if (attacker.current) {
      attacker.current.position.z =
        event.style === 0
          ? -0.12 * Math.sin(hit * Math.PI)
          : (distance - 0.6) * Math.sin((hit * Math.PI) / 2) * (1 - settle);
      attacker.current.rotation.x =
        event.style === 1 ? 0.25 * Math.sin(hit * Math.PI) : 0;
      attacker.current.visible = event.style !== 3 || t < 0.35 || t > 2.05;
    }
    if (victim.current) {
      victim.current.position.set(
        0,
        event.style === 2 ? 0.25 * Math.sin(hit * Math.PI) : 0,
        distance,
      );
      victim.current.rotation.x = event.style === 3 ? 0 : (hit * Math.PI) / 2;
      victim.current.rotation.y = Math.PI;
      victim.current.scale.setScalar(
        event.style === 3 ? Math.max(0.001, 1 - hit) : 1,
      );
      if (event.style === 3)
        victim.current.position.z = distance * (1 - hit) + 0.5 * hit;
      victim.current.visible = event.style !== 3 || hit < 1;
    }
    if (weapon.current) {
      weapon.current.visible = t < 1.55;
      weapon.current.rotation.x =
        event.style === 1 ? -1.2 + 2.4 * Math.sin(hit * Math.PI) : 0;
    }
    if (beam.current) {
      beam.current.visible = event.style === 0 && t > 0.62 && t < 0.88;
      beam.current.scale.x = beam.current.scale.y = 1 + Math.sin(t * 80) * 0.3;
    }
    if (burst.current) {
      burst.current.visible = t > 0.7 && t < 1.5;
      burst.current.scale.setScalar(0.2 + (t - 0.7) * 1.8);
      burst.current.rotation.y = t * 3;
    }
    if (monster.current) {
      monster.current.visible = event.style === 3 && t > 0.3 && t < 2.1;
      const grow =
        THREE.MathUtils.smoothstep(t, 0.3, 0.6) *
        (1 - THREE.MathUtils.smoothstep(t, 1.8, 2.1));
      monster.current.scale.setScalar(Math.max(0.001, grow));
      monster.current.position.z = (distance - 0.8) * hit * (1 - settle);
    }
    if (jaw.current)
      jaw.current.rotation.x = -0.6 + Math.sin(hit * Math.PI) * 0.9;
    headTurn.current = event.style === 2 ? hit * Math.PI * 2 : 0;
  });
  return (
    <group
      position={[event.attacker.x, 0, event.attacker.z]}
      rotation={[0, angle, 0]}
    >
      <group ref={attacker}>
        <Actor color={event.attacker.color} hat={event.attacker.hat} />
        {(event.style === 0 || event.style === 1) && (
          <group ref={weapon} position={[0.4, 0.9, 0.45]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.11, 0.45, 8]} />
              <meshStandardMaterial
                color="#243743"
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
            {event.style === 0 ? (
              <mesh position={[0, 0.08, 0.25]}>
                <boxGeometry args={[0.24, 0.22, 0.48]} />
                <meshStandardMaterial
                  color="#a7decc"
                  emissive="#61d5c5"
                  emissiveIntensity={0.5}
                />
              </mesh>
            ) : (
              <mesh position={[0, 0.4, 0.12]}>
                <coneGeometry args={[0.12, 0.8, 4]} />
                <meshStandardMaterial
                  color="#b9f9f4"
                  emissive="#4af3e9"
                  emissiveIntensity={2}
                />
              </mesh>
            )}
          </group>
        )}
      </group>
      <group
        ref={victim}
        position={[0, 0, distance]}
        rotation={[0, Math.PI, 0]}
      >
        <Actor
          color={event.victim.color}
          hat={event.victim.hat}
          headTurn={headTurn}
        />
      </group>
      <mesh ref={beam} position={[0.15, 1, distance / 2]} visible={false}>
        <boxGeometry args={[0.07, 0.07, distance]} />
        <meshBasicMaterial color="#b9fff6" toneMapped={false} />
      </mesh>
      <group ref={burst} position={[0, 1, distance]} visible={false}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(i * 2.4) * 0.5,
              Math.cos(i * 2.4) * 0.5,
              Math.sin(i * 3) * 0.3,
            ]}
            rotation={[i, i, 0]}
          >
            <octahedronGeometry args={[0.07]} />
            <meshBasicMaterial
              color={event.style === 3 ? "#b9ed83" : "#ffe29a"}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <group ref={monster} visible={false}>
        <mesh position={[0, 0.65, 0]} scale={[0.8, 1, 0.65]}>
          <sphereGeometry args={[0.9, 16, 12]} />
          <meshStandardMaterial color={event.attacker.color} />
        </mesh>
        <mesh position={[0, 1.35, 0.4]} scale={[0.85, 0.6, 0.8]}>
          <sphereGeometry args={[0.8, 16, 12]} />
          <meshStandardMaterial color={event.attacker.color} />
        </mesh>
        <mesh position={[0, 1.05, 1]} scale={[1, 0.8, 0.15]}>
          <sphereGeometry args={[0.62, 16, 10]} />
          <meshStandardMaterial color="#182833" />
        </mesh>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} position={[x, 1.65, 0.97]}>
            <sphereGeometry args={[0.13, 12, 8]} />
            <meshBasicMaterial color="#ff7d77" toneMapped={false} />
          </mesh>
        ))}
        <group ref={jaw} position={[0, 0.7, 0.5]}>
          <mesh scale={[0.85, 0.25, 0.8]}>
            <sphereGeometry args={[0.8, 16, 8]} />
            <meshStandardMaterial color={event.attacker.color} />
          </mesh>
          {[-0.45, -0.22, 0, 0.22, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.2, 0.45]}>
              <coneGeometry args={[0.1, 0.3, 4]} />
              <meshStandardMaterial color="#fff3d3" />
            </mesh>
          ))}
        </group>
        {[-0.45, -0.22, 0, 0.22, 0.45].map((x) => (
          <mesh key={x} position={[x, 1.4, 0.95]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.1, 0.3, 4]} />
            <meshStandardMaterial color="#fff3d3" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
