import type { Cosmetics } from "@/features/appearance/model/appearance-store";
import { RoundedBox } from "@react-three/drei";

type Point = [number, number, number];
type PartProps = {
  at: Point;
  size: Point;
  color: string;
  rotation?: Point;
  ghost?: boolean;
};
function Block({ at, size, color, rotation, ghost }: PartProps) {
  return (
    <RoundedBox
      position={at}
      args={size}
      rotation={rotation}
      radius={Math.min(...size) / 4}
      smoothness={2}
      castShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={0.65}
        transparent={ghost}
        opacity={ghost ? 0.35 : 1}
        depthWrite={!ghost}
      />
    </RoundedBox>
  );
}
function Orb({ at, size, color, ghost }: PartProps) {
  return (
    <mesh position={at} scale={size} castShadow>
      <sphereGeometry args={[1, 16, 10]} />
      <meshStandardMaterial
        color={color}
        transparent={ghost}
        opacity={ghost ? 0.35 : 1}
        depthWrite={!ghost}
      />
    </mesh>
  );
}
function Disc({
  at,
  top,
  bottom = top,
  height,
  color,
  ghost,
}: {
  at: Point;
  top: number;
  bottom?: number;
  height: number;
  color: string;
  ghost?: boolean;
}) {
  return (
    <mesh position={at} castShadow>
      <cylinderGeometry args={[top, bottom, height, 24]} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        transparent={ghost}
        opacity={ghost ? 0.35 : 1}
        depthWrite={!ghost}
      />
    </mesh>
  );
}
function Ring({
  at,
  radius,
  color,
  ghost,
  rotation,
}: {
  at: Point;
  radius: number;
  color: string;
  ghost?: boolean;
  rotation?: Point;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow>
      <torusGeometry args={[radius, 0.023, 8, 24]} />
      <meshStandardMaterial
        color={color}
        metalness={0.35}
        roughness={0.35}
        transparent={ghost}
        opacity={ghost ? 0.35 : 1}
        depthWrite={!ghost}
      />
    </mesh>
  );
}

export const OUTFIT_COLORS: Record<string, string> = {
  flight: "#e57f51",
  overalls: "#537d98",
  dress: "#a08bd7",
  captain: "#253f65",
  hoodie: "#76bda1",
  lab: "#e3eee3",
  tuxedo: "#29323f",
};
export const BOOT_COLORS: Record<string, string> = {
  ivory: "#ece6d4",
  mint: "#6ad9c5",
  coral: "#f47785",
  gold: "#e6b650",
};

