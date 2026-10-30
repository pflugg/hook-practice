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

function plan(root: HTMLElement, id: string) {
  click(root, `[data-drill-plan="${id}"]`);
  click(root, "[data-drill-begin]");
}

describe("practice learning paths", () => {
  it("offers a fully guided beginner tutorial before any plan questions", () => {
    const root = open();
    expect(root.querySelector(".title-tutorial-note")?.textContent).toMatch(/All hints are on/);
    expect(root.querySelectorAll("[data-drill]")).toHaveLength(3);
    expect(root.querySelectorAll("[data-drill-guided]")).toHaveLength(3);
    expect(root.querySelector("[data-table-habits]")?.textContent).toMatch(/Hero anywhere in your realm/);
    click(root, "[data-tutorial]");
    expect(root.querySelector("[data-drill-study]")).toBeNull();
    expect(root.querySelector(".coach-do")?.textContent).toMatch(/Skull Rock/);
    expect(root.querySelectorAll("[data-teach-rail] > .teach-pane")).toHaveLength(3);
    expect(root.querySelector("[data-lesson-notes]")?.textContent).toMatch(/3|4/);
    expect(root.querySelector("[data-lesson-notes]")?.textContent).toMatch(/Map/);
  });

  it("lets a beginner follow every hint immediately and keeps that mode across setups", () => {
    const root = open();
    click(root, '[data-drill-guided="equal-strength"]');
    expect(root.querySelector("[data-drill-study]")).toBeNull();
    expect(root.querySelector("[data-drill-guidance]")?.textContent).toMatch(/all hints visible/);
    expect(root.querySelectorAll("[data-drill-guidance] li")).toHaveLength(2);
    expect(root.querySelector(".coach-do")?.textContent).toMatch(/Vanquish/);
    click(root, "[data-drill-next]");
    expect(root.querySelector('[data-drill-setup="combat-wendy"]')).toBeTruthy();
    expect(root.querySelector("[data-drill-study]")).toBeNull();
    expect(root.querySelectorAll("[data-drill-guidance] li")).toHaveLength(2);
    click(root, "[data-drill-retry]");
    expect(root.querySelector('[data-drill-setup="combat-wendy"]')).toBeTruthy();
    click(root, "[data-resign]");
    click(root, "[data-again]");
    expect(root.querySelector('[data-drill-setup="combat-wendy"]')).toBeTruthy();
    expect(root.querySelectorAll("[data-drill-guidance] li")).toHaveLength(2);
  });

  it("keeps plan feedback and hints hidden until an attempt and prevents premature play", () => {
    const root = open();
    click(root, '[data-drill="equal-strength"]');
    expect(root.querySelector("[data-drill-study]")).toBeTruthy();
    expect(root.querySelector(".plan-feedback")).toBeNull();
    expect(root.querySelector("[data-drill-hint]")).toBeNull();
    expect(root.querySelector<HTMLButtonElement>("[data-drill-begin]")?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-act="jr-vanquish"]')?.disabled).toBe(true);
    const before = root.querySelector(".zone-heroes")?.textContent;
    root.querySelector<HTMLButtonElement>("[data-drill-begin]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector("[data-drill-study]")).toBeTruthy();
    click(root, '[data-loc="jollyRoger"] .zone-heroes [data-card]');
    expect(root.querySelector("#inspect-title")?.textContent).toBe("Tinker Bell");
    click(root, "[data-inspect-close]");
    expect(root.querySelector(".zone-heroes")?.textContent).toBe(before);
    click(root, '[data-drill-plan="wait-for-more"]');
    expect(root.querySelector(".plan-feedback")?.textContent).toMatch(/already have enough Strength/);
    expect(root.querySelector<HTMLButtonElement>("[data-drill-begin]")?.disabled).toBe(true);
    click(root, "[data-drill-hint]");
    expect(root.querySelector(".plan-hint")?.textContent).toMatch(/Strength bubbles/);
    plan(root, "equal-crew");
    expect(root.querySelector("[data-drill-study]")).toBeNull();
    expect(root.querySelectorAll("[data-drill-guidance] li")).toHaveLength(1);
    expect(root.querySelector(".coach-do")).toBeNull();
  });

  it("lets a learner leave plan mode for full guidance without answering first", () => {
    const root = open();
    click(root, '[data-drill="ship-clash"]');
    click(root, "[data-drill-follow]");
    expect(root.querySelector("[data-drill-study]")).toBeNull();
    expect(root.querySelector("[data-drill-guidance]")?.textContent).toMatch(/all hints visible/);
    expect(root.querySelectorAll("[data-drill-guidance] li")).toHaveLength(2);
  });

  it("requires the real clash before feedback, then rotates the board without leaking the next answer", () => {
    const root = open();
    click(root, '[data-drill="equal-strength"]');
    plan(root, "equal-crew");
    click(root, '[data-act="jr-vanquish"]');
    click(root, '[data-loc="jollyRoger"] .zone-heroes [data-card]');
    expect(root.querySelector("#drill-result-title")).toBeNull();
    click(root, '[data-loc="jollyRoger"] .zone-allies [data-card]');
    click(root, "[data-confirm]");
    expect(root.querySelector("#drill-result-title")?.textContent).toBe("Make the numbers work");
    expect(root.querySelector("[data-drill-reflection]")?.textContent).toMatch(/first plan matched.*0 optional hints/);
    click(root, "[data-drill-next]");
    expect(root.querySelector('[data-drill-setup="combat-wendy"]')).toBeTruthy();
    expect(root.querySelector(".plan-feedback")).toBeNull();
    expect(root.querySelector("[data-drill-hint]")).toBeNull();
    expect(root.querySelector('.zone-allies')?.textContent).toMatch(/Pirate Brute/);
    click(root, "[data-drill-exit]");
    click(root, '[data-drill="equal-strength"]');
    expect(root.querySelector('[data-drill-setup="combat-wendy"]')).toBeTruthy();
  });

  it("recognizes an escort after Peter reaches the ship and preserves the full-game entry", () => {
    const root = open();
    click(root, '[data-drill="escort"]');
    plan(root, "device-west");
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
