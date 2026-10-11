/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, createGame } from "../src/engine/game";
import { explainSelection } from "../src/engine/moveReason";
import { mapReserveScene } from "../src/engine/scenes";
import type { Input, LocationId } from "../src/engine/types";
import { mount, renderPlay } from "../src/ui/app";
import { resolveBoardClick } from "../src/ui/clicks";
import { barePlayState, inst, pick, putAlly, putHero, attachTo, give } from "./helpers";

function readyShipMove() {
  const state = barePlayState();
  state.phase = "move";
  state.villainLocation = "skullRock";
  state.departedFrom = "jollyRoger";
  state.hangmansUnlocked = true;
  putHero(state, "peterPan", "jollyRoger");
  putAlly(state, "pirateBrute", "jollyRoger");
  putAlly(state, "pirateBrute", "jollyRoger");
  return state;
}

describe("review regression cases", () => {
  it("saves four small Gains for the held Map instead of spending on optional plays", () => {
    let state = mapReserveScene();
    const spent: string[] = [];
    for (let i = 0; i < 50 && !state.hangmansUnlocked; i++) {
      const key = pick(advise(state).highlights[0], "coach highlight");
      let input: Input;
      if (key.startsWith("act:")) input = { type: "selectAction", actionKey: key.slice(4) };
      else if (key.startsWith("loc:")) input = { type: "selectLocation", locationId: key.slice(4) as LocationId };
      else if (key.startsWith("card:")) {
        const card = state.hand.find((c) => c.instanceId === key.slice(5));
        if (card) spent.push(card.defId);
        input = { type: "selectCard", instanceId: key.slice(5) };
      } else if (key === "btn:end") input = { type: "endTurn" };
      else if (key === "btn:pay-power") input = { type: "payWithPower" };
      else throw new Error(`Unexpected Map recovery advice: ${key}`);
      state = applyInput(state, input);
      expect(state.lost).toBe(false);
      expect(state.villainLocation).not.toBe("mermaidLagoon");
    }
    expect(state.hangmansUnlocked).toBe(true);
    expect(state.turn).toBeLessThanOrEqual(13);
    expect(spent).toEqual(["neverLandMap"]);
  });

  it("protects a held Map in a manually opened Play and warns what entering Tick Tock loses", () => {
    const state = mapReserveScene();
    state.power = 3;
    state.pending = { kind: "playChooseCard" };
    state.phase = "resolving";
    expect(advise(state).highlights).toContain("btn:cancel");
    expect(advise(state).why).toMatch(/reserve 4 Power/);
    state.pending = null;
    state.phase = "move";
    expect(advise(state).warning).toMatch(/discards your held Never Land Map/);
  });
  it("keeps the Play-open reason and payment instruction consistent with an Effect", () => {
    const state = barePlayState();
    state.power = 1;
    const effect = give(state, "giveThemAScare");
    state.fateDeck = [inst("michael"), inst("wendy")];
    const opened = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    const reason = explainSelection(state, { type: "selectAction", actionKey: "jr-play" }, opened);
    expect(reason?.next).toMatch(/Effects go directly to payment or effect choices/);
    const paying = applyInput(opened, { type: "selectCard", instanceId: effect.instanceId });
    expect(paying.pending?.kind).toBe("playChoosePayment");
    expect(advise(paying).do).toMatch(/click Pay 1 Power/);
  });
  it("explains an Effect's payment and choices without asking for a shore", () => {
    const state = barePlayState();
    state.power = 1;
    state.pending = { kind: "playChooseCard" };
    state.phase = "resolving";
    const effect = give(state, "giveThemAScare");
    state.fateDeck = [inst("michael"), inst("wendy")];
    const advice = advise(state);
    expect(advice.highlights).toContain(`card:${effect.instanceId}`);
    expect(advice.why).toMatch(/payment or effect choices/);
    expect(advice.why).not.toMatch(/Choose this place/);
  });
  it("keeps horizontal realm and hand positions when a phone decision rerenders", () => {
    window.history.replaceState({}, "", "/?scene=nearwin");
    const root = document.createElement("div");
    document.body.appendChild(root);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
    mount(root);
    root.querySelector<HTMLElement>("[data-realm-map]")!.scrollLeft = 256;
    root.querySelector<HTMLElement>(".hand-row")!.scrollLeft = 174;
    const device = [...root.querySelectorAll<HTMLButtonElement>("button[data-act]")].find((b) => b.textContent?.includes("Move a Hero (Device)"));
    expect(device).toBeTruthy();
    device!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(root.querySelector<HTMLElement>("[data-realm-map]")?.scrollLeft).toBe(256);
    expect(root.querySelector<HTMLElement>(".hand-row")?.scrollLeft).toBe(174);
    root.remove();
  });
  it("takes a winning required move even when it returns to the departed shore", () => {
    const state = readyShipMove();
    const advice = advise(state);
    expect(advice.highlights).toContain("loc:jollyRoger");
    expect(advice.why).toMatch(/finish the clash/);
    let next = applyInput(state, { type: "selectLocation", locationId: "jollyRoger" });
    expect(advise(next).highlights).toContain("act:jr-vanquish");
    next = applyInput(next, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: pick(next.locations.jollyRoger.heroes[0], "ship hero").instanceId });
    for (const ally of next.locations.jollyRoger.allies) {
      next = applyInput(next, { type: "selectCard", instanceId: ally.instanceId });
    }
    next = applyInput(next, { type: "confirm" });
    expect(next.won).toBe(true);
  });

  it("does not claim an immediate win with too little Strength or a remote Taunt", () => {
    const short = readyShipMove();
    short.locations.jollyRoger.allies.pop();
    expect(advise(short).why).not.toMatch(/crew can finish the clash/);
    const blocked = readyShipMove();
    const john = putHero(blocked, "john", "mermaidLagoon");
    attachTo(blocked, "taunt", john.instanceId);
    expect(advise(blocked).why).not.toMatch(/crew can finish the clash/);
  });

  it("still takes a winning move when Tick Tock will empty a dispensable hand", () => {
    const state = readyShipMove();
    putHero(state, "tickTock", "jollyRoger");
    expect(advise(state).highlights).toContain("loc:jollyRoger");
  });

  for (const kind of ["worthyLocation", "obsessionLocation"] as const) {
    it(`resolves ${kind} using visible choices inside the reveal panel`, () => {
      const state = barePlayState();
      const hero = inst("michael");
      state.heldCard = hero;
      state.phase = "resolving";
      state.pending = { kind, heroId: hero.instanceId };
      const root = document.createElement("div");
      root.innerHTML = renderPlay(state);
      const panel = root.querySelector('[data-placement-picker][role="dialog"]');
      expect(panel).toBeTruthy();
      const choices = [...panel!.querySelectorAll<HTMLButtonElement>("button[data-move]")];
      expect(choices.map((b) => b.dataset.move)).toEqual(["jollyRoger", "skullRock", "mermaidLagoon"]);
      expect(root.querySelector('.prompt button[data-move]')).toBeNull();
      const input = resolveBoardClick(pick(choices[0], "move button"), state);
      expect(input).toBeTruthy();
      const next = applyInput(state, input!);
      expect(next.locations.jollyRoger.heroes.some((h) => h.instanceId === hero.instanceId)).toBe(true);
    });
  }

  it("keeps a held Map off Tick Tock when every safe Gain is covered", () => {
    const state = barePlayState();
    state.phase = "move";
    state.power = 2;
    state.villainLocation = "jollyRoger";
    state.departedFrom = null;
    give(state, "neverLandMap");
    give(state, "cutlass");
    give(state, "pirateBrute");
    putHero(state, "wendy", "jollyRoger");
    putHero(state, "john", "skullRock");
    putHero(state, "tickTock", "mermaidLagoon");
    state.fateDeck = [inst("michael"), inst("wendy")];

    const opening = advise(state);
    expect(opening.highlights).not.toContain("loc:mermaidLagoon");
    expect(opening.why).toMatch(/Never Land Map|Safe Gains/);

    let cursor = state;
    for (let i = 0; i < 10 && !cursor.hangmansUnlocked; i++) {
      const key = advise(cursor).highlights[0];
      let input: Input;
      if (!key) break;
      if (key.startsWith("act:")) input = { type: "selectAction", actionKey: key.slice(4) };
      else if (key.startsWith("loc:")) input = { type: "selectLocation", locationId: key.slice(4) as LocationId };
      else if (key.startsWith("card:")) input = { type: "selectCard", instanceId: key.slice(5) };
      else if (key === "btn:end") input = { type: "endTurn" };
      else if (key === "btn:ack") input = { type: "acknowledgeFate" };
      else if (key === "btn:cancel") input = { type: "cancel" };
      else if (key === "btn:pay-power") input = { type: "payWithPower" };
      else break;
      const before = cursor.power;
      cursor = applyInput(cursor, input);
      expect(cursor.villainLocation).not.toBe("mermaidLagoon");
      expect(cursor.lost).toBe(false);
      if (key === "btn:pay-power" || key === "btn:pay-map") {
        throw new Error(`Coach spent Power while the Map reserve was short: ${key}`);
      }
      expect(cursor.power).toBeGreaterThanOrEqual(Math.min(before, 2));
    }
    expect(cursor.hand.some((card) => card.defId === "neverLandMap")).toBe(true);
    expect(cursor.hangmansUnlocked).toBe(false);
    expect(cursor.power).toBeGreaterThanOrEqual(2);
  });

  it("digs with an open Discard when covered Gains leave the Map one Power short", () => {
    const stalled = barePlayState();
    stalled.phase = "actions";
    stalled.power = 3;
    stalled.villainLocation = "skullRock";
    stalled.departedFrom = "jollyRoger";
    stalled.hangmansUnlocked = false;
    stalled.peterPanRevealed = true;
    stalled.peterPanLocation = "hangmansTree";
    putHero(stalled, "peterPan", "hangmansTree");
    putHero(stalled, "lostBoys", "jollyRoger");
    putHero(stalled, "lostBoys", "skullRock");
    putHero(stalled, "tickTock", "mermaidLagoon");
    give(stalled, "neverLandMap");
    give(stalled, "giveThemAScare");
    give(stalled, "ayeAyeSir");

    const advice = advise(stalled);
    expect(advice.do).toMatch(/Discard (Give Them a Scare|Aye Aye Sir)/);
    expect(advice.do).not.toMatch(/Discard Never Land Map at/);
    expect(advice.why).not.toMatch(/No Discard, Gain, or Play is left uncovered/);
    expect(advice.highlights).toContain("act:sr-discard");
    const opened = applyInput(stalled, { type: "selectAction", actionKey: "sr-discard" });
    const picking = advise(opened);
    expect(picking.do).toMatch(/Give Them a Scare|Aye Aye Sir/);
    expect(picking.highlights.join(" ")).not.toMatch(/neverLandMap/);

    let state = createGame("easy", 1059823);
    for (let i = 0; i < 450 && !state.hangmansUnlocked && !state.won && !state.lost; i++) {
      const key = advise(state).highlights[0];
      let input: Input | null = null;
      if (key?.startsWith("act:")) input = { type: "selectAction", actionKey: key.slice(4) };
      else if (key?.startsWith("loc:")) input = { type: "selectLocation", locationId: key.slice(4) as LocationId };
      else if (key?.startsWith("card:")) input = { type: "selectCard", instanceId: key.slice(5) };
      else if (key === "btn:end") input = { type: "endTurn" };
      else if (key === "btn:ack") input = { type: "acknowledgeFate" };
      else if (key === "btn:cancel") input = { type: "cancel" };
      else if (key === "btn:confirm") input = { type: "confirm" };
      else if (key === "btn:pay-power") input = { type: "payWithPower" };
      else if (key === "btn:pay-map") input = { type: "payWithMap" };
      else if (key === "btn:accept-cond") input = { type: "acceptCondition" };
      else if (key === "btn:skip-cond") input = { type: "skipCondition" };
      else if (key === "btn:play-hero") input = { type: "playOrDiscardHero", play: true };
      else if (key === "btn:discard-hero") input = { type: "playOrDiscardHero", play: false };
      else if (key === "btn:scare-discard") input = { type: "scareDiscardBoth" };
      else if (key?.startsWith("btn:scare-order:")) {
        const parts = key.slice("btn:scare-order:".length).split(",");
        input = { type: "scareReturn", order: [pick(parts[0], "scare top"), pick(parts[1], "scare bottom")] };
      }
      expect(input, key).toBeTruthy();
      state = applyInput(state, input!);
      expect(state.lost).toBe(false);
    }
    expect(state.hangmansUnlocked).toBe(true);
    expect(state.turn).toBeLessThan(30);
  });
});
