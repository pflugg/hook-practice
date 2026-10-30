import { findChrome } from "./browserSupport";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Page } from "playwright";
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

const chromePath = findChrome();

describe.skipIf(chromePath === undefined)("hidden teaching sections free the rail's dead column", () => {
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

  it("hands the dock the full width and trims the rail when only the Coach is shown at 1728x1000", async () => {
    const width = 1728;
    const height = 1000;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page: Page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("[data-diff=easy]").click();
    await page.locator("[data-start]").click();
    await page.locator('[data-loc="jollyRoger"] h2').waitFor();

    // Brief and Reasons are off by default, so the rail already carries only the
    // Coach pane — exactly the dead-column case this fix targets.
    const after = await page.evaluate(() => {
      const panes = document.querySelectorAll(".teach-rail > .teach-pane").length;
      const rail = document.querySelector<HTMLElement>(".teach-rail");
      const dock = document.querySelector<HTMLElement>(".play.has-teach .dock");
      const railRect = rail?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      const content = rail
        ? Math.max(...[...rail.querySelectorAll(":scope > .teach-pane *")].map((el) => el.getBoundingClientRect().bottom)) - railRect!.top
        : 0;
      return {
        panes,
        railHeight: railRect ? Math.round(railRect.height) : 0,
        railContent: Math.round(content),
        dockWidth: dockRect ? Math.round(dockRect.width) : 0,
        dockTop: dockRect ? Math.round(dockRect.top) : 0,
        railBottom: railRect ? Math.round(railRect.bottom) : 0,
      };
    });

    // Only the Coach pane remains.
    expect(after.panes).toBe(1);
    // The dock now spans (almost) the full window width, not just the left column.
    expect(after.dockWidth, `dock width ${after.dockWidth} of ${width}`).toBeGreaterThan(width - 40);
    // The rail no longer spans the dock row, so it stops at or above the dock.
    expect(after.railBottom, `rail bottom ${after.railBottom} vs dock top ${after.dockTop}`).toBeLessThanOrEqual(after.dockTop + 2);
    // Dead space under the Coach content is a fraction of the rail, not most of it.
    const dead = after.railHeight - after.railContent;
    expect(dead, `dead space ${dead} of rail ${after.railHeight}`).toBeLessThan(after.railHeight * 0.6);

    await context.close();
  }, 45_000);
});
