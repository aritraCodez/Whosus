import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.WHOSUS_BROWSER || undefined,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const interval = window.setInterval.bind(window);
    window.pauseIntervalTimers = false;
    window.setInterval = (callback, delay, ...args) =>
      interval(() => {
        if (!window.pauseIntervalTimers) callback(...args);
      }, delay);
  });
  let inputs = 0;
  let pings = 0;
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const { type } = JSON.parse(payload);
      if (type === "input") inputs++;
      if (type === "ping") pings++;
    });
  });
  await page.goto(process.env.WHOSUS_TEST_URL || "http://localhost:5173");
  const results = await page.evaluate(async () => {
    // Use the application's loaded modules, including Vite's current version.
    const moduleUrl = (name) =>
      performance
        .getEntriesByType("resource")
        .find((entry) => new URL(entry.name).pathname === `/src/${name}.ts`)
        .name;
    const { motion, movementInput, renderPosition } = await import(
      moduleUrl("network")
    );
    const { useGame } = await import(moduleUrl("store"));
    const { move } = await import(moduleUrl("world"));
    // Keep the network timer idle; these checks exercise render prediction.
    useGame.setState({
      status: "connected",
      settings: false,
      id: "test",
      quality: "low",
    });
    document.activeElement?.blur();
    const sample = (phase, x, z, key, ghost = false) => {
      useGame.getState().room = {
        phase,
        vent: -1,
        movementLock: 0,
        challenge: null,
        players: [{ id: "test", x, z, alive: !ghost }],
      };
      motion.x = x;
      motion.z = z;
      motion.dx = motion.dz = 0;
      motion.keys.clear();
      motion.keys.add(key);
      const [dx, dz] = movementInput();
      const target = move(x, z, dx, dz, ghost, phase === "lobby");
      const frames = [0, 10, 20, 30, 40, 50].map((elapsed) => {
        motion.steppedAt = performance.now() - elapsed;
        return renderPosition();
      });
      useGame.getState().room = null;
      return { start: [x, z], target, frames };
    };
    const samples = {
      openLobby: sample("lobby", -1.65, 2, "ArrowDown"),
      lobbyEdge: sample("lobby", 0, 4.55, "ArrowDown"),
      lobbyCrate: sample("lobby", -3.5, 0.55, "ArrowUp"),
      meetingBeacon: sample("playing", -1.3, 0, "ArrowRight"),
      ghostEdge: sample("playing", 13.95, 0, "ArrowRight", true),
    };
    motion.keys.clear();
    useGame.setState({ room: null, status: "offline" });
    return samples;
  });
  for (const [name, { start, target, frames }] of Object.entries(results)) {
    for (const [axis, origin] of start.entries()) {
      const travel = target[axis] - origin;
      for (let i = 0; i < frames.length; i++) {
        const actual = frames[i][axis];
        const expected = origin + (travel * i) / (frames.length - 1);
        assert(
          Math.abs(actual - expected) < 0.002,
          `${name}: frame ${i} must follow the accepted movement step`,
        );
      }
    }
  }
  assert(
    results.openLobby.target[1] > 2.1,
    "Down must move on open lobby floor",
  );
  assert.equal(
    results.lobbyEdge.target[1],
    4.55,
    "The lobby edge must block forward movement",
  );
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByText("The usual suspects.").waitFor();
  const position = () =>
    page.evaluate(async () => {
      const url = performance
        .getEntriesByType("resource")
        .find((entry) => new URL(entry.name).pathname === "/src/store.ts").name;
      const { useGame } = await import(url);
      const s = useGame.getState();
      const me = s.room.players.find((p) => p.id === s.id);
      return [me.x, me.z];
    });
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(200);
  const beforeRepeat = await position();
  const beforeInputs = inputs;
  const beforePings = pings;
  await page.evaluate(() => {
    window.pauseIntervalTimers = true;
  });
  try {
    // Reproduce timers being deferred while native repeat events still arrive.
    for (let i = 0; i < 180; i++) {
      await page.waitForTimeout(30);
      await page.keyboard.down("ArrowDown");
    }
  } finally {
    await page.keyboard.up("ArrowDown");
    await page.evaluate(() => {
      window.pauseIntervalTimers = false;
    });
  }
  await page.waitForTimeout(200);
  const afterRepeat = await position();
  assert(
    inputs - beforeInputs >= 8,
    "Held Down must keep sending inputs while interval timers are deferred",
  );
  assert(pings > beforePings, "Heartbeats must continue while interval timers are deferred");
  assert(
    Math.hypot(
      afterRepeat[0] - beforeRepeat[0],
      afterRepeat[1] - beforeRepeat[1],
    ) > 1.2,
    "The server must keep moving the player during keyboard repeat",
  );
  const releasedInputs = inputs;
  await page.waitForTimeout(200);
  assert.equal(
    inputs,
    releasedInputs,
    "Key release must stop sending movement",
  );
  const stopped = await position();
  assert(
    Math.hypot(stopped[0] - afterRepeat[0], stopped[1] - afterRepeat[1]) < 0.05,
    "Key release must stop the authoritative player",
  );
  console.log(
    "PASS: smooth prediction, held Down with deferred timers, heartbeats, server movement, and release.",
  );
} finally {
  await browser.close();
}
