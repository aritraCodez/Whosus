import { useGame } from "@/features/game/model/game-store";
import { World } from "@/features/scene/components/World";
import { LabelLayout } from "@/features/scene/components/LabelLayout";
import { setSceneRendererState } from "@/features/scene/model/scene-diagnostics";
import { Canvas } from "@react-three/fiber";
import { memo, Suspense } from "react";
export { sceneDiagnostics } from "@/features/scene/model/scene-diagnostics";
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
      style={{ touchAction: menu ? "pan-y pinch-zoom" : "none" }}
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
        <LabelLayout />
      </Suspense>
    </Canvas>
  );
});
