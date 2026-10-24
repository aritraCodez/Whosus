import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

export function Mosslight({
  color,
  ghost = false,
  seated = false,
  walking = false,
  idleBounce = 0.018,
  headTurn,
}: {
  color: string;
  ghost?: boolean;
  seated?: boolean;
  walking?: boolean | RefObject<boolean>;
  idleBounce?: number;
  headTurn?: RefObject<number>;
}) {
  const { scene } = useGLTF("/models/mosslight.glb");
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.name = "MosslightCharacter";
    copy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = !ghost;
      object.receiveShadow = true;
      const material = (object.material as THREE.MeshStandardMaterial).clone();
      if (material.name === "Mosslight_Team") material.color.set(color);
      if (material.name === "Mosslight_Amber") material.depthWrite = false;
      if (ghost) {
        material.transparent = true;
        material.opacity = 0.3;
        material.depthWrite = false;
      }
      object.material = material;
    });
    return copy;
  }, [scene, color, ghost]);
  const feet = useMemo(
    () =>
      [
        ["L_Front", 1],
        ["R_Back", 1],
        ["R_Front", -1],
        ["L_Back", -1],
      ].map(([name, sign]) => {
        const object = model.getObjectByName(`Mosslight_Foot_${name}`);
        return { object, sign: Number(sign), y: object?.position.y ?? 0 };
      }),
    [model],
  );
  const group = useRef<THREE.Group>(null);
  const movement = useRef(0);
  useEffect(
    () => () => {
      model.traverse((object) => {
        if (object instanceof THREE.Mesh)
          (object.material as THREE.Material).dispose();
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
    for (const { object, sign, y } of feet) {
      if (!object) continue;
      const stride = Math.sin(t * 13) * sign * movement.current;
      object.rotation.x = stride * 0.3;
      object.position.y = y + Math.max(0, stride) * 0.065;
    }
    if (!group.current) return;
    group.current.position.y = ghost
      ? 0.22 + Math.sin(t * 2) * 0.08
      : seated
        ? 0.42
        : Math.abs(Math.sin(t * 13)) * 0.025 * movement.current +
          Math.sin(t * 2) * Math.min(idleBounce, 0.018);
    group.current.rotation.z = Math.sin(t * 13) * 0.025 * movement.current;
    group.current.rotation.y = headTurn?.current ?? 0;
  });
  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}
