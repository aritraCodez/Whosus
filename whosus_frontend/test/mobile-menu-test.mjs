import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser, baseURL } from "./helpers/browser.mjs";

await mkdir("artifacts", { recursive: true });
const browser = await launchBrowser({
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 650 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.getByText("Good friends.").waitFor();
  await page.locator(".scene-wrap canvas").waitFor();
  await page.evaluate(() => document.fonts.ready);

  for (const [width, height] of [
    [390, 844],
    [390, 650],
    [390, 600],
    [360, 640],
    [320, 568],
    [412, 740],
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const app = document.querySelector(".app");
      return {
        height: app.clientHeight,
        contentHeight: app.scrollHeight,
        width: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth,
        heading: document.querySelector("h1").getBoundingClientRect().right,
        notes: document.querySelector(".play-notes").getBoundingClientRect()
          .bottom,
      };
    });
    console.log(`${width}x${height}`, layout);
    assert.equal(layout.contentWidth, width, "No horizontal page overflow");
    assert(layout.heading <= width, "Heading stays within the screen");
    assert(layout.notes <= height, "Menu content fits above browser controls");
    assert(
      layout.contentHeight <= layout.height + 1,
      "No unnecessary scrolling",
    );
    for (const button of await page.locator(".menu button").all()) {
      const bounds = await button.boundingBox();
      assert(
        bounds && bounds.x >= 0 && bounds.x + bounds.width <= width,
        "Menu buttons stay inside the screen",
      );
    }
    await page.screenshot({ path: `artifacts/menu-mobile-${width}.png` });
  }

  // A short viewport (landscape/browser UI/keyboard) must still allow swiping
  // from the scene behind the middle of the menu, not just the page header.
  await page.setViewportSize({ width: 390, height: 450 });
  const client = await context.newCDPSession(page);
  const start = { x: 230, y: 190 };
  assert(
    await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".scene-wrap"),
      start,
    ),
    "Swipe starts over the actual 3D scene",
  );
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [start],
  });
  for (let i = 1; i <= 8; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x, y: start.y - i * 16 }],
    });
    await page.waitForTimeout(30);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(
    () => document.querySelector(".app").scrollTop > 30,
  );
  await page.getByRole("button", { name: "Join with code" }).tap();
  await page.locator("dialog").waitFor();
  console.log("Middle swipe scrolls; join action remains reachable.");
  await context.close();

  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await desktop.goto(baseURL);
  await desktop.getByText("Good friends.").waitFor();
  assert(await desktop.locator(".scene-copy").isVisible());
  assert(await desktop.locator(".menu-footer").isVisible());
  await desktop
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await desktop.locator("dialog").waitFor();
  await desktop.close();
  console.log("Desktop menu and create action remain available.");
} finally {
  await browser.close();
}
