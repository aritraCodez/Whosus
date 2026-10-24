import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { launchBrowser, baseURL, selectOption } from "./helpers/browser.mjs";
import { waitFor } from "./wait.mjs";

const names = [
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
for (const name of names) {
  const file = await readFile(`public/models/pokemon/${name}.glb`);
  assert.equal(file.toString("ascii", 0, 4), "glTF");
  const gltf = JSON.parse(
    file.toString("utf8", 20, 20 + file.readUInt32LE(12)),
  );
  assert.equal(gltf.scenes.length, 1, `${name}: isolated export`);
  assert(gltf.nodes.some((node) => node.extras?.pokemon === name));
  assert(
    !gltf.nodes.some((node) => /studio|plane|camera|light/i.test(node.name)),
    `${name}: no studio objects exported`,
  );
  assert(
    gltf.nodes.some((node) => node.extras?.part?.startsWith("leg_")),
    `${name}: animation pivots`,
  );
  const triangles = gltf.meshes
    .flatMap((mesh) => mesh.primitives)
    .reduce(
      (sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3,
      0,
    );
  assert(triangles < 40000, `${name}: manageable geometry`);
  assert(file.length < 1000000, `${name}: manageable download`);
  for (const accessor of gltf.accessors.filter(
    (a) => a.type === "VEC3" && a.min,
  )) {
    assert([...accessor.min, ...accessor.max].every(Number.isFinite));
    assert(
      Math.max(...accessor.max.map((value, i) => value - accessor.min[i])) < 5,
      `${name}: no oversized accidental geometry`,
    );
  }
  console.log(name, { triangles, bytes: file.length });
}

const browser = await launchBrowser({ args: ["--enable-unsafe-swiftshader"] });
const errors = [];
async function waitForPreview(page, character) {
  await waitFor(
    page,
    async (character) => {
      const url = performance
        .getEntriesByType("resource")
        .find((entry) =>
          entry.name.includes("/node_modules/.vite/deps/@react-three_fiber.js"),
        )?.name;
      if (!url) return false;
      const { _roots } = await import(url);
      const state = _roots
        .get(document.querySelector(".wardrobe-canvas canvas"))
        ?.store.getState();
      return (
        !!state?.scene.getObjectByName(`PokemonCharacter_${character}`) &&
        state.gl.info.render.calls > 0
      );
    },
    character,
    { timeout: 30000 },
  );
  await page.waitForTimeout(500);
}
await mkdir("artifacts", { recursive: true });
try {
  const context = await browser.newContext({
    permissions: ["local-network-access"],
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    console.log("Request failed:", request.url(), request.failure()?.errorText),
  );
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      try {
        const message = JSON.parse(String(payload));
        if (message.type === "error") console.log("Server:", message);
      } catch {
        /* Binary frames are not game messages. */
      }
    }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/models/pokemon/"))
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(baseURL);
  const bindModules = () =>
    page.evaluate(() => {
      for (const [key, path] of [
        ["__pokemonGameModule", "/src/features/game/model/game-store.ts"],
        [
          "__pokemonSceneModule",
          "/src/features/scene/model/scene-diagnostics.ts",
        ],
      ]) {
        window[key] =
          performance
            .getEntriesByType("resource")
            .find((entry) => new URL(entry.name).pathname === path)?.name ||
          path;
      }
    });
  await page
    .getByRole("button", { name: "Customize character", exact: true })
    .click();
  await page.getByRole("tab", { name: "Characters", exact: true }).click();
  for (const name of names) {
    await page
      .getByRole("button", {
        name: name[0].toUpperCase() + name.slice(1),
        exact: true,
      })
      .click();
    await waitFor(
      page,
      (name) =>
        performance
          .getEntriesByType("resource")
          .some(
            (entry) =>
              entry.name.endsWith(`/models/pokemon/${name}.glb`) &&
              entry.responseEnd > 0,
          ),
      name,
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("whosus-appearance")).character,
      ),
      name,
    );
    await waitForPreview(page, name);
    await page.screenshot({ path: `artifacts/pokemon-wardrobe-${name}.png` });
  }
  await page
    .getByRole("button", { name: "Turn character", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page
    .locator("dialog")
    .getByLabel("Explorer name", { exact: true })
    .fill("Pokemon Host");
  await selectOption(page, "Map", "mosslight");
  await page.getByRole("button", { name: "Crew", exact: true }).click();
  await selectOption(page, "Crew capacity", "4");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await bindModules();
  await waitFor(
    page,
    async () =>
      (await import(window.__pokemonGameModule)).useGame.getState().room
        ?.mapId === "mosslight",
  );
  const snapshot = () =>
    page.evaluate(
      async () =>
        (await import(window.__pokemonGameModule)).useGame.getState().room,
    );
  assert.equal((await snapshot()).players[0].character, "charizard");
  await page
    .getByRole("button", { name: "Fill to 4 with bots", exact: true })
    .click();
  await waitFor(
    page,
    async () =>
      (await import(window.__pokemonGameModule)).useGame.getState().room
        ?.population === 4,
  );
  await page.getByRole("button", { name: /I.m ready/ }).click();
  await page
    .getByRole("button", { name: "Launch expedition", exact: true })
    .click();
  await waitFor(
    page,
    async () =>
      (await import(window.__pokemonGameModule)).useGame.getState().room
        ?.phase === "playing",
  );
  await waitFor(page, async () =>
    (await import(window.__pokemonSceneModule))
      .sceneDiagnostics()
      ?.pokemonCharacters.includes("charizard"),
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/pokemon-mosslight-gameplay.png" });
  const before = (await snapshot()).players.find(
    (p) => p.name === "Pokemon Host",
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(300);
  const after = (await snapshot()).players.find((p) => p.id === before.id);
  assert(
    Math.hypot(after.x - before.x, after.z - before.z) > 0.2,
    "Pokemon movement reaches the server",
  );
  await page.reload();
  await page.getByRole("button", { name: "Toggle map", exact: true }).waitFor();
  await bindModules();
  await waitFor(page, async () => {
    const state = (await import(window.__pokemonGameModule)).useGame.getState();
    return state.room?.players.some(
      (p) => p.id === state.id && p.character === "charizard",
    );
  });
  assert.equal((await snapshot()).mapId, "mosslight");
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(baseURL);
  await phone
    .getByRole("button", { name: "Customize character", exact: true })
    .click();
  await phone.getByRole("tab", { name: "Characters", exact: true }).click();
  await phone.getByRole("button", { name: "Pikachu", exact: true }).click();
  await waitForPreview(phone, "pikachu");
  await waitFor(phone, () =>
    performance
      .getEntriesByType("resource")
      .some(
        (entry) =>
          entry.name.endsWith("/models/pokemon/pikachu.glb") &&
          entry.responseEnd > 0,
      ),
  );
  assert(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await phone.screenshot({ path: "artifacts/pokemon-mobile.png" });
  await phone.getByRole("button", { name: "Done", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: nine Blender GLBs, character previews, selection, Mosslight gameplay, movement, reconnect, and mobile.",
  );
} finally {
  await browser.close();
}
