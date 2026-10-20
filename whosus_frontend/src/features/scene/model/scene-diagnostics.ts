import { type RootState } from "@react-three/fiber";
import * as THREE from "three";
let rendererState: RootState | undefined;
export function setSceneRendererState(state: RootState) { rendererState = state; }

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
