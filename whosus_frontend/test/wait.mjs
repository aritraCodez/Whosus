/** Playwright's page predicate poller treats a Promise as truthy before it settles.
 * Await module imports/diagnostics in Node, then inspect the resolved condition.
 */
export async function waitFor(
  page,
  predicate,
  argument = null,
  { timeout = 15000 } = {},
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate, argument)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(
    `Condition did not become true within ${timeout} ms: ${predicate.toString()}`,
  );
}
