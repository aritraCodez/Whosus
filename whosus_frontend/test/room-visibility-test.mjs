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
  for (const [x, z] of [
    [0, 0],
    [4, 0],
    [5, 0],
    [10, 0],
    [0, 5],
    [0, 12],
    [-5, 0],
    [-12, 0],
    [0, -5],
    [0, -12],
    [0, 0],
  ]) {
    await page.evaluate(
      ([x, z]) => {
        const room = window.gameStore.getState().room;
        window.gameStore.setState({
          room: {
            ...room,
            players: room.players.map((p) =>
              p.id === "p1" ? { ...p, x, z } : p,
            ),
          },
        });
      },
      [x, z],
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert.equal(
      await page.locator(".nameplate").count(),
      12,
      "All players remain mounted across rooms",
    );
    assert(
      await page.evaluate(() => window.trackedAvatar.isConnected),
      "Moving avatar never unmounts",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: characters remain mounted crossing all four room boundaries and the old distance cutoff",
  );
} finally {
  await browser.close();
}
