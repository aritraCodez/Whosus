import {
  Bodywear,
  BOOT_COLORS,
  Headwear,
  OUTFIT_COLORS,
} from "@/features/appearance/components/CharacterClothes";
import { type Cosmetics } from "@/features/appearance/model/appearance-store";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Mosslight } from "@/features/appearance/components/Mosslight";
export function Pip(props: React.ComponentProps<typeof PipExplorer>) {
  return props.character === "mosslight" ? (
    <Mosslight {...props} />
  ) : (
    <PipExplorer {...props} />
  );
}
function PipExplorer({
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
        if (["Torso", "ArmL", "ArmR"].includes(o.name) && OUTFIT_COLORS[outfit])
          m.color.set(OUTFIT_COLORS[outfit]);
        if (o.name.startsWith("Foot") && BOOT_COLORS[boots])
          m.color.set(BOOT_COLORS[boots]);
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
    sitBlend.current = THREE.MathUtils.damp(
      sitBlend.current,
      seated ? 1 : 0,
      10,
      dt,
    );
    const sitting = sitBlend.current;
    const t = clock.elapsedTime,
      moving =
        !seated && (typeof walking === "boolean" ? walking : walking.current);
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
      !moving && idleBounce > 0.1 && idleTime >= jumpDelay && jumpTime < 0.7
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
      limb.rotation.x = THREE.MathUtils.lerp(
        stride,
        limb.name.startsWith("Foot") ? -0.12 : -0.6,
        sitting,
      );
      if (limb.name.startsWith("Foot")) {
        limb.position.y = 0.2 - 0.04 * sitting;
        limb.position.z = 0.045 + 0.29 * sitting;
      } else {
        limb.position.y = 0.67 - 0.045 * sitting;
        limb.position.z = 0.09 * sitting;
      }
    }
    if (group.current)
      group.current.position.y = ghost
        ? 0.3 + Math.sin(t * 2) * 0.12
        : sitting > 0.001
          ? 0.085 * sitting
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
