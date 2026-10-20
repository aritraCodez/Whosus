import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { waitFor } from "./wait.mjs";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.WHOSUS_BROWSER || undefined,
  args: ["--enable-unsafe-swiftshader"],
});
await mkdir("artifacts", { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(15000);
  console.log("Browser ready");
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("websocket", (ws) => {
    console.log(`Websocket: ${ws.url()}`);
    ws.on("framereceived", (event) => {
      try {
        const message = JSON.parse(String(event.payload));
        if (message.type === "error")
          console.log("Server error:", message.message);
      } catch {}
    });
    ws.on("socketerror", (error) => console.log("Socket error:", error));
  });
  await page.goto(process.env.WHOSUS_TEST_URL || "http://localhost:5173");
  await page
    .getByRole("button", { name: "Customize character", exact: true })
    .click();
  console.log("Wardrobe opened");
  const choose = async (category, item) => {
    await page.getByRole("tab", { name: category, exact: true }).click();
    await page.getByRole("button", { name: item, exact: true }).click();
    console.log(`Selected ${category}: ${item}`);
    await page.waitForFunction(
      ({ item }) =>
        [...document.querySelectorAll(".wardrobe-item")].some(
          (b) =>
            b.getAttribute("aria-label") === item &&
            b.getAttribute("aria-pressed") === "true",
        ),
      { item },
    );
  };
  await choose("Outfits", "Starlight dress");
  await choose("Hats", "Crew royalty");
  await choose("Facewear", "Round glasses");
  await choose("Backpacks", "Little wings");
  await choose("Boots", "Golden boots");
  await choose("Color", "Lavender");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/wardrobe-desktop.png" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Customize character", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Starlight dress", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page
    .locator("dialog")
    .getByLabel("Explorer name")
    .fill("Wardrobe Host");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByText("The usual suspects.").waitFor();
  const room = () =>
    page.evaluate(
      async () =>
        (
          await import(
            performance
              .getEntriesByType("resource")
              .find((entry) => new URL(entry.name).pathname === "/src/features/game/model/game-store.ts")
              .name
          )
        ).useGame.getState().room,
    );
  let snapshot = await room();
  assert.equal(snapshot.players[0].outfit, "dress");
  assert.equal(snapshot.players[0].hat, "crown");
  assert.equal(snapshot.players[0].accessory, "wings");
  const station = page.getByRole("button", {
    name: "Change outfit",
    exact: true,
  });
  assert.equal(
    await station.count(),
    0,
    "Outfit option is hidden away from the wardrobe box",
  );
  assert.equal(
    await page
      .locator(".room-profile .wardrobe-launch, .lobby-deck .wardrobe-launch")
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Sit down", exact: true }).waitFor();
  await page.keyboard.down("KeyS");
  try {
    await waitFor(page, async () => {
      const url = performance.getEntriesByType("resource").find(entry => new URL(entry.name).pathname === "/src/features/game/model/game-store.ts").name;
      const state = (await import(url)).useGame.getState();
      return state.room.players.find(p => p.id === state.id).z >= 1.8;
    });
  } finally { await page.keyboard.up("KeyS"); }
  await page.keyboard.down("ArrowRight");
  try {
    await station.waitFor();
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await page.keyboard.press("KeyE");
  await page.getByRole("heading", { name: "Explorer wardrobe" }).waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.keyboard.down("ArrowLeft");
  try {
    await station.waitFor({ state: "hidden" });
  } finally {
    await page.keyboard.up("ArrowLeft");
  }
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .find(
        (entry) => new URL(entry.name).pathname === "/src/features/game/actions/interactions.ts",
      ).name;
    (await import(url)).openWardrobe();
  });
  assert.equal(
    await page.locator("dialog[open]").count(),
    0,
    "Walking away prevents wardrobe access",
  );
  await page.keyboard.down("ArrowRight");
  try {
    await station.waitFor();
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/wardrobe-station.png" });
  await page.evaluate((code) => {
    window.wardrobePeer = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    );
    window.wardrobePeer.onopen = () =>
      window.wardrobePeer.send(
        JSON.stringify({ type: "join", code, name: "Wardrobe witness" }),
      );
    window.wardrobePeer.onmessage = (e) => {
      const message = JSON.parse(e.data);
      if (message.type === "snapshot") window.peerRoom = message.room;
    };
  }, snapshot.code);
  await page.waitForFunction(() => window.peerRoom?.players.length === 2);
  await page
    .getByRole("button", { name: "Change outfit", exact: true })
    .click();
  await choose("Outfits", "Captain's coat");
  await choose("Hats", "Space cowboy");
  await choose("Backpacks", "Jetpack");
  await page.waitForFunction(() =>
    window.peerRoom?.players.some(
      (p) =>
        p.name === "Wardrobe Host" &&
        p.outfit === "captain" &&
        p.hat === "cowboy" &&
        p.accessory === "jetpack",
    ),
  );
  await page.screenshot({ path: "artifacts/wardrobe-lobby.png" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/wardrobe-lobby-scene.png" });
  await page.reload();
  await page.getByText("The usual suspects.").waitFor();
  snapshot = await room();
  assert.equal(
    snapshot.players.find((p) => p.name === "Wardrobe Host").outfit,
    "captain",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Change outfit", exact: true })
    .click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/wardrobe-mobile.png" });
  const overflow = await page
    .locator("dialog")
    .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  assert.equal(overflow, false, "Wardrobe must fit a phone viewport");
  await choose("Outfits", "Cozy hoodie");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(async () =>
    (
      await import(
        performance
          .getEntriesByType("resource")
          .find((entry) => new URL(entry.name).pathname === "/src/features/game/network/game-client.ts")
          .name
      )
    ).leave(),
  );
  await page
    .getByRole("button", { name: "Customize character", exact: true })
    .waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/wardrobe-hero-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: wardrobe categories, station proximity, E interaction, persistence, create/join, live peer updates, resume, mobile, and no browser errors",
  );
} finally {
  await browser.close();
}
