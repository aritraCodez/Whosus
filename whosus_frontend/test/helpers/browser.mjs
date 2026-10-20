import { chromium } from "@playwright/test";

export const baseURL = process.env.WHOSUS_TEST_URL || "http://127.0.0.1:5173";

export function launchBrowser(options = {}) {
  return chromium.launch({
    headless: true,
    executablePath: process.env.WHOSUS_BROWSER || undefined,
    ...options,
  });
}

/** Support the app's accessible custom combobox as well as native selects. */
export async function selectOption(page, label, value) {
  const control = page.getByLabel(label, { exact: true });
  if (await control.evaluate((element) => element.tagName === "SELECT")) {
    await control.selectOption(String(value));
  } else {
    await control.click();
    await page
      .locator(`[role="option"][data-value=${JSON.stringify(String(value))}]`)
      .click();
  }
}
