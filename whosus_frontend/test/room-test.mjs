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
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.WHOSUS_TEST_URL || "http://localhost:5173");
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.locator("dialog").getByLabel("Explorer name").fill("Rules Host");
  await page.getByLabel("Crew capacity").selectOption("8");
  await page.getByLabel("Movement speed").selectOption("1.5");
  await page.getByLabel("Voting time").selectOption("60");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByText("The usual suspects.").waitFor();
  await page.evaluate(async () => {
    window.gameModule = (name) =>
      performance
        .getEntriesByType("resource")
        .find((e) => new URL(e.name).pathname === `/src/${name}.ts`).name;
    window.gameStore = (await import(window.gameModule("store"))).useGame;
    window.gameStore.setState({ quality: "low" });
  });
  const room = () => page.evaluate(() => window.gameStore.getState().room);
  assert.equal((await room()).capacity, 8);
  assert.equal((await room()).movementSpeed, 1.5);
  assert.equal((await room()).rules.voting, 60);
  await page
    .getByRole("button", { name: "Fill to 8 players", exact: true })
    .click();
  await waitFor(page, () => window.gameStore.getState().room.population === 8);
  assert.equal(new Set((await room()).players.map((p) => p.color)).size, 8);
  console.log("Eight unique players connected");
  assert.equal(await page.locator(".lobby-colors button:disabled").count(), 7);
  await page
    .getByRole("button", { name: "Kick Test Crew 1", exact: true })
    .click();
  await waitFor(page, () => window.gameStore.getState().room.population === 7);
  await page
    .getByRole("button", { name: "Fill to 8 players", exact: true })
    .click();
  await waitFor(page, () => window.gameStore.getState().room.population === 8);
  await page.getByLabel("Lobby room visibility").selectOption("true");
  await waitFor(page, () => window.gameStore.getState().room.public);
  assert.equal((await room()).players.filter((p) => p.ready).length, 0);
  await page
    .getByRole("button", { name: "Room settings", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Station & Mission Settings" })
    .waitFor();
  await page.getByLabel("Kill cooldown", { exact: true }).selectOption("45");
  await page.getByLabel("Discussion time", { exact: true }).selectOption("60");
  await page.getByLabel("Task Progress Bar").selectOption("meetings");
  await page.getByLabel("Visual Tasks", { exact: true }).click();
  await waitFor(page, () => {
    const r = window.gameStore.getState().room;
    return (
      r.rules.killCooldown === 45 &&
      r.rules.discussion === 60 &&
      r.taskBarMode === "meetings" &&
      !r.visualTasks
    );
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await waitFor(page, () => {
    const s = window.gameStore.getState(),
      p = s.room.players.find((p) => p.id === s.id);
    return p.z < -2.1;
  });
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(250);
  await page.keyboard.press("KeyE");
  await page
    .getByRole("heading", { name: "Practice station", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Prime Shields/ }).click();
  for (let i = 0; i < 5; i++)
    await page.locator(".hex-tile.depleted").first().click();
  await page
    .getByRole("heading", { name: "Practice station", exact: true })
    .waitFor();
  assert.equal((await room()).tasks.length, 0);
  await page.getByRole("button", { name: /Fuel Engines/ }).click();
  const fuel = page.getByRole("button", { name: /HOLD TO DISPENSE/ });
  await fuel.hover();
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.move(10, 10);
  await page.mouse.up();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForTimeout(3000);
  await page
    .getByRole("heading", { name: "Practice station", exact: true })
    .waitFor();
  await page.getByText("Tap or press E", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({ path: "artifacts/room-controls.png" });
  assert.equal(await page.locator(".bay-sign").evaluate(el => getComputedStyle(el).display), "inline");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Tap to interact", { exact: true }).waitFor();
  assert.equal(await page.locator(".bay-sign").evaluate(el => getComputedStyle(el).display), "none");
  assert.notEqual(await page.locator(".nameplate.you").evaluate(el => getComputedStyle(el).display), "none");
  const practiceLabel = await page.locator(".station-label.practice").boundingBox();
  const playerName = await page.locator(".nameplate.you").boundingBox();
  assert(practiceLabel && playerName);
  assert(
    practiceLabel.y + practiceLabel.height <= playerName.y ||
      playerName.y + playerName.height <= practiceLabel.y,
    "Practice label does not overlap the player's nameplate on mobile",
  );
  await page
    .getByRole("button", { name: "Room settings", exact: true })
    .click();
  assert(await page.getByLabel("Movement speed").isVisible());
  await page.screenshot({ path: "artifacts/room-rules-mobile.png" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(async () => {
    const s = window.gameStore.getState();
    const room = structuredClone(s.room);
    (await import(window.gameModule("network"))).leave();
    window.gameStore.setState({ room, id: room.players.find(p => p.id !== room.host).id, settings: true });
  });
  await page.getByText("Only the host can change room rules in the waiting room. You can view them here.").waitFor();
  assert.equal(await page.locator(".host-rules select:enabled").count(), 0);
  assert(await page.getByLabel("Visual Tasks", { exact: true }).isDisabled());
  assert(await page.getByLabel("Task Progress Bar").isDisabled());
  assert.deepEqual(errors, []);
  console.log(
    "PASS: eight-player capacity, unique colors, kick/refill, privacy, host rules, practice tasks, cancellation, mobile controls",
  );
} finally {
  await browser.close();
}
