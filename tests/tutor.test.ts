import { describe, expect, it } from "vitest";
import { checkedTutorSelection, tutorContext } from "../src/engine/tutor";
import { lessonOpening } from "../src/engine/lesson";
import { barePlayState, putAlly, putHero } from "./helpers";

describe("engine-grounded tutor facts", () => {
  it("never serializes hidden decks, RNG, seed, or private logs", () => {
    const state = lessonOpening();
    state.seed = 123456789;
    state.rng = 987654321;
    state.villainDeck = [{ instanceId: "private-deck-marker", defId: "cannon" }];
    state.fateDeck = [{ instanceId: "private-fate-marker", defId: "wendy" }];
    state.log.push({ id: 999, text: "private-log-marker", tone: "info" });
    const before = structuredClone(state);
    const result = JSON.stringify(tutorContext(state));
    for (const secret of ["123456789", "987654321", "private-deck-marker", "private-fate-marker", "private-log-marker", '"villainDeck"', '"fateDeck"']) expect(result).not.toContain(secret);
    expect(state).toEqual(before);
  });

  it("uses current buffed Strength and exposes the exact Tick Tock trigger", () => {
    const state = barePlayState();
    putHero(state, "wendy", "skullRock");
    const tinker = putHero(state, "tinkerBell", "mermaidLagoon");
    putHero(state, "tickTock", "jollyRoger");
    const smee = putAlly(state, "smee", "jollyRoger");
    state.attachments.push({ attachedTo: smee.instanceId, item: { instanceId: "tutor-cutlass", defId: "cutlass" } });
    state.tempStrength[smee.instanceId] = 3;
    const facts = tutorContext(state).facts;
    expect(facts.find((fact) => fact.id === `hero:${tinker.instanceId}`)?.text).toContain("Current Strength: 3");
    expect(facts.find((fact) => fact.id === `hero:${tinker.instanceId}`)?.text).toContain("+1 because Wendy is in the realm");
    expect(facts.find((fact) => fact.id === "ticktock")?.text).toMatch(/Seating Tick Tock.*does not discard/);
    const crew = facts.find((fact) => fact.id === `ally:${smee.instanceId}`)?.text;
    expect(crew).toContain("Current Strength: 9. Printed Strength: 2.");
    expect(crew).toContain("+2 because Smee is at the Jolly Roger; +2 from Cutlass; +3 temporary Strength this turn");
  });

  it("explains the two-Ally requirement even when one Ally matches Lost Boys' Strength", () => {
    const state = barePlayState();
    const hero = putHero(state, "lostBoys", "jollyRoger");
    const ally = putAlly(state, "pirateBrute", "jollyRoger");
    state.pending = { kind: "vanquishAllies", heroId: hero.instanceId, selected: [ally.instanceId] };
    state.phase = "resolving";
    expect(tutorContext(state).facts.find((fact) => fact.id === "clash")?.text).toMatch(/4 against 4.*at least two Allies; 1 are selected/);
  });

  it("accepts only exact offered facts and refuses freeform or invented model prose", () => {
    const context = tutorContext(lessonOpening());
    expect(checkedTutorSelection({ answerable: true, factIds: ["next", "reason"] }, context)).toEqual({ answerable: true, factIds: ["next", "reason"] });
    for (const value of [
      { answerable: true, factIds: ["invented"] },
      { answerable: true, factIds: ["next"], answer: "Peter wins anywhere" },
      { answerable: true, factIds: ["next", "next"] },
      { answerable: true, factIds: [] },
      { answerable: false, factIds: ["next"] },
      { answerable: true, factIds: ["next", "reason", "map", "objective"] },
    ]) expect(checkedTutorSelection(value, context)).toBeNull();
    expect(checkedTutorSelection({ answerable: false, factIds: [] }, context)).toEqual({ answerable: false, factIds: [] });
  });
});
