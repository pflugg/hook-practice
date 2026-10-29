import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function findChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    "/opt/google/chrome/chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && existsSync(candidate));
}

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

// Short desktop windows where the shore zones scroll internally.
const SIZES = [
  [1280, 800],
  [1366, 768],
] as const;

// In-page: every coached card sitting in a board zone must have its centre
// actually hittable (elementFromPoint lands on the card), not clipped out of the
// scrolling zone. Skipped while a modal/overlay owns the click.
function coachedCardMisses(): string[] {
  const misses: string[] = [];
  if (document.querySelector(".overlay:not(.pass-through), [role=dialog], .modal")) return misses;
  document.querySelectorAll<HTMLElement>(".location .zone .card.is-coached").forEach((card) => {
    const box = card.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const cx = Math.round(box.left + box.width / 2);
    const cy = Math.round(box.top + box.height / 2);
    const at = document.elementFromPoint(cx, cy);
    const hit = at === card || card.contains(at);
    if (!hit) {
      const name = card.querySelector("h3")?.textContent?.trim().slice(0, 18) ?? "card";
      const covered = at ? (at.className || at.tagName).toString().slice(0, 30) : "null";
      misses.push(`${name} centre covered by "${covered}"`);
    }
  });
  return misses;
}

async function clickCoached(page: Page): Promise<boolean> {
  for (let i = 0; i < 4; i += 1) {
    const ack = page.locator("[data-ack]").first();
    if (await ack.count()) {
      try {
        await ack.click({ timeout: 800 });
        await page.waitForTimeout(50);
        continue;
      } catch {
        /* fallthrough */
      }
    }
    break;
  }
  for (const selector of ["[data-move].is-coached", ".prompt .is-coached", "button.is-coached", ".action.is-coached", ".card.is-coached", "[data-end]"]) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        await locator.click({ timeout: 1000 });
        await page.waitForTimeout(90);
        return true;
      } catch {
        /* try the next kind of coached target */
      }
    }
  }
  return false;
}

const chromePath = findChrome();

describe.skipIf(chromePath === undefined)("the Coach never points at a card hidden inside a scrolling zone", () => {
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

  for (const [width, height] of SIZES) {
    it(`keeps every coached board card hittable while following the Coach at ${width}x${height}`, async () => {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator("[data-diff=normal]").click();
      await page.locator("[data-start]").click();
      await page.locator('[data-loc="jollyRoger"] h2').waitFor();

      const misses: string[] = [];
      for (let step = 0; step < 70; step += 1) {
        await page.waitForTimeout(430); // allow the travel-settle re-scroll to run
        misses.push(...(await page.evaluate(coachedCardMisses)));
        if (!(await clickCoached(page))) break;
      }

      expect(misses, misses.join("\n")).toEqual([]);
      await context.close();
    }, 90_000);
  }
});
