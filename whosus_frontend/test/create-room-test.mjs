import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser, baseURL, selectOption } from "./helpers/browser.mjs";

await mkdir("artifacts", { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 650 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  const messages = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.routeWebSocket("**/*", (socket) =>
    socket.onMessage((message) => messages.push(JSON.parse(message))),
  );
  await page.route("**/src/features/scene/components/Scene.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export default function Scene() { return null; }",
    }),
  );
  await page.goto(baseURL);
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  const dialog = page.locator(".room-create-dialog");
  const steps = dialog.getByRole("navigation", { name: "Room setup steps" });
  for (const [width, height] of [
    [320, 568],
    [390, 650],
    [844, 390],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const label of ["Explorer", "Crew", "Meetings"]) {
      await steps.getByRole("button", { name: new RegExp(label) }).click();
      const visible = await dialog
        .getByRole("button", { name: "Create room", exact: true })
        .evaluate((element) => {
          const r = element.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            r.left >= 0 &&
            r.right <= innerWidth &&
            element.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            )
          );
        });
      assert(visible, `Create stays visible on ${label} at ${width}x${height}`);
    }
    await page.screenshot({ path: `artifacts/create-room-${width}.png` });
  }
  await steps.getByRole("button", { name: /Explorer/ }).click();
  await dialog.getByLabel("Explorer name", { exact: true }).fill("");
  await steps.getByRole("button", { name: /Crew/ }).click();
  await dialog
    .getByRole("button", { name: "Create room", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  assert.equal(messages.length, 0);
  await dialog.getByLabel("Explorer name", { exact: true }).fill("Step Tester");
  await page.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Next", exact: false }).click();
  await selectOption(page, "Crew capacity", 10);
  await selectOption(page, "Movement speed", 1.5);
  await selectOption(page, "killers", 2);
  await selectOption(page, "Elimination cooldown", 45);
  await dialog.getByRole("button", { name: "Next", exact: false }).click();
  await selectOption(page, "Voting time", 60);
  await selectOption(page, "Discussion time", 45);
  await selectOption(page, "Emergency meetings per player", 2);
  await selectOption(page, "Meeting cooldown", 30);
  await dialog.getByRole("button", { name: "Previous setup step" }).click();
  assert.equal(
    await page.getByRole("combobox", { name: "Crew capacity" }).innerText(),
    "10 players",
  );
  await dialog
    .getByRole("button", { name: "Create room", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector(".room-create-dialog"),
  );
  for (
    let i = 0;
    i < 40 && !messages.some((message) => message.type === "create");
    i++
  )
    await new Promise((resolve) => setTimeout(resolve, 50));
  const request = messages.find((message) => message.type === "create");
  assert(request);
  for (const [key, value] of Object.entries({
    name: "Step Tester",
    capacity: 10,
    public: true,
    killers: 2,
    kill_cooldown: 45,
    discussion: 45,
    movement_speed: 1.5,
    voting: 60,
    emergency_meetings: 2,
    meeting_cooldown: 30,
  }))
    assert.equal(request[key], value, key);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: responsive setup steps, name validation, retained values, exact creation payload",
  );
} finally {
  await browser.close();
}
