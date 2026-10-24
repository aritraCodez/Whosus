import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, baseURL } from "../test/helpers/browser.mjs";

// Render the actual game meshes on transparency, with consistent framing.
const characters = [
  "pip",
  "mosslight",
  "eevee",
  "pikachu",
  "rowlet",
  "sprigatito",
  "piplup",
  "jigglypuff",
  "togepi",
  "squirtle",
  "charizard",
];
await mkdir("public/models/portraits", { recursive: true });
const browser = await launchBrowser({ args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  await page.route("**/__portraits__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Character portraits</title>",
    }),
  );
  await page.goto(`${baseURL}/__portraits__`);
  const portraits = await page.evaluate(async (characters) => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(320, 320);
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const result = [];
    for (const id of characters) {
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 1.8));
      const key = new THREE.DirectionalLight(0xfff4df, 3);
      key.position.set(-3, 5, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xd1efff, 1.5);
      fill.position.set(4, 2, -2);
      scene.add(fill);
      const url = ["pip", "mosslight"].includes(id)
        ? `/models/${id}.glb`
        : `/models/pokemon/${id}.glb`;
      const { scene: model } = await new GLTFLoader().loadAsync(url);
      scene.add(model);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model),
        center = box.getCenter(new THREE.Vector3());
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
      camera.position.copy(center).add(new THREE.Vector3(2.8, 1.6, 6));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      const viewBox = new THREE.Box3();
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z])
            viewBox.expandByPoint(
              new THREE.Vector3(x, y, z).applyMatrix4(
                camera.matrixWorldInverse,
              ),
            );
      const half =
        Math.max(viewBox.max.x - viewBox.min.x, viewBox.max.y - viewBox.min.y) *
        0.55;
      camera.left = -half;
      camera.right = half;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      result.push({
        id,
        data: renderer.domElement.toDataURL("image/png").split(",")[1],
      });
      model.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        }
      });
    }
    renderer.dispose();
    return result;
  }, characters);
  for (const { id, data } of portraits)
    await writeFile(
      `public/models/portraits/${id}.png`,
      Buffer.from(data, "base64"),
    );
  console.log(`Rendered ${portraits.length} transparent avatar portraits.`);
} finally {
  await browser.close();
}
