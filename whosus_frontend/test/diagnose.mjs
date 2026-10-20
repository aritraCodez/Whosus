import { chromium } from "@playwright/test";
import path from "node:path";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.WHOSUS_BROWSER || undefined,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${path.resolve("artifacts/test-tone.wav")}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const pages = [];
try {
  for (let i = 0; i < 2; i++) {
    const c = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ["microphone"],
    });
    const p = await c.newPage();
    pages.push(p);
    p.on("pageerror", (e) => console.log("ERROR", e.message));
    p.on("console", (m) => {
      if (m.type() === "error") console.log("CONSOLE", m.text());
    });
    await p.goto(process.env.WHOSUS_TEST_URL || "http://127.0.0.1:5173");
    await p.waitForTimeout(2000);
    await p.evaluate(async () => {
      const { useGame } = await import("/src/features/game/model/game-store.ts");
      useGame.setState({ quality: "low" });
    });
    if (i === 0) {
      await p
        .getByRole("button", { name: "Create a room", exact: true })
        .click();
      await p.getByRole("button", { name: "Create room", exact: true }).click();
    } else {
      const code = await pages[0].evaluate(async () => {
        const { useGame } = await import("/src/features/game/model/game-store.ts");
        return useGame.getState().room.code;
      });
      await p.getByRole("button", { name: "Join with code" }).click();
      await p.getByLabel("ROOM CODE").fill(code);
      await p.getByRole("button", { name: "Join expedition" }).click();
    }
    await p.getByText("The usual suspects.").waitFor();
    await p.waitForTimeout(1500);
    console.log(
      "SCENE",
      await p.evaluate(async () => {
        const { sceneDiagnostics } = await import("/src/features/scene/components/Scene.tsx");
        const { motion } = await import("/src/features/game/network/game-client.ts");
        return {
          scene: sceneDiagnostics(),
          motion: { x: motion.x, z: motion.z },
        };
      }),
    );
    await p.screenshot({ path: `artifacts/diagnose-${i}.png` });
    await p.getByLabel("Toggle microphone").click();
  }
  await pages[1].waitForTimeout(12000);
  for (const p of pages)
    console.log(
      "VOICE",
      await p.evaluate(async () => {
        const { voice } = await import("/src/features/voice/voice-client.ts");
        const { useGame } = await import("/src/features/game/model/game-store.ts");
        const s = useGame.getState();
        return {
          state: {
            voice: s.voiceStatus,
            muted: s.muted,
            speaking: s.speaking,
            error: s.voiceError,
          },
          tracks: voice.stream
            ?.getTracks()
            .map((t) => ({ enabled: t.enabled, state: t.readyState })),
          stats: await voice.getDiagnostics(),
        };
      }),
    );
} finally {
  await browser.close();
}
