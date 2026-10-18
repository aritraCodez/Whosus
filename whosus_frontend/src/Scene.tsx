import { memo, Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  Html,
  OrthographicCamera,
  RoundedBox,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "./store";
import { motion, renderPosition } from "./network";
import { COLORS, type Player } from "./types";
import { useAppearance, type Cosmetics } from "./appearance";
import { Headwear, Bodywear, OUTFIT_COLORS, BOOT_COLORS } from "./CharacterClothes";
import {
  FLOORS,
  LOBBY_OBSTACLES,
  LOBBY_SEATS,
  nearestLobbySeat,
  WARDROBE_STATION,
  nearWardrobe,
  move as movePlayer,
  OBSTACLES,
  STATIONS,
  VENTS,
  walkable,
} from "./world";
import { EliminationEffect } from "./EliminationEffect";
import { interactWithStation, interactWithSeat, openPractice, openWardrobe } from "./interactions";
import type { VisualEffect } from "./types";
let rendererState: RootState | undefined;
const EMPTY_VISUALS: VisualEffect[] = [];
export function sceneDiagnostics() {
  const s = rendererState?.get();
  return s
    ? {
        camera: s.camera.position.toArray(),
        rotation: s.camera.rotation.toArray(),
        zoom: (s.camera as THREE.OrthographicCamera).zoom,
        size: s.size,
        drawCalls: s.gl.info.render.calls,
        objects: s.scene.children.length,
      }
    : null;
}

const Box = memo(function Box({
  at,
  size,
  color,
  round = 0.07,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
  round?: number;
}) {
  return (
    <RoundedBox
      position={at}
      args={size}
      radius={round}
      smoothness={2}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.7} />
    </RoundedBox>
  );
});
export function Pip({
  color,
  hat = "sprout",
  outfit = "none",
  visor = "none",
  accessory: gear = "none",
  boots = "original",
  ghost = false,
  seated = false,
  walking = false,
  idleBounce = 0.018,
  headTurn,
}: Partial<Cosmetics> & {
  color: string;
  hat?: string;
  ghost?: boolean;
  seated?: boolean;
  walking?: boolean | React.RefObject<boolean>;
  idleBounce?: number;
  headTurn?: React.RefObject<number>;
}) {
  const { scene } = useGLTF("/models/pip.glb");
  const model = useMemo(() => {
    const c = scene.clone(true);
    const pivot = new THREE.Group();
    pivot.name = "HeadPivot";
    pivot.position.y = 1.2;
    c.add(pivot);
    c.updateMatrixWorld(true);
    for (const name of ["Head", "Face", "Eye", "Eye001"]) {
      const part = c.getObjectByName(name);
      if (part) pivot.attach(part);
    }
    c.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.material = (o.material as THREE.MeshStandardMaterial).clone();
        const m = o.material as THREE.MeshStandardMaterial;
        if (m.name === "Shell") m.color.set(color);
        if (o.name === "Badge" && outfit !== "none") o.visible = false;
        if (["Torso", "ArmL", "ArmR"].includes(o.name) && OUTFIT_COLORS[outfit]) m.color.set(OUTFIT_COLORS[outfit]);
        if (o.name.startsWith("Foot") && BOOT_COLORS[boots]) m.color.set(BOOT_COLORS[boots]);
        if (ghost) {
          m.transparent = true;
          m.opacity = 0.35;
          m.depthWrite = false;
        }
      }
    });
    return c;
  }, [scene, color, ghost, outfit, boots]);
  const group = useRef<THREE.Group>(null);
  const accessory = useRef<THREE.Group>(null);
  const lastMovementAt = useRef<number | null>(null);
  const hasMoved = useRef(false);
  const sitBlend = useRef(seated ? 1 : 0);
  const headPivot = useMemo(() => model.getObjectByName("HeadPivot"), [model]);
  const limbs = useMemo(
    () =>
      [
        [model.getObjectByName("FootL"), 1],
        [model.getObjectByName("FootR"), -1],
        [model.getObjectByName("ArmL"), -1],
        [model.getObjectByName("ArmR"), 1],
      ] as const,
    [model],
  );
  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      });
    },
    [model],
  );
  useFrame(({ clock }, dt) => {
    sitBlend.current = THREE.MathUtils.damp(sitBlend.current, seated ? 1 : 0, 10, dt);
    const sitting = sitBlend.current;
    const t = clock.elapsedTime,
      moving = !seated && (typeof walking === "boolean" ? walking : walking.current);
    if (moving) {
      hasMoved.current = true;
      lastMovementAt.current = t;
    } else if (lastMovementAt.current === null) {
      lastMovementAt.current = t;
    }
    const idleTime = t - lastMovementAt.current;
    const jumpDelay = hasMoved.current ? 7 : 0;
    const jumpTime = (idleTime - jumpDelay) % 2.6;
    const idleJump =
      !moving &&
      idleBounce > 0.1 &&
      idleTime >= jumpDelay &&
      jumpTime < 0.7
        ? Math.sin((Math.PI * jumpTime) / 0.7)
        : 0;
    if (headPivot) headPivot.rotation.y = headTurn?.current || 0;
    if (accessory.current)
      accessory.current.rotation.y = headTurn?.current || 0;
    for (const [limb, sign] of limbs) {
      if (!limb) continue;
      const stride = moving
        ? Math.sin(t * 12) * 0.45 * sign
        : idleJump
          ? (limb.name.startsWith("Foot") ? -0.3 : 0.18) * idleJump * sign
          : 0;
      limb.rotation.x = THREE.MathUtils.lerp(stride, limb.name.startsWith("Foot") ? -.12 : -.6, sitting);
      if (limb.name.startsWith("Foot")) {
        limb.position.y = .2 - .04 * sitting;
        limb.position.z = .045 + .29 * sitting;
      } else {
        limb.position.y = .67 - .045 * sitting;
        limb.position.z = .09 * sitting;
      }
    }
    if (group.current)
      group.current.position.y = ghost
        ? 0.3 + Math.sin(t * 2) * 0.12
        : sitting > .001
          ? .085 * sitting
          : moving
          ? Math.abs(Math.sin(t * 12)) * 0.06
          : idleBounce > 0.1
            ? Math.pow(idleJump, 0.7) * idleBounce
            : Math.sin(t * 2) * idleBounce;
  });
  return (
    <group ref={group}>
      <primitive object={model} />
      <Bodywear outfit={outfit} accessory={gear} ghost={ghost} />
      <group ref={accessory}>
        <Headwear hat={hat} visor={visor} ghost={ghost} />
        {hat === "sprout" && (
          <group position={[0, 1.52, 0]}>
            <mesh>
              <cylinderGeometry args={[0.025, 0.035, 0.23, 6]} />
              <meshStandardMaterial color="#658c52" />
            </mesh>
            <mesh
              position={[0.11, 0.09, 0]}
              rotation={[0, 0, -0.6]}
              scale={[0.2, 0.08, 0.1]}
            >
              <sphereGeometry args={[1, 12, 6]} />
              <meshStandardMaterial color="#9cce74" />
            </mesh>
            <mesh
              position={[-0.1, 0.04, 0]}
              rotation={[0, 0, 0.5]}
              scale={[0.16, 0.07, 0.09]}
            >
              <sphereGeometry args={[1, 12, 6]} />
              <meshStandardMaterial color="#73ae5d" />
            </mesh>
          </group>
        )}
        {hat === "antenna" && (
          <group position={[0, 1.6, 0]}>
            <mesh>
              <cylinderGeometry args={[0.025, 0.025, 0.25, 8]} />
              <meshStandardMaterial color="#3d535c" />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <sphereGeometry args={[0.09, 12, 8]} />
              <meshStandardMaterial
                color="#f47785"
                emissive="#f47785"
                emissiveIntensity={0.5}
              />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
function Avatar({ p, local = false }: { p: Player; local?: boolean }) {
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
function AnimatedPip({
  walking,
  ...props
}: {
  walking: React.RefObject<boolean>;
  outfit?: string;
  visor?: string;
  accessory?: string;
  boots?: string;
  color: string;
  hat: string;
  ghost: boolean;
  seated?: boolean;
}) {
  return <Pip {...props} walking={walking} />;
}
function Plant({
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
function Console({ x, z, color, stationId, practice = false, touchControls }: { x: number; z: number; color: string; stationId?: string; practice?: boolean; touchControls: boolean }) {
  const { scene } = useGLTF("/models/task-console.glb");
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    return copy;
  }, [scene]);
  const s = useGame(), r = s.room;
  const me = r?.players.find(p => p.id === s.id);
  const task = r?.tasks.find(t => t.id === stationId);
  const definition = STATIONS.find(t => t.id === stationId);
  const done = !!task?.done || !!(stationId && s.fakeDone[stationId]);
  const success = !!r?.visuals?.some(v => v.player === s.id && v.task === stationId);
  const repair = stationId === "reactor_monitor" && !!r?.sabotage;
  const active = practice || repair || (!!task && !done);
  const near = !!me && Math.hypot(me.x - x, me.z - z) <= 2.5;
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      ring.current.rotation.z = clock.elapsedTime * .7;
      ring.current.position.y = 1.42 + Math.sin(clock.elapsedTime * 2) * .07;
    }
  });
  const statusColor = done ? "#6ad9c5" : active ? color : "#718d91";
  const activate = () => practice ? openPractice() : interactWithStation(stationId);
  return (
    <group position={[x, 0, z]} onClick={e => { e.stopPropagation(); activate(); }}>
      <primitive object={model} />
      <mesh ref={ring} position={[0, 1.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.025, 8, 24, Math.PI * 1.65]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={success ? 3 : active ? 1.2 : .15}
        />
      </mesh>
      {(active || success) && <mesh position={[0, .03, 0]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[.7,success ? .95 : .75,32]} /><meshBasicMaterial color={statusColor} transparent opacity={success ? 1 : near ? .8 : .3} />
      </mesh>}
      {(near || practice) && <Html position={[0, 1.95, 0]} center zIndexRange={[10, 1]}>
        <button className={`station-label ${practice ? "practice" : ""} ${active ? "active" : ""}`} onClick={e => { e.stopPropagation(); activate(); }}>
          <strong>{practice ? "Practice station" : repair ? "Repair reactor" : definition?.name}</strong>
          <small>{success ? "Task complete" : near ? active ? touchControls ? "Tap to interact" : "Tap or press E" : done ? "Complete" : "Task console" : "Walk closer to try tasks"}</small>
        </button>
      </Html>}
    </group>
  );
}
const rooms = [
  { x: 0, z: 0, name: "THE COMMONS", color: "#b9c5bb", accent: "#f3c86d" },
  { x: -10, z: 0, name: "MEDBAY", color: "#adc4ae", accent: "#9ecc85" },
  { x: 0, z: -10, name: "REACTOR", color: "#b2b2c2", accent: "#b2a1e4" },
  { x: 10, z: 0, name: "COMMS & ADMIN", color: "#a7bec6", accent: "#8dcee2" },
  { x: 0, z: 10, name: "STORAGE", color: "#c4b7a0", accent: "#e5ad79" },
  { x: -10, z: -10, name: "SECURITY", color: "#9fb0bf", accent: "#7198b5" },
  { x: 10, z: -10, name: "WEAPONS & O2", color: "#c9aba8", accent: "#e58277" },
  { x: -10, z: 10, name: "ELECTRICAL", color: "#c6c29b", accent: "#e5d360" },
  { x: 10, z: 10, name: "SHIELDS & NAV", color: "#9cbab6", accent: "#6bc4b5" },
];

function FloorLabel({ name, x, z }: { name: string; x: number; z: number }) {
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

function VisualTaskEffects() {
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

const consoleColors = [
  "#bee196",
  "#8fd7e5",
  "#b3a6ee",
  "#f4bf72",
  "#e57979",
  "#6ad9c5",
  "#f59e6d",
  "#c5db79",
];

const Station = memo(function Station({ touchControls }: { touchControls: boolean }) {
  const sabotage = useGame((s) => !!s.room?.sabotage);
  return (
    <group>
      {/* Render halls from the same bounds used for movement. */}
      {FLOORS.slice(9).map(([a, b, c, d], i) => (
        <Box
          key={i}
          at={[(a + b) / 2, -0.37, (c + d) / 2]}
          size={[b - a, 0.55, d - c]}
          color={i < 2 ? "#54696a" : "#485c5d"}
        />
      ))}

      {rooms.map(({ x, z, name, color, accent }, i) => (
        <group key={name} position={[x, 0, z]}>
          <Box
            at={[0, -0.55, 0]}
            size={[8.35, 0.95, 8.35]}
            color="#304956"
            round={0.22}
          />
          <Box at={[0, -0.09, 0]} size={[8, 0.12, 8]} color={color} />
          {Array.from({ length: 7 }, (_, j) => (
            <group key={j}>
              <Box
                at={[j - 3, 0.001, 0]}
                size={[0.016, 0.012, 7.8]}
                color="#91a6a2"
                round={0}
              />
              <Box
                at={[0, 0.001, j - 3]}
                size={[7.8, 0.012, 0.016]}
                color="#91a6a2"
                round={0}
              />
            </group>
          ))}
          {[-1, 1].map((sign) => (
            <group key={sign}>
              <Box
                at={[sign * 2.8, 0.45, -3.85]}
                size={[2.4, 0.9, 0.22]}
                color="#d7dfd4"
              />
              <Box
                at={[sign * 2.8, 0.22, 3.85]}
                size={[2.4, 0.44, 0.22]}
                color="#d7dfd4"
              />
              <Box
                at={[-3.85, 0.45, sign * 2.8]}
                size={[0.22, 0.9, 2.4]}
                color="#d7dfd4"
              />
              <Box
                at={[3.85, 0.22, sign * 2.8]}
                size={[0.22, 0.44, 2.4]}
                color="#d7dfd4"
              />
            </group>
          ))}
          <Box at={[0, -0.52, 4.18]} size={[4.6, 0.12, 0.04]} color={accent} />
          <FloorLabel name={name} x={x} z={z} />
          <Plant at={[-3, 0, -3]} scale={i === 1 ? 1.6 : 1} />
          <Plant at={[3, 0, 3]} scale={0.8} />
          {[
            [-3, -3],
            [3, -3],
            [-3, 3],
            [3, 3],
          ].map(([a, b], j) => (
            <Box
              key={j}
              at={[a, -1, b]}
              size={[0.35, 0.6, 0.35]}
              color="#f2bb65"
            />
          ))}
        </group>
      ))}
      <group>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.05, 1.2, 0.6, 8]} />
          <meshStandardMaterial color="#334f58" />
        </mesh>
        <mesh position={[0, 0.64, 0]}>
          <cylinderGeometry args={[0.82, 0.9, 0.1, 32]} />
          <meshStandardMaterial color="#e3ce9c" />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <sphereGeometry
            args={[0.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#f27870"
            emissive="#e9655d"
            emissiveIntensity={sabotage ? 2 : 0.3}
          />
        </mesh>
        <Html position={[0, 1.5, 0]} center zIndexRange={[2, 0]}>
          <span className="beacon-label">MEETING BEACON</span>
        </Html>
      </group>
      <VisualTaskEffects />
      {STATIONS.map((s, i) => (
        <Console
          key={s.id}
          stationId={s.id}
          x={s.x}
          z={s.z}
          touchControls={touchControls}
          color={
            s.id === "start_reactor" && sabotage
              ? "#ff6c67"
              : consoleColors[i % consoleColors.length]
          }
        />
      ))}
      {VENTS.map(([x, z], i) => (
        <group key={i} position={[x, 0.025, z]}>
          <Box at={[0, 0, 0]} size={[0.9, 0.05, 0.65]} color="#556977" />
          {[-0.3, -0.15, 0, 0.15, 0.3].map((v) => (
            <Box
              key={v}
              at={[v, 0.04, 0]}
              size={[0.045, 0.02, 0.52]}
              color="#243c47"
              round={0.005}
            />
          ))}
        </group>
      ))}
      {/* The reactor obstacle (index 5) has its own model below. */}
      {OBSTACLES.map(([a, b, c, d], i) =>
        i === 5 ? null : (
          <group key={i}>
            <Box
              at={[(a + b) / 2, 0.5, (c + d) / 2]}
              size={[b - a, 1, d - c]}
              color={["#66897a", "#587a8e", "#776d97", "#a78a64"][i % 4]}
            />
            {i === 0 ? (
              <>
                <Plant at={[a + 0.4, 1, c + 0.4]} />
                <Plant at={[b - 0.4, 1, d - 0.4]} />
              </>
            ) : (
              <Box
                at={[(a + b) / 2, 1.05, (c + d) / 2]}
                size={[b - a - 0.2, 0.1, d - c - 0.2]}
                color="#d2d5bc"
              />
            )}
          </group>
        ),
      )}
      <group position={[0, 0, -10]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.8, 2.8, 8]} />
          <meshStandardMaterial color="#64747e" />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <torusGeometry args={[0.85, 0.12, 8, 24]} />
          <meshStandardMaterial
            color={sabotage ? "#fb736f" : "#b5afe8"}
            emissive={sabotage ? "#fb736f" : "#b5afe8"}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>
    </group>
  );
});
function MotionFrame() {
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

function WardrobeStation({ touchControls }: { touchControls: boolean }) {
  const near = useGame(s => {
    const me = s.room?.players.find(p => p.id === s.id);
    return s.room?.phase === "lobby" && !!me && (me.seat ?? -1) < 0 && nearWardrobe(me.x, me.z) && !s.wardrobe && !s.practiceOpen && !s.settings;
  });
  return (
    <group position={[WARDROBE_STATION.x, 0, WARDROBE_STATION.z]}>
      <Box at={[0, .76, .94]} size={[.64, .56, .04]} color="#294c50" round={.05} />
      <Box at={[0, .72, .97]} size={[.23, .27, .025]} color="#d5e5c8" round={.015} />
      <Box at={[0, .85, .97]} size={[.42, .12, .025]} color="#d5e5c8" round={.015} />
      <Box at={[0, .92, .98]} size={[.09, .06, .025]} color="#294c50" round={.015} />
      {near && <Html position={[0, 2, 0]} center zIndexRange={[14, 11]}>
        <button className="station-label active wardrobe-station" aria-label="Change outfit" onClick={e => { e.stopPropagation(); openWardrobe(); }}>
          <strong>Change outfit</strong>
          <small>{touchControls ? "Tap to open wardrobe" : "Click or press E"}</small>
        </button>
      </Html>}
    </group>
  );
}

function LobbyChair({ index, touchControls }: { index: number; touchControls: boolean }) {
  const chair = LOBBY_SEATS[index];
  const action = useGame(s => {
    if (s.room?.phase !== "lobby" || s.wardrobe || s.practiceOpen || s.settings) return "";
    const me = s.room.players.find(p => p.id === s.id);
    if (!me) return "";
    if (me.seat === index) return "Stand up";
    if ((me.seat ?? -1) >= 0) return "";
    return nearestLobbySeat(me.x, me.z, s.room.players.map(p => p.seat ?? -1)) === index ? "Sit down" : "";
  });
  return <group position={[chair.x, 0, chair.z]}>
    <Box at={[0, .4, 0]} size={[.65, .22, .85]} color="#5a91a1" />
    <Box at={[chair.side * .23, .8, 0]} size={[.18, .8, .85]} color="#73a7ad" />
    <Box at={[0, .17, 0]} size={[.3, .35, .55]} color="#2a414e" />
    {action && <Html position={[-chair.side * 1.15, .4, .8]} center zIndexRange={[14, 11]}>
      <button className="station-label active chair-interaction" aria-label={action} onClick={e => { e.stopPropagation(); interactWithSeat(index); }}>
        <strong>{action}</strong><small>{touchControls ? "Tap to interact" : "Click or press E"}</small>
      </button>
    </Html>}
  </group>;
}

const WaitingRoom = memo(function WaitingRoom({ touchControls }: { touchControls: boolean }) {
  return (
    <group>
      <Box
        at={[0, -0.45, 0]}
        size={[12.6, 0.8, 10.6]}
        color="#263e4d"
        round={0.22}
      />
      <Box
        at={[0, -0.04, 0]}
        size={[12, 0.1, 10]}
        color="#788e91"
        round={0.03}
      />
      {Array.from({ length: 11 }, (_, i) => (
        <Box
          key={`x${i}`}
          at={[i - 5, 0.02, 0]}
          size={[0.025, 0.015, 9.8]}
          color="#acc4b5"
          round={0}
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={`z${i}`}
          at={[0, 0.02, i - 4]}
          size={[11.8, 0.015, 0.025]}
          color="#acc4b5"
          round={0}
        />
      ))}
      <Box at={[0, 1.1, -5]} size={[12.4, 2.2, 0.3]} color="#354e5b" />
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <Box at={[sign * 6, 0.65, 0]} size={[0.3, 1.3, 10]} color="#354e5b" />
          <Box
            at={[sign * 4, 0.06, 4.8]}
            size={[3.7, 0.12, 0.12]}
            color="#f5c568"
            round={0.03}
          />
          <Box
            at={[sign * 3.8, 1.7, -4.78]}
            size={[3.1, 0.12, 0.1]}
            color="#a7e4d5"
            round={0.03}
          />
        </group>
      ))}
      {LOBBY_SEATS.map((_, index) => <LobbyChair key={index} index={index} touchControls={touchControls} />)}
      <Box at={[0, 1, -4.8]} size={[2.2, 2, 0.15]} color="#1c303e" />
      {[-0.52, 0.52].map((x) => (
        <Box
          key={x}
          at={[x, 1, -4.68]}
          size={[0.98, 1.8, 0.1]}
          color="#708991"
        />
      ))}
      <Box
        at={[0, 2.1, -4.6]}
        size={[1.8, 0.1, 0.1]}
        color="#bde1c8"
        round={0.03}
      />
      {LOBBY_OBSTACLES.slice(0, 1).map(([a, b, c, d], i) => (
        <group key={i}>
          <Box
            at={[(a + b) / 2, 0.6, (c + d) / 2]}
            size={[b - a, 1.2, d - c]}
            color="#4d716b"
          />
          <Box
            at={[(a + b) / 2, 1.23, (c + d) / 2]}
            size={[b - a + 0.08, 0.08, d - c + 0.08]}
            color="#86aa91"
            round={0.03}
          />
          <Box
            at={[(a + b) / 2, 0.65, d + 0.02]}
            size={[0.15, 1.1, 0.04]}
            color="#e8c37b"
            round={0.01}
          />
        </group>
      ))}
      <WardrobeStation touchControls={touchControls} />
      <Console x={0} z={-3.8} color="#a8e4b3" practice touchControls={touchControls} />
      <Html
        position={[0, 2.5, -5]}
        center
        pointerEvents="none"
        style={{ pointerEvents: "none" }}
        zIndexRange={[2, 0]}
      >
        <span className="bay-sign">CLOUDLINE / DEPARTURE BAY</span>
      </Html>
      <mesh position={[0, 0.035, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.24, 64]} />
        <meshBasicMaterial color="#d9c38d" transparent opacity={0.6} />
      </mesh>
    </group>
  );
});

function isVisibleToPlayer(
  targetX: number,
  targetZ: number,
  localX: number,
  localZ: number,
  isGhost: boolean,
  phase: string | undefined,
): boolean {
  if (phase !== "playing" || isGhost) return true;
  const dist = Math.hypot(targetX - localX, targetZ - localZ);
  if (dist > 7.5) return false;
  // Disconnected room occlusion checks: living players cannot see through walls
  if (localX < -4.5 && targetX > -3.8) return false;
  if (targetX < -4.5 && localX > -3.8) return false;
  if (localX > 4.5 && targetX < 3.8) return false;
  if (targetX > 4.5 && localX < 3.8) return false;
  if (localZ < -4.5 && targetZ > -3.8) return false;
  if (targetZ < -4.5 && localZ > -3.8) return false;
  if (localZ > 4.5 && targetZ < 3.8) return false;
  if (targetZ > 4.5 && localZ < 3.8) return false;
  return true;
}

function heroCanOccupy(x: number, z: number) {
  const radius = 0.42;
  return (
    walkable(x, z) &&
    walkable(x - radius, z) &&
    walkable(x + radius, z) &&
    walkable(x, z - radius) &&
    walkable(x, z + radius) &&
    walkable(x - radius, z - radius) &&
    walkable(x - radius, z + radius) &&
    walkable(x + radius, z - radius) &&
    walkable(x + radius, z + radius)
  );
}

function CameraRig({ menu, lobby }: { menu: boolean; lobby: boolean }) {
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
const showcase: Player[] = Array.from({ length: 5 }, (_, i) => ({
  id: `show${i}`,
  name: ["Miso", "Sprout", "Pip", "Echo", "Pebble"][i],
  color: COLORS[i],
  hat: i % 2 ? "antenna" : "sprout",
  x: [-2, 1.9, -9, 9, 0][i],
  z: [2, -1, 1, 1, 10][i],
  alive: true,
  connected: true,
  ready: true,
  ack: 0,
  voted: false,
}));
function Actors({
  menu,
  color,
  hat,
}: {
  menu: boolean;
  color: number;
  hat: string;
}) {
  const r = useGame((s) => s.room),
    id = useGame((s) => s.id),
    map = useGame((s) => s.map);
  const hero = useRef<THREE.Group>(null);
  const appearance = useAppearance(s => s.appearance);
  const heroPosition = useRef({ x: -2, z: 2 });
  const heroWalking = useRef(false);
  const heroStep = useRef(0);
  const heroDirection = useRef({ x: 0, z: 0 });
  const me = r?.players.find((p) => p.id === id);
  const isGhost = me ? !me.alive : false;
  const lx = motion.renderX,
    lz = motion.renderZ;
  const events = r?.eliminations || [];
  useFrame((_, dt) => {
    if (!menu) {
      heroWalking.current = false;
      return;
    }
    const held = (a: string, b: string) =>
      motion.keys.has(a) || motion.keys.has(b) ? 1 : 0;
    let x =
      held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft") + motion.dx;
    let z =
      held("KeyS", "ArrowDown") - held("KeyW", "ArrowUp") + motion.dz;
    const length = Math.max(1, Math.hypot(x, z));
    x /= length;
    z /= length;
    const directionLength = Math.hypot(18, 13);
    const dx = (18 * x + 13 * z) / directionLength;
    const dz = (-13 * x + 18 * z) / directionLength;
    heroWalking.current = Math.hypot(dx, dz) > 0;
    if (heroWalking.current) {
      heroDirection.current = { x: dx, z: dz };
      heroStep.current += dt;
      while (heroStep.current >= 0.05) {
        const [nextX, nextZ] = movePlayer(
          heroPosition.current.x,
          heroPosition.current.z,
          dx,
          dz,
        );
        if (heroCanOccupy(nextX, nextZ)) {
          heroPosition.current.x = nextX;
          heroPosition.current.z = nextZ;
        } else {
          const [slideX] = movePlayer(
            heroPosition.current.x,
            heroPosition.current.z,
            dx,
            0,
          );
          const [, slideZ] = movePlayer(
            heroPosition.current.x,
            heroPosition.current.z,
            0,
            dz,
          );
          if (heroCanOccupy(slideX, heroPosition.current.z))
            heroPosition.current.x = slideX;
          if (heroCanOccupy(heroPosition.current.x, slideZ))
            heroPosition.current.z = slideZ;
        }
        heroStep.current -= 0.05;
      }
    } else {
      heroStep.current = 0;
    }
    hero.current?.position.set(
      heroPosition.current.x,
      0,
      heroPosition.current.z,
    );
    if (heroWalking.current && hero.current) {
      const target = Math.atan2(
        heroDirection.current.x,
        heroDirection.current.z,
      );
      hero.current.rotation.y +=
        Math.atan2(
          Math.sin(target - hero.current.rotation.y),
          Math.cos(target - hero.current.rotation.y),
        ) * Math.min(1, dt * 12);
    }
  });
  const animated = new Set(events.flatMap((e) => [e.attacker.id, e.victim.id]));
  const visibleEvents = map ? [] : events.filter((e) => {
    if (!r || r.phase !== "playing" || isGhost) return true;
    if (e.attacker.id === id || e.victim.id === id) return true;
    return isVisibleToPlayer(e.victim.x, e.victim.z, lx, lz, isGhost, r.phase);
  });
  const visibleBodies = map ? [] : (r?.bodies || []).filter((b) => {
    if (animated.has(b.id)) return false;
    if (!r || r.phase !== "playing" || isGhost) return true;
    return isVisibleToPlayer(b.x, b.z, lx, lz, isGhost, r.phase);
  });
  const visiblePlayers = (
    menu
      ? showcase
      : (r?.players || []).filter((p) => {
          if (animated.has(p.id)) return false;
          if (p.id === id) return map || (r?.vent ?? -1) < 0;
          if (map) return false;
          if (!r || r.phase !== "playing" || isGhost) return true;
          return isVisibleToPlayer(p.x, p.z, lx, lz, isGhost, r.phase);
        })
  );

  return (
    <>
      {visiblePlayers.map((p, i) =>
        menu ? (
          <group
            key={p.id}
            ref={i === 0 ? hero : undefined}
            position={
              i === 0
                ? [heroPosition.current.x, 0, heroPosition.current.z]
                : [p.x, 0, p.z]
            }
            rotation={[0, i * 0.8 + 0.3, 0]}
          >
            <Pip
              outfit={i === 0 ? appearance.outfit : p.outfit}
              visor={i === 0 ? appearance.visor : p.visor}
              accessory={i === 0 ? appearance.accessory : p.accessory}
              boots={i === 0 ? appearance.boots : p.boots}
              color={i === 0 ? COLORS[color] : p.color}
              hat={i === 0 ? hat : p.hat}
              walking={i === 0 ? heroWalking : false}
              idleBounce={i === 0 ? 0.2 : undefined}
            />
          </group>
        ) : (
          <Avatar key={p.id} p={p} local={p.id === id} />
        ),
      )}
      {visibleEvents.map((e) => (
        <EliminationEffect key={e.id} event={e} Actor={Pip} />
      ))}
      {visibleBodies.map((b) => (
        <group
          key={b.id}
          position={[b.x, 0.24, b.z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <Pip color={b.color} hat="none" />
        </group>
      ))}
    </>
  );
}
function World({
  menu,
  color,
  hat,
}: {
  menu: boolean;
  color: number;
  hat: string;
}) {
  const lobby = useGame((s) => s.room?.phase === "lobby");
  const quality = useGame((s) => s.quality);
  const viewportWidth = useThree((s) => s.size.width);
  const touchControls =
    viewportWidth <= 700 || window.matchMedia("(pointer: coarse)").matches;
  return (
    <>
      <color attach="background" args={["#152b35"]} />
      <fog attach="fog" args={["#152b35", 42, 85]} />
      <OrthographicCamera
        makeDefault
        position={[16, 22, 20]}
        zoom={25}
        near={0.1}
        far={150}
      />
      <MotionFrame />
      <CameraRig menu={menu} lobby={lobby} />
      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#f4e7c9", "#426574", 1.4]} />
      <directionalLight
        position={[-7, 20, 8]}
        intensity={2.4}
        castShadow={quality === "high"}
        shadow-mapSize={[
          quality === "high" ? 1024 : 512,
          quality === "high" ? 1024 : 512,
        ]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.001}
      />
      {lobby ? (
        <WaitingRoom touchControls={touchControls} />
      ) : (
        <Station touchControls={touchControls} />
      )}
      <Actors menu={menu} color={color} hat={hat} />
      {quality === "high" &&
        Array.from({ length: 12 }, (_, i) => (
          <Float key={i} speed={0.4} floatIntensity={0.5}>
            <mesh
              position={[
                Math.sin(i * 7) * 25,
                -4 - (i % 3) * 2,
                Math.cos(i * 7) * 25,
              ]}
              scale={[4 + (i % 3), 1, 2.8]}
            >
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial
                color="#274550"
                flatShading
                transparent
                opacity={0.45}
              />
            </mesh>
          </Float>
        ))}
      {quality === "high" && (
        <ContactShadows
          position={[0, -2.2, 0]}
          opacity={0.25}
          scale={50}
          blur={3}
          far={8}
          resolution={256}
          frames={1}
        />
      )}
    </>
  );
}
export default memo(function Scene({
  menu,
  color,
  hat,
}: {
  menu: boolean;
  color: number;
  hat: string;
}) {
  const quality = useGame((s) => s.quality);
  return (
    <Canvas
      onCreated={(s) => {
        rendererState = s;
      }}
      shadows={quality === "high"}
      dpr={quality === "high" ? [1, 1.25] : 1}
      gl={{
        antialias: quality === "high",
        powerPreference: "high-performance",
      }}
    >
      <Suspense fallback={null}>
        <World menu={menu} color={color} hat={hat} />
      </Suspense>
    </Canvas>
  );
});
