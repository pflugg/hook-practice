/* global document, getComputedStyle, innerWidth, requestAnimationFrame, window */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

// Use the server started and checked by verify.mjs; never manipulate engine state.
const { url } = JSON.parse(readFileSync("/tmp/hook-practice-verify/server.json", "utf8"));
const output = "verification-evidence/learning";
mkdirSync(output, { recursive: true });
const executablePath = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const sizes = [[1301, 692], [1280, 720], [1280, 800], [1440, 900], [1024, 768], [390, 844]];
const evidence = [];
const errors = [];

async function inspect(page, label, width) {
  const result = await page.evaluate(() => {
    const locs = [...document.querySelectorAll(".location")];
    const overlap = locs.flatMap((loc) => {
      const children = [...loc.children].filter((el) => ["loc-head", "location-choice", "row", "zone"].some((c) => el.classList.contains(c)));
      return children.slice(1).filter((el, i) => el.getBoundingClientRect().top < children[i].getBoundingClientRect().bottom - 1).map(() => loc.dataset.loc);
    });
    const handClipped = [...document.querySelectorAll(".hand-card .text")].some((el) => el.scrollHeight > el.clientHeight + 2);
    const board = document.querySelector(".board-wrap");
    const dock = document.querySelector(".dock");
    const coach = document.querySelector(".coach-do");
    const why = document.querySelector(".coach-why");
    const taps = [...document.querySelectorAll("button, summary")].filter((el) => el.checkVisibility() && !el.disabled && el.getBoundingClientRect().width > 0).filter((el) => el.getBoundingClientRect().height < 44 || el.getBoundingClientRect().width < 44).map((el) => el.textContent.trim().slice(0, 40));
    return {
      heights: locs.map((loc) => Math.round(loc.getBoundingClientRect().height)),
      overlap, handClipped,
      dockOverlap: dock.getBoundingClientRect().top < board.getBoundingClientRect().bottom - 1,
      mapVisible: document.querySelector(".map-scene")?.getBoundingClientRect().height > 0,
      coachFont: coach ? parseFloat(getComputedStyle(coach).fontSize) : null,
      whyFont: why ? parseFloat(getComputedStyle(why).fontSize) : null,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      taps,
    };
  });
  assert(result.heights.every((h) => h >= 380), `${label}: shore heights ${result.heights}`);
  assert.deepEqual(result.overlap, [], `${label}: overlapping location content`);
  assert(!result.handClipped, `${label}: hand text clipped`);
  assert(!result.dockOverlap, `${label}: dock overlaps board`);
  assert(result.mapVisible, `${label}: map hidden`);
  assert(!result.horizontalOverflow, `${label}: page overflows sideways`);
  if (result.coachFont !== null) assert(result.coachFont >= 18, `${label}: coach below 18px`);
  if (result.whyFont !== null) assert(result.whyFont >= 14, `${label}: explanation below 14px`);
  if (width < 500) assert.deepEqual(result.taps, [], `${label}: phone targets below 44px`);
  return { label, ...result };
}

