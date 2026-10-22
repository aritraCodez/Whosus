import assert from "node:assert/strict";
import { baseURL, launchBrowser } from "./helpers/browser.mjs";

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.route("**/__collision_test__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Collision checks</title>",
    }),
  );
  await page.goto(`${baseURL}/__collision_test__`);
  const failures = await page.evaluate(async () => {
    const { STATIONS, walkable, move, PLAYER_SPACING } =
      await import("/src/features/game/model/world.ts");
    const failures = [];
    for (const station of STATIONS) {
      if (walkable(station.x, station.z))
        failures.push(`${station.id}: console is not solid`);
      for (const speed of [0.5, 1, 2]) {
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let x = station.x + dx * 1.6,
            z = station.z + dz * 1.6;
          if (!walkable(x, z)) continue;
          for (let i = 0; i < 40; i++) {
            [x, z] = move(x, z, -dx, -dz, false, false, speed);
            if (!walkable(x, z))
              failures.push(
                `${station.id}: character entered console at speed ${speed}`,
              );
          }
          if (Math.hypot(x - station.x, z - station.z) > 2.5)
            failures.push(`${station.id}: task out of reach`);
        }
      }
    }
    for (const speed of [0.5, 1, 2]) {
      let a = { x: 0, z: 2 },
        b = { x: 3, z: 2 };
      for (let i = 0; i < 50; i++) {
        [a.x, a.z] = move(a.x, a.z, 1, 0, false, false, speed, [b]);
        [b.x, b.z] = move(b.x, b.z, -1, 0, false, false, speed, [a]);
        if (Math.hypot(a.x - b.x, a.z - b.z) < PLAYER_SPACING)
          failures.push(`Bodies intersect at speed ${speed}`);
      }
      const slide = move(a.x, a.z, 0, 1, false, false, speed, [b]);
      if (slide[1] <= a.z)
        failures.push("Cannot move away from another player");
    }
    const ghost = move(8, 2, 1, 0, true, false, 1, [{ x: 8.2, z: 2 }]);
    if (ghost[0] <= 8) failures.push("Ghost movement blocked");
    return failures;
  });
  assert.deepEqual(failures, []);
  console.log(
    "PASS: client movement blocks every console, head-on bodies at all speeds, sliding and ghosts",
  );
} finally {
  await browser.close();
}
