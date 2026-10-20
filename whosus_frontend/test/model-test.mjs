import assert from "node:assert/strict";
import { baseURL, launchBrowser } from "./helpers/browser.mjs";

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.route("**/__model_test__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Frontend model checks</title>",
    }),
  );
  await page.goto(`${baseURL}/__model_test__`);
  const result = await page.evaluate(async () => {
    const { parseBackendOrigin } = await import("/src/config/environment.ts");
    const { normalizeAppearance, DEFAULT_APPEARANCE } =
      await import("/src/features/appearance/model/appearance-store.ts");
    const { parseServerMessage } =
      await import("/src/features/game/network/protocol.ts");
    const { setGameSocket, send } =
      await import("/src/services/game-socket.ts");
    const { move, walkable } =
      await import("/src/features/game/model/world.ts");
    const appearance = { color: 2, hat: "crown", outfit: "flight" };
    const invalidOrigins = [
      "ftp://example.com",
      "https://user:password@example.com",
      "https://example.com/api",
      "https://example.com?secret=value",
      "invalid",
    ];
    const invalidMessages = [
      "{",
      "[]",
      '{"type":"unknown"}',
      '{"type":"joined","id":"a"}',
      '{"type":"voice_signal","from":"b","kind":"offer","generation":0.5}',
    ];
    const sent = [];
    const offline = send({ type: "ping" });
    setGameSocket({
      readyState: WebSocket.OPEN,
      send: (value) => sent.push(value),
    });
    const online = send({
      type: "voice_signal",
      to: "b",
      kind: "ice",
      generation: 1,
      candidate: null,
    });
    setGameSocket(null);
    const step = move(0, 2, 1, 0, false, false, 1);
    return {
      origin: parseBackendOrigin("https://api.example.com:8443///"),
      unset: parseBackendOrigin(" "),
      rejectedOrigins: invalidOrigins.map((value) => {
        try {
          parseBackendOrigin(value);
          return false;
        } catch {
          return true;
        }
      }),
      normalized: normalizeAppearance(appearance),
      original: appearance,
      defaults: normalizeAppearance({
        color: -1,
        hat: "invalid",
        outfit: "invalid",
      }),
      expectedDefaults: DEFAULT_APPEARANCE,
      rejectedMessages: invalidMessages.map(
        (value) => parseServerMessage(value) === null,
      ),
      joined: parseServerMessage(
        JSON.stringify({
          type: "joined",
          id: "a",
          token: "test-token",
          iceServers: [{ urls: "stun:example.com:3478" }],
        }),
      ),
      signal: parseServerMessage(
        JSON.stringify({
          type: "voice_signal",
          from: "b",
          kind: "offer",
          generation: 1,
          sdp: "audio-offer",
        }),
      ),
      offline,
      online,
      sent,
      step,
      validStep: walkable(...step),
    };
  });
  assert.equal(result.origin, "https://api.example.com:8443");
  assert.equal(result.unset, undefined);
  assert(result.rejectedOrigins.every(Boolean));
  assert.equal(result.normalized.hat, "crown");
  assert.equal(result.normalized.outfit, "flight");
  assert.equal(result.normalized.color, 2);
  assert.deepEqual(result.original, {
    color: 2,
    hat: "crown",
    outfit: "flight",
  });
  assert.deepEqual(result.defaults, result.expectedDefaults);
  assert(result.rejectedMessages.every(Boolean));
  assert.equal(result.joined.token, "test-token");
  assert.equal(result.signal.sdp, "audio-offer");
  assert.equal(result.offline, false);
  assert.equal(result.online, true);
  assert.deepEqual(JSON.parse(result.sent[0]), {
    type: "voice_signal",
    to: "b",
    kind: "ice",
    generation: 1,
    candidate: null,
  });
  assert(result.step[0] > 0 && result.validStep);
  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      json: [{ code: "ROOM01", players: 2, capacity: 8, host: "Host" }],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  const rooms = await page.evaluate(async () =>
    (await import("/src/features/lobby/api/rooms.ts")).fetchPublicRooms(),
  );
  assert.equal(rooms[0].code, "ROOM01");
  await page.unroute("**/api/rooms");
  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      json: [{ code: "ROOM01", players: "invalid" }],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  const malformed = await page.evaluate(async () => {
    try {
      await (
        await import("/src/features/lobby/api/rooms.ts")
      ).fetchPublicRooms();
      return "";
    } catch (error) {
      return error.message;
    }
  });
  assert.match(malformed, /invalid room list/);
  await page.unroute("**/api/rooms");
  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      status: 503,
      body: "Unavailable",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  const unavailable = await page.evaluate(async () => {
    try {
      await (
        await import("/src/features/lobby/api/rooms.ts")
      ).fetchPublicRooms();
      return "";
    } catch (error) {
      return error.message;
    }
  });
  assert.match(unavailable, /503/);
  console.log(
    "PASS: environment validation, appearance normalization, movement, message decoding, socket serialization and room API success/error validation",
  );
} finally {
  await browser.close();
}
