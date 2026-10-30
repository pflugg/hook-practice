#!/usr/bin/env node
/* global document, requestAnimationFrame, innerWidth */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { chromium, firefox } from "playwright";
import { findChrome } from "./browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const browserName = process.env.VERIFY_BROWSER ?? "chromium";
assert(["chromium", "firefox"].includes(browserName), "VERIFY_BROWSER must be chromium or firefox");
const output = path.join(root, "verification-evidence", browserName === "chromium" ? "submission" : `submission-${browserName}`);
mkdirSync(output, { recursive: true });
assert(existsSync(path.join(dist, "index.html")), "Run npm run build first");
const prefix = "/review/neverland-duel/";
const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".mp4": "video/mp4", ".vtt": "text/vtt", ".json": "application/json", ".md": "text/plain", ".txt": "text/plain" };

// Plain static hosting, deliberately without a Vite/SPA fallback.
const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const target = path.resolve(dist, pathname.slice(prefix.length) || "index.html");
    if (!target.startsWith(`${dist}${path.sep}`) || !existsSync(target) || !statSync(target).isFile()) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(200, { "content-type": contentTypes[path.extname(target)] ?? "application/octet-stream" });
    response.end(readFileSync(target));
  } catch {
    response.writeHead(400).end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const { port } = server.address();
const url = `http://127.0.0.1:${port}${prefix}`;
const errors = [];
const failures = [];
const evidence = [];
let browser;

async function coachClick(page) {
  const selectors = [
    ".modal button.is-coached:visible:not(:disabled)",
    ".location .card.is-coached:not(.is-selected):visible, .hand .card.is-coached:not(.is-selected):visible",
    ".prompt button.is-coached:visible:not(:disabled)",
    ".location .action.is-coached:visible:not(:disabled)",
    ".location.is-coached button[data-move]:visible",
  ];
  for (const selector of selectors) {
    const control = page.locator(selector).first();
    if (await control.count()) {
      await control.click({ timeout: 7000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return;
    }
  }
  throw new Error(`No clickable recommendation: ${await page.locator(".coach-do").textContent()}`);
}

try {
  browser = browserName === "firefox"
    ? await firefox.launch({ headless: true })
    : await chromium.launch({ executablePath: findChrome(), headless: true });
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 568], [844, 390], [1280, 568]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    // The optional font service must not be a prerequisite for playing.
    await context.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await context.route("https://fonts.gstatic.com/**", (route) => route.abort());
    const page = await context.newPage();
    let tutorRequests = 0;
    page.on("request", (request) => { if (request.url().endsWith("/api/tutor")) tutorRequests++; });
    page.on("pageerror", (error) => errors.push(`${width}x${height}: ${error.message}`));
    page.on("response", (response) => {
      if (response.url().startsWith(url) && response.status() >= 400 && !response.url().endsWith("/api/tutor")) failures.push(`${response.status()} ${response.url()}`);
    });
    try {
      await page.goto(url);
      await page.locator("[data-tutorial]").waitFor({ state: "visible" });
      await page.screenshot({ path: path.join(output, `title-${width}x${height}.png`) });
      await page.locator("[data-tutorial]").click();
      assert.equal(tutorRequests, 0, "AI must not run automatically");
      await page.locator(".luna-open").click();
      assert.equal(tutorRequests, 0, "Opening Ask Coach must not call AI");
      await page.locator("[data-luna-question]").first().click();
      await page.getByText("Local Coach · verified explanation", { exact: true }).waitFor();
      await page.locator("[data-luna-close]").click();
      // Exercise the client contract without spending API credits in routine CI.
      await page.route("**/api/tutor", async (route) => {
        const { context } = route.request().postDataJSON();
        await route.fulfill({ json: { source: "luna", position: context.position, answerable: true, factIds: ["reason"] } });
      });
      await page.locator(".luna-open").click();
      await page.locator("[data-luna-question]").first().click();
      await page.getByText("Selected by Luna · facts checked by the game", { exact: true }).waitFor();
      assert(await page.locator(".luna-answer").textContent().then((text) => text.includes("Every turn starts")), "Tutor did not display the engine explanation");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Tutor overflows the viewport");
      await page.screenshot({ path: path.join(output, `tutor-${width}x${height}.png`) });
      await page.locator("[data-luna-close]").click();
      const lessons = new Set();
      for (let click = 0; click < 50 && !(await page.locator("[data-lesson-handoff]").count()); click++) {
        const number = (await page.locator("[data-lesson-banner] strong").textContent()).match(/Lesson (\d)/)?.[1];
        if (number) lessons.add(number);
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          mapLoaded: document.querySelector(".map-scene")?.naturalWidth > 0,
        }));
        assert(!layout.overflow, `Page overflows at ${width}x${height}`);
        assert(layout.mapLoaded, "The map image did not load under the hosting subfolder");
        if (number === "2") await page.screenshot({ path: path.join(output, `tutorial-${width}x${height}.png`) });
        await coachClick(page);
      }
      assert.deepEqual([...lessons], ["1", "2", "3", "4", "5", "6"]);
      assert(await page.locator("[data-lesson-handoff]").isVisible(), "Tutorial did not finish");
      await page.locator("[data-lesson-sail]").click();
      await page.locator(".hud-menu > summary").click();
      await page.locator("[data-help]").click();
      await page.locator('[data-dialog="help-title"]').waitFor({ state: "visible" });
      await page.locator("[data-close-help]").click();
      await page.locator(".hud-menu > summary").click();
      await page.locator("[data-resign]").click();
      await page.locator("[data-recap]").waitFor({ state: "visible" });
      await page.locator("[data-home]").click();
      await page.locator('[data-drill-guided="equal-strength"]').click();
      for (let click = 0; click < 15 && !(await page.locator("#drill-result-title").count()); click++) await coachClick(page);
      assert(await page.locator("#drill-result-title").isVisible(), "Guided drill did not finish");
      await page.locator("[data-drill-exit]").click();
      await page.getByRole("link", { name: "Watch the 48-second introduction" }).click();
      await page.locator("video").waitFor();
      await page.waitForFunction(() => document.querySelector("video").readyState >= 1);
      const video = await page.locator("video").evaluate((element) => ({
        duration: element.duration, width: element.videoWidth, height: element.videoHeight,
        error: element.error?.message ?? null,
      }));
      assert.equal(video.error, null);
      assert.equal(video.duration, 48);
      assert.equal(video.width, 1280);
      assert.equal(video.height, 720);
      const vtt = await page.locator("track").getAttribute("src");
      const captionResponse = await page.request.get(new URL(vtt, page.url()).href);
      assert(captionResponse.ok(), "Captions are missing from the build");
      const captions = await captionResponse.text();
      assert.equal((captions.match(/ --> /g) ?? []).length, 6);
      assert(captions.includes("00:00:40.000 --> 00:00:48.000"));
      await page.getByRole("link", { name: "Play the game", exact: true }).click();
      await page.locator("[data-tutorial]").waitFor({ state: "visible" });
      evidence.push({ width, height, lessons: [...lessons], tutorNoAutomaticCalls: true, tutorStaticFallback: true, tutorValidatedDisplay: true, helpAndResignMenu: true, guidedCombatCompleted: true, optionalFontsBlocked: true, subfolderAssetsLoaded: true, video, captions: 6, videoReturnLink: true });
      console.log(`${width}x${height}: production tutorial, drill, video, captions, and return link passed`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `failure-${width}x${height}.png`) });
      failures.push(`${width}x${height}: ${error.stack ?? error.message}`);
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, [], "Browser exceptions");
  assert.equal(failures.length, 0, failures.map((failure) => failure.split("\n").slice(0, 2).join(" ")).join("\n"));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  writeFileSync(path.join(output, "proof.json"), `${JSON.stringify({ url, browser: browserName, checkedAt: new Date().toISOString(), evidence, errors, failures }, null, 2)}\n`);
}
