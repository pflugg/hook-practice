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

// Short desktop windows where the Fate banner compresses the board the most.
const SHORT_SIZES = [
  [1366, 768],
  [1280, 800],
  [1120, 800],
] as const;

type ShoreProbe = {
  overprint: string[];
  coachedHidden: string[];
};

async function probe(page: Page): Promise<ShoreProbe> {
  return page.evaluate(() => {
    const overprint: string[] = [];
    const coachedHidden: string[] = [];
    document.querySelectorAll<HTMLElement>(".location").forEach((loc) => {
      const id = loc.dataset.loc ?? "shore";
      const head = loc.querySelector<HTMLElement>(".loc-head");
      const choice = loc.querySelector<HTMLElement>(".location-choice");
      if (head && choice) {
        const hb = head.getBoundingClientRect();
        const cb = choice.getBoundingClientRect();
        // The shore title/subtitle must not print down over the arrival tag.
        const overlap = hb.bottom - cb.top;
        if (overlap > 1) overprint.push(`${id} head over choice by ${overlap.toFixed(1)}px`);
      }
      loc.querySelectorAll<HTMLElement>(".zone").forEach((zone) => {
        const card = zone.querySelector<HTMLElement>(".card.is-coached");
        if (!card) return;
        const zb = zone.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        // The coached card's centre must sit inside its (scrolling) zone.
        const mid = cardBox.top + cardBox.height / 2;
        if (mid < zb.top - 0.5 || mid > zb.bottom + 0.5) {
          coachedHidden.push(`${id} coached card centre outside zone (mid=${mid.toFixed(0)}, zone=${zb.top.toFixed(0)}-${zb.bottom.toFixed(0)})`);
        }
      });
    });
    return { overprint, coachedHidden };
  });
}

async function clickFirst(page: Page, selector: string): Promise<boolean> {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return false;
  try {
    await locator.click({ timeout: 1200 });
    await page.waitForTimeout(60);
    return true;
  } catch {
    return false;
  }
}

async function acknowledge(page: Page): Promise<void> {
  for (let i = 0; i < 4; i += 1) if (!(await clickFirst(page, "[data-ack]"))) break;
}

async function playTurn(page: Page): Promise<void> {
  await acknowledge(page);
  await clickFirst(page, "[data-move]");
  await acknowledge(page);
  await clickFirst(page, "[data-end]");
  await acknowledge(page);
}

const chromePath = findChrome();

describe.skipIf(chromePath === undefined)("short desktop shores keep the heading clear and coached card shown", () => {
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

  for (const [width, height] of SHORT_SIZES) {
    it(`keeps shore headings off the arrival tag and coached cards shown at ${width}x${height}`, async () => {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator("[data-diff=easy]").click();
      await page.locator("[data-start]").click();
      await page.locator('[data-loc="jollyRoger"] h2').waitFor();

      const overprint: string[] = [];
      const coachedHidden: string[] = [];
      for (let turn = 0; turn < 9; turn += 1) {
        await playTurn(page);
        const report = await probe(page);
        overprint.push(...report.overprint);
        coachedHidden.push(...report.coachedHidden);
      }

      expect(overprint, overprint.join("\n")).toEqual([]);
      expect(coachedHidden, coachedHidden.join("\n")).toEqual([]);

      await context.close();
    }, 60_000);
  }
});
