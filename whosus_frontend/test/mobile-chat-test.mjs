import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { waitFor } from "./wait.mjs";

const base = process.env.WHOSUS_TEST_URL || "http://127.0.0.1:5173";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.WHOSUS_BROWSER || undefined,
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
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
    async () => !!(await import("/src/features/game/model/game-store.ts")).useGame.getState().room,
  );
  await page.getByRole("button", { name: "Toggle chat" }).click();
  const input = page.getByRole("textbox", { name: "Chat message" });
  await input.waitFor();
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
    "PASS: touch chat, 16px input, no focus zoom, overlay keyboard clearance, text delivery, no page panning, portrait and landscape layouts",
  );
} finally {
  await browser.close();
}
