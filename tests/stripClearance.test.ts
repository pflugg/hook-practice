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

// Scroll a prompt target to the top of the narrow page and report whether its
// centre is still hittable (not hidden under the fixed Next-click strip).
async function clears(page: Page, selector: string): Promise<{ hit: boolean; endTop: number; stripBottom: number; covered: string }> {
  return page.evaluate((sel) => {
    const strip = document.querySelector(".quick-coach");
    const target = document.querySelector<HTMLElement>(sel);
    if (!target) return { hit: false, endTop: -1, stripBottom: -1, covered: "missing" };
    target.scrollIntoView({ block: "start" });
    const tb = target.getBoundingClientRect();
    const sb = strip ? strip.getBoundingClientRect() : null;
    const cx = Math.round(tb.left + tb.width / 2);
    const cy = Math.round(tb.top + tb.height / 2);
    const at = document.elementFromPoint(cx, cy);
    return {
      hit: at === target || target.contains(at),
      endTop: Math.round(tb.top),
      stripBottom: sb ? Math.round(sb.bottom) : 0,
      covered: (at ? (at.className || at.tagName) : "null").toString().slice(0, 40),
    };
  }, selector);
}

async function clickFirst(page: Page, selector: string): Promise<boolean> {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return false;
  try {
    await locator.click({ timeout: 1200 });
    await page.waitForTimeout(80);
    return true;
  } catch {
    return false;
  }
}

async function acknowledge(page: Page): Promise<void> {
  for (let i = 0; i < 4; i += 1) if (!(await clickFirst(page, "[data-ack]"))) break;
}

const chromePath = findChrome();

describe.skipIf(chromePath === undefined)("the fixed Next-click strip never buries scrolled-to prompt buttons at 900px", () => {
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

  it("keeps End turn clear of the strip when scrolled to the top", async () => {
    const context = await browser.newContext({ viewport: { width: 900, height: 820 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("[data-diff=easy]").click();
    await page.locator("[data-start]").click();
    await page.locator('[data-loc="jollyRoger"] h2').waitFor();
    await acknowledge(page);
    await clickFirst(page, "[data-move]");
    await acknowledge(page);

    const result = await clears(page, "[data-end]");
    expect(result.hit, `End turn covered by "${result.covered}" (top=${result.endTop}, strip bottom=${result.stripBottom})`).toBe(true);
    expect(result.endTop).toBeGreaterThanOrEqual(result.stripBottom - 0.5);
    await context.close();
  }, 30_000);

  it("keeps clash Confirm clear of the strip when scrolled to the top", async () => {
    const context = await browser.newContext({ viewport: { width: 900, height: 820 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`${url}/?scene=clash`, { waitUntil: "networkidle" });
    await page.locator('[data-loc="jollyRoger"] h2').waitFor();
    await acknowledge(page);

    const result = await clears(page, "[data-confirm]");
    expect(result.hit, `Confirm covered by "${result.covered}" (top=${result.endTop}, strip bottom=${result.stripBottom})`).toBe(true);
    expect(result.endTop).toBeGreaterThanOrEqual(result.stripBottom - 0.5);
    await context.close();
  }, 30_000);
});
