import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser, baseURL, selectOption } from "./helpers/browser.mjs";
import { waitFor } from "./wait.mjs";

const browser = await launchBrowser({
  args: ["--enable-unsafe-swiftshader"],
});
await mkdir("artifacts", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(baseURL);
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.locator("dialog").getByLabel("Explorer name").fill("Rules Host");
  await selectOption(page, "Crew capacity", "8");
  await selectOption(page, "Movement speed", "1.5");
  await selectOption(page, "Voting time", "60");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByText("The usual suspects.").waitFor();
  await page.evaluate(async () => {
    window.gameModule = (name) =>
      performance.getEntriesByType("resource").find(
        (e) =>
          new URL(e.name).pathname ===
          {
            store: "/src/features/game/model/game-store.ts",
            types: "/src/features/game/model/types.ts",
            world: "/src/features/game/model/world.ts",
            network: "/src/features/game/network/game-client.ts",
            voice: "/src/features/voice/voice-client.ts",
            appearance: "/src/features/appearance/model/appearance-store.ts",
            interactions: "/src/features/game/actions/interactions.ts",
            devPlayers: "/src/features/lobby/model/test-players.ts",
            audio: "/src/features/game/audio/sounds.ts",
            backend: "/src/config/backend.ts",
          }[name],
      ).name;
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
  await selectOption(page, "Room visibility", "true");
  await waitFor(page, () => window.gameStore.getState().room.public);
  assert.equal((await room()).players.filter((p) => p.ready).length, 0);
  await page
    .getByRole("button", { name: "Room settings", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Station & Mission Settings" })
    .waitFor();
  await selectOption(page, "Kill cooldown", "45");
  await selectOption(page, "Discussion time", "60");
  await selectOption(page, "Task Progress Bar", "meetings");
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
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyS");
  await waitFor(page, () => {
    const s = window.gameStore.getState(),
      p = s.room.players.find((p) => p.id === s.id);
    return Math.hypot(p.x, p.z + 3.8) < 2.1;
  });
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyS");
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
  assert.equal(
    await page
      .locator(".bay-sign")
      .evaluate((el) => getComputedStyle(el).display),
    "inline",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Tap to interact", { exact: true }).waitFor();
  assert.equal(
    await page
      .locator(".bay-sign")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  assert.notEqual(
    await page
      .locator(".nameplate.you")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  const practiceLabel = await page
    .locator(".station-label.practice")
    .boundingBox();
  const playerName = await page.locator(".nameplate.you").boundingBox();
  assert(practiceLabel && playerName);
  assert(
    practiceLabel.x + practiceLabel.width <= playerName.x ||
      playerName.x + playerName.width <= practiceLabel.x ||
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
    window.gameStore.setState({
      room,
      id: room.players.find((p) => p.id !== room.host).id,
      settings: true,
    });
  });
  await page
    .getByText(
      "Only the host can change room rules in the waiting room. You can view them here.",
    )
    .waitFor();
  assert.equal(
    await page.locator('.host-rules [role="combobox"]:enabled').count(),
    0,
  );
  assert(await page.getByLabel("Visual Tasks", { exact: true }).isDisabled());
  assert(await page.getByLabel("Task Progress Bar").isDisabled());
  assert.deepEqual(errors, []);
  console.log(
    "PASS: eight-player capacity, unique colors, kick/refill, privacy, host rules, practice tasks, cancellation, mobile controls",
  );
} finally {
  await browser.close();
}
