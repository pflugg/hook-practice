import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

/** Use a local Chrome or Playwright's installed Chromium on all supported hosts. */
export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/opt/google/chrome/chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    ...[process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]
      .filter(Boolean)
      .map((base) => join(base, "Google", "Chrome", "Application", "chrome.exe")),
    chromium.executablePath(),
  ];
  return candidates.find((candidate) => typeof candidate === "string" && existsSync(candidate));
}
