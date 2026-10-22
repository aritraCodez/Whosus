import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser, baseURL, selectOption } from "./helpers/browser.mjs";

await mkdir("artifacts", { recursive: true });
const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 650 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise the real UI and action transport with deterministic room snapshots.
  await page.route("**/src/features/scene/components/Scene.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export default function Scene() { return null; }",
    }),
  );
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
  const patchRoom = (patch) =>
    page.evaluate((values) => {
      window.gameStore.setState({
        room: { ...window.gameStore.getState().room, ...values },
      });
    }, patch);
  const visibleAndUncovered = async (locator, description) => {
    assert(
      await locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return (
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          element.contains(hit)
        );
      }),
      description,
    );
  };

  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 650],
    [412, 740],
    [844, 390],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await patchRoom({ phase: "voting" });
    await page.locator(".meeting-card").waitFor();
    const confirm = page.getByRole("button", {
      name: "Confirm vote",
      exact: true,
    });
    const skip = page.getByRole("button", { name: "Skip vote", exact: true });
    await visibleAndUncovered(
      confirm,
      `${width}x${height}: confirm visible without scrolling`,
    );
    await visibleAndUncovered(
      skip,
      `${width}x${height}: skip visible without scrolling`,
    );
    assert(await confirm.isDisabled());
    await page.locator(".vote-card").first().click();
    assert(await confirm.isEnabled());
    await confirm.click();
    assert.deepEqual(await page.evaluate(() => window.sentActions.at(-1)), {
      type: "action",
      action: "vote",
      target: "p0",
    });
    await skip.click();
    await confirm.click();
    assert.deepEqual(await page.evaluate(() => window.sentActions.at(-1)), {
      type: "action",
      action: "vote",
      target: "skip",
    });

    const players = page.getByRole("region", { name: "Players", exact: true });
    if (
      await players.evaluate(
        (element) => element.scrollHeight > element.clientHeight + 2,
      )
    ) {
      await page
        .getByRole("button", { name: "Scroll down in Players", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector(".meeting-players .scroll-area-viewport")
            .scrollTop > 0,
      );
      await visibleAndUncovered(
        confirm,
        "Confirm stays visible after navigating the crew list",
      );
      await players.focus();
      await page.keyboard.press("End");
      await page.locator(".vote-card").last().click();
      await confirm.click();
      assert.equal(
        await page.evaluate(() => window.sentActions.at(-1).target),
        "p11",
      );
    }
    await page.screenshot({ path: `artifacts/voting-${width}x${height}.png` });
    await patchRoom({ phase: "gameover" });
    await page.locator(".end-card").waitFor();
    await visibleAndUncovered(
      page.getByRole("button", { name: "One more expedition?" }),
      "Rematch stays visible",
    );
    await visibleAndUncovered(
      page.getByRole("button", { name: "Back to the main menu" }),
      "Menu action stays visible",
    );
    await page.screenshot({ path: `artifacts/results-${width}x${height}.png` });
    console.log(`PASS: voting and rematch actions at ${width}x${height}`);
  }

  await page.setViewportSize({ width: 360, height: 640 });
  await patchRoom({ phase: "voting" });
  const touchList = page.getByRole("region", { name: "Players", exact: true });
  await touchList.waitFor();
  const touchBox = await touchList.boundingBox();
  const cdp = await context.newCDPSession(page);
  const start = {
    x: touchBox.x + touchBox.width / 2,
    y: touchBox.y + touchBox.height - 15,
  };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [start],
  });
  for (let step = 1; step <= 6; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x, y: start.y - step * 20 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".meeting-players .scroll-area-viewport")
        .scrollTop > 0,
  );
  await visibleAndUncovered(
    page.getByRole("button", { name: "Confirm vote", exact: true }),
    "Vote action stays visible during touch scrolling",
  );
  await page.evaluate(() => {
    const room = window.gameStore.getState().room;
    window.gameStore.setState({
      room: {
        ...room,
        players: room.players.map((player) => ({ ...player, voted: true })),
      },
    });
  });
  assert(
    await page
      .getByRole("button", { name: "Skip vote", exact: true })
      .isDisabled(),
  );
  assert(
    await page
      .getByRole("button", { name: "Confirm vote", exact: true })
      .isDisabled(),
  );
  await patchRoom({ phase: "discussion" });
  assert.equal(await page.locator(".vote-actions").count(), 0);
  console.log("PASS: touch swipe, locked votes, discussion phase");
  await patchRoom({ phase: "playing", meetingCooldown: 19.4 });
  const meetingAction = page.locator(".action.use");
  await meetingAction.waitFor();
  assert(await meetingAction.isDisabled());
  assert.match(await meetingAction.innerText(), /Meeting\s+20s/);
  await patchRoom({ meetingCooldown: 1 });
  assert.match(await meetingAction.innerText(), /Meeting\s+1s/);
  await patchRoom({ meetingCooldown: 0 });
  assert(await meetingAction.isEnabled());
  assert.equal(await meetingAction.locator(".meeting-cooldown").count(), 0);
  await patchRoom({ emergency: 0 });
  assert(await meetingAction.isDisabled());
  console.log("PASS: meeting countdown and availability");
  await patchRoom({ phase: "lobby", population: 4 });
  await page.evaluate(() =>
    window.gameStore.setState({ missionSettings: true }),
  );
  const dialog = page.locator(".mission-settings-dialog");
  await dialog.waitFor();
  await page.getByRole("combobox", { name: "Crew capacity" }).click();
  const capacityList = page.getByRole("listbox", { name: "Crew capacity" });
  assert(
    await capacityList.evaluate((element) => element.matches(":popover-open")),
  );
  await capacityList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await visibleAndUncovered(
    capacityList.getByRole("option", { name: "12", exact: true }),
    "Last capacity option is above the dialog footer and not clipped",
  );
  await page.screenshot({ path: "artifacts/settings-dropdown.png" });
  await page.keyboard.press("Escape");
  assert(
    await dialog.isVisible(),
    "Escape closes the dropdown without closing settings",
  );
  await capacityList.waitFor({ state: "detached" });
  await visibleAndUncovered(
    dialog.getByRole("button", { name: "Close", exact: true }),
    "Close stays visible",
  );
  await selectOption(page, "Kill cooldown", "45");
  assert.equal(await page.evaluate(() => window.sentActions.at(-1).value), 45);
  await dialog.getByRole("button", { name: "Meetings", exact: true }).click();
  await selectOption(page, "Discussion time", "60");
  assert.equal(await page.evaluate(() => window.sentActions.at(-1).value), 60);
  const fields = await page
    .getByRole("combobox")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    );
  assert.equal(fields[0], fields[1], "First pair of settings aligned");
  assert.equal(
    fields[2],
    fields[3],
    "Wrapped emergency meeting label keeps controls aligned",
  );
  await page.screenshot({ path: "artifacts/mission-settings-meetings.png" });
  assert.equal(
    await dialog.getByRole("button", { name: "Tasks", exact: true }).count(),
    0,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await visibleAndUncovered(
    dialog.getByRole("button", { name: "Done", exact: true }),
    "Done stays visible",
  );
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: settings sections, aligned controls, settings actions, no browser errors",
  );
} finally {
  await browser.close();
}
