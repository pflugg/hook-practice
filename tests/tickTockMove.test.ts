import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput } from "../src/engine/game";
import { explainSelection } from "../src/engine/moveReason";
import { tickTockOntoCaptainScene } from "../src/engine/scenes";
import { renderOverlay, renderPlay } from "../src/ui/app";
import { barePlayState, give, inst, putAlly, putHero, putItem } from "./helpers";

describe("Tick Tock snaps only when the captain moves onto the crocodile", () => {
  it("wipes the hand after the captain steps onto Tick Tock", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "move";
    putHero(state, "tickTock", "skullRock");
    const map = give(state, "neverLandMap");
    give(state, "smee");

    const next = applyInput(state, { type: "selectLocation", locationId: "skullRock" });
    expect(next.hand).toHaveLength(0);
    expect(next.villainDiscard.some((c) => c.instanceId === map.instanceId)).toBe(true);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.note).toMatch(/snaps/i);
    expect(next.pending.note).toMatch(/only when the captain moves onto this place/i);
    expect(next.pending.note).not.toMatch(/sharing this place/i);
  });

  it("does not wipe the hand after Move a Hero slides Tick Tock onto the captain", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const tick = putHero(state, "tickTock", "skullRock");
    const device = putItem(state, "ingeniousDevice", "jollyRoger");
    const map = give(state, "neverLandMap");
    give(state, "smee");

    let next = applyInput(state, { type: "selectAction", actionKey: `extra:${device.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: tick.instanceId });
    const beforeSlide = next;
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });

    expect(next.locations.jollyRoger.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(next.hand.length).toBeGreaterThan(0);
    expect(next.hand.some((c) => c.instanceId === map.instanceId)).toBe(true);
    expect(next.pending?.kind).not.toBe("fateReport");
    expect(next.phase).toBe("actions");
    expect(next.log.some((e) => /Tick Tock is moved to Jolly Roger/.test(e.text))).toBe(true);

    const reason = explainSelection(beforeSlide, { type: "selectLocation", locationId: "jollyRoger" }, next);
    expect(reason?.why).not.toMatch(/empties the whole hand/i);
    expect(reason?.why).not.toMatch(/same trap as stepping/i);
  });

  it("does not wipe the hand after Starkey slides Tick Tock onto the captain", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "resolving";
    const tick = putHero(state, "tickTock", "skullRock");
    const starkey = putAlly(state, "mrStarkey", "skullRock");
    give(state, "cannon");
    state.pending = { kind: "starkeyDest", starkeyId: starkey.instanceId, heroId: tick.instanceId };

    const next = applyInput(state, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.locations.jollyRoger.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(next.hand.length).toBeGreaterThan(0);
    expect(next.pending?.kind).not.toBe("fateReport");
  });

  it("does not snap when player Fate seats Tick Tock on the captain", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("john")];
    const smee = give(state, "smee");

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    if (next.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const tick = next.pending.cards.find((c) => c.defId === "tickTock")!;
    next = applyInput(next, { type: "selectCard", instanceId: tick.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "skullRock" });

    expect(next.locations.skullRock.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(next.hand.some((c) => c.instanceId === smee.instanceId)).toBe(true);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.note).not.toMatch(/snaps/i);
    expect(next.pending.markAction).toBe(true);
  });

  it("does not snap when computer Fate seats Tick Tock on the captain", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("wendy")];
    const pack = give(state, "hooksCase");

    const next = applyInput(state, { type: "endTurn" });
    expect(next.locations.mermaidLagoon.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(next.hand.some((c) => c.instanceId === pack.instanceId)).toBe(true);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.note).toMatch(/Mermaid Lagoon/);
    expect(next.pending.note).not.toMatch(/snaps/i);
    expect(next.pending.note).not.toMatch(/mermaidLagoon/);
  });

  it("DEV crocmove scene seats Tick Tock on the captain without snapping", () => {
    const scene = tickTockOntoCaptainScene();
    expect(scene.pending?.kind).toBe("moveHeroDest");
    expect(scene.hand.length).toBeGreaterThan(0);

    const advice = advise(scene);
    expect(advice.highlights).not.toContain("loc:jollyRoger");
    expect(advice.warning ?? "").not.toMatch(/empties the hand/i);
    expect(advice.warning ?? "").not.toMatch(/slide Tick Tock onto the captain/i);

    const html = renderPlay(scene);
    expect(html).toContain("Tick Tock");
    expect(html).toMatch(/Jolly Roger/);
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/jollyRoger|skullRock|mermaidLagoon|hangmansTree/);

    const seated = applyInput(scene, { type: "selectLocation", locationId: "jollyRoger" });
    expect(seated.locations.jollyRoger.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(seated.hand.length).toBeGreaterThan(0);
    expect(seated.pending?.kind).not.toBe("fateReport");
    expect(renderOverlay(seated)).not.toMatch(/Tick Tock snaps/);
  });
});
