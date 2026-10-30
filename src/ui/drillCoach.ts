import { availableActions, def, highlightSet, type CoachAdvice, type GameState } from "../engine";
import { allyStrength, heroStrength, vanquishClashMath } from "../engine/queries";
import type { DrillRun } from "./learning";

/** Small, setup-specific guidance. Its highlights must be legal in the real reducer. */
export function drillAdvice(run: DrillRun, state: GameState): CoachAdvice {
  const legal = highlightSet(state);
  const p = state.pending;
  const target = state.locations.jollyRoger.heroes.find((c) => c.defId === (run.drill.id === "ship-clash" ? "peterPan" : "tinkerBell"));
  const crewStrength = state.locations.jollyRoger.allies.reduce((sum, ally) => sum + allyStrength(state, ally), 0);
  const need = target ? heroStrength(state, target) : 0;
  const why = run.drill.id === "escort" ? run.setup.takeaway
    : run.setup.id === "clash-dust" && crewStrength < need
      ? `Peter’s current Strength is ${need}; the crew totals ${crewStrength}. The Cutlass adds 2 to an Ally and costs 1 Power. Prepare that extra Strength before trying the clash.`
      : target ? `${def(target.defId).name} is currently Strength ${need}. The ship crew totals ${crewStrength}. Commit enough to meet the Hero; each Ally you use is discarded with the defeated Hero.`
        : run.setup.takeaway;
  const buttonLegal = (key: string) => (key === "btn:ack" && p?.kind === "fateReport") ||
    (key === "btn:pay-power" && p?.kind === "playChoosePayment" && state.power >= 1) ||
    (key === "btn:confirm" && Boolean(vanquishClashMath(state)?.ready));
  const say = (key: string | undefined, line: string): CoachAdvice => key && (legal.has(key) || buttonLegal(key))
    ? { do: line, why, highlights: [key] }
    : { do: "This setup has changed. Restart this setup to practise its original plan.", why: run.setup.takeaway, highlights: [] };
  if (p?.kind === "fateReport") return say("btn:ack", "Read what Fate changed, then click Continue.");
  if (run.drill.id === "escort") {
    if (p?.kind === "moveHeroSelect") {
      const peter = Object.values(state.locations).flatMap((loc) => loc.heroes).find((c) => c.defId === "peterPan");
      return say(peter ? `card:${peter.instanceId}` : undefined, "Click Peter Pan, the Hero you are escorting.");
    }
    if (p?.kind === "moveHeroDest") {
      const destination = state.peterPanLocation === "mermaidLagoon" ? "skullRock" : "jollyRoger";
      return say(`loc:${destination}`, `Choose this place: ${destination === "skullRock" ? "Skull Rock" : "Jolly Roger"}.`);
    }
    const action = availableActions(state).find((a) => a.kind === "moveHero" && a.available);
    return say(action ? `act:${action.key}` : undefined, `Click ${action?.label ?? "Move a Hero"}. This moves Peter, not Hook.`);
  }
  if (p?.kind === "playChooseCard") {
    const cutlass = state.hand.find((c) => c.defId === "cutlass");
    return say(cutlass ? `card:${cutlass.instanceId}` : undefined, "Click the Cutlass in your hand.");
  }
  if (p?.kind === "playChooseAllyAttach") {
    const brute = state.locations.jollyRoger.allies.find((c) => c.defId === "pirateBrute");
    return say(brute ? `card:${brute.instanceId}` : undefined, "Choose a Pirate Brute to carry the Cutlass.");
  }
  if (p?.kind === "playChoosePayment") return say("btn:pay-power", "Pay 1 Power to finish attaching the Cutlass.");
  if (p?.kind === "vanquishHero") {
    const id = run.drill.id === "ship-clash" ? "peterPan" : "tinkerBell";
    const hero = state.locations.jollyRoger.heroes.find((c) => c.defId === id);
    return say(hero ? `card:${hero.instanceId}` : undefined, `Click ${id === "peterPan" ? "Peter Pan" : "Tinker Bell"}.`);
  }
  if (p?.kind === "vanquishAllies") {
    const clash = vanquishClashMath(state);
    if (clash?.ready) return say("btn:confirm", `Confirm the clash: ${clash.selected} Strength meets ${clash.need}.`);
    const pool = state.locations.jollyRoger.allies.filter((c) => !p.selected.includes(c.instanceId) && legal.has(`card:${c.instanceId}`));
    const ally = run.setup.id === "combat-wendy" ? pool.find((c) => c.defId === "pirateBrute") : pool[0];
    return say(ally ? `card:${ally.instanceId}` : undefined, `Select ${ally ? def(ally.defId).name : "an Ally"} to add its Strength.`);
  }
  if (!p && state.phase === "actions") {
    const peter = state.locations.jollyRoger.heroes.find((c) => c.defId === "peterPan");
    const total = state.locations.jollyRoger.allies.reduce((sum, ally) => sum + allyStrength(state, ally), 0);
    const prepare = run.setup.id === "clash-dust" && peter && total < heroStrength(state, peter);
    const action = availableActions(state).find((a) => a.kind === (prepare ? "playCard" : "vanquish") && a.available);
    return say(action ? `act:${action.key}` : undefined, prepare ? "Click Play a Card to strengthen the crew before the clash." : "Click Vanquish at the Jolly Roger.");
  }
  return say(undefined, "");
}
