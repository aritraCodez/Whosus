import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { launchBrowser, baseURL, selectOption } from "./helpers/browser.mjs";
import { waitFor } from "./wait.mjs";

// Inspect the exported files independently of the scene implementation.
for (const filename of ["mosslight.glb", "mosslight-map.glb"]) {
  const file = await readFile(`public/models/${filename}`);
  assert.equal(file.toString("ascii", 0, 4), "glTF");
  const json = JSON.parse(
    file.toString("utf8", 20, 20 + file.readUInt32LE(12)),
  );
  assert(json.meshes.length > 0);
  console.log(filename, {
    meshes: json.meshes.length,
    triangles: json.meshes
      .flatMap((mesh) => mesh.primitives)
      .reduce(
        (sum, primitive) => sum + json.accessors[primitive.indices].count / 3,
        0,
      ),
  });
  assert(
    !json.images?.some((image) => image.uri),
    "Assets must be self contained",
  );
  if (filename === "mosslight.glb") {
    assert.equal(
      json.nodes.filter((node) => node.name?.startsWith("Mosslight_Foot_"))
        .length,
      4,
    );
  }
}
const browser = await launchBrowser({ args: ["--enable-unsafe-swiftshader"] });
const errors = [];
await mkdir("artifacts", { recursive: true });
try {
  const context = await browser.newContext({
    permissions: ["local-network-access"],
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page
    .getByRole("button", { name: "Customize character", exact: true })
    .click();
  await page.getByRole("tab", { name: "Characters", exact: true }).click();
  await page
    .getByRole("button", { name: "Mosslight creature", exact: true })
    .click();
  await waitFor(
    page,
    () =>
      JSON.parse(localStorage.getItem("whosus-appearance")).character ===
      "mosslight",
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "artifacts/mosslight-wardrobe.png" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page
    .locator("dialog")
    .getByLabel("Explorer name", { exact: true })
    .fill("Mosslight Host");
  await selectOption(page, "Map", "mosslight");
  await page.getByRole("button", { name: "Crew", exact: true }).click();
  await selectOption(page, "Crew capacity", "4");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  const snapshot = () =>
    page.evaluate(
      async () =>
        (
          await import("/src/features/game/model/game-store.ts")
        ).useGame.getState().room,
    );
  await waitFor(
    page,
    async () =>
      (
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room?.mapId === "mosslight",
  );
  assert.equal((await snapshot()).players[0].character, "mosslight");
  await page
    .getByRole("button", { name: "Fill to 4 with bots", exact: true })
    .click();
  await waitFor(
    page,
    async () =>
      (
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room?.population === 4,
  );
  await page.getByRole("button", { name: /I.m ready/ }).click();
  await page
    .getByRole("button", { name: "Launch expedition", exact: true })
    .click();
  await waitFor(
    page,
    async () =>
      (
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room?.phase === "playing",
  );
  await waitFor(page, async () => {
    const diagnostics = (
      await import("/src/features/scene/model/scene-diagnostics.ts")
    ).sceneDiagnostics();
    return (
      diagnostics?.map === "mosslight" && diagnostics.mosslightCharacters >= 1
    );
  });
  assert(
    (await snapshot()).tasks.some(
      (task) => task.name === "Restore the moss garden",
    ),
  );
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "artifacts/mosslight-gameplay.png" });
  const before = (await snapshot()).players.find(
    (player) => player.name === "Mosslight Host",
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(300);
  const after = (await snapshot()).players.find(
    (player) => player.id === before.id,
  );
  assert(
    Math.hypot(after.x - before.x, after.z - before.z) > 0.2,
    "Creature moves authoritatively on the forest map",
  );
  await page.getByRole("button", { name: "Toggle map", exact: true }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "artifacts/mosslight-map-overview.png" });
  const diagnostics = await page.evaluate(async () =>
    (
      await import("/src/features/scene/model/scene-diagnostics.ts")
    ).sceneDiagnostics(),
  );
  assert.equal(diagnostics.map, "mosslight");
  await page.reload();
  await waitFor(page, async () => {
    const state = (
      await import("/src/features/game/model/game-store.ts")
    ).useGame.getState();
    return state.room?.players.some(
      (p) => p.id === state.id && p.character === "mosslight",
    );
  });
  assert.equal((await snapshot()).mapId, "mosslight");
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  mobilePage.on("pageerror", (error) => errors.push(error.message));
  await mobilePage.goto(baseURL);
  await mobilePage
    .getByRole("button", { name: "Customize character", exact: true })
    .click();
  await mobilePage
    .getByRole("tab", { name: "Characters", exact: true })
    .click();
  await mobilePage
    .getByRole("button", { name: "Mosslight creature", exact: true })
    .click();
  await mobilePage.waitForTimeout(1200);
  assert(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await mobilePage.screenshot({ path: "artifacts/mosslight-mobile.png" });
  await mobilePage.getByRole("button", { name: "Done", exact: true }).click();
  await mobilePage
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await selectOption(mobilePage, "Map", "mosslight");
  assert.equal(
    await mobilePage.locator(".map-card h3").textContent(),
    "Mosslight",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Blender GLBs, wardrobe selection, map creation, forest rendering, movement, tasks, and reconnect",
    diagnostics,
  );
} finally {
  await browser.close();
}
