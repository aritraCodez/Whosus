import assert from "node:assert/strict";
import { launchBrowser, baseURL } from "./helpers/browser.mjs";
const browser = await launchBrowser({ args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByText("Good friends.").waitFor();
  await page.evaluate(async () => {
    const { useGame } = await import("/src/features/game/model/game-store.ts");
    const { COLORS } = await import("/src/features/game/model/types.ts");
    const { setGameSocket } = await import("/src/services/game-socket.ts");
    window.gameStore = useGame;
    window.sentActions = [];
    setGameSocket({
      readyState: WebSocket.OPEN,
      send: (data) => window.sentActions.push(JSON.parse(data)),
    });
    useGame.setState({
      id: "p0",
      status: "connected",
      sound: false,
      room: {
        code: "LAYOUT",
        host: "p0",
        public: false,
        capacity: 12,
        population: 12,
        killers: 2,
        phase: "voting",
        round: 1,
        remaining: 30,
        result: "Android called an emergency meeting.",
        winner: "killer",
        players: COLORS.map((color, i) => ({
          id: `p${i}`,
          name: i === 0 ? "Android" : `bot-${i}`,
          color,
          hat: "sprout",
          alive: true,
          connected: true,
          ready: true,
          voted: false,
          ack: 0,
          x: 0,
          z: 0,
          role: i > 9 ? "killer" : "crew",
        })),
        bodies: [],
        tasks: [],
        eliminations: [],
        movementLock: 0,
        sabotage: 0,
        killCooldown: 0,
        sabotageCooldown: 0,
        meetingCooldown: 0,
        emergency: 1,
        vent: -1,
        challenge: null,
        progress: 0,
        tally: {},
        taskBarMode: "always",
        visualTasks: true,
      },
    });
  });

  await page.evaluate(() => {
    const room = window.gameStore.getState().room;
    window.gameStore.setState({ room: { ...room, phase: "playing" } });
  });
  await page
    .locator(".nameplate")
    .filter({ hasText: "bot-1" })
    .first()
    .waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".nameplate").length === 12,
  );
  await page.evaluate(() => {
    window.trackedAvatar = Array.from(
      document.querySelectorAll(".nameplate"),
    ).find((el) => el.textContent.trim() === "bot-1");
  });

  await page.evaluate(async () => {
    const { STATIONS } = await import("/src/features/game/model/world.ts");
    const { motion } = await import("/src/features/game/model/motion.ts");
    const task = STATIONS[0];
    const x = task.x + 0.8,
      z = task.z;
    motion.x = motion.renderX = x;
    motion.z = motion.renderZ = z;
    const room = window.gameStore.getState().room;
    window.gameStore.setState({
      room: { ...room, players: room.players.map((p) => ({ ...p, x, z })) },
    });
  });
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator(".station-label").first().waitFor();
    await page.waitForFunction(() => {
      const names = Array.from(document.querySelectorAll(".nameplate")).map(
        (e) => e.getBoundingClientRect(),
      );
      const prompts = Array.from(
        document.querySelectorAll(".station-label"),
      ).map((e) => e.getBoundingClientRect());
      const overlaps = (a, b) =>
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      return (
        names.length === 12 &&
        names.every(
          (a, i) =>
            names.slice(i + 1).every((b) => !overlaps(a, b)) &&
            prompts.every((b) => !overlaps(a, b)),
        )
      );
    });
    await page.screenshot({ path: "artifacts/labels-" + width + ".png" });
    console.log(
      "PASS: 12 crowded nameplates avoid each other and task prompts at " +
        width +
        "x" +
        height,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
