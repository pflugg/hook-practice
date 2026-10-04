/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { barePlayState, give, putAlly, putHero } from "./helpers";
import { mount, renderOverlay, renderPlay } from "../src/ui/app";

function boot(scene: string) {
  window.history.replaceState({}, "", scene);
  const root = document.createElement("div");
  document.body.appendChild(root);
  window.scrollTo = (() => undefined) as typeof window.scrollTo;
  mount(root);
  return root;
}

describe("named dialogs", () => {
  it("names payment, loss, Fate, help, and inspect dialogs and focuses the safe choice", () => {
    const pay = barePlayState();
    pay.phase = "resolving";
    pay.power = 0;
    const brute = give(pay, "pirateBrute");
    pay.pending = { kind: "playChoosePayment", cardId: brute.instanceId, locationId: "jollyRoger" };
    const payHtml = renderOverlay(pay);
    expect(payHtml).toContain('role="dialog"');
    expect(payHtml).toContain('aria-labelledby="pay-title"');
    expect(payHtml).toContain(">Pay 3 Power<");
    expect(payHtml).toContain(">Cancel<");
    expect(payHtml).toMatch(/data-cancel[^>]*data-initial-focus|data-initial-focus[^>]*data-cancel/);

    const loss = barePlayState();
    loss.phase = "resolving";
    loss.hangmansUnlocked = true;
    loss.villainLocation = "mermaidLagoon";
    const peter = putHero(loss, "peterPan", "mermaidLagoon");
    loss.pending = { kind: "vanquishConfirmLoss", heroId: peter.instanceId };
    const lossHtml = renderOverlay(loss);
    expect(lossHtml).toContain('aria-labelledby="loss-title"');
    expect(lossHtml).toMatch(/data-cancel[^>]*data-initial-focus|data-initial-focus[^>]*data-cancel/);
    expect(lossHtml).toContain("Continue anyway");

    const offered = barePlayState();
    offered.phase = "resolving";
    const cunning = give(offered, "cunning");
    offered.pending = { kind: "conditionOffer", conditionId: cunning.instanceId, reason: "A Condition is ready." };
    expect(renderOverlay(offered)).toContain(">Not now<");
    expect(renderOverlay(offered)).toContain('aria-labelledby="condition-title"');

    const root = boot("/?scene=peterloss");
    const dialog = root.querySelector("[role=dialog]");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("loss-title");
    expect(document.activeElement).toBe(root.querySelector("[data-initial-focus]"));
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.querySelector("[data-dialog=loss-title]")).toBeNull();
    expect(root.querySelector(".play")).toBeTruthy();
    root.remove();
  });

  it("does not dismiss Fate acknowledgement with Escape", () => {
    const root = boot("/?scene=ticktock");
    expect(root.querySelector("[data-dialog=fate-title]")).toBeTruthy();
    expect(document.activeElement).toBe(root.querySelector("[data-ack]"));
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.querySelector("[data-ack]")).toBeTruthy();
    expect(root.querySelector("[data-dialog=fate-title]")).toBeTruthy();
    root.remove();
  });

  it("names the help dialog and closes it with Escape", () => {
    const root = boot("/");
    root.querySelector<HTMLButtonElement>("[data-help]")!.click();
    expect(root.querySelector("#help-title")?.textContent).toBe("How to play");
    expect(root.querySelector("[role=dialog]")?.getAttribute("aria-modal")).toBe("true");
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.querySelector("#help-title")).toBeNull();
    expect(root.querySelector("[data-tutorial]")).toBeTruthy();
    root.remove();
  });

  it("keeps a locked tree locked and an off-ship confirm cancellable", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    const html = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("is-locked");
    expect(html).toContain("Need: Never Land Map");
    const loss = applyInput(state, { type: "resign" });
    expect(loss.phase).toBe("over");
    const ally = putAlly(barePlayState(), "pirateBrute", "jollyRoger");
    expect(ally.defId).toBe("pirateBrute");
  });
});
