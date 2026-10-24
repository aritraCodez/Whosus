import { type PokemonId } from "@/features/appearance/model/pokemon-catalog";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

export function Pokemon({
  character,
  color,
  ghost = false,
  seated = false,
  walking = false,
  idleBounce = 0.018,
  headTurn,
}: {
  character: PokemonId;
  color: string;
  ghost?: boolean;
  seated?: boolean;
  walking?: boolean | RefObject<boolean>;
  idleBounce?: number;
  headTurn?: RefObject<number>;
}) {
  const { scene } = useGLTF(`/models/pokemon/${character}.glb`);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.name = `PokemonCharacter_${character}`;
    copy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = !ghost;
      object.receiveShadow = true;
      const cloneMaterial = (source: THREE.Material) => {
        const material = source.clone();
        if (ghost) {
          material.transparent = true;
          material.opacity = 0.3;
          material.depthWrite = false;
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
    });
    return copy;
  }, [scene, character, ghost]);
  const parts = useMemo(() => {
    const result: {
      object: THREE.Object3D;
      part: string;
      rotation: THREE.Euler;
    }[] = [];
    model.traverse((object) => {
      if (typeof object.userData.part === "string")
        result.push({
          object,
          part: object.userData.part,
          rotation: object.rotation.clone(),
        });
    });
    return result;
  }, [model]);
  const group = useRef<THREE.Group>(null);
  const movement = useRef(0);
  useEffect(
    () => () => {
      model.traverse((object) => {
        if (object instanceof THREE.Mesh)
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
      });
    },
    [model],
  );
  useFrame(({ clock }, dt) => {
    const moving =
      !seated && (typeof walking === "boolean" ? walking : walking.current);
    movement.current = THREE.MathUtils.damp(
      movement.current,
      moving ? 1 : 0,
      12,
      dt,
    );
    const t = clock.elapsedTime;
    for (const { object, part, rotation } of parts) {
      object.rotation.copy(rotation);
      const sign = [
        "leg_l",
        "leg_lf",
        "leg_rb",
        "arm_r",
        "wing_r",
        "ear_r",
      ].includes(part)
        ? 1
        : -1;
      if (part.startsWith("leg_"))
        object.rotation.x += Math.sin(t * 12) * sign * movement.current * 0.32;
      else if (part.startsWith("arm_"))
        object.rotation.x += Math.sin(t * 12) * sign * movement.current * 0.18;
      else if (part.startsWith("wing_"))
        object.rotation.y +=
          Math.sin(t * 3) * sign * (0.045 + movement.current * 0.05);
      else if (part === "tail") object.rotation.y += Math.sin(t * 2.3) * 0.09;
      else if (part === "head")
        object.rotation.y += headTurn?.current ?? Math.sin(t * 0.8) * 0.025;
      else if (part.startsWith("ear_"))
        object.rotation.z += Math.sin(t * 1.7) * sign * 0.018;
    }
    if (!group.current) return;
    group.current.position.y = ghost
      ? 0.22 + Math.sin(t * 2) * 0.08
      : seated
        ? 0.42
        : Math.abs(Math.sin(t * 12)) * movement.current * 0.025 +
          Math.sin(t * 2) * Math.min(idleBounce, 0.018);
    group.current.rotation.z = Math.sin(t * 12) * movement.current * 0.02;
  });
  return (
    <group>
      <group ref={group}>
        <primitive object={model} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
        <ringGeometry args={[0.39, 0.425, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={ghost ? 0.2 : 0.8}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
