/**
 * Boot and Set Sail checks for ?scene=nearwin and ?scene=tauntdig.
 * Prints one JSON line: { ok, hydrations, errors }.
 */
import { JSDOM } from "jsdom";

interface Probe {
  ok: boolean;
  hydrations: number;
  errors: string[];
}

function install(url: string): { root: HTMLElement; click: (selector: string) => void } {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, {
    url,
    pretendToBeVisual: true,
  });
  const w = dom.window as unknown as Window & typeof globalThis;
  const g = globalThis as unknown as Record<string, unknown>;
  const assign = (key: string, value: unknown) => {
    try {
      g[key] = value;
    } catch {
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
  };
  assign("window", w);
  assign("document", w.document);
  assign("HTMLElement", w.HTMLElement);
  assign("HTMLButtonElement", w.HTMLButtonElement);
  assign("Element", w.Element);
  assign("Node", w.Node);
  assign("MouseEvent", w.MouseEvent);
  assign("sessionStorage", w.sessionStorage);
  assign("history", w.history);
  assign("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number);
  w.scrollTo = () => undefined;
  const root = w.document.getElementById("root");
  if (!root) throw new Error("missing root");
  return {
    root,
    click(selector: string) {
      const el = root.querySelector(selector);
      if (!el) throw new Error(`missing ${selector} at ${url}`);
      el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
    },
  };
}

const { mount } = await import("../src/ui/app.ts");
const errors: string[] = [];
let hydrations = 0;

for (const scene of ["nearwin", "tauntdig"] as const) {
  const { root, click } = install(`http://localhost/?scene=${scene}`);
  mount(root);
  const power = () => root.querySelector(".power b")?.textContent ?? "";
  const chip = () => root.querySelector("[data-scene-chip]")?.textContent ?? "";
  const expectPower = scene === "nearwin" ? "2" : "7";
  const expectTurn = scene === "nearwin" ? "Turn 8" : "Turn 38";
  const text = () => root.textContent ?? "";
  const locked = () => Boolean(root.querySelector("[data-loc='hangmansTree']")?.classList.contains("is-locked"));
  const captain = root.querySelector("[data-loc='skullRock']")?.classList.contains("is-current");
  if (chip() !== `Scene: ${scene}` || power() !== expectPower || !text().includes(expectTurn) || locked() || !captain) {
    errors.push(`boot ${scene}: chip=${chip()} power=${power()} turn=${text().includes(expectTurn)} locked=${locked()} captain=${captain}`);
  }
  click("[data-resign]");
  click("[data-home]");
  click("[data-start]");
  if (chip() !== `Scene: ${scene}` || power() !== expectPower || !text().includes(expectTurn) || locked()) {
    errors.push(`setsail ${scene}: chip=${chip()} power=${power()} turn=${text().includes(expectTurn)} locked=${locked()}`);
  } else if (errors.length === 0 || !errors.some((line) => line.startsWith(`boot ${scene}`))) {
    hydrations += 1;
  }
}

const probe: Probe = { ok: errors.length === 0, hydrations, errors };
console.log(JSON.stringify(probe));
if (!probe.ok) process.exit(1);
