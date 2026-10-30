/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { mount } from "../src/ui/app";

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  sessionStorage.clear();
});

function open() {
  window.history.replaceState({}, "", "/");
  window.scrollTo = (() => undefined) as typeof window.scrollTo;
  const root = document.createElement("div");
  document.body.appendChild(root);
  mount(root);
  return root;
}

function click(root: HTMLElement, selector: string) {
  const target = root.querySelector<HTMLButtonElement>(selector);
  expect(target, selector).toBeTruthy();
  expect(target!.disabled, `${selector} should be enabled`).toBe(false);
  target!.click();
}

describe("practice drills", () => {
  it("offers three tasks, optional hints, restart, and an exit without losing the game entry points", () => {
    const root = open();
    expect(root.querySelectorAll("[data-drill]")).toHaveLength(3);
    expect(root.querySelector("[data-table-habits]")?.textContent).toMatch(/any unlocked location/);
    click(root, '[data-drill="equal-strength"]');
    expect(root.querySelector(".coach-panel")).toBeNull();
    expect(root.querySelector("[data-drill-banner]")?.textContent).toMatch(/Tinker Bell/);
    click(root, "[data-coach-toggle]");
    expect(root.querySelector(".coach-panel")).toBeTruthy();
    click(root, "[data-drill-retry]");
    expect(root.querySelector(".coach-panel")).toBeNull();
    click(root, "[data-resign]");
    click(root, "[data-again]");
    expect(root.querySelector("[data-drill-banner]")?.textContent).toMatch(/Tinker Bell/);
    click(root, "[data-drill-exit]");
    expect(root.querySelector("[data-tutorial]")).toBeTruthy();
    expect(root.querySelector("[data-start]")).toBeTruthy();
  });

  it("requires the actual equal-Strength clash before giving feedback and resets the board on retry", () => {
    const root = open();
    click(root, '[data-drill="equal-strength"]');
    click(root, '[data-act="jr-vanquish"]');
    click(root, '[data-loc="jollyRoger"] .zone-heroes [data-card]');
    expect(root.querySelector("#drill-result-title")).toBeNull();
    click(root, '[data-loc="jollyRoger"] .zone-allies [data-card]');
    click(root, "[data-confirm]");
    expect(root.querySelector("#drill-result-title")?.textContent).toBe("Make the numbers work");
    expect(root.querySelector(".takeaway")?.textContent).toMatch(/discarded/);
    click(root, "[data-drill-retry]");
    expect(root.querySelector("#drill-result-title")).toBeNull();
    expect(root.querySelector('[data-loc="jollyRoger"] .zone-heroes')?.textContent).toMatch(/Tinker Bell/);
  });

  it("recognizes an escort only after the Hero reaches the ship", () => {
    const root = open();
    click(root, '[data-drill="escort"]');
    click(root, '[data-loc="skullRock"] [data-act^="extra:"]');
    click(root, '[data-loc="skullRock"] .zone-heroes [data-card]');
    expect(root.querySelector("#drill-result-title")).toBeNull();
    click(root, '.prompt [data-move="jollyRoger"]');
    expect(root.querySelector("#drill-result-title")?.textContent).toBe("Bring Peter aboard");
    click(root, "[data-drill-sail]");
    expect(root.querySelector("[data-drill-banner]")).toBeNull();
    expect(root.querySelector(".play")).toBeTruthy();
    expect(root.querySelector(".power b")?.textContent).toBe("0");
  });
});