export function Headwear({
  hat,
  visor,
  ghost = false,
}: Pick<Cosmetics, "hat" | "visor"> & { ghost?: boolean }) {
  const g = { ghost };
  return (
    <group>
      {hat === "beanie" && (
        <>
          <Orb
            {...g}
            at={[0, 1.52, 0]}
            size={[0.43, 0.23, 0.32]}
            color="#d88095"
          />
          <Block
            {...g}
            at={[0, 1.49, 0]}
            size={[0.88, 0.12, 0.62]}
            color="#bc617e"
          />
          <Orb
            {...g}
            at={[0, 1.77, 0]}
            size={[0.1, 0.1, 0.1]}
            color="#f5d7c4"
          />
        </>
      )}
      {hat === "cap" && (
        <>
          <Orb
            {...g}
            at={[0, 1.5, 0]}
            size={[0.43, 0.19, 0.31]}
            color="#527da6"
          />
          <Block
            {...g}
            at={[0, 1.49, 0.29]}
            size={[0.65, 0.065, 0.43]}
            color="#82b7c6"
          />
          <Block
            {...g}
            at={[0, 1.6, 0.27]}
            size={[0.12, 0.09, 0.04]}
            color="#f3d58b"
          />
        </>
      )}
      {hat === "cowboy" && (
        <>
          <mesh position={[0, 1.51, 0]} scale={[1.15, 1, 0.8]}>
            <cylinderGeometry args={[0.61, 0.61, 0.065, 24]} />
            <meshStandardMaterial
              color="#b9814e"
              transparent={ghost}
              opacity={ghost ? 0.35 : 1}
            />
          </mesh>
          <Block
            {...g}
            at={[0, 1.65, 0]}
            size={[0.58, 0.28, 0.46]}
            color="#d5ab73"
          />
          <Block
            {...g}
            at={[0, 1.55, 0]}
            size={[0.6, 0.07, 0.48]}
            color="#66483c"
          />
        </>
      )}
      {hat === "crown" && (
        <>
          <Disc
            {...g}
            at={[0, 1.56, 0]}
            top={0.36}
            height={0.15}
            color="#edc65e"
          />
          {Array.from({ length: 6 }, (_, i) => (
            <group key={i} rotation={[0, (i * Math.PI) / 3, 0]}>
              <mesh position={[0, 1.73, 0.3]}>
                <coneGeometry args={[0.105, 0.25, 4]} />
                <meshStandardMaterial
                  color="#edc65e"
                  transparent={ghost}
                  opacity={ghost ? 0.35 : 1}
                />
              </mesh>
              <Orb
                {...g}
                at={[0, 1.57, 0.355]}
                size={[0.045, 0.045, 0.025]}
                color={i % 2 ? "#79d5c2" : "#e5788a"}
              />
            </group>
          ))}
        </>
      )}
      {hat === "wizard" && (
        <>
          <Disc
            {...g}
            at={[0, 1.51, 0]}
            top={0.51}
            height={0.06}
            color="#63528e"
          />
          <Disc
            {...g}
            at={[0, 1.82, 0]}
            top={0.015}
            bottom={0.33}
            height={0.62}
            color="#8d78bc"
          />
          <Orb
            {...g}
            at={[0, 1.75, 0.23]}
            size={[0.065, 0.065, 0.025]}
            color="#f5d98d"
          />
        </>
      )}
      {hat === "headphones" && (
        <>
          <Block
            {...g}
            at={[0, 1.51, 0]}
            size={[0.92, 0.09, 0.16]}
            color="#263b51"
          />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Block
                {...g}
                at={[s * 0.45, 1.34, 0]}
                size={[0.09, 0.34, 0.16]}
                color="#263b51"
              />
              <Block
                {...g}
                at={[s * 0.47, 1.22, 0]}
                size={[0.16, 0.29, 0.3]}
                color="#a69cdb"
              />
            </group>
          ))}
        </>
      )}
      {hat === "cat" &&
        [-1, 1].map((s) => (
          <group
            key={s}
            position={[s * 0.29, 1.62, 0]}
            rotation={[0, 0, -s * 0.2]}
          >
            <mesh>
              <coneGeometry args={[0.19, 0.32, 3]} />
              <meshStandardMaterial
                color="#354459"
                transparent={ghost}
                opacity={ghost ? 0.35 : 1}
              />
            </mesh>
            <mesh position={[0, 0, 0.075]} scale={[0.6, 0.65, 0.4]}>
              <coneGeometry args={[0.19, 0.32, 3]} />
              <meshStandardMaterial
                color="#efa6b7"
                transparent={ghost}
                opacity={ghost ? 0.35 : 1}
              />
            </mesh>
          </group>
        ))}
      {hat === "halo" && (
        <Ring
          {...g}
          at={[0, 1.8, 0]}
          radius={0.35}
          color="#ffe294"
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}
      {(visor === "glasses" || visor === "goggles") && (
        <>
          {[-1, 1].map((s) => (
            <Ring
              {...g}
              key={s}
              at={[s * 0.17, 1.23, 0.365]}
              radius={visor === "goggles" ? 0.13 : 0.105}
              color={visor === "goggles" ? "#d5b37b" : "#dde2df"}
            />
          ))}
          <Block
            {...g}
            at={[0, 1.24, 0.37]}
            size={[0.13, 0.03, 0.03]}
            color="#dde2df"
          />
          {visor === "goggles" && (
            <Block
              {...g}
              at={[0, 1.23, -0.29]}
              size={[0.8, 0.08, 0.035]}
              color="#624f42"
            />
          )}
        </>
      )}
      {visor === "shades" && (
        <>
          {[-1, 1].map((s) => (
            <Block
              {...g}
              key={s}
              at={[s * 0.17, 1.23, 0.36]}
              size={[0.27, 0.17, 0.035]}
              color="#567e94"
            />
          ))}
          <Block
            {...g}
            at={[0, 1.28, 0.38]}
            size={[0.65, 0.025, 0.025]}
            color="#f1d6a2"
          />
        </>
      )}
      {visor === "monocle" && (
        <>
          <Ring {...g} at={[0.17, 1.23, 0.365]} radius={0.11} color="#ecc96b" />
          <Block
            {...g}
            at={[0.29, 1.09, 0.35]}
            size={[0.018, 0.23, 0.018]}
            color="#ecc96b"
          />
        </>
      )}
    </group>
  );
}

