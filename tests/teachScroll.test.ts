/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { mount } from "../src/ui/app";

describe("teaching panel scroll across remounts", () => {
  it("restores the single rail scroll and the window scroll when the view re-renders", () => {
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

    // The teaching rail is one flowing scroll box, not a set of tabs.
    const rail = root.querySelector<HTMLElement>("[data-teach-rail]");
    expect(rail).toBeTruthy();
    expect(root.querySelector("[data-teach-tab]")).toBeNull();
    expect(root.querySelector(".teach-tabs")).toBeNull();

    // Make sure all enabled sections live in the one rail, in order.
    if (!rail!.querySelector('[data-teach-pane="brief"]')) {
      root.querySelector<HTMLButtonElement>("[data-brief-toggle]")!.click();
    }
    const panes = [...rail!.querySelectorAll(":scope > .teach-pane")].map((el) => el.getAttribute("data-teach-pane"));
    expect(panes[0]).toBe("coach");

    // A scroll position on the single rail survives a re-render.
    const liveRail = root.querySelector<HTMLElement>("[data-teach-rail]")!;
    liveRail.scrollTop = 72;
    window.scrollTo(0, 140);

    // Toggling a section (re-render) must keep the rail and window scroll put.
    root.querySelector<HTMLButtonElement>("[data-reasons-toggle]")!.click();
    expect(window.scrollY).toBe(140);
    expect(root.querySelector<HTMLElement>("[data-teach-rail]")?.scrollTop).toBe(72);

    root.remove();
  });
});
