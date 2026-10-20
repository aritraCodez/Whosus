import assert from "node:assert/strict";
import { baseURL, launchBrowser } from "./helpers/browser.mjs";
import { waitFor } from "./wait.mjs";

const browser = await launchBrowser();
const contexts = [];
try {
  const pages = [];
  const errors = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      permissions: ["local-network-access"],
    });
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.error(message.text());
    });
    page.on("requestfailed", (request) =>
      console.error(
        "Session request failed:",
        request.url(),
        request.failure()?.errorText,
      ),
    );
    await page.route("**/__session_test__", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Session integration test</title>",
      }),
    );
    await page.goto(`${baseURL}/__session_test__`);
    await page.evaluate(async () =>
      (
        await import("/src/features/game/network/game-client.ts")
      ).initializeNetwork(),
    );
  }
  await pages[0].evaluate(async () =>
    (await import("/src/features/game/network/game-client.ts")).connect({
      type: "create",
      public: true,
      name: "Session host",
    }),
  );
  await waitFor(
    pages[0],
    async () =>
      !!(
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room,
  );
  const identity = await pages[0].evaluate(async () => {
    const state = (
      await import("/src/features/game/model/game-store.ts")
    ).useGame.getState();
    return {
      id: state.id,
      code: state.room.code,
      token: sessionStorage.getItem("whosus-session"),
    };
  });
  await pages[1].evaluate(
    async (code) =>
      (await import("/src/features/game/network/game-client.ts")).connect({
        type: "join",
        code,
        name: "Session guest",
      }),
    identity.code,
  );
  await waitFor(
    pages[1],
    async () =>
      (
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room?.population === 2,
  );
  const publicRooms = await pages[1].evaluate(async () =>
    (await import("/src/features/lobby/api/rooms.ts")).fetchPublicRooms(),
  );
  assert(publicRooms.some((room) => room.code === identity.code));
  await pages[0].evaluate(async () =>
    (await import("/src/services/game-socket.ts")).send({
      type: "chat",
      text: "Session chat",
    }),
  );
  await waitFor(pages[1], async () =>
    (await import("/src/features/game/model/game-store.ts")).useGame
      .getState()
      .chat.some((message) => message.text === "Session chat"),
  );
  await pages[0].reload();
  await pages[0].evaluate(async () =>
    (
      await import("/src/features/game/network/game-client.ts")
    ).initializeNetwork(),
  );
  await waitFor(
    pages[0],
    async () =>
      !!(
        await import("/src/features/game/model/game-store.ts")
      ).useGame.getState().room,
  );
  const resumed = await pages[0].evaluate(async () => ({
    id: (
      await import("/src/features/game/model/game-store.ts")
    ).useGame.getState().id,
    token: sessionStorage.getItem("whosus-session"),
  }));
  assert.equal(resumed.id, identity.id);
  assert.equal(resumed.token, identity.token);
  for (const page of pages)
    await page.evaluate(async () =>
      (await import("/src/features/game/network/game-client.ts")).leave(),
    );
  assert.equal(
    await pages[0].evaluate(() => sessionStorage.getItem("whosus-session")),
    null,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: create/join, public-room API, text delivery, authenticated session resume and leave cleanup",
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
