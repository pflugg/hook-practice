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

const drillPlans = {
  "combat-equal": ["equal-crew", "wait-for-more"],
  "combat-wendy": ["brute-only", "swash-only"],
  "escort-ship": ["device-west", "move-hook"],
  "escort-lagoon": ["lagoon-west", "jump-to-ship"],
  "clash-ready": ["clash-now", "wait-for-more"],
  "clash-dust": ["arm-then-clash", "clash-now"],
};

async function solveDrill(page, setup) {
  if (setup.startsWith("escort-")) {
    const hook = setup === "escort-ship" ? "skullRock" : "hangmansTree";
    const route = setup === "escort-ship" ? ["skullRock", "jollyRoger"] : ["mermaidLagoon", "skullRock", "jollyRoger"];
    for (let step = 0; step < route.length - 1; step++) {
      await page.locator(`[data-loc="${hook}"] [data-act]:not(:disabled)`).filter({ hasText: "Move a Hero" }).first().click();
      await page.locator(`[data-loc="${route[step]}"] [data-card]`).filter({ hasText: "Peter Pan" }).click();
      await page.locator(`[data-loc="${route[step + 1]}"] [data-move]`).click();
    }
    return;
  }
  if (setup === "clash-dust") {
    await page.locator('[data-loc="jollyRoger"] [data-act="jr-play"]').click();
    await page.locator('.hand [data-card]').filter({ hasText: "Cutlass" }).click();
    await page.locator('[data-dialog="attach-title"] button[data-card]').first().click();
    await page.locator('[data-pay-power]').click();
  }
  await page.locator('[data-loc="jollyRoger"] [data-act="jr-vanquish"]').click();
  await page.locator('[data-loc="jollyRoger"] .zone-heroes [data-card]').filter({ hasText: setup.startsWith("combat-") ? "Tinker Bell" : "Peter Pan" }).click();
  const allies = page.locator('[data-loc="jollyRoger"] .zone-allies [data-card]');
  if (setup === "combat-wendy") await allies.filter({ hasText: "Pirate Brute" }).click();
  else {
    const count = await allies.count();
    for (let n = 0; n < count; n++) await allies.nth(n).click();
  }
  await page.locator('[data-confirm]').click();
}

async function inspectStudy(page, width) {
  const result = await page.evaluate(() => {
    const locations = [...document.querySelectorAll('.location')];
    const targets = [...document.querySelectorAll('button:not(:disabled), a.btn')].filter((el) => el.checkVisibility());
    return {
      heights: locations.map((el) => Math.round(el.getBoundingClientRect().height)),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      taps: targets.filter((el) => el.getBoundingClientRect().height < 44 || el.getBoundingClientRect().width < 44).map((el) => el.textContent),
    };
  });
  assert(result.heights.every((h) => h >= 380), 'Study board squashed');
  assert(!result.overflow, 'Study page overflows sideways');
  if (width < 500) assert.deepEqual(result.taps, [], 'Study phone controls below 44px');
  return result;
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
        assert.equal(await page.locator('[data-drill-study]').count(), 0, 'Beginners must never enter plan questions');
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
    // The beginner handoff keeps all guidance on for the first shuffled voyage.
    await page.locator('[data-lesson-sail]').click();
    assert.equal(await page.locator('[data-teach-rail] > .teach-pane').count(), 3);
    assert.match(await page.locator('.topbar [data-coach-toggle]').textContent(), /Coach on/);
    await page.locator('.hud-menu > summary').click();
    await page.locator('[data-resign]').click();
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

    const drills = [];
    for (const mode of ['plan', 'guided']) {
      for (const id of ["equal-strength", "escort", "ship-clash"]) {
        await page.locator(`[data-drill${mode === 'guided' ? '-guided' : ''}="${id}"]`).click();
        let prior = null;
        for (let variant = 0; variant < 2; variant++) {
          const setup = await page.locator('[data-drill-setup]').getAttribute('data-drill-setup');
          assert.notEqual(setup, prior, 'New setup must change the board');
          prior = setup;
          if (mode === 'plan') {
            assert.equal(await page.locator('.plan-feedback, [data-drill-hint]').count(), 0, 'Answers shown before an attempt');
            assert(await page.locator('[data-drill-begin]').isDisabled(), 'Plan gate started open');
            await inspectStudy(page, width);
            const [right, wrong] = drillPlans[setup];
            await page.locator(`[data-drill-plan="${wrong}"]`).click();
            assert(await page.locator('[data-drill-begin]').isDisabled(), 'Mismatched plan started play');
            assert(await page.locator('.plan-feedback').isVisible(), 'Missing explanatory feedback');
            await page.locator('[data-drill-hint]').click();
            assert(await page.locator('.plan-hint').isVisible(), 'Missing requested hint');
            await page.locator(`[data-drill-plan="${right}"]`).click();
            await page.locator('[data-drill-begin]').click();
          } else {
            assert.equal(await page.locator('[data-drill-study]').count(), 0, 'Guided mode showed a quiz');
            assert.equal(await page.locator('[data-drill-guidance] li').count(), 2, 'Guided hints are hidden');
            assert(await page.locator('.coach-do').isVisible(), 'No current guided click');
          }
          measurements.push(await inspect(page, `${mode}-${setup}-${width}x${height}`, width));
          if (width === 1301 || width === 390) await page.screenshot({ path: `${output}/${mode}-${setup}-${width}.png`, fullPage: true });
          if (mode === 'guided') {
            for (let click = 0; click < 20 && !(await page.locator('#drill-result-title').count()); click++) await coachClick(page);
          } else await solveDrill(page, setup);
          assert(await page.locator('#drill-result-title').isVisible(), `${mode}-${setup}: no success feedback`);
          assert.match(await page.locator('[data-drill-reflection]').textContent(), mode === 'guided' ? /guided version/ : /revised your plan.*1 optional hint/);
          drills.push({ mode, setup });
          if (variant === 0) await page.locator('[data-drill-next]').click();
          else await page.locator('[data-drill-exit]').click();
        }
      }
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/title-${width}x${height}.png`, fullPage: true });
    evidence.push({ width, height, lessons: [...lessons], gameClicks, won, drills: drills.length, drillRuns: drills, measurements });
    writeFileSync(`${output}/proof.json`, JSON.stringify({ evidence, errors }, null, 2));
    console.log(JSON.stringify({ width, height, lessons: 6, gameClicks, won, drills: drills.length, minimumShore: Math.min(...measurements.flatMap((p) => p.heights)) }));
    await context.close();
  }));
  const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason?.stack ?? String(result.reason));
  assert.deepEqual(failures, [], failures.join("\n"));
  assert.deepEqual(errors, [], "Browser exceptions");
} finally {
  await browser.close();
}
