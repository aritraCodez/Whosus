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
import { LOBBY_OBSTACLES, OBSTACLES, STATIONS, VENTS } from "./world";
import { EliminationEffect } from "./EliminationEffect";
let rendererState: RootState | undefined;
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
function Pip({
  color,
  hat = "sprout",
  ghost = false,
  walking = false,
  headTurn,
}: {
  color: string;
  hat?: string;
  ghost?: boolean;
  walking?: boolean | React.RefObject<boolean>;
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
        if (ghost) {
          m.transparent = true;
          m.opacity = 0.35;
          m.depthWrite = false;
        }
      }
    });
    return c;
  }, [scene, color, ghost]);
  const group = useRef<THREE.Group>(null);
  const accessory = useRef<THREE.Group>(null);
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
  useFrame(({ clock }) => {
    const t = clock.elapsedTime,
      moving = typeof walking === "boolean" ? walking : walking.current;
    if (headPivot) headPivot.rotation.y = headTurn?.current || 0;
    if (accessory.current)
      accessory.current.rotation.y = headTurn?.current || 0;
    for (const [limb, sign] of limbs) {
      if (limb) limb.rotation.x = moving ? Math.sin(t * 12) * 0.45 * sign : 0;
    }
    if (group.current)
      group.current.position.y = ghost
        ? 0.3 + Math.sin(t * 2) * 0.12
        : moving
          ? Math.abs(Math.sin(t * 12)) * 0.06
          : Math.sin(t * 2) * 0.018;
  });
  return (
    <group ref={group}>
      <primitive object={model} />
      <group ref={accessory}>
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
  const speaking = useGame((s) => s.speaking.includes(p.id));
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const x = local ? motion.renderX : p.x,
      z = local ? motion.renderZ : p.z;
    const dx = x - g.position.x,
      dz = z - g.position.z;
    walking.current =
      Math.hypot(x - previous.current[0], z - previous.current[1]) > 0.001 ||
      Math.hypot(dx, dz) > 0.035;
    g.position.x = local ? x : THREE.MathUtils.damp(g.position.x, x, 16, dt);
    g.position.z = local ? z : THREE.MathUtils.damp(g.position.z, z, 16, dt);
    if (walking.current) {
      const target = Math.atan2(dx, dz);
      g.rotation.y +=
        Math.atan2(
          Math.sin(target - g.rotation.y),
          Math.cos(target - g.rotation.y),
        ) * Math.min(1, dt * 12);
    }
    previous.current = [x, z];
  });
  return (
    <group ref={group} position={initialPosition.current}>
      <AnimatedPip
        color={p.color}
        hat={p.hat}
        ghost={!p.alive}
        walking={walking}
      />
      {/* Keep nameplates in screen pixels; distanceFactor multiplies orthographic zoom. */}
      <Html
        position={[0, 2.05, 0]}
        center
        pointerEvents="none"
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
  color: string;
  hat: string;
  ghost: boolean;
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
function Console({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <Box at={[0, 0.45, 0]} size={[1.1, 0.9, 0.65]} color="#334b57" />
      <Box at={[0, 0.94, -0.02]} size={[0.93, 0.08, 0.58]} color={color} />
      <mesh position={[0, 1.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.035, 8, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
        />
      </mesh>
    </group>
  );
}
const rooms = [
  { x: 0, z: 0, name: "THE COMMONS", color: "#b9c5bb", accent: "#f3c86d" },
  { x: -10, z: 0, name: "BOTANICAL", color: "#adc4ae", accent: "#9ecc85" },
  { x: 10, z: 0, name: "COMMS", color: "#a7bec6", accent: "#8dcee2" },
  { x: 0, z: -10, name: "REACTOR", color: "#b2b2c2", accent: "#b2a1e4" },
  { x: 0, z: 10, name: "CARGO", color: "#c4b7a0", accent: "#e5ad79" },
];
const Station = memo(function Station() {
  const sabotage = useGame((s) => !!s.room?.sabotage);
  return (
    <group>
      <Box at={[0, -0.37, 0]} size={[22, 0.55, 3.2]} color="#54696a" />
      <Box at={[0, -0.37, 0]} size={[3.2, 0.55, 22]} color="#54696a" />
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
          <Html
            position={[0, 0.05, 3.2]}
            center
            transform
            rotation={[-Math.PI / 2, 0, 0]}
            distanceFactor={4}
            zIndexRange={[1, 0]}
          >
            <span className="floor-label">{name}</span>
          </Html>
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
      {STATIONS.map((s, i) => (
        <Console
          key={s.id}
          x={s.x}
          z={s.z}
          color={
            ["#bee196", "#8fd7e5", sabotage ? "#ff6c67" : "#b3a6ee", "#f4bf72"][
              i
            ]
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
      {OBSTACLES.slice(0, 4).map(([a, b, c, d], i) => (
        <group key={i}>
          <Box
            at={[(a + b) / 2, 0.5, (c + d) / 2]}
            size={[b - a, 1, d - c]}
            color={["#66897a", "#587a8e", "#776d97", "#a78a64"][i]}
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
      ))}
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
    motion.renderX = snap ? x : THREE.MathUtils.damp(motion.renderX, x, 35, dt);
    motion.renderZ = snap ? z : THREE.MathUtils.damp(motion.renderZ, z, 35, dt);
    revision.current = motion.revision;
  }, -2);
  return null;
}

const WaitingRoom = memo(function WaitingRoom() {
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
          {[-3, -1.5, 0, 1.5, 3].map((z) => (
            <group key={z} position={[sign * 5.3, 0, z]}>
              <Box at={[0, 0.4, 0]} size={[0.65, 0.22, 0.85]} color="#5a91a1" />
              <Box
                at={[sign * 0.23, 0.8, 0]}
                size={[0.18, 0.8, 0.85]}
                color="#73a7ad"
              />
              <Box at={[0, 0.17, 0]} size={[0.3, 0.35, 0.55]} color="#2a414e" />
            </group>
          ))}
        </group>
      ))}
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
      {LOBBY_OBSTACLES.slice(0, 2).map(([a, b, c, d], i) => (
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
      <Console x={0} z={-3.8} color="#a8e4b3" />
      <Html
        position={[0, 2.5, -5]}
        center
        pointerEvents="none"
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
    cam.position.lerp(desired, 1 - Math.exp(-dt * 4));
    cam.lookAt(cam.position.x - 13, cam.position.y - 19, cam.position.z - 18);
    const zoom = menu
      ? Math.min(size.width / 35, size.height / 29)
      : lobby
        ? Math.min(size.width / (size.width > 900 ? 22 : 19), size.height / 16)
        : map
          ? Math.min(size.width / 34, size.height / 32)
          : Math.min(size.width / 18, size.height / 14);
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
    id = useGame((s) => s.id);
  const events = r?.eliminations || [];
  const animated = new Set(events.flatMap((e) => [e.attacker.id, e.victim.id]));
  return (
    <>
      {(menu
        ? showcase
        : (r?.players || []).filter((p) => !animated.has(p.id))
      ).map((p, i) =>
        menu ? (
          <group
            key={p.id}
            position={[p.x, 0, p.z]}
            rotation={[0, i * 0.8 + 0.3, 0]}
          >
            <Pip
              color={i === 0 ? COLORS[color] : p.color}
              hat={i === 0 ? hat : p.hat}
              walking={i === 0}
            />
          </group>
        ) : (
          <Avatar key={p.id} p={p} local={p.id === id} />
        ),
      )}
      {events.map((e) => (
        <EliminationEffect key={e.id} event={e} Actor={Pip} />
      ))}
      {r?.bodies
        .filter((b) => !animated.has(b.id))
        .map((b) => (
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
          quality === "high" ? 2048 : 512,
          quality === "high" ? 2048 : 512,
        ]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.001}
      />
      {lobby ? <WaitingRoom /> : <Station />}
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
      dpr={quality === "high" ? [1, 1.5] : 1}
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
