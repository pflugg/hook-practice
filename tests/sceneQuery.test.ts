/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "../src/ui/app";

function click(root: HTMLElement, selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  expect(el, selector).toBeTruthy();
  el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function treeLocked(root: HTMLElement): boolean {
  return root.querySelector("[data-loc='hangmansTree']")?.classList.contains("is-locked") ?? false;
}

function powerText(root: HTMLElement): string {
  return root.querySelector(".power b")?.textContent ?? "";
}

describe("?scene= hydrates on boot and on Set Sail", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    document.body.innerHTML = "";
  });

  it("Set Sail with scene=nearwin does not leave Power 0 / Tree locked", () => {
    window.history.replaceState({}, "", "/?scene=nearwin");
    const root = document.createElement("div");
    document.body.appendChild(root);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
    mount(root);

    expect(root.querySelector("[data-scene-chip]")?.textContent).toBe("Scene: nearwin");
    expect(powerText(root)).toBe("2");
    expect(treeLocked(root)).toBe(false);
    expect(root.querySelector("[data-loc='skullRock']")?.classList.contains("is-current")).toBe(true);

    click(root, "[data-resign]");
    click(root, "[data-home]");
    expect(root.querySelector("[data-start]")).toBeTruthy();

    click(root, "[data-start]");
    expect(root.querySelector("[data-scene-chip]")?.textContent).toBe("Scene: nearwin");
    expect(powerText(root)).not.toBe("0");
    expect(powerText(root)).toBe("2");
    expect(root.textContent).toContain("Turn 8");
    expect(treeLocked(root)).toBe(false);
    expect(root.querySelector("[data-loc='hangmansTree']")?.textContent).not.toContain("LOCKED");
    expect(root.querySelector("[data-loc='skullRock']")?.classList.contains("is-current")).toBe(true);
  });

  it("Set Sail with scene=tauntdig loads the spent-Obsession board", () => {
    window.history.replaceState({}, "", "/?scene=tauntdig");
    const root = document.createElement("div");
    document.body.appendChild(root);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
    mount(root);

    expect(root.querySelector("[data-scene-chip]")?.textContent).toBe("Scene: tauntdig");
    expect(powerText(root)).toBe("7");
    expect(root.textContent).toContain("Turn 38");
    expect(treeLocked(root)).toBe(false);

    click(root, "[data-resign]");
    click(root, "[data-home]");
    click(root, "[data-start]");

    expect(root.querySelector("[data-scene-chip]")?.textContent).toBe("Scene: tauntdig");
    expect(powerText(root)).toBe("7");
    expect(powerText(root)).not.toBe("0");
    expect(root.textContent).toContain("Turn 38");
    expect(treeLocked(root)).toBe(false);
    expect(root.querySelector("[data-loc='skullRock']")?.classList.contains("is-current")).toBe(true);
    expect(root.textContent).toContain("Obsession");
    expect(root.querySelector(".coach-do")?.textContent ?? "").toMatch(/Obsession/);
    expect(root.querySelector(".coach-do")?.textContent ?? "").not.toMatch(/^Discard$/);
  });

  it("warns in dev when the scene param is unknown and Set Sail stays a fresh voyage", () => {
    window.history.replaceState({}, "", "/?scene=not-a-scene");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = document.createElement("div");
    document.body.appendChild(root);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
    mount(root);

    expect(root.querySelector("[data-start]")).toBeTruthy();
    expect(root.querySelector("[data-scene-warning]")?.textContent).toMatch(/Unknown scene/);
    expect(root.querySelector("[data-scene-warning]")?.textContent).toMatch(/not-a-scene/);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.some((args) => String(args[0]).includes("not-a-scene"))).toBe(true);

    click(root, "[data-start]");
    expect(root.querySelector("[data-scene-chip]")).toBeNull();
    expect(powerText(root)).toBe("0");
    expect(treeLocked(root)).toBe(true);
    expect(root.textContent).toContain("Turn 1");
    warn.mockRestore();
  });
});
