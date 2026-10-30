import { findChrome } from "./browserSupport";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";


function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("no port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

const DESKTOP_SIZES = [
  [1440, 900],
  [1280, 800],
  [1728, 1000],
  [1366, 768],
  [1120, 800],
] as const;

/**
 * Assert a prompt-bar control is fully inside the viewport and reachable by the
 * mouse. The trial click runs Playwright's real actionability hit-test (visible,
 * stable, receives pointer events at its own centre, enabled) without firing the
 * click, and it never uses scrollIntoView to fake visibility — an off-screen or
 * covered control fails here, which is exactly the regression we guard against.
 */
async function expectReachable(locator: Locator, width: number, height: number, label: string): Promise<void> {
  expect(await locator.isVisible(), `${label} should be visible`).toBe(true);
  const box = await locator.boundingBox();
  expect(box, `${label} should have a box`).not.toBeNull();
  if (!box) return;
  expect(box.x, `${label} off the left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(box.y, `${label} off the top edge`).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width, `${label} off the right edge (x=${Math.round(box.x + box.width)} vw=${width})`).toBeLessThanOrEqual(
    width + 0.5,
  );
  expect(box.y + box.height, `${label} below the viewport`).toBeLessThanOrEqual(height + 0.5);
  await locator.click({ trial: true, timeout: 4000 });
}

const chromePath = findChrome();

describe.skipIf(chromePath === undefined)("desktop prompt bar keeps its controls on screen", () => {
  let browser: Browser;
  let server: ChildProcess;
  let url = "";

  beforeAll(async () => {
    const port = await freePort();
    url = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      { cwd: process.cwd(), stdio: "ignore" },
    );
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* vite is still booting */
      }
      await delay(200);
    }
    if (!ready) throw new Error(`vite did not answer ${url}`);
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
    server?.kill("SIGTERM");
  });

  for (const [width, height] of DESKTOP_SIZES) {
    it(`keeps Choose-this-place and End turn reachable at ${width}x${height}`, async () => {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page: Page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator("[data-diff=easy]").click();
      await page.locator("[data-start]").click();
      await page.locator('[data-loc="jollyRoger"] h2').waitFor();

      // Move phase: the "Move here" (Choose this place) prompt-place buttons.
      const place = page.locator(".prompt .prompt-place").first();
      await expectReachable(place, width, height, "Choose-this-place");

      // The instruction text must keep a real width, not collapse to zero.
      const promptTextWidth = await page.locator(".prompt p").first().evaluate((el) => el.getBoundingClientRect().width);
      expect(promptTextWidth, "prompt instruction collapsed to zero width").toBeGreaterThan(80);

      await place.click();
      await page.waitForTimeout(150);

      // Actions phase: End turn.
      const end = page.locator("[data-end]").first();
      await expectReachable(end, width, height, "End turn");

      await context.close();
    }, 45_000);

    it(`keeps Cancel reachable in the prompt bar at ${width}x${height}`, async () => {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page: Page = await context.newPage();
      await page.goto(`${url}/?scene=cutlass`, { waitUntil: "networkidle" });
      await page.locator('[data-loc="jollyRoger"] h2').waitFor();

      const cancel = page.locator(".prompt [data-cancel]").first();
      await expectReachable(cancel, width, height, "Cancel");

      const promptTextWidth = await page.locator(".prompt p").first().evaluate((el) => el.getBoundingClientRect().width);
      expect(promptTextWidth, "prompt instruction collapsed to zero width").toBeGreaterThan(80);

      await context.close();
    }, 45_000);
  }
});
