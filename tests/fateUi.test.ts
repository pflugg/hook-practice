/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { tickTockReportScene } from "../src/engine/scenes";
import { renderOverlay } from "../src/ui/app";

describe("Fate intervening overlay", () => {
  it("shows Tick Tock's full paraphrased text and a Continue control", () => {
    const state = tickTockReportScene();
    const html = renderOverlay(state);
    expect(html).toContain("discard every card in hand");
    expect(html).toContain("Tick Tock");
    expect(html).toContain("What it does");
    expect(html).toContain("data-ack");
    expect(html).toContain("Continue");
    expect(html).toMatch(/class="card[^"]*reveal/);
    expect(html).toContain("Fate intervening");
  });
});
