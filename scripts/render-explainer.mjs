#!/usr/bin/env node
/* global document, window */
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { findChrome } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'submission');
const runtime = path.join('/tmp', 'neverland-duel-video');
mkdirSync(runtime, { recursive: true });
mkdirSync(output, { recursive: true });
const chromePath = findChrome();
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const scenes = [
  ['Practice privately before you play with people.', 'New game night. Same first-turn nerves? Give yourself a place to try, ask why, and start again at your own pace. No pressure. Repeat any step.'],
  ['Move to a different unlocked location before using its actions.', 'One move at a time. Start with a short guided lesson. Move first. Then use the new location’s open actions. Simplified lesson diagram.'],
  ['Need 4 Power? Gain 1 before paying for the Map.', 'A hint should explain why. The Map costs 4 Power. You have 3. Take Gain 1, then pay for the Map. Build toward the unlock.'],
  ['Check the total before a clash: 4 + 4 = 8. Equal Strength works.', 'Try. Repeat. Make it click. Follow along first. Choose your own plan when you want to. In this clash, selected crew are spent afterward.'],
  ['Six guided lessons. Three focused drills. A coached simulated voyage.', 'Help for the click. And the plan. Coach: a legal next click. Why this move: an explanation of your choice. Strategy brief: your objective, progress, and what comes next.'],
  ['A teaching companion for learning before game night.', 'Neverland Duel. Practice privately. Join the table with confidence. Start with Tutorial. Independent teaching prototype. Current lesson: Captain Hook’s objective in Disney Villainous. Solo adaptations are explained before table play. Not affiliated with or endorsed by Disney or Ravensburger.'],
];
function timestamp(seconds, separator = '.') {
  return `00:00:${String(seconds).padStart(2, '0')}${separator}000`;
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(75000);
  await page.goto(pathToFileURL(path.join(output, 'explainer-source.html')).href);
  await page.locator('canvas').waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < scenes.length; i += 1) {
    await page.evaluate((time) => window.explainer.draw(time), i * 8 + 5);
    await page.locator('canvas').screenshot({ path: path.join(runtime, `scene-${i + 1}.png`) });
  }
  await page.evaluate(() => window.explainer.draw(42));
  await page.locator('canvas').screenshot({ path: path.join(output, 'neverland-duel-poster.png') });
  console.log('Rendering 48 seconds of original motion graphics…');
  const video = await page.evaluate(() => window.explainer.record());
  const webm = path.join(runtime, 'explainer.webm');
  writeFileSync(webm, Buffer.from(video, 'base64'));
  const ffmpeg = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', webm, '-t', '48',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart',
    path.join(output, 'neverland-duel.mp4'),
  ], { encoding: 'utf8' });
  if (ffmpeg.status !== 0) throw new Error(ffmpeg.stderr || ffmpeg.error?.message || 'FFmpeg failed');
  const cues = scenes.map(([caption], i) => `${timestamp(i * 8)} --> ${timestamp((i + 1) * 8)}\n${caption}`);
  writeFileSync(path.join(output, 'neverland-duel.vtt'), `WEBVTT\n\n${cues.join('\n\n')}\n`);
  writeFileSync(path.join(output, 'neverland-duel.srt'), scenes.map(([caption], i) => `${i + 1}\n${timestamp(i * 8, ',')} --> ${timestamp((i + 1) * 8, ',')}\n${caption}`).join('\n\n') + '\n');
  writeFileSync(path.join(output, 'transcript.txt'), scenes.map(([caption, visual], i) => `${i * 8}–${(i + 1) * 8} seconds\n${caption}\nOn screen: ${visual}`).join('\n\n') + '\n');
  console.log(JSON.stringify({ video: path.join(output, 'neverland-duel.mp4'), duration: 48, silent: true, captions: 'neverland-duel.vtt', sceneProofs: runtime }));
} finally {
  await browser.close();
}
