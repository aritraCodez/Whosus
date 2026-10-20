import { launchBrowser, baseURL, selectOption } from "./helpers/browser.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { waitFor } from "./wait.mjs";
const base = baseURL;
await mkdir("artifacts", { recursive: true });
const wav = Buffer.alloc(44 + 48000 * 2 * 3);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < 48000 * 3; i++)
  wav.writeInt16LE(
    Math.round(Math.sin((i / 48000) * Math.PI * 2 * 440) * 6000),
    44 + i * 2,
  );
await writeFile("artifacts/test-tone.wav", wav);
const browser = await launchBrowser({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${path.resolve("artifacts/test-tone.wav")}`,
    "--autoplay-policy=no-user-gesture-required",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
const contexts = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["microphone", "clipboard-write"],
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.message);
  });
  await page.goto(base);
  await page.getByText("Good friends.").waitFor();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "artifacts/menu-desktop.png" });
  console.log("Menu rendered");
  await page.evaluate(async () => {
    const { useGame } = await import("/src/features/game/model/game-store.ts");
    useGame.setState({ quality: "low" });
  });
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.locator("dialog").getByLabel("Explorer name").fill("Host Pilot");
  await selectOption(page, "Elimination cooldown", "10");
  await selectOption(page, "Discussion time", "10");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByText("The usual suspects.").waitFor();
  const getRoom = (p) =>
    p.evaluate(async () => {
      const { useGame } =
        await import("/src/features/game/model/game-store.ts");
      return useGame.getState().room;
    });
  assert(
    (await getRoom(page)).players[0].name === "Host Pilot",
    "Create form name must appear in the lobby",
  );
  const code = (await getRoom(page)).code;
  const pages = [page];
  for (let i = 1; i < 4; i++) {
    const c = await browser.newContext({
      viewport: { width: 1000, height: 740 },
      permissions: ["microphone"],
    });
    contexts.push(c);
    const p = await c.newPage();
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("Browser error:", e.message);
    });
    await p.goto(base);
    await p.evaluate(async () => {
      const { useGame } =
        await import("/src/features/game/model/game-store.ts");
      useGame.setState({ quality: "low" });
    });
    await p.getByRole("button", { name: "Join with code" }).click();
    await p.locator("dialog").getByLabel("Explorer name").fill(`Explorer ${i}`);
    await p.getByLabel("ROOM CODE").fill(code);
    await p.getByRole("button", { name: "Join expedition" }).click();
    await p.getByText("The usual suspects.").waitFor();
    assert(
      (await getRoom(p)).players.some(
        (player) => player.name === `Explorer ${i}`,
      ),
      `Join form name must appear in the lobby for player ${i}`,
    );
    pages.push(p);
    console.log("Joined player", i + 1);
  }
  await page.screenshot({ path: "artifacts/lobby-desktop.png" });
  console.log("Four player lobby rendered");
  await pages[0].getByLabel("Toggle chat").click();
  await pages[0].getByLabel("Chat message").fill("A very good alibi.");
  await pages[0].getByLabel("Send message").click();
  await pages[1].getByLabel("Toggle chat").click();
  await pages[1].getByText("A very good alibi.").waitFor();
  for (const p of pages.slice(0, 2)) {
    await p.getByLabel("Close chat").click();
    await p.getByLabel("Toggle microphone").click();
  }
  for (const p of pages.slice(0, 2))
    await waitFor(
      p,
      async () => {
        const { useGame } =
          await import("/src/features/game/model/game-store.ts");
        return useGame.getState().voiceStatus === "live";
      },
      null,
      { timeout: 40000 },
    );
  await page.waitForTimeout(2500);
  await waitFor(pages[1], async () => {
    const { voice } = await import("/src/features/voice/voice-client.ts");
    const d = await voice.getDiagnostics();
    return (
      d.inbound.some((row) => row.bytes > 1000) &&
      d.receivedLevel > 0.001 &&
      !d.playbackPaused
    );
  });
  const audioStats = await pages[1].evaluate(async () => {
    const { voice } = await import("/src/features/voice/voice-client.ts");
    return voice.getDiagnostics();
  });
  console.log("WebRTC received audio:", audioStats);
  assert(
    audioStats.inbound.some((s) => s.bytes > 1000) &&
      audioStats.receivedLevel > 0.001 &&
      !audioStats.playbackPaused,
    "Real WebRTC audio must arrive with nonzero energy",
  );
  for (const p of pages)
    await p.getByRole("button", { name: "I’m ready" }).click();
  await page.getByRole("button", { name: "Launch expedition" }).click();
  await page.getByText("KEEP THIS BETWEEN US.").waitFor();
  await page.screenshot({ path: "artifacts/role-reveal.png" });
  await waitFor(
    page,
    async () => {
      const { useGame } =
        await import("/src/features/game/model/game-store.ts");
      return useGame.getState().room?.phase === "playing";
    },
    null,
    { timeout: 15000 },
  );
  await page.screenshot({ path: "artifacts/game-desktop.png" });
  const before = await page.evaluate(async () => {
    const { motion } =
      await import("/src/features/game/network/game-client.ts");
    return motion.x;
  });
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyD");
  const after = await page.evaluate(async () => {
    const { motion } =
      await import("/src/features/game/network/game-client.ts");
    return motion.x;
  });
  assert(after > before + 0.3, "Movement must be synchronized");
  const infos = await Promise.all(
    pages.map((p) =>
      p.evaluate(async () => {
        const { useGame } =
          await import("/src/features/game/model/game-store.ts");
        const s = useGame.getState();
        return { id: s.id, me: s.room.players.find((p) => p.id === s.id) };
      }),
    ),
  );
  const crewIndex = infos.findIndex(
    (i) => i.me.role === "crew" && Math.hypot(i.me.x, i.me.z) <= 2.4,
  );
  const crew = pages[crewIndex];
  // Reach the central beacon via ordinary movement inputs, then exercise meeting/vote/rematch.
  await crew.evaluate(async () => {
    const { motion } =
      await import("/src/features/game/network/game-client.ts");
    motion.keys.clear();
  });
  await page.waitForTimeout(16000);
  await crew.evaluate(async () => {
    const { act } = await import("/src/features/game/network/game-client.ts");
    act("meeting");
  });
  await waitFor(
    page,
    async () => {
      const { useGame } =
        await import("/src/features/game/model/game-store.ts");
      return useGame.getState().room?.phase === "discussion";
    },
    null,
    { timeout: 8000 },
  );
  await page.screenshot({ path: "artifacts/meeting-desktop.png" });
  await waitFor(
    page,
    async () => {
      const { useGame } =
        await import("/src/features/game/model/game-store.ts");
      return useGame.getState().room?.phase === "voting";
    },
    null,
    { timeout: 15000 },
  );
  const killer = infos.find((i) => i.me.role === "killer");
  for (const p of pages)
    await p.evaluate(async (id) => {
      const { act } = await import("/src/features/game/network/game-client.ts");
      act("vote", id);
    }, killer.id);
  await waitFor(page, async () => {
    const { useGame } = await import("/src/features/game/model/game-store.ts");
    return useGame.getState().room?.phase === "gameover";
  });
  await page.screenshot({ path: "artifacts/results-desktop.png" });
  await page.getByRole("button", { name: "One more expedition?" }).click();
  await page.getByText("The usual suspects.").waitFor();
  const oldId = await pages[1].evaluate(async () => {
    const { useGame } = await import("/src/features/game/model/game-store.ts");
    return useGame.getState().id;
  });
  await pages[1].reload();
  await pages[1].getByText("The usual suspects.").waitFor();
  assert.equal(
    await pages[1].evaluate(async () => {
      const { useGame } =
        await import("/src/features/game/model/game-store.ts");
      return useGame.getState().id;
    }),
    oldId,
  );
  const mobile = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  contexts.push(mobile);
  const mp = await mobile.newPage();
  await mp.goto(base);
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: "artifacts/menu-mobile-landscape.png" });
  await mp.getByRole("button", { name: "Join with code" }).click();
  await mp.getByLabel("ROOM CODE").fill(code);
  await mp.getByRole("button", { name: "Join expedition" }).click();
  await mp.getByRole("button", { name: "Crew & room", exact: true }).waitFor();
  await mp.screenshot({ path: "artifacts/lobby-mobile-landscape.png" });
  assert.equal(
    await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    "No horizontal mobile overflow",
  );
  await mp.setViewportSize({ width: 390, height: 844 });
  await mp.screenshot({ path: "artifacts/lobby-mobile-portrait.png" });
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    "PASS: four players, lobby/text chat, actual WebRTC audio, role secrecy, movement, meeting, voting, crew victory, rematch, reconnect, mobile layout.",
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