export function Bodywear({
  outfit,
  accessory,
  ghost = false,
}: Pick<Cosmetics, "outfit" | "accessory"> & { ghost?: boolean }) {
  const g = { ghost },
    cloth = OUTFIT_COLORS[outfit];
  return (
    <group>
      {cloth && (
        <Block
          {...g}
          at={[0, 0.68, 0]}
          size={[0.6, 0.54, 0.43]}
          color={cloth}
        />
      )}
      {outfit === "flight" && (
        <>
          <Block
            {...g}
            at={[0, 0.69, 0.233]}
            size={[0.025, 0.44, 0.025]}
            color="#f6e8c7"
          />
          <Block
            {...g}
            at={[0, 0.49, 0]}
            size={[0.62, 0.075, 0.45]}
            color="#293f4d"
          />
          <Block
            {...g}
            at={[0.17, 0.77, 0.24]}
            size={[0.12, 0.1, 0.035]}
            color="#f4d274"
          />
        </>
      )}
      {outfit === "overalls" && (
        <>
          {[-1, 1].map((s) => (
            <Block
              {...g}
              key={s}
              at={[s * 0.18, 0.85, 0.24]}
              size={[0.09, 0.25, 0.035]}
              color="#b5c8ac"
            />
          ))}
          <Block
            {...g}
            at={[0, 0.63, 0.25]}
            size={[0.28, 0.16, 0.04]}
            color="#365b76"
          />
        </>
      )}
      {outfit === "dress" && (
        <>
          <mesh position={[0, 0.46, 0]} scale={[1, 1, 0.73]} castShadow>
            <cylinderGeometry args={[0.29, 0.48, 0.32, 12]} />
            <meshStandardMaterial
              color="#a08bd7"
              transparent={ghost}
              opacity={ghost ? 0.35 : 1}
              depthWrite={!ghost}
            />
          </mesh>
          <Block
            {...g}
            at={[0, 0.65, 0.24]}
            size={[0.61, 0.065, 0.04]}
            color="#efd6b4"
          />
          {[-1, 1].map((s) => (
            <Orb
              {...g}
              key={s}
              at={[s * 0.07, 0.68, 0.28]}
              size={[0.08, 0.05, 0.035]}
              color="#efd6b4"
            />
          ))}
        </>
      )}
      {(outfit === "captain" || outfit === "tuxedo" || outfit === "lab") && (
        <>
          <Block
            {...g}
            at={[0, 0.78, 0.235]}
            size={[0.18, 0.3, 0.03]}
            color={outfit === "lab" ? "#90c4cb" : "#eee6cd"}
          />
          {[-1, 1].map((s) => (
            <Block
              {...g}
              key={s}
              at={[s * 0.14, 0.81, 0.26]}
              size={[0.09, 0.29, 0.035]}
              rotation={[0, 0, s * -0.3]}
              color={
                outfit === "captain"
                  ? "#efcc76"
                  : outfit === "lab"
                    ? "#ffffff"
                    : "#4a5566"
              }
            />
          ))}
          {[0.53, 0.62].map((y) => (
            <Orb
              {...g}
              key={y}
              at={[0, y, 0.25]}
              size={[0.025, 0.025, 0.02]}
              color="#e7c472"
            />
          ))}
          {outfit === "tuxedo" &&
            [-1, 1].map((s) => (
              <Orb
                {...g}
                key={s}
                at={[s * 0.05, 0.88, 0.27]}
                size={[0.06, 0.04, 0.025]}
                color="#d87589"
              />
            ))}
          {outfit === "lab" && (
            <Block
              {...g}
              at={[0.19, 0.61, 0.25]}
              size={[0.13, 0.12, 0.035]}
              color="#b7d5d2"
            />
          )}
        </>
      )}
      {outfit === "hoodie" && (
        <>
          <Block
            {...g}
            at={[0, 0.94, -0.1]}
            size={[0.57, 0.14, 0.37]}
            color="#568e7d"
          />
          <Block
            {...g}
            at={[0, 0.57, 0.24]}
            size={[0.33, 0.13, 0.04]}
            color="#568e7d"
          />
          {[-1, 1].map((s) => (
            <Block
              {...g}
              key={s}
              at={[s * 0.09, 0.81, 0.25]}
              size={[0.02, 0.2, 0.025]}
              color="#ecdfbb"
            />
          ))}
        </>
      )}
      {accessory === "pack" && (
        <>
          <Block
            {...g}
            at={[0, 0.73, -0.36]}
            size={[0.5, 0.58, 0.3]}
            color="#b8845a"
          />
          <Block
            {...g}
            at={[0, 0.66, -0.53]}
            size={[0.34, 0.23, 0.09]}
            color="#dbb077"
          />
          {[-1, 1].map((s) => (
            <Block
              {...g}
              key={s}
              at={[s * 0.22, 0.76, 0.25]}
              size={[0.055, 0.41, 0.035]}
              color="#b8845a"
            />
          ))}
        </>
      )}
      {accessory === "jetpack" && (
        <>
          {[-1, 1].map((s) => (
            <group key={s}>
              <Disc
                {...g}
                at={[s * 0.23, 0.76, -0.38]}
                top={0.13}
                height={0.52}
                color="#9bb9c5"
              />
              <Disc
                {...g}
                at={[s * 0.23, 0.46, -0.38]}
                top={0.09}
                bottom={0.04}
                height={0.12}
                color="#72d8da"
              />
            </group>
          ))}
          <Block
            {...g}
            at={[0, 0.75, -0.35]}
            size={[0.3, 0.22, 0.18]}
            color="#536c89"
          />
        </>
      )}
      {accessory === "wings" &&
        [-1, 1].map((s) => (
          <group
            key={s}
            position={[s * 0.2, 0.83, -0.3]}
            rotation={[0, s * -0.3, s * -0.45]}
          >
            {[0, 1, 2].map((i) => (
              <Block
                {...g}
                key={i}
                at={[s * (0.12 + i * 0.1), -0.05 - i * 0.05, 0]}
                size={[0.14, 0.55 - i * 0.1, 0.07]}
                color={i % 2 ? "#c7d7e2" : "#eee8dd"}
              />
            ))}
          </group>
        ))}
      {accessory === "cape" && (
        <>
          <Block
            {...g}
            at={[0, 0.65, -0.34]}
            size={[0.64, 0.75, 0.045]}
            rotation={[-0.18, 0, 0]}
            color="#c86880"
          />
          <Block
            {...g}
            at={[0, 0.95, 0.1]}
            size={[0.54, 0.07, 0.3]}
            color="#e5be73"
          />
        </>
      )}
      {accessory === "scarf" && (
        <>
          <Block
            {...g}
            at={[0, 0.96, 0]}
            size={[0.65, 0.1, 0.48]}
            color="#e98567"
          />
          <Block
            {...g}
            at={[0.21, 0.76, 0.27]}
            size={[0.13, 0.4, 0.05]}
            rotation={[0, 0, -0.12]}
            color="#e98567"
          />
        </>
      )}
    </group>
  );
}
