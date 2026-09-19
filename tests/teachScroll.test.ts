/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { mount } from "../src/ui/app";

describe("teach-pane scroll across remounts", () => {
  it("keeps window and pane scroll when the Coach tab is selected", () => {
    window.history.replaceState({}, "", "/?scene=crocmove");
    const root = document.createElement("div");
    document.body.appendChild(root);

    let x = 0;
    let y = 140;
    Object.defineProperty(window, "scrollX", { configurable: true, get: () => x });
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
    window.scrollTo = ((a?: number | ScrollToOptions, b?: number) => {
      if (typeof a === "object") {
        x = a.left ?? x;
        y = a.top ?? y;
      } else {
        x = a ?? x;
        y = b ?? y;
      }
    }) as typeof window.scrollTo;

    mount(root);
    expect(root.querySelector("[data-teach-rail]")).toBeTruthy();

    const brief = root.querySelector<HTMLElement>('[data-teach-pane="brief"]');
    expect(brief).toBeTruthy();
    brief!.scrollTop = 64;

    window.scrollTo(0, 140);
    const coachTab = root.querySelector<HTMLButtonElement>('[data-teach-tab="coach"]');
    expect(coachTab).toBeTruthy();
    coachTab!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(root.querySelector("[data-teach-rail]")?.getAttribute("data-active-tab")).toBe("coach");
    expect(window.scrollY).toBe(140);

    const briefTab = root.querySelector<HTMLButtonElement>('[data-teach-tab="brief"]');
    briefTab!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(root.querySelector<HTMLElement>('[data-teach-pane="brief"]')?.scrollTop).toBe(64);
    expect(window.scrollY).toBe(140);
    root.remove();
  });
});
