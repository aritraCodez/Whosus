import { useGame } from "@/features/game/model/game-store";
import { MOSS_ROOMS, stationsFor } from "@/features/game/model/maps";
import { VENTS } from "@/features/game/model/world";
import { Console, FloorLabel } from "@/features/scene/components/SceneObjects";
import { VisualTaskEffects } from "@/features/scene/components/VisualTaskEffects";
import { rooms } from "@/features/scene/model/scene-layout";
import { Html, Sparkles, useGLTF } from "@react-three/drei";
import { memo, useMemo } from "react";
import * as THREE from "three";

export const MosslightMap = memo(function MosslightMap({
  touchControls,
}: {
  touchControls: boolean;
}) {
  const { scene } = useGLTF("/models/mosslight-map.glb");
  const quality = useGame((s) => s.quality);
  const sabotage = useGame((s) => !!s.room?.sabotage);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.name = "MosslightForest";
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.receiveShadow = true;
        object.castShadow = true;
      }
    });
    return copy;
  }, [scene]);
  return (
    <group name="MosslightMap">
      <primitive object={model} />
      {rooms.map((room, index) => (
        <FloorLabel
          key={room.name}
          name={MOSS_ROOMS[index].toUpperCase()}
          x={room.x}
          z={room.z}
        />
      ))}
      <Html position={[0, 1.9, 0]} center zIndexRange={[2, 0]}>
        <span className="beacon-label">GATHERING STONE</span>
      </Html>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.12, 40]} />
        <meshBasicMaterial color={sabotage ? "#f78a6d" : "#ead68c"} />
      </mesh>
      <VisualTaskEffects />
      {stationsFor("mosslight").map((station, index) => (
        <Console
          key={station.id}
          stationId={station.id}
          x={station.x}
          z={station.z}
          touchControls={touchControls}
          color={index % 2 ? "#efc46e" : "#b6da8c"}
        />
      ))}
      {VENTS.map(([x, z], index) => (
        <group key={index} position={[x, 0.035, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.48, 10]} />
            <meshStandardMaterial color="#233d33" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.055, 5, 10]} />
            <meshStandardMaterial
              color="#abc080"
              emissive="#748852"
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}
      {quality === "high" && (
        <Sparkles
          count={45}
          size={2.5}
          scale={[29, 2, 29]}
          position={[0, 1.1, 0]}
          speed={0.18}
          color="#eae8a0"
        />
      )}
    </group>
  );
});
