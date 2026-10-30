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

type Geometry = {
  boardH: number;
  dockH: number;
  logItems: number;
  overlap: boolean;
  clippedHandText: boolean;
  logH: number;
};

async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const board = document.querySelector<HTMLElement>(".board");
    const dock = document.querySelector<HTMLElement>(".play.has-teach .dock");
    const boardBox = board?.getBoundingClientRect();
    const dockBox = dock?.getBoundingClientRect();
    // The dock (hand + log) must never grow up into the board area.
    let overlap = false;
    if (boardBox && dockBox) {
      overlap = dockBox.top < boardBox.bottom - 1;
    }
    return {
      boardH: boardBox ? Math.round(boardBox.height) : 0,
      dockH: dockBox ? Math.round(dockBox.height) : 0,
      logItems: document.querySelectorAll(".log li").length,
      overlap,
      clippedHandText: [...document.querySelectorAll<HTMLElement>(".hand-card .text")].some((text) => text.scrollHeight > text.clientHeight + 2),
      logH: document.querySelector(".log")?.getBoundingClientRect().height ?? 0,
    };
  });
}

async function playTurn(page: Page): Promise<void> {
  const ack = async () => {
    for (let i = 0; i < 4; i += 1) {
      const btn = page.locator("[data-ack]").first();
      if (await btn.count()) {
        try {
          await btn.click({ timeout: 2000 });
          await page.waitForTimeout(80);
        } catch {
          break;
        }
      } else break;
    }
  };
  await ack();
  const move = page.locator("[data-move]").first();
  if (await move.count()) {
    try {
      await move.click({ timeout: 2000 });
      await page.waitForTimeout(80);
    } catch {
      /* move already taken */
    }
  }
  await ack();
  const end = page.locator("[data-end]").first();
  if (await end.count()) {
    try {
      await end.click({ timeout: 2000 });
      await page.waitForTimeout(100);
    } catch {
      /* end not available */
    }
  }
  await ack();
}

const chromePath = findChrome();

describe.skipIf(chromePath === undefined)("board keeps its height as the log grows", () => {
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

  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1120, 800],
  ] as const) {
    it(`holds the board open through several turns at ${width}x${height}`, async () => {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator("[data-diff=easy]").click();
      await page.locator("[data-start]").click();
      await page.locator('[data-loc="jollyRoger"] h2').waitFor();

      const start = await geometry(page);
      expect(start.boardH, "board should open at a healthy height").toBeGreaterThanOrEqual(250);

      for (let turn = 0; turn < 7; turn += 1) {
        await playTurn(page);
        const g = await geometry(page);
        // The board must never be squeezed flat by a growing hand/log dock.
        expect(g.boardH, `board collapsed to ${g.boardH}px after turn ${turn} (log ${g.logItems})`).toBeGreaterThanOrEqual(
          250,
        );
        // Hand cards may grow to show their full text; only the log is capped.
        expect(g.clippedHandText, `hand text clipped after turn ${turn}`).toBe(false);
        expect(g.logH, `log grew to ${g.logH}px after turn ${turn}`).toBeLessThanOrEqual(260);
        expect(g.overlap, `dock overlapped the board after turn ${turn}`).toBe(false);
      }

      const end = await geometry(page);
      expect(end.logItems, "several turns should have grown the log").toBeGreaterThan(8);

      await context.close();
    }, 45_000);
  }
});
