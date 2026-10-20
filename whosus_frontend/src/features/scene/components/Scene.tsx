import { useGame } from "@/features/game/model/game-store";
import { World } from '@/features/scene/components/World';
import { setSceneRendererState } from '@/features/scene/model/scene-diagnostics';
import { Canvas } from "@react-three/fiber";
import { memo,Suspense } from "react";
export { sceneDiagnostics } from '@/features/scene/model/scene-diagnostics';
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
        setSceneRendererState(s);
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
