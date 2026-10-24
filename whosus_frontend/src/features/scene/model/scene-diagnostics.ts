import { type RootState } from "@react-three/fiber";
import type * as THREE from "three";
let rendererState: RootState | undefined;
export function setSceneRendererState(state: RootState) {
  rendererState = state;
}

export function sceneDiagnostics() {
  const s = rendererState?.get();
  let mosslightCharacters = 0;
  const pokemonCharacters: string[] = [];
  s?.scene.traverse((object) => {
    if (object.name === "MosslightCharacter") mosslightCharacters++;
    if (object.name.startsWith("PokemonCharacter_"))
      pokemonCharacters.push(object.name.slice("PokemonCharacter_".length));
  });
  return s
    ? {
        camera: s.camera.position.toArray(),
        rotation: s.camera.rotation.toArray(),
        zoom: (s.camera as THREE.OrthographicCamera).zoom,
        size: s.size,
        drawCalls: s.gl.info.render.calls,
        objects: s.scene.children.length,
        map: s.scene.getObjectByName("MosslightMap")
          ? "mosslight"
          : "cloudline",
        mosslightCharacters,
        pokemonCharacters,
      }
    : null;
}
