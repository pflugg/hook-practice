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

type ShoreReport = {
  overlaps: string[];
  alignment: string[];
  fit: string[];
};

async function shoreReport(page: Page): Promise<ShoreReport> {
  return page.evaluate(() => {
    const overlaps: string[] = [];
    const alignment: string[] = [];
    const fit: string[] = [];

    type Ink = {
      shore: string;
      text: string;
      left: number;
      top: number;
      right: number;
      bottom: number;
    };

    const clip = (node: Node, rect: DOMRect): Ink["left"] extends number ? Pick<Ink, "left" | "top" | "right" | "bottom"> | null : never => {
      let left = rect.left;
      let top = rect.top;
      let right = rect.right;
      let bottom = rect.bottom;
      let el = node.parentElement;
      while (el) {
        const style = getComputedStyle(el);
        const clipsX = style.overflowX === "hidden" || style.overflowX === "clip" || style.overflowX === "auto" || style.overflowX === "scroll";
        const clipsY = style.overflowY === "hidden" || style.overflowY === "clip" || style.overflowY === "auto" || style.overflowY === "scroll";
        if (clipsX || clipsY) {
          const box = el.getBoundingClientRect();
          if (clipsX) {
            left = Math.max(left, box.left);
            right = Math.min(right, box.right);
          }
          if (clipsY) {
            top = Math.max(top, box.top);
            bottom = Math.min(bottom, box.bottom);
          }
        }
        el = el.parentElement;
      }
      if (right - left <= 1 || bottom - top <= 1) return null;
      return { left, top, right, bottom };
    };

    const inks: Array<Ink & { nodeId: number }> = [];
    let nodeId = 0;
    document.querySelectorAll<HTMLElement>(".location").forEach((shore) => {
      const shoreId = shore.dataset.loc ?? "shore";
      const walker = document.createTreeWalker(shore, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const raw = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
        nodeId += 1;
        if (raw) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            const visible = clip(node, rect);
            if (!visible) continue;
            inks.push({ shore: shoreId, text: raw.slice(0, 48), nodeId, ...visible });
          }
        }
        node = walker.nextNode();
      }
    });

    for (let i = 0; i < inks.length; i += 1) {
      for (let j = i + 1; j < inks.length; j += 1) {
        const a = inks[i];
        const b = inks[j];
        if (!a || !b || a.shore !== b.shore) continue;
        if (a.nodeId === b.nodeId && Math.abs(a.top - b.top) <= 2) continue;
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) {
          overlaps.push(`${a.shore}: "${a.text}" overlaps "${b.text}"`);
        }
      }
    }

    const trackTops = (selector: string, label: string) => {
      const tops = [...document.querySelectorAll<HTMLElement>(selector)].map((el) => el.getBoundingClientRect().top);
      if (tops.length !== 4) {
        alignment.push(`${label} count ${tops.length}`);
        return;
      }
      const low = Math.min(...tops);
      const high = Math.max(...tops);
      if (high - low > 1) alignment.push(`${label} tops differ by ${(high - low).toFixed(1)}px`);
    };
    trackTops(".location .loc-head", "header");
    trackTops(".location .location-choice", "choice");
    trackTops(".location .row-top", "top actions");
    trackTops(".location .zone-heroes", "heroes");
    trackTops(".location .zone-allies", "allies");
    trackTops(".location .zone-items", "items");
    trackTops(".location .row-bottom", "bottom actions");

    const root = document.documentElement;
    if (root.scrollHeight - root.clientHeight > 1) {
      fit.push(`page overflow ${root.scrollHeight - root.clientHeight}px`);
    }
    document.querySelectorAll<HTMLElement>(".card.hand-card").forEach((card) => {
      const box = card.getBoundingClientRect();
      if (box.height < 200) fit.push(`hand card height ${box.height.toFixed(0)}`);
      if (box.bottom > root.clientHeight + 1) fit.push(`hand card below the viewport (${box.bottom.toFixed(0)})`);
    });
    const rail = document.querySelector<HTMLElement>(".teach-rail");
    if (rail && rail.scrollHeight - rail.clientHeight > 1) {
      fit.push(`coach scroll ${rail.scrollHeight - rail.clientHeight}px`);
    }
    return { overlaps, alignment, fit };
  });
}

const chromePath = findChrome();

describe.skipIf(chromePath === undefined)("shore text at 1280x800", () => {
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

  async function openScene(path: string): Promise<Page> {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`${url}${path}`, { waitUntil: "networkidle" });
    await page.locator('[data-loc="jollyRoger"] h2').waitFor();
    return page;
  }

  async function expectClear(page: Page): Promise<void> {
    const report = await shoreReport(page);
    expect(report.overlaps, report.overlaps.join("\n")).toEqual([]);
    expect(report.alignment, report.alignment.join("\n")).toEqual([]);
    expect(report.fit, report.fit.join("\n")).toEqual([]);
    await page.context().close();
  }

  it("keeps opening-board shore text apart", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("[data-diff=easy]").click();
    await page.locator("[data-start]").click();
    await page.locator('[data-loc="jollyRoger"] h2').waitFor();
    await expectClear(page);
  }, 30_000);

  it("keeps hourequal shore text apart", async () => {
    const page = await openScene("/?scene=hourequal");
    await expectClear(page);
  }, 30_000);

  it("keeps nearwin shore text apart", async () => {
    const page = await openScene("/?scene=nearwin");
    await expectClear(page);
  }, 30_000);
});
