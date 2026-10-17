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
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.WHOSUS_TEST_URL || "http://127.0.0.1:5173");
  await page.getByLabel("Edit explorer name", { exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Explorer name", { exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page
    .getByLabel("Explorer name", { exact: true })
    .fill("Editable Pilot");
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.locator("dialog").getByLabel("Explorer name").fill("Map Pilot");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByText("The usual suspects.").waitFor();
  await page.getByLabel("Edit lobby name").click();
  await page.getByLabel("Lobby explorer name").fill("Renamed Pilot");
  await page.getByLabel("Lobby explorer name").press("Enter");
  await waitFor(page, async () => {
    const { useGame } = await import("/src/store.ts");
    const s = useGame.getState();
    return s.room.players.find((p) => p.id === s.id).name === "Renamed Pilot";
  });
  const position = () =>
    page.evaluate(async () => {
      const { useGame } = await import("/src/store.ts");
      const s = useGame.getState();
      const p = s.room.players.find((p) => p.id === s.id);
      return [p.x, p.z];
    });
  const lobbyBefore = await position();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(650);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(200);
  const lobbyAfter = await position();
  assert(
    Math.hypot(lobbyAfter[0] - lobbyBefore[0], lobbyAfter[1] - lobbyBefore[1]) >
      1.5,
    "One held key must keep moving",
  );
  await page.waitForTimeout(300);
  const stopped = await position();
  assert(
    Math.hypot(stopped[0] - lobbyAfter[0], stopped[1] - lobbyAfter[1]) < 0.05,
    "Releasing movement stops the player",
  );
  // Three independent protocol clients keep this test focused on one renderer.
  await page.evaluate(async () => {
    const { backendWebSocketUrl } = await import("/src/backend.ts");
    const { useGame } = await import("/src/store.ts");
    const code = useGame.getState().room.code;
    window.sceneTestPeers = await Promise.all(
      Array.from(
        { length: 3 },
        (_, i) =>
          new Promise((resolve, reject) => {
            const socket = new WebSocket(backendWebSocketUrl());
            socket.onopen = () =>
              socket.send(
                JSON.stringify({ type: "join", code, name: `Map Crew ${i}` }),
              );
            socket.onerror = () =>
              reject(new Error("Test player connection failed"));
            socket.onmessage = ({ data }) => {
              const message = JSON.parse(data);
              if (message.type === "joined") {
                socket.send(
                  JSON.stringify({ type: "action", action: "ready" }),
                );
                resolve(socket);
              }
            };
          }),
      ),
    );
  });
  await waitFor(page, async () => {
    const { useGame } = await import("/src/store.ts");
    const s = useGame.getState();
    return (
      s.room.players.length === 4 &&
      s.room.players.filter((p) => p.id !== s.id).every((p) => p.ready)
    );
  });

  async function checkLabels() {
    await waitFor(page, () => {
      const labels = [...document.querySelectorAll(".nameplate")];
      return (
        labels.length === 4 &&
        labels.every((label) => {
          const bounds = label.getBoundingClientRect();
          return (
            bounds.width > 20 &&
            bounds.width < 240 &&
            bounds.height > 8 &&
            bounds.height < 40
          );
        })
      );
    });
  }
  await checkLabels();
  await page.screenshot({ path: "artifacts/waiting-room-desktop.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: "artifacts/waiting-room-landscape.png" });
  const stick = await page.getByLabel("Movement joystick").boundingBox();
  const touchBefore = await position();
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    stick.x + stick.width / 2,
    stick.y + stick.height / 2 + 28,
  );
  await page.waitForTimeout(550);
  await page.mouse.up();
  const touchAfter = await position();
  assert(
    Math.hypot(touchAfter[0] - touchBefore[0], touchAfter[1] - touchBefore[1]) >
      0.7,
    "Joystick keeps moving while held",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/waiting-room-portrait.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => {
    const { act, send } = await import("/src/network.ts");
    const { useGame } = await import("/src/store.ts");
    const round = useGame.getState().room.round;
    window.sceneTestErrors = [];
    window.sceneTestUnsubscribe = useGame.subscribe((s) => {
      if (s.error) window.sceneTestErrors.push(s.error);
    });
    act("ready");
    act("start");
    // Deterministically reproduce the lobby packet arriving after launch.
    send({ type: "input", round, seq: 100000, dx: 1, dz: 0 });
  });
  await page.getByText("KEEP THIS BETWEEN US.").waitFor();
  await waitFor(page, async () => {
    const { useGame } = await import("/src/store.ts");
    return useGame.getState().room?.phase === "playing";
  });
  await checkLabels();
  await page.screenshot({ path: "artifacts/scene-playing.png" });
  await page.getByLabel("Toggle map").click();
  await page.waitForTimeout(1200);
  await checkLabels();
  await page.screenshot({ path: "artifacts/scene-map.png" });
  await page.getByLabel("Toggle map").click();
  const before = await page.evaluate(
    async () => (await import("/src/network.ts")).motion.x,
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(350);
  await page.keyboard.up("KeyD");
  await waitFor(
    page,
    async (before) => {
      const { useGame } = await import("/src/store.ts");
      const s = useGame.getState();
      return s.room.players.find((p) => p.id === s.id).x > before + 0.3;
    },
    before,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await checkLabels();
  await page.screenshot({ path: "artifacts/scene-mobile.png" });
  assert.deepEqual(
    await page.evaluate(() => window.sceneTestErrors),
    [],
    "No transition or movement errors",
  );
  assert.deepEqual(errors, [], "No renderer errors");
  await page.evaluate(async () => {
    window.sceneTestUnsubscribe();
    const { useGame } = await import("/src/store.ts");
    window.effectTestRoom = structuredClone(useGame.getState().room);
    for (const socket of window.sceneTestPeers) {
      socket.send(JSON.stringify({ type: "leave" }));
      socket.close();
    }
    (await import("/src/network.ts")).leave();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  // Exercise each renderer with the same shape as validated server events.
  for (let style = 0; style < 4; style++) {
    await page.evaluate(async (style) => {
      const { useGame } = await import("/src/store.ts");
      const { motion } = await import("/src/network.ts");
      const room = structuredClone(window.effectTestRoom);
      const attacker = {
        ...room.players[0],
        x: 0,
        z: 2,
        role: "impostor",
        alive: true,
      };
      const victim = {
        ...room.players[1],
        x: 1.4,
        z: 2,
        role: "crew",
        alive: false,
      };
      motion.x = 0;
      motion.z = 2;
      motion.revision++;
      useGame.setState({
        id: attacker.id,
        room: {
          ...room,
          phase: "gameover",
          players: [attacker, victim],
          movementLock: 2.4,
          bodies: [victim],
          eliminations: [
            { id: `visual-${style}`, style, elapsed: 0, attacker, victim },
          ],
        },
      });
    }, style);
    await page.waitForTimeout(950);
    await page.locator(".elimination-caption").waitFor();
    assert.equal(
      await page.locator(".end-card").count(),
      0,
      "Finishing effect plays before results",
    );
    await page.screenshot({ path: `artifacts/elimination-${style}.png` });
    await page.evaluate(async () => {
      const { useGame } = await import("/src/store.ts");
      useGame.setState((s) => ({ room: { ...s.room, eliminations: [] } }));
    });
  }
  assert.deepEqual(errors, [], "No errors during any elimination animation");
  console.log(
    "PASS: editable names, held keys, joystick, responsive waiting room, launch, map, movement, four elimination effects.",
  );
} finally {
  await browser.close();
}
