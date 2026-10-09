#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = "/tmp/hook-practice-verify";
const statePath = path.join(runtimeDir, "server.json");
const evidenceRoot = path.join(root, "verification-evidence");

function readState() {
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function freePort() {
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

async function waitForUrl(url) {
  let lastError = "no response";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(200);
  }
  throw new Error(`vite did not answer ${url}: ${lastError}`);
}

async function launch() {
  const existing = readState();
  if (existing && processAlive(existing.pid)) {
    throw new Error(`already running at ${existing.url} pid ${existing.pid}. Run cleanup first.`);
  }
  mkdirSync(runtimeDir, { recursive: true });
  const port = await freePort();
  const logPath = path.join(runtimeDir, "vite.log");
  const logFd = openSync(logPath, "w");
  const viteBin = path.join(root, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  const url = `http://127.0.0.1:${port}`;
  const state = { pid: child.pid, url, port, logPath };
  writeFileSync(statePath, JSON.stringify(state));
  try {
    await waitForUrl(url);
  } catch (error) {
    if (child.pid && processAlive(child.pid)) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        process.kill(child.pid, "SIGTERM");
      }
    }
    throw error;
  }
  console.log(JSON.stringify(state));
}

async function doctor() {
  const state = readState();
  if (!state) throw new Error("no server state. Run launch first.");
  if (!processAlive(state.pid)) throw new Error(`pid ${state.pid} is not running`);
  const response = await fetch(state.url);
  const html = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!html.includes('id="app"')) throw new Error("response is missing #app");
  if (!html.includes("/src/main.ts")) throw new Error("response is not the Vite dev page");
  const report = { ok: true, url: state.url, pid: state.pid, status: response.status };
  console.log(JSON.stringify(report));
}

async function driveTutorial() {
  const state = readState();
  if (!state) throw new Error("no server state. Run launch first.");
  const runDir = path.join(evidenceRoot, "tutorial-move");
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(state.url, { waitUntil: "domcontentloaded" });
    await page.locator("[data-tutorial]").waitFor({ state: "visible" });
    const title = await page.locator("h1").first().innerText();
    await page.locator("[data-tutorial]").click();
    const move = page.getByRole("button", { name: "Move here: Skull Rock" });
    await move.waitFor({ state: "visible" });
    const before = await page.locator('[data-loc="jollyRoger"]').getAttribute("class");
    await page.screenshot({ path: path.join(runDir, "before-move.png"), fullPage: true });
    await move.click();
    const shore = page.locator('[data-loc="skullRock"]');
    await shore.waitFor({ state: "visible" });
    await page.waitForFunction(`() => {
      const node = document.querySelector('[data-loc="skullRock"]');
      return Boolean(node && node.classList.contains("is-current"));
    }`);
    const after = await shore.getAttribute("class");
    const shipAfter = await page.locator('[data-loc="jollyRoger"]').getAttribute("class");
    const prompt = await page.locator(".prompt").innerText();
    await page.screenshot({ path: path.join(runDir, "after-move.png"), fullPage: true });
    const proof = {
      feature: "tutorial-move",
      url: state.url,
      title,
      beforeClass: before,
      afterClass: after,
      prompt,
      captainAtSkullRock: after?.includes("is-current") === true,
      leftTheShip: shipAfter?.includes("is-current") !== true,
      shipClassAfter: shipAfter,
    };
    writeFileSync(path.join(runDir, "proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
    if (!proof.captainAtSkullRock || !proof.leftTheShip) {
      throw new Error(`tutorial move did not land on Skull Rock: ${JSON.stringify(proof)}`);
    }
    console.log(JSON.stringify(proof));
  } finally {
    await browser.close();
  }
}

function stopRecorded(state) {
  if (!state?.pid) return;
  try {
    process.kill(-state.pid, "SIGTERM");
  } catch {
    try {
      process.kill(state.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

async function cleanup() {
  const state = readState();
  stopRecorded(state);
  if (state?.pid) {
    for (let attempt = 0; attempt < 25 && processAlive(state.pid); attempt += 1) {
      await delay(100);
    }
  }
  let stillUp = false;
  if (state?.url) {
    try {
      const response = await fetch(state.url);
      stillUp = response.ok;
    } catch {
      stillUp = false;
    }
  }
  if (existsSync(statePath)) rmSync(statePath);
  if (stillUp) throw new Error(`vite still answering ${state.url} after cleanup`);
  console.log(JSON.stringify({ stopped: state?.pid ?? null, url: state?.url ?? null, stillUp }));
}

const [command, feature] = process.argv.slice(2);

try {
  if (command === "launch") await launch();
  else if (command === "doctor") await doctor();
  else if (command === "drive") {
    if (feature !== "tutorial-move") throw new Error("drive accepts tutorial-move");
    await driveTutorial();
  }   else if (command === "cleanup") await cleanup();
  else if (command === "prove") {
    await cleanup();
    await launch();
    await doctor();
    await driveTutorial();
    const proofPath = path.join(evidenceRoot, "tutorial-move", "proof.json");
    await cleanup();
    if (!existsSync(proofPath)) throw new Error("cleanup removed the proof");
    console.log(JSON.stringify({ evidence: proofPath, survivedCleanup: true }));
  } else {
    throw new Error("use launch, doctor, drive tutorial-move, cleanup, or prove");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (command === "prove") await cleanup();
  process.exitCode = 1;
}