async function coachClick(page) {
  // Card selections precede Confirm even when the prompt appears earlier in DOM order.
  const selectors = [
    '.modal button.is-coached:visible:not(:disabled)',
    '.location .card.is-coached:not(.is-selected):visible, .hand .card.is-coached:not(.is-selected):visible',
    '.prompt button.is-coached:visible:not(:disabled)',
    '.location .action.is-coached:visible:not(:disabled)',
    '.location.is-coached button[data-move]:visible',
  ];
  let clicked = false;
  for (const selector of selectors) {
    const choice = page.locator(selector).first();
    if (await choice.count()) { await choice.click({ timeout: 5000 }); clicked = true; break; }
  }
  if (!clicked) throw new Error(`No clickable recommendation: ${await page.locator('.coach-do').textContent()}`);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

try {
  const results = await Promise.allSettled(sizes.map(async ([width, height]) => {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.locator("[data-tutorial]").click();
    const lessons = new Set();
    const measurements = [];
    for (let click = 0; click < 40; click++) {
      if (await page.locator("[data-lesson-handoff]").count()) break;
      if (await page.locator("[data-lesson-banner]").count()) {
        const lesson = (await page.locator("[data-lesson-banner] strong").textContent()).match(/Lesson (\d)/)?.[1];
        lessons.add(lesson);
        if (await page.locator('.overlay:not(.pass-through)').count() === 0) {
          measurements.push(await inspect(page, `lesson-${lesson}-${width}x${height}`, width));
          if (lesson === "5" && await page.locator('.location [data-card].is-coached').count()) {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: `${output}/escort-${width}x${height}.png`, fullPage: true });
          }
        }
      }
      await coachClick(page);
    }
    assert.deepEqual([...lessons], ["1", "2", "3", "4", "5", "6"]);
    assert(await page.locator("[data-lesson-handoff]").count(), "Tutorial did not reach its completion dialog");
    console.log(`${width}x${height}: six tutorial lessons completed`);
    await page.screenshot({ path: `${output}/tutorial-complete-${width}x${height}.png` });
    // Exercise the actual Set Sail entry separately from the tutorial handoff.
    await page.locator("[data-home]").click();
    await page.locator('[data-diff="easy"]').click();
    await page.locator("[data-start]").click();
    let won = false;
    let gameClicks = 0;
    for (; gameClicks < 3000; gameClicks++) {
      if (gameClicks % 100 === 0) console.log(`${width}x${height}: Set Sail decision ${gameClicks}, ${await page.locator('.chip-stat').first().textContent()}: ${await page.locator('.coach-do').textContent()}`);
      if (await page.locator("[data-recap]").count()) {
        won = (await page.locator("[data-outcome]").textContent()).trim() === "Victory";
        break;
      }
      if (gameClicks % 20 === 0 && await page.locator('.overlay:not(.pass-through)').count() === 0) {
        measurements.push(await inspect(page, `set-sail-${gameClicks}-${width}x${height}`, width));
      }
      await coachClick(page);
    }
    assert(await page.locator("[data-recap]").count(), `Set Sail did not finish at ${width}x${height} after ${gameClicks} clicks`);
    await page.screenshot({ path: `${output}/voyage-complete-${width}x${height}.png` });
    await page.locator("[data-home]").click();

    for (const id of ["equal-strength", "escort", "ship-clash"]) {
      await page.locator(`[data-drill="${id}"]`).click();
      assert.equal(await page.locator('.coach-panel').count(), 0, 'Drills must start without answer-giving Coach');
      if (id === "escort") {
        await page.locator('[data-loc="skullRock"] [data-act]').filter({ hasText: "Move a Hero" }).click();
        await page.locator('[data-loc="skullRock"] [data-card]').filter({ hasText: "Peter Pan" }).click();
        await page.locator('[data-loc="jollyRoger"] [data-move]').click();
      } else {
        await page.locator('[data-loc="jollyRoger"] [data-act="jr-vanquish"]').click();
        await page.locator('[data-loc="jollyRoger"] [data-card]').filter({ hasText: id === "equal-strength" ? "Tinker Bell" : "Peter Pan" }).click();
        const allies = page.locator('[data-loc="jollyRoger"] .zone-allies [data-card]');
        const count = await allies.count();
        for (let n = 0; n < count; n++) await allies.nth(n).click();
        await page.locator("[data-confirm]").click();
      }
      assert(await page.locator("#drill-result-title").isVisible(), `${id}: no success feedback`);
      await page.locator("[data-drill-retry]").click();
      assert(await page.locator("[data-drill-banner]").count(), `${id}: retry failed`);
      await page.locator("[data-drill-exit]").click();
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/title-${width}x${height}.png`, fullPage: true });
    evidence.push({ width, height, lessons: [...lessons], gameClicks, won, drills: 3, measurements });
    writeFileSync(`${output}/proof.json`, JSON.stringify({ evidence, errors }, null, 2));
    console.log(JSON.stringify({ width, height, lessons: 6, gameClicks, won, drills: 3, minimumShore: Math.min(...measurements.flatMap((p) => p.heights)) }));
    await context.close();
  }));
  const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason?.stack ?? String(result.reason));
  assert.deepEqual(failures, [], failures.join("\n"));
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
