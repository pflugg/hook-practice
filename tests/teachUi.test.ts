/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import {
  easyFizzleScene,
  fateSpentScene,
  obsessionDecideScene,
  payNoMapScene,
  vanquishClashScene,
  vanquishLocalScene,
} from "../src/engine/scenes";
import { renderOverlay, renderPlay } from "../src/ui/app";
import { barePlayState, give, inst, putAlly, putHero, putItem } from "./helpers";

describe("teaching UI for Must fixes", () => {
  it("shows live Vanquish Strength and disables Confirm until the total is met", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const peter = putHero(state, "peterPan", "jollyRoger");
    const brute = putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });

    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("data-clash-meter");
    expect(html).toMatch(/Strength 4 \/ 8 — short/);
    expect(html).not.toContain("data-clash-chip");
    expect(html).toContain("is-clash");
    expect(html).toMatch(/data-confirm[^>]*disabled|disabled[^>]*data-confirm/);
  });

  it("does not mark a remote Hero as a legal Vanquish target", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const wendy = putHero(state, "wendy", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");
    const opened = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    const html = renderPlay(opened, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    const wendyChunk = html.includes(`data-card="${wendy.instanceId}"`)
      ? html.slice(html.indexOf(`data-card="${wendy.instanceId}"`) - 80, html.indexOf(`data-card="${wendy.instanceId}"`) + 120)
      : "";
    expect(wendyChunk).not.toMatch(/is-legal/);
  });

  it("shows the found Hero face-up on Obsession decide", () => {
    const state = barePlayState();
    state.phase = "resolving";
    const hero = inst("tickTock");
    state.heldCard = hero;
    state.pending = { kind: "obsessionDecide", heroId: hero.instanceId, extras: [] };
    const html = renderOverlay(state);
    expect(html).toContain("Obsession");
    expect(html).toContain("Tick Tock");
    expect(html).toMatch(/class="card[^"]*reveal/);
    expect(html).toContain("discard every card in hand");
  });

  it("shows the found Hero face-up while Worthy is seating them", () => {
    const state = barePlayState();
    state.phase = "resolving";
    const hero = inst("wendy");
    state.heldCard = hero;
    state.pending = { kind: "worthyLocation", heroId: hero.instanceId };
    const html = renderOverlay(state);
    expect(html).toContain("Worthy Opponent");
    expect(html).toContain("Wendy");
    expect(html).toMatch(/class="card[^"]*reveal/);
  });

  it("always opens the payment modal for a paid card, even with no Map in the realm", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 3;
    const pack = give(state, "hooksCase");
    let next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: pack.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.pending?.kind).toBe("playChoosePayment");
    expect(next.power).toBe(3);
    expect(next.locations.jollyRoger.items.some((c) => c.defId === "hooksCase")).toBe(false);

    const html = renderOverlay(next);
    expect(html).toContain("Hook");
    expect(html).toContain("2 Power");
    expect(html).toContain("You have");
    expect(html).toContain("3 Power");
    expect(html).not.toContain("data-pay-map");
    expect(html).not.toContain("Map available");

    const paid = applyInput(next, { type: "payWithPower" });
    expect(paid.power).toBe(1);
    expect(paid.locations.jollyRoger.items.some((c) => c.defId === "hooksCase")).toBe(true);
    expect(paid.log.some((e) => /Spent 2 Power on Hook/.test(e.text) && /1 Power left/.test(e.text))).toBe(true);
  });

  it("shows Power, cost, and Map availability on the payment modal", () => {
    const state = barePlayState();
    state.phase = "resolving";
    state.power = 1;
    const cannon = give(state, "cannon");
    putItem(state, "neverLandMap", "jollyRoger");
    state.pending = { kind: "playChoosePayment", cardId: cannon.instanceId, locationId: "skullRock" };
    const html = renderOverlay(state);
    expect(html).toContain("Cannon");
    expect(html).toContain("2 Power");
    expect(html).toContain("You have");
    expect(html).toContain("1 Power");
    expect(html).toContain("Map available");
    expect(html).toMatch(/data-pay-power[^>]*disabled|disabled[^>]*data-pay-power/);
  });

  it("uses honest Fate-discard copy on Give Them a Scare", () => {
    const state = barePlayState();
    state.phase = "resolving";
    state.pending = { kind: "scarePeek", cards: [inst("tickTock"), inst("wendy")] };
    const html = renderOverlay(state);
    expect(html).toContain("Discard both");
    expect(html).toMatch(/Fate discard/);
    expect(html).not.toContain("Banish both");
  });

  it("shows a soft-loss confirm when Peter is named off the ship", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    const cannon = putItem(state, "cannon", "mermaidLagoon");
    const peter = putHero(state, "peterPan", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");
    let next = applyInput(state, { type: "selectAction", actionKey: `extra:${cannon.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    const html = renderOverlay(next);
    expect(html).toContain("loses the practice duel");
    expect(html).toContain("Peter Pan");
    expect(html).toContain("data-cancel");
    expect(html).toContain("Continue anyway");
  });

  it("DEV clash / Obsession / local-vanquish scenes paint the new teaching chrome", () => {
    const clash = renderPlay(vanquishClashScene(), {
      coachEnabled: false,
      briefEnabled: false,
      reasonsEnabled: false,
    });
    expect(clash).toContain("data-clash-meter");
    expect(clash).toMatch(/Strength 4 \/ 8 — short/);

    const obsession = renderOverlay(obsessionDecideScene());
    expect(obsession).toContain("Tick Tock");
    expect(obsession).toMatch(/class="card[^"]*reveal/);

    const local = renderPlay(vanquishLocalScene(), {
      coachEnabled: false,
      briefEnabled: false,
      reasonsEnabled: false,
    });
    expect(local).toMatch(/captain's place|Boarding Party/);
    const wendy = vanquishLocalScene().locations.mermaidLagoon.heroes[0];
    const john = vanquishLocalScene().locations.jollyRoger.heroes[0];
    expect(local).toMatch(new RegExp(`class="card[^"]*is-legal[^"]*"[^>]*data-card="${john.instanceId}"|data-card="${john.instanceId}"[^>]*is-legal`));
    const wendyBit = local.slice(
      local.indexOf(`data-card="${wendy.instanceId}"`) - 90,
      local.indexOf(`data-card="${wendy.instanceId}"`) + 40,
    );
    expect(wendyBit).not.toMatch(/is-legal/);
  });

  it("DEV pay / fate-pick / spent-strip scenes paint the Should-loop chrome", () => {
    const pay = renderOverlay(payNoMapScene());
    expect(pay).toContain("Pay the cost");
    expect(pay).toContain("Hook");
    expect(pay).not.toContain("data-pay-map");

    const pick = renderOverlay(easyFizzleScene());
    expect(pick).toContain("data-fate-choice");
    expect(pick).toMatch(/Easy Fate picked at random/);

    const spent = renderPlay(fateSpentScene(), {
      coachEnabled: false,
      briefEnabled: false,
      reasonsEnabled: false,
    });
    expect(spent).toContain("That Fate is over");
    expect(spent).not.toContain("Taunt clings to Tinker Bell");
  });
});
