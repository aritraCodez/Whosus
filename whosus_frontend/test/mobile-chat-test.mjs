import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser, baseURL } from "./helpers/browser.mjs";
import { waitFor } from "./wait.mjs";

const base = baseURL;
await mkdir("artifacts", { recursive: true });
const browser = await launchBrowser({
  args: [
    "--enable-unsafe-swiftshader",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone", "local-network-access"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  // Exercise the real HUD/chat without spending GPU time rendering the station.
  await page.route("**/src/features/scene/components/Scene.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export function Pip() { return null; } export default function Scene() { return null; }",
    }),
  );
  await page.goto(base);
  await page.getByText("Good friends.").waitFor();
  await page.evaluate(async () => {
    (await import("/src/features/game/network/game-client.ts")).connect({
      type: "create",
      name: "Mobile chat tester",
    });
  });
  await waitFor(
    page,
    async () =>
      !!(
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room,
  );
  await page
    .getByRole("button", {
      name: "Join voice and listen (mic stays muted)",
      exact: true,
    })
    .tap();
  await page.getByText("Listening · mic off", { exact: true }).waitFor();
  const microphoneEnabled = () =>
    page.evaluate(
      async () =>
        (
          await (
            await import("/src/features/voice/voice-client.ts")
          ).voice.getDiagnostics()
        ).microphoneEnabled,
    );
  assert.equal(await microphoneEnabled(), false);
  await page
    .getByRole("button", { name: "Unmute microphone", exact: true })
    .tap();
  await page.getByText("Listening · mic on", { exact: true }).waitFor();
  assert.equal(await microphoneEnabled(), true);
  await page
    .getByRole("button", { name: "Mute microphone", exact: true })
    .tap();
  assert.equal(await microphoneEnabled(), false);
  const talk = page.getByRole("button", { name: "Hold to talk", exact: true });
  const talkBox = await talk.boundingBox();
  await page.mouse.move(
    talkBox.x + talkBox.width / 2,
    talkBox.y + talkBox.height / 2,
  );
  await page.mouse.down();
  assert.equal(await microphoneEnabled(), true);
  await talk.dispatchEvent("pointercancel");
  assert.equal(
    await microphoneEnabled(),
    false,
    "A cancelled hold must stop microphone transmission",
  );
  await page.mouse.up();
  assert.equal(
    await talk.evaluate((el) => getComputedStyle(el).userSelect),
    "none",
    "Holding a control must not select its label",
  );
  assert.equal(
    await talk.evaluate((el) =>
      el.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      ),
    ),
    false,
    "Game controls must suppress the long-press context menu",
  );
  await page.getByRole("button", { name: "Toggle chat" }).click();
  const input = page.getByRole("textbox", { name: "Chat message" });
  await input.waitFor();
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).userSelect),
    "text",
    "Chat text must stay editable and selectable",
  );
  assert.equal(
    await input.evaluate((el) =>
      el.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      ),
    ),
    true,
    "Chat input must keep its editing menu",
  );
  assert.equal(
    await input.evaluate((el) => document.activeElement === el),
    false,
    "Opening chat on touch must not force the keyboard open",
  );
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).fontSize),
    "16px",
  );
  await input.click();
  await input.fill("Hello from mobile");
  assert.equal(await page.evaluate(() => visualViewport.scale), 1);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );

  // Emulate the visual viewport shrinking while the layout viewport stays tall,
  // as on Android/iOS with an overlay keyboard.
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "height", {
      configurable: true,
      value: 420,
    });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  const box = await input.boundingBox();
  assert(
    box && box.y >= 0 && box.y + box.height <= 420,
    "Chat input must remain above an overlay keyboard",
  );
  const panel = await page.locator(".chat-panel").boundingBox();
  assert(
    panel && panel.y >= 0 && panel.x >= 0 && panel.x + panel.width <= 390,
    "Chat panel must fit the visible viewport",
  );
  await page.screenshot({ path: "artifacts/mobile-chat-keyboard.png" });
  await input.press("Enter");
  await page.locator(".chat-messages").getByText("Hello from mobile").waitFor();
  assert.equal(
    await page.evaluate(() => scrollY),
    0,
    "New messages must scroll the chat list without panning the page",
  );
  await page.evaluate(() => {
    delete visualViewport.height;
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await input.click();
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).fontSize),
    "16px",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "artifacts/mobile-chat-landscape.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: muted headphones join, mic toggle, cancelled hold, long-press menu suppression, editable chat, 16px input, overlay keyboard clearance, portrait and landscape layouts",
  );
} finally {
  await browser.close();
}
