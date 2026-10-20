import { useGame } from "@/features/game/model/game-store";
import {
  FLOORS,
  OBSTACLES,
  STATIONS,
  VENTS,
} from "@/features/game/model/world";
import { Box } from "@/features/scene/components/Box";
import {
  Console,
  FloorLabel,
  Plant,
} from "@/features/scene/components/SceneObjects";
import { VisualTaskEffects } from "@/features/scene/components/VisualTaskEffects";
import { consoleColors, rooms } from "@/features/scene/model/scene-layout";
import { Html } from "@react-three/drei";
import { memo } from "react";
export const Station = memo(function Station({
  touchControls,
}: {
  touchControls: boolean;
}) {
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
