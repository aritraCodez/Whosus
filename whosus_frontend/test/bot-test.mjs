import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser, baseURL } from "./helpers/browser.mjs";
import { waitFor } from "./wait.mjs";

const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    permissions: ["local-network-access"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Keep the real lobby/HUD/network without the unrelated 3D asset/GPU load.
  await page.route("**/src/features/scene/components/Scene.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export function Pip() { return null; } export default function Scene() { return null; }",
    }),
  );
  await page.goto(baseURL);
  await page.getByText("Good friends.").waitFor();
  await page.evaluate(async () =>
    (await import("/src/features/game/network/game-client.ts")).connect({
      type: "create",
      name: "Bot host",
      capacity: 8,
      kill_cooldown: 10,
    }),
  );
  const fill = page.getByRole("button", {
    name: "Fill to 8 with bots",
    exact: true,
  });
  await fill.click();
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
      ).useGame.getState().room.population === 8,
  );
  const bots = (await snapshot()).players.filter((p) => p.bot);
  assert.deepEqual(
    bots.map((p) => p.name).sort(),
    Array.from({ length: 7 }, (_, i) => `bot-${i + 1}`),
  );
  assert.equal(
    await page.locator(".crew-card small").filter({ hasText: "BOT" }).count(),
    7,
  );
  assert(
    await page
      .getByRole("button", { name: "Room full", exact: true })
      .isDisabled(),
  );
  await waitFor(
    page,
    async (before) =>
      (await import("/src/features/game/model/game-store.ts")).useGame
        .getState()
        .room.players.some((p) => {
          const previous = before[p.id];
          return (
            p.bot &&
            previous &&
            Math.hypot(p.x - previous[0], p.z - previous[1]) > 0.5
          );
        }),
    Object.fromEntries(bots.map((p) => [p.id, [p.x, p.z]])),
  );
  await page.getByRole("button", { name: "Kick bot-1", exact: true }).click();
  await fill.click();
  await waitFor(
    page,
    async () =>
      (
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room.population === 8,
  );
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/bot-lobby.png" });
  await page.getByRole("button", { name: /I’m ready/ }).click();
  await page
    .getByRole("button", { name: "Launch expedition", exact: true })
    .click();
  await waitFor(
    page,
    async () => {
      const room = (
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room;
      return room.phase === "playing" && room.progress > 0;
    },
    null,
    { timeout: 30000 },
  );
  const humanIsCrew = await page.evaluate(async () => {
    const s = (
      await import("/src/features/game/model/game-store.ts")
    ).useGame.getState();
    return s.room.players.find((p) => p.id === s.id).role === "crew";
  });
  if (humanIsCrew) {
    await waitFor(
      page,
      async () =>
        (
          await import("/src/features/game/model/game-store.ts")
        ).useGame.getState().room.bodies.length > 0,
      null,
      { timeout: 60000 },
    );
    console.log("PASS: server-controlled impostor made a kill in a real match");
  }
  await page.evaluate(async () =>
    (await import("/src/features/game/network/game-client.ts")).leave(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: bot labels/names, independent movement, kick/refill, auto-ready, launch and real task progress",
  );
} finally {
  await browser.close();
}
