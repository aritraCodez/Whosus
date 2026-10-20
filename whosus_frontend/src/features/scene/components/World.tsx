import { useGame } from "@/features/game/model/game-store";
import { Actors } from '@/features/scene/components/Actors';
import { CameraRig } from '@/features/scene/components/CameraRig';
import { MotionFrame } from '@/features/scene/components/MotionFrame';
import { Station } from '@/features/scene/components/Station';
import { WaitingRoom } from '@/features/scene/components/WaitingRoom';
import {
ContactShadows,
Float,
OrthographicCamera
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
export function World({
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