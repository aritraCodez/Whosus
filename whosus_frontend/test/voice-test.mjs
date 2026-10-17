import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { waitFor } from "./wait.mjs";

// Exercise the real client, socket, microphone and media server without 3D/GPU load.
const base = process.env.WHOSUS_TEST_URL || "http://127.0.0.1:5173";
await mkdir("artifacts", { recursive: true });
const samples = 48000 * 3;
const wav = Buffer.alloc(44 + samples * 2);
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
for (let i = 0; i < samples; i++)
  wav.writeInt16LE(
    Math.round(Math.sin((i / 48000) * Math.PI * 880) * 9000),
    44 + i * 2,
  );
await writeFile("artifacts/voice-tone.wav", wav);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.WHOSUS_BROWSER || undefined,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${path.resolve("artifacts/voice-tone.wav")}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const contexts = [],
  pages = [],
  errors = [];
const state = (page) =>
  page.evaluate(async () => {
    const { useGame } = await import("/src/store.ts");
    const s = useGame.getState();
    return {
      id: s.id,
      room: s.room,
      status: s.status,
      voice: s.voiceStatus,
      error: s.voiceError,
      muted: s.muted,
      ptt: s.ptt,
      speaking: s.speaking,
    };
  });
const diagnostics = (page) =>
  page.evaluate(async () =>
    (await import("/src/voice.ts")).voice.getDiagnostics(),
  );
const action = (page, name, target = "") =>
  page.evaluate(
    async ({ name, target }) =>
      (await import("/src/network.ts")).act(name, target),
    { name, target },
  );
const muted = (page, value) =>
  page.evaluate(
    async (value) => (await import("/src/voice.ts")).voice.setMuted(value),
    value,
  );
async function waitVoice(page) {
  await waitFor(
    page,
    async () => {
      const s = (await import("/src/store.ts")).useGame.getState();
      if (s.voiceStatus === "error") throw Error(s.voiceError);
      return s.voiceStatus === "live";
    },
    null,
    { timeout: 35000 },
  );
}
async function audible(page, expected, label) {
  await page.waitForTimeout(600); // Drain only previously authorized playout audio.
  if (expected) {
    await waitFor(
      page,
      async () => {
        const d = await (await import("/src/voice.ts")).voice.getDiagnostics();
        return (
          d.receivedLevel > 0.003 &&
          !d.playbackPaused &&
          d.inbound.some((r) => r.bytes > 1000)
        );
      },
      null,
      { timeout: 10000 },
    );
  } else {
    for (let i = 0; i < 5; i++) {
      const d = await diagnostics(page);
      assert(
        d.receivedLevel < 0.001,
        `${label}: unexpected audio level ${d.receivedLevel}`,
      );
      await page.waitForTimeout(100);
    }
  }
  console.log("PASS:", label);
}
async function approachAlongRing(page, target) {
  const s = await state(page),
    me = s.room.players.find((p) => p.id === s.id);
  const start = Math.atan2(me.z, me.x),
    end = Math.atan2(target.z, target.x);
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.2));
  for (let i = 1; i <= steps; i++) {
    const angle = start + (delta * i) / steps;
    await page.evaluate(
      async (target) => {
        const { motion } = await import("/src/network.ts");
        const until = Date.now() + 4000;
        try {
          while (Date.now() < until) {
            const dx = target.x - motion.x,
              dz = target.z - motion.z,
              distance = Math.hypot(dx, dz);
            if (distance < 0.15) return;
            motion.dx = dx / distance;
            motion.dz = dz / distance;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          throw Error("Timed out moving into elimination range");
        } finally {
          motion.dx = motion.dz = 0;
        }
      },
      { x: Math.cos(angle) * 2, z: Math.sin(angle) * 2 },
    );
  }
  await page.waitForTimeout(200);
}

try {
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext({ permissions: ["microphone"] });
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/__voice_test__", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><title>Voice integration test</title><button id="enable">Enable voice</button><button id="talk">Hold to talk</button>',
      }),
    );
    await page.goto(`${base}/__voice_test__`);
    await page.evaluate(async () => {
      const { initializeNetwork } = await import("/src/network.ts");
      const { voice } = await import("/src/voice.ts");
      initializeNetwork();
      document
        .getElementById("enable")
        .addEventListener("click", () => void voice.enable());
      const talk = document.getElementById("talk");
      talk.addEventListener("pointerdown", () => voice.ptt(true));
      talk.addEventListener("pointerup", () => voice.ptt(false));
    });
    const code = i ? (await state(pages[0])).room.code : "";
    await page.evaluate(
      async ({ i, code }) => {
        const { connect } = await import("/src/network.ts");
        connect({
          type: i ? "join" : "create",
          name: `Voice ${i}`,
          code,
          capacity: 5,
          kill_cooldown: 10,
          discussion: 10,
        });
      },
      { i, code },
    );
    await waitFor(
      page,
      async () => !!(await import("/src/store.ts")).useGame.getState().room,
    );
  }
  console.log("Five independent clients joined");
  // A blackholed STUN server must not delay host-candidate signaling.
  await pages[0].evaluate(async () => {
    (await import("/src/voice.ts")).voice.configure([
      { urls: "stun:192.0.2.1:3478" },
    ]);
  });
  // A first-time PTT click is released before permission resolves. It must stay muted.
  await pages[0].evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return original(constraints);
    };
  });
  const started = Date.now();
  await pages[0].getByText("Hold to talk", { exact: true }).click();
  await waitVoice(pages[0]);
  assert(
    Date.now() - started < 8000,
    "Host ICE must connect without waiting for the unreachable STUN server",
  );
  console.log("PASS: Host ICE connects without waiting for unreachable STUN");
  assert.equal((await state(pages[0])).muted, true);
  assert.equal((await diagnostics(pages[0])).microphoneEnabled, false);
  await pages[1].evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    window.restorePlayback = () => {
      HTMLMediaElement.prototype.play = play;
    };
    HTMLMediaElement.prototype.play = function () {
      return Promise.reject(
        new DOMException("Simulated autoplay denial", "NotAllowedError"),
      );
    };
  });
  await pages[1].getByText("Enable voice", { exact: true }).click();
  await waitVoice(pages[1]);
  await waitFor(
    pages[1],
    async () =>
      (await import("/src/store.ts")).useGame.getState().playbackBlocked,
  );
  await pages[1].evaluate(() => window.restorePlayback());
  await pages[1].getByText("Enable voice", { exact: true }).click();
  await waitFor(
    pages[1],
    async () =>
      !(await import("/src/store.ts")).useGame.getState().playbackBlocked,
  );
  console.log("PASS: A user gesture recovers blocked audio playback");
  await audible(pages[0], true, "Lobby audio reaches a muted listener");
  await pages[1].evaluate(async () =>
    (await import("/src/network.ts")).send({
      type: "chat",
      text: "Voice and text together",
    }),
  );
  await waitFor(pages[0], async () =>
    (await import("/src/store.ts")).useGame
      .getState()
      .chat.some((message) => message.text === "Voice and text together"),
  );
  console.log("PASS: Text delivery works while voice is active");
  await audible(
    pages[1],
    false,
    "Released first-time PTT never opens the microphone",
  );
  await pages[0].evaluate(async () =>
    (await import("/src/voice.ts")).voice.ptt(true),
  );
  await audible(pages[1], true, "Held PTT transmits audio");
  await pages[0].evaluate(async () =>
    (await import("/src/voice.ts")).voice.ptt(false),
  );
  await audible(pages[1], false, "PTT release stops audio");
  await muted(pages[0], false);
  await audible(pages[1], true, "Unmute restores audio");
  await pages[1].evaluate(async () =>
    (await import("/src/voice.ts")).voice.setDeafened(true),
  );
  await audible(pages[1], false, "Deafen suppresses received audio");
  await pages[1].evaluate(async () =>
    (await import("/src/voice.ts")).voice.setDeafened(false),
  );
  await audible(pages[1], true, "Undeafen restores audio");
  const generation = (await diagnostics(pages[0])).generation;
  await pages[0].evaluate(async (generation) => {
    const { voice } = await import("/src/voice.ts");
    await voice.answer("invalid stale answer", generation - 1);
    voice.fail("stale failure", generation - 1);
  }, generation);
  assert.equal((await diagnostics(pages[0])).generation, generation);
  await pages[0].evaluate(async () =>
    (await import("/src/voice.ts")).voice.reconnect(),
  );
  await waitVoice(pages[0]);
  assert((await diagnostics(pages[0])).generation > generation);
  await audible(
    pages[1],
    true,
    "Media reconnect restores speech and ignores stale signaling",
  );
  await pages[4].evaluate(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    window.restoreMicrophone = () => {
      navigator.mediaDevices.getUserMedia = getUserMedia;
    };
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Simulated permission denial", "NotAllowedError");
    };
  });
  await pages[4].getByText("Enable voice", { exact: true }).click();
  await waitFor(
    pages[4],
    async () =>
      (await import("/src/store.ts")).useGame.getState().voiceStatus ===
      "error",
  );
  assert.equal((await diagnostics(pages[4])).microphoneEnabled, false);
  await pages[4].evaluate(() => window.restoreMicrophone());
  for (const page of pages.slice(2)) {
    await page.getByText("Enable voice", { exact: true }).click();
    await waitVoice(page);
  }
  console.log("PASS: Microphone permission denial recovers on explicit retry");
  for (const page of pages) await action(page, "ready");
  await waitFor(pages[0], async () =>
    (await import("/src/store.ts")).useGame
      .getState()
      .room.players.every((p) => p.ready),
  );
  await action(pages[0], "start");
  await waitFor(
    pages[0],
    async () =>
      (await import("/src/store.ts")).useGame.getState().room.phase ===
      "playing",
    null,
    { timeout: 10000 },
  );
  const info = await Promise.all(
    pages.map(async (page) => {
      const s = await state(page);
      return { page, me: s.room.players.find((p) => p.id === s.id) };
    }),
  );
  const impostor = info.find((item) => item.me.role === "impostor");
  const crew = info.filter((item) => item.me.role === "crew");
  for (const page of pages) await muted(page, true);
  await muted(crew[0].page, false);
  await audible(
    crew[2].page,
    true,
    "Nearby living crew receive proximity speech",
  );
  const establishedGeneration = (await diagnostics(crew[2].page)).generation;
  async function eliminate(victim) {
    await approachAlongRing(victim.page, impostor.me);
    await waitFor(
      impostor.page,
      async () =>
        (await import("/src/store.ts")).useGame.getState().room.killCooldown ===
        0,
      null,
      { timeout: 15000 },
    );
    await action(impostor.page, "kill", victim.me.id);
    await waitFor(victim.page, async () => {
      const s = (await import("/src/store.ts")).useGame.getState();
      return !s.room.players.find((p) => p.id === s.id).alive;
    });
  }
  await eliminate(crew[0]);
  await audible(
    crew[2].page,
    false,
    "An established living connection receives no ghost audio",
  );
  assert.equal(
    (await diagnostics(crew[2].page)).generation,
    establishedGeneration,
  );
  assert(!(await state(crew[2].page)).speaking.includes(crew[0].me.id));
  await eliminate(crew[1]);
  await audible(crew[1].page, true, "Ghosts receive other ghosts");
  await muted(crew[1].page, false);
  await audible(crew[0].page, true, "Ghost voice works in both directions");
  await audible(
    crew[2].page,
    false,
    "Two ghosts remain inaudible to living crew",
  );
  await waitFor(
    impostor.page,
    async () =>
      (await import("/src/store.ts")).useGame.getState().room
        .meetingCooldown === 0,
  );
  await action(impostor.page, "meeting");
  await waitFor(
    pages[0],
    async () =>
      (await import("/src/store.ts")).useGame.getState().room.phase ===
      "discussion",
  );
  await audible(
    crew[2].page,
    false,
    "Meetings continue to exclude ghost audio",
  );
  await waitFor(
    pages[0],
    async () =>
      (await import("/src/store.ts")).useGame.getState().room.phase ===
      "voting",
    null,
    { timeout: 15000 },
  );
  for (const item of [impostor, crew[2], crew[3]])
    await action(item.page, "vote", impostor.me.id);
  await waitFor(
    pages[0],
    async () =>
      (await import("/src/store.ts")).useGame.getState().room.phase ===
      "gameover",
  );
  await audible(crew[2].page, true, "Game over reopens all-player audio");
  for (const page of pages)
    await page.evaluate(async () => (await import("/src/network.ts")).leave());
  assert.equal((await diagnostics(pages[0])).microphoneEnabled, false);
  assert.equal((await diagnostics(pages[0])).contextState, "closed");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser microphone, trickled ICE, two-way audio, PTT race, mute/deafen, stale signals, reconnect, proximity, live ghost isolation, meetings, post-game audio and cleanup",
  );
} catch (error) {
  for (const page of pages) {
    console.error(
      "VOICE DIAGNOSTICS",
      await state(page)
        .then((s) => ({
          id: s.id,
          phase: s.room?.phase,
          voice: s.voice,
          error: s.error,
          muted: s.muted,
          ptt: s.ptt,
        }))
        .catch(() => null),
      await diagnostics(page).catch(() => null),
    );
  }
  throw error;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
