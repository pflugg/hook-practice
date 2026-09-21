import type { GameState } from "./types";

export interface EndgameRecap {
  headline: string;
  lead: string;
  steps: string;
  clash: string;
  fate: string;
}

function stepsRecap(state: GameState): string {
  const voyage = state.voyage;
  const parts: string[] = [];
  if (voyage.mapOpened || state.hangmansUnlocked) {
    parts.push("The Never Land Map opened Hangman’s Tree.");
  } else {
    parts.push("Hangman’s Tree stayed locked — the Map was never played.");
  }
  if (voyage.peterSeated || state.peterPanRevealed || state.won) {
    parts.push("Peter Pan was found and seated at Hangman’s Tree.");
  } else {
    parts.push("Peter Pan was never found.");
  }
  const reachedShip =
    state.won || state.peterPanLocation === "jollyRoger" || Boolean(voyage.lastClash?.onShip);
  if (voyage.walkedWest && reachedShip) {
    parts.push("You walked him west, one neighboring place at a time, until he stood on the Jolly Roger.");
  } else if (voyage.walkedWest) {
    parts.push("You started walking him west, one neighboring place at a time.");
  } else if (voyage.peterSeated || state.peterPanRevealed) {
    parts.push("He had not yet been walked west toward the ship.");
  }
  return parts.join(" ");
}

function clashRecap(state: GameState): string {
  const clash = state.voyage.lastClash;
  if (!clash) {
    return "There was no finished clash. A win needs Peter vanquished on the Jolly Roger, with the captain standing there or a Boarding Party reaching that neighboring place, and Ally Strength at least equal to his.";
  }
  const math = `Ally Strength was ${clash.allyStrength} and ${clash.heroName} was ${clash.heroStrength}. Equal Strength is enough — you do not need to go over.`;
  const local =
    clash.reach === "same-place"
      ? `The captain stood at ${clash.captainPlace} with ${clash.heroName}, so the fight was local.`
      : `The captain stood at ${clash.captainPlace}, and a Boarding Party reached ${clash.place} next door. That neighboring reach is what made the clash legal.`;
  if (state.won) {
    return `${clash.heroName} was vanquished at ${clash.place}. ${local} ${math} That clash was legal, and it wins because it happened on the ship.`;
  }
  if (clash.heroName === "Peter Pan" && !clash.onShip) {
    return `The Strength was enough and the place rule was followed. ${local} ${math} It still loses, because Peter was at ${clash.place}, not the Jolly Roger. This practice duel only wins on the ship.`;
  }
  return `${clash.heroName} fell at ${clash.place}. ${local} ${math}`;
}

function fateRecap(state: GameState): string {
  const moments = state.voyage.fateMoments;
  const peter = state.voyage.peterHow.trim();
  const tick = [...moments].reverse().find((line) => /tick tock/i.test(line));
  const latest = moments[moments.length - 1];
  const bits: string[] = [];
  if (peter) bits.push(peter.endsWith(".") ? peter : `${peter}.`);
  if (tick && tick !== peter) bits.push(tick.endsWith(".") ? tick : `${tick}.`);
  else if (!tick && latest && latest !== peter) bits.push(latest.endsWith(".") ? latest : `${latest}.`);
  if (bits.length === 0) {
    return "Fate did not change this finish. No Fate card landed a blow you still had to answer.";
  }
  return bits.join(" ");
}

/** Kid- and parent-friendly end card. Paraphrased play facts only — no published card text. */
export function endgameRecap(state: GameState): EndgameRecap {
  if (state.won) {
    return {
      headline: "The ship is yours",
      lead: "Captain Hook wins. You finished the voyage: the Map opened the hideout, Peter was walked west to the ship, and the clash there was a legal win.",
      steps: stepsRecap(state),
      clash: clashRecap(state),
      fate: fateRecap(state),
    };
  }
  const resigned = /struck the colors/i.test(state.loseReason);
  const offShip = /away from the Jolly Roger/i.test(state.loseReason);
  const lead = resigned
    ? "You struck the colors before the chain was finished. Here is how far the voyage got, so the next one can pick up the lesson."
    : offShip
      ? "This loss is the lesson. Beating Peter away from the Jolly Roger does not finish the objective, even when the Strength is legal."
      : state.loseReason || "The tide turned before the chain was finished.";
  return {
    headline: "The tide turns",
    lead,
    steps: stepsRecap(state),
    clash: clashRecap(state),
    fate: fateRecap(state),
  };
}
