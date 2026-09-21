import { def } from "./cards";
import { adjacentIds, locName } from "./realm";
import {
  allAllies,
  allHeroes,
  allLocationItems,
  allyStrength,
  attachableHeroes,
  availableActions,
  canPlayCunning,
  cardName,
  coveringHero,
  findCard,
  findCardLocation,
  heroStrength,
  adjacentUnlocked,
  legalMoveLocations,
  legalPlayLocations,
  mapInHand,
  mapInRealm,
  movableAlliesAndItems,
  movableHeroes,
  playableHandCards,
  anyTauntInRealm,
  clashAndCrocLine,
  cutlassStrapLine,
  preferredAttachAlly,
  vanquishAllyPool,
  vanquishBlockedReason,
  vanquishableHeroes,
} from "./queries";
import { highlightSet } from "./game";
import { LOCATION_IDS, type ActionSlot, type CardInstance, type GameState, type LocationId } from "./types";

export interface CoachAdvice {
  do: string;
  why: string;
  highlights: string[];
  warning?: string;
}

function towardRoger(from: LocationId): LocationId | null {
  const i = LOCATION_IDS.indexOf(from);
  if (i <= 0) return null;
  return LOCATION_IDS[i - 1];
}

function tickTockAt(state: GameState): LocationId | null {
  for (const id of LOCATION_IDS) {
    if (state.locations[id].heroes.some((h) => h.defId === "tickTock")) return id;
  }
  return null;
}

function jrStrength(state: GameState): number {
  return state.locations.jollyRoger.allies.reduce((sum, ally) => sum + allyStrength(state, ally), 0);
}

function peterCard(state: GameState): { hero: CardInstance; location: LocationId } | null {
  return allHeroes(state).find((h) => h.hero.defId === "peterPan") ?? null;
}

function peterReadyToFinish(state: GameState): boolean {
  const peter = peterCard(state);
  if (!peter || peter.location !== "jollyRoger") return false;
  return vanquishableHeroes(state).some((h) => h.hero.defId === "peterPan");
}

function slotsAt(state: GameState, id: LocationId): ActionSlot[] {
  return availableActions({ ...state, villainLocation: id }, { asIfOnActionStretch: true });
}

function liveSlots(state: GameState, id: LocationId): ActionSlot[] {
  return slotsAt(state, id).filter((a) => a.available);
}

function hasKind(state: GameState, id: LocationId, kind: ActionSlot["kind"]): ActionSlot | undefined {
  return liveSlots(state, id).find((a) => a.kind === kind);
}

function playableMap(state: GameState): CardInstance | null {
  const map = mapInHand(state);
  if (!map) return null;
  return playableHandCards(state).some((c) => c.instanceId === map.instanceId) ? map : null;
}

function needPowerForMap(state: GameState): boolean {
  if (state.hangmansUnlocked) return false;
  const map = mapInHand(state);
  if (!map) return false;
  return state.power < def(map.defId).cost;
}

function wantEarlyPower(state: GameState): boolean {
  return !state.hangmansUnlocked && state.power < 4;
}

/** Power is short and the Map is not in the realm to cover an Item. */
function cannotPay(state: GameState, card: CardInstance): boolean {
  const d = def(card.defId);
  if (d.type === "condition" || d.cost <= 0) return false;
  if (d.cost <= state.power) return false;
  if (d.type === "item" && mapInRealm(state)) return false;
  return true;
}

function canPayNow(state: GameState, card: CardInstance): boolean {
  const d = def(card.defId);
  if (d.type === "condition") return false;
  return !cannotPay(state, card);
}

/** Hand has pays, and none of them can be played with current Power (Map substitute included). */
function handHasOnlyUnaffordablePays(state: GameState): boolean {
  if (playableHandCards(state).length > 0) return false;
  return state.hand.some((card) => cannotPay(state, card));
}

function cheapestUnaffordable(state: GameState): CardInstance | null {
  const cards = state.hand.filter((card) => cannotPay(state, card));
  cards.sort((a, b) => def(a.defId).cost - def(b.defId).cost);
  return cards[0] ?? null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namesUnaffordablePlay(state: GameState, text: string): CardInstance | null {
  for (const card of state.hand) {
    if (!cannotPay(state, card)) continue;
    if (new RegExp(`Play ${escapeRegExp(cardName(card))}\\b`, "i").test(text)) return card;
  }
  return null;
}

function diggingForMap(state: GameState): boolean {
  return !state.hangmansUnlocked && !mapInHand(state);
}

const DISCARD_KEEP = 1_000;

function isDeadCondition(state: GameState, card: CardInstance): boolean {
  if (card.defId === "obsession") return state.peterPanRevealed;
  if (card.defId === "cunning") return !canPlayCunning(state);
  return false;
}

/** Lower rank is tossed first. Keepers sit at DISCARD_KEEP and above. */
function discardRank(state: GameState, card: CardInstance): number {
  const d = def(card.defId);
  if (card.defId === "neverLandMap") return 10_000;
  if (card.defId === "cunning" && canPlayCunning(state)) return 8_000;
  if (d.type === "ally" && canPlayCunning(state)) return 4_500 + d.strength;
  if (
    card.defId === "obsession" &&
    !state.peterPanRevealed &&
    !handHasOnlyUnaffordablePays(state) &&
    !diggingForMap(state)
  ) {
    return 7_000;
  }
  if (isDeadCondition(state, card)) return 0;
  if (d.type === "condition") return 20;
  if (!state.peterPanRevealed && (card.defId === "worthyOpponent" || card.defId === "giveThemAScare")) {
    return canPayNow(state, card) ? 6_000 : 320;
  }
  if (
    state.peterPanRevealed &&
    state.peterPanLocation !== "jollyRoger" &&
    (card.defId === "ingeniousDevice" || card.defId === "mrStarkey" || card.defId === "ayeAyeSir")
  ) {
    return canPayNow(state, card) ? 5_500 : 280;
  }
  if (d.type === "ally" && jrStrength(state) < 8 && canPayNow(state, card)) return 5_000 + d.strength;
  if (d.type === "ally" && cannotPay(state, card)) return 100 + d.strength;
  if (cannotPay(state, card)) return 80 + d.cost;
  return 400 + d.cost;
}

function discardPicks(state: GameState, skip: string[] = []): CardInstance[] {
  const ranked = state.hand
    .filter((card) => !skip.includes(card.instanceId))
    .sort((a, b) => discardRank(state, a) - discardRank(state, b) || cardName(a).localeCompare(cardName(b)));
  const pick = ranked.find((card) => discardRank(state, card) < DISCARD_KEEP);
  return pick ? [pick] : [];
}

function wantsNamedDiscard(state: GameState): boolean {
  if (discardPicks(state).length === 0) return false;
  if (handHasOnlyUnaffordablePays(state) || diggingForMap(state)) return true;
  if (state.hand.some((card) => isDeadCondition(state, card))) return true;
  return jrStrength(state) < 8 && state.hand.some((card) => def(card.defId).type === "ally" && cannotPay(state, card));
}

function discardDo(state: GameState, where: string): string {
  const pick = discardPicks(state)[0];
  const name = pick ? cardName(pick) : "";
  return name
    ? `Take Discard at ${where} (click that action), then click ${name} in your hand, then Confirm.`
    : `Take Discard at ${where} (click that action), then Confirm.`;
}

function discardWhy(state: GameState, picks: CardInstance[]): string {
  const name = picks.map((card) => cardName(card)).join(" and ");
  const pricey = cheapestUnaffordable(state);
  const powerLine = pricey
    ? `You have ${state.power} Power; ${cardName(pricey)} costs ${def(pricey.defId).cost}.`
    : `You have ${state.power} Power.`;
  const deadLine = picks.some((card) => isDeadCondition(state, card)) ? ` ${name} no longer serves this objective.` : "";
  const goal = !state.hangmansUnlocked
    ? "cheaper crew and the Map"
    : jrStrength(state) < 8
      ? "cheaper crew"
      : "the next card that serves the chain";
  return `${powerLine}${deadLine} Discard ${name} to dig toward ${goal}.`;
}

function parkHeroLocation(state: GameState, hero: CardInstance): LocationId {
  const legal = legalPlayLocations(state);
  if (hero.defId === "tickTock") {
    const quiet = legal.find((id) => id !== "mermaidLagoon" && id !== "hangmansTree" && id !== state.villainLocation);
    return quiet ?? legal[0] ?? "jollyRoger";
  }
  const avoid = new Set<LocationId>();
  if (needPowerForMap(state) || playableMap(state)) avoid.add("mermaidLagoon");
  if (state.peterPanRevealed && state.hangmansUnlocked && state.peterPanLocation !== "jollyRoger") {
    avoid.add("hangmansTree");
  }
  return legal.find((id) => !avoid.has(id)) ?? legal[0] ?? "jollyRoger";
}

function bestAllyHome(state: GameState): LocationId {
  const legal = legalPlayLocations(state);
  if (legal.includes("jollyRoger")) return "jollyRoger";
  return legal.includes(state.villainLocation) ? state.villainLocation : (legal[0] ?? "jollyRoger");
}

function warningFor(state: GameState, highlights: string[]): string | undefined {
  const notes: string[] = [];
  const croc = tickTockAt(state);
  const pair = clashAndCrocLine(state);
  if (
    state.phase === "actions" &&
    anyTauntInRealm(state) &&
    vanquishableHeroes(state).length === 0 &&
    availableActions(state).some((a) => a.kind === "vanquish" && !a.used && !a.covered)
  ) {
    notes.push(vanquishBlockedReason(state));
  }
  if (pair) {
    notes.push(pair);
  } else if (croc && state.phase === "move") {
    notes.push(
      `Tick Tock waits at ${locName(croc)} — if the captain moves onto that place, the whole hand is discarded. Seating or sliding the crocodile onto the captain does not empty the hand.`,
    );
  }
  const covering = coveringHero(state, state.villainLocation);
  if (covering && state.phase === "actions") {
    const name = cardName(covering);
    notes.push(`${name} is covering the top actions here, so those buttons stay dark until the Hero leaves.`);
  }
  const peter = peterCard(state);
  if (peter && peter.location !== "jollyRoger" && highlights.some((h) => h.startsWith("act:") && h.includes("moveHero") || h === `card:${peter.hero.instanceId}`)) {
    if (jrStrength(state) < heroStrength(state, peter.hero)) {
      notes.push("Crew at the Jolly Roger is still light. Keep stacking Allies so the clash is ready when he arrives.");
    }
  }
  if (highlights.some((h) => croc && h === `loc:${croc}`)) {
    notes.unshift("That recommended step lands on Tick Tock. Only go if you accept an empty hand.");
  }
  return notes[0];
}

const BOARDING_REACH_WHY =
  "Boarding Party’s neighboring reach is the exception: that crew may join a clash at the captain’s place or one unlocked step away. Other Allies cannot be spent on a Hero the captain is not standing beside.";

function withReach(why: string, state: GameState, heroLoc: LocationId | null | undefined): string {
  if (!heroLoc || heroLoc === state.villainLocation) return why;
  if (why.includes("neighboring reach")) return why;
  return `${why} ${BOARDING_REACH_WHY}`;
}

function say(next: string, why: string, highlights: string[], state: GameState): CoachAdvice {
  const warning = warningFor(state, highlights);
  return warning ? { do: next, why, highlights, warning } : { do: next, why, highlights };
}

function scoreMove(state: GameState, id: LocationId): number {
  if (tickTockAt(state) === id) return -10_000;
  let score = 0;
  const play = hasKind(state, id, "playCard");
  const gain = liveSlots(state, id).filter((a) => a.kind === "gainPower");
  const discard = hasKind(state, id, "discard");
  const fate = hasKind(state, id, "fate");
  const moveHero = hasKind(state, id, "moveHero") || liveSlots(state, id).some((a) => a.kind === "moveHero");
  const vanquish = hasKind(state, id, "vanquish");
  const gainAmt = gain.reduce((n, a) => n + (a.amount ?? 1), 0);

  if (peterReadyToFinish(state) && vanquish) score += 1200;
  const peter = peterCard(state);
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger" && moveHero) score += 900;
  if (playableMap(state) && play) score += 700;
  const blocked = handHasOnlyUnaffordablePays(state);
  if (blocked) score += gainAmt * 180;
  else if (needPowerForMap(state) || wantEarlyPower(state)) score += gainAmt * 120;
  if (diggingForMap(state) && discard) score += state.power >= 4 ? 380 : 70;
  if (blocked && discard && gainAmt === 0) score += 220;
  if (!state.peterPanRevealed && fate && !blocked) score += state.hangmansUnlocked ? 360 : 40;
  if (jrStrength(state) < 8 && play && state.hand.some((c) => def(c.defId).type === "ally" && def(c.defId).cost <= state.power + gainAmt)) {
    score += id === "jollyRoger" ? 280 : 120;
  }
  if (state.peterPanRevealed && state.hangmansUnlocked && peter?.location !== "jollyRoger") {
    const deviceHere = state.locations[id].items.some((c) => c.defId === "ingeniousDevice");
    if (deviceHere) score += 850;
  }
  if (coveringHero(state, id) && play && play.row === "top") score -= 40;
  if (id === "mermaidLagoon") score += 12;
  return score;
}

function pickMove(state: GameState): LocationId {
  const legal = legalMoveLocations(state);
  const ranked = [...legal].sort((a, b) => scoreMove(state, b) - scoreMove(state, a));
  return ranked[0] ?? legal[0] ?? "skullRock";
}

function placeVerb(id: LocationId): string {
  switch (id) {
    case "jollyRoger":
      return "Choose this place on the ship";
    case "skullRock":
      return "Choose this place on Skull Rock";
    case "mermaidLagoon":
      return "Choose this place on the lagoon";
    case "hangmansTree":
      return "Choose this place on Hangman’s Tree";
  }
}

function playHome(state: GameState, card: CardInstance): LocationId {
  const legal = legalPlayLocations(state);
  if (def(card.defId).type === "ally" || card.defId === "cannon" || card.defId === "hooksCase") {
    const home = bestAllyHome(state);
    return legal.includes(home) ? home : (legal[0] ?? "jollyRoger");
  }
  if (legal.includes(state.villainLocation)) return state.villainLocation;
  return legal[0] ?? "jollyRoger";
}

function peterStep(state: GameState): { from: LocationId; dest: LocationId } | null {
  const peter = peterCard(state);
  if (!peter) return null;
  const dest = towardRoger(peter.location);
  if (!dest || !adjacentUnlocked(state, peter.location).includes(dest)) return null;
  return { from: peter.location, dest };
}

function playCta(state: GameState, card: CardInstance, phase: "open" | "pick" | "place"): string {
  const name = cardName(card);
  const d = def(card.defId);
  if (d.id === "cutlass") {
    const host = preferredAttachAlly(state);
    if (!host) {
      const need = cutlassStrapLine(state);
      if (phase === "open") return `Play ${name} (click Play a Card, then click ${name} in your hand). ${need}`;
      return need;
    }
    const ally = cardName(host.ally);
    const place = host.location === "jollyRoger" ? "the Jolly Roger" : locName(host.location);
    const how = `click ${ally} in the ally picker / drag Cutlass onto ${ally}`;
    if (phase === "open") {
      return `Play ${name} and strap it to ${ally} at ${place} (click Play a Card, then click ${name} in your hand, then ${how}).`;
    }
    if (phase === "pick") {
      return `Play ${name} and strap it to ${ally} at ${place} (click ${name} in your hand, then ${how}).`;
    }
    return cutlassStrapLine(state);
  }
  if (d.type === "effect") {
    const pay = d.cost > 0 ? ", then click Pay with Power" : "";
    if (phase === "open") return `Play ${name} (click Play a Card, then click ${name} in your hand${pay}).`;
    return `Play ${name} (click ${name} in your hand${pay}).`;
  }
  const dest = playHome(state, card);
  const place = placeVerb(dest);
  if (phase === "open") {
    return `Play ${name} to ${locName(dest)} (click Play a Card, then click ${name} in your hand, then ${place}).`;
  }
  if (phase === "pick") {
    return `Play ${name} to ${locName(dest)} (click ${name} in your hand, then ${place}).`;
  }
  return `Play ${name} to ${locName(dest)} (click ${place}).`;
}

function plannedAfterMove(state: GameState, dest: LocationId): string {
  const next: GameState = { ...state, villainLocation: dest, usedActions: [], pending: null, phase: "actions" };
  const pick = pickAction(next);
  if (!pick || pick === "end") {
    return "then End the turn if no uncovered action still serves the chain";
  }
  if (pick.kind === "moveHero") {
    const step = peterStep(next);
    return step
      ? `then take Move a Hero to slide Peter Pan one step toward the ship (${locName(step.from)} → ${locName(step.dest)})`
      : "then take Move a Hero to slide Peter Pan one unlocked step toward the Jolly Roger";
  }
  if (pick.kind === "playCard") {
    const card = usefulPlay(next);
    if (card && canPayNow(next, card)) {
      const d = def(card.defId);
      if (d.id === "cutlass") {
        const host = preferredAttachAlly(next);
        return host
          ? `then ${cutlassStrapLine(next)}`
          : `then play ${cardName(card)}`;
      }
      if (d.type === "effect") return `then play ${cardName(card)}`;
      return `then play ${cardName(card)} to ${locName(playHome(next, card))}`;
    }
    const gains = liveSlots(next, dest)
      .filter((a) => a.kind === "gainPower")
      .sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    if (gains[0]) return `then take ${gains[0].label}`;
    if (hasKind(next, dest, "discard") && discardPicks(next)[0]) {
      return `then ${discardDo(next, locName(dest)).replace(/\.$/, "")}`;
    }
    return "then bank Power before you play";
  }
  if (pick.kind === "gainPower") return `then take ${pick.label}`;
  if (pick.kind === "vanquish") {
    const targets = vanquishableHeroes(next);
    const peter = targets.find((h) => h.hero.defId === "peterPan" && h.location === "jollyRoger");
    const hero = peter ?? targets[0];
    return hero
      ? `then take Vanquish and click ${cardName(hero.hero)} at ${locName(hero.location)}`
      : "then take Vanquish";
  }
  if (pick.kind === "discard") {
    return `then ${discardDo(next, locName(dest)).replace(/\.$/, "")}`;
  }
  if (pick.kind === "fate") return "then take Fate (practice self-Fate)";
  if (pick.kind === "moveItemAlly") {
    const piece = movableAlliesAndItems(next).find(
      (c) => def(c.defId).type === "ally" && findCardLocation(next, c.instanceId) !== "jollyRoger",
    );
    return piece ? `then take Move Ally/Item and click ${cardName(piece)} toward the ship` : "then take Move Ally/Item";
  }
  return `then take ${pick.label}`;
}

function fullActionDo(state: GameState, slot: ActionSlot): string {
  const here = locName(state.villainLocation);
  switch (slot.kind) {
    case "playCard": {
      const card = usefulPlay(state) ?? playableHandCards(state)[0];
      if (card) return playCta(state, card, "open");
      return `Take Play a Card at ${here} (click that action), then click a glowing card in your hand.`;
    }
    case "moveHero": {
      const step = peterStep(state);
      if (step && movableHeroes(state).some((h) => h.defId === "peterPan")) {
        return `Take ${slot.label} at ${here} (click that action), then click Peter Pan and ${placeVerb(step.dest)} to slide him one step toward the Jolly Roger.`;
      }
      const hero = movableHeroes(state)[0];
      return hero
        ? `Take ${slot.label} at ${here} (click that action), then click ${cardName(hero)} and Choose this place on a glowing adjacent square.`
        : `Take ${slot.label} at ${here} (click that action).`;
    }
    case "gainPower":
      return `Take ${slot.label} at ${here} (click that action token).`;
    case "vanquish": {
      const targets = vanquishableHeroes(state);
      const peter = targets.find((h) => h.hero.defId === "peterPan" && h.location === "jollyRoger");
      const hero = peter ?? targets[0];
      return hero
        ? `Take Vanquish at ${here} (click that action), then click ${cardName(hero.hero)} at ${locName(hero.location)}, tap Allies until Strength meets the Hero, then Confirm.`
        : `Take Vanquish at ${here} (click that action).`;
    }
    case "discard":
      return discardDo(state, here);
    case "fate":
      return `Take Fate at ${here} (click that action). Play Peter Pan if he appears — he lands at Hangman’s Tree.`;
    case "moveItemAlly": {
      const pieces = movableAlliesAndItems(state);
      const ally = pieces
        .filter((c) => def(c.defId).type === "ally")
        .map((c) => ({ c, loc: findCardLocation(state, c.instanceId)! }))
        .filter((x) => x.loc && x.loc !== "jollyRoger" && towardRoger(x.loc))
        .sort((a, b) => LOCATION_IDS.indexOf(b.loc) - LOCATION_IDS.indexOf(a.loc))[0];
      const pick = ally ?? (pieces[0] ? { c: pieces[0], loc: findCardLocation(state, pieces[0].instanceId) } : null);
      const dest = pick?.loc ? towardRoger(pick.loc) : null;
      return pick
        ? `Take Move Ally/Item at ${here} (click that action), then click ${cardName(pick.c)} at ${pick.loc ? locName(pick.loc) : "this place"} and ${dest ? placeVerb(dest) : `Choose this place on ${locName("jollyRoger")}`} to slide toward the Jolly Roger.`
        : `Take Move Ally/Item at ${here} (click that action).`;
    }
    default:
      return `Take ${slot.label} at ${here} (click that action).`;
  }
}

function moveWhy(state: GameState, dest: LocationId): string {
  const peter = peterCard(state);
  if (peterReadyToFinish(state) && dest === "jollyRoger") {
    return "Peter is already on the ship and your crew can finish the clash. Take the Vanquish action there — that is the only place the win counts.";
  }
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger" && hasKind(state, dest, "moveHero")) {
    const step = peterStep(state);
    return step
      ? `The tree is open and Peter is at ${locName(step.from)}. After you land, click Move a Hero, then Peter Pan, then ${placeVerb(step.dest)} (${locName(step.from)} → ${locName(step.dest)}).`
      : "The tree is open and Peter is ashore. After you land, click Move a Hero, then Peter Pan, then the glowing square toward the Jolly Roger.";
  }
  if (playableMap(state) && hasKind(state, dest, "playCard")) {
    return "You are holding the Never Land Map with enough Power. After you land, click Play a Card, then the Map in your hand, then Choose this place on any unlocked square.";
  }
  if (needPowerForMap(state) && dest === "mermaidLagoon") {
    return "Gain 3 Power here — you are holding the Never Land Map and still need 4 to play it.";
  }
  if (wantEarlyPower(state) && dest === "mermaidLagoon") {
    return "Gain 3 here is the richest Power bank. Keep a reserve so the next Item or Ally you draw is playable.";
  }
  const pricey = cheapestUnaffordable(state);
  if (pricey && handHasOnlyUnaffordablePays(state) && hasKind(state, dest, "gainPower")) {
    const cost = def(pricey.defId).cost;
    return `Save ${cardName(pricey)} for when you have ${cost} Power. This stop can bank Power before that card is a real Play.`;
  }
  const toss = discardPicks(state);
  if (toss[0] && hasKind(state, dest, "discard") && wantsNamedDiscard(state)) {
    return `${discardWhy(state, toss)} After you land, click Discard at ${locName(dest)}, then click ${cardName(toss[0])} in your hand.`;
  }
  if (diggingForMap(state) && hasKind(state, dest, "discard")) {
    return "The Map is still in the deck. A Discard action lets you dig for it so the tree can open.";
  }
  if (!state.peterPanRevealed && hasKind(state, dest, "fate")) {
    return "Peter is still hidden. Hunt cards, or being Fated, can find him. In this practice tool your Fate action is self-Fate — at a table it would hit another villain.";
  }
  return "Every turn starts with a required move. This stop lines up the next useful action on the Map → Tree → Peter → ship chain.";
}

function adviseMove(state: GameState): CoachAdvice {
  const dest = pickMove(state);
  return say(
    `Move to ${locName(dest)} (click Move here on ${locName(dest)}), ${plannedAfterMove(state, dest)}.`,
    moveWhy(state, dest),
    [`loc:${dest}`],
    state,
  );
}

function usefulPlay(state: GameState): CardInstance | null {
  const playable = playableHandCards(state).filter((card) => canPayNow(state, card));
  const map = playable.find((c) => c.defId === "neverLandMap");
  if (map) return map;
  if (!state.peterPanRevealed) {
    const hunt = playable.find((c) => c.defId === "worthyOpponent" || c.defId === "giveThemAScare");
    if (hunt) return hunt;
  }
  if (state.peterPanRevealed && state.hangmansUnlocked && state.peterPanLocation !== "jollyRoger") {
    const escort = playable.find((c) => c.defId === "ingeniousDevice" || c.defId === "mrStarkey" || c.defId === "ayeAyeSir");
    if (escort) return escort;
  }
  if (jrStrength(state) < 8) {
    const allies = playable
      .filter((c) => def(c.defId).type === "ally")
      .sort((a, b) => def(b.defId).strength - def(a.defId).strength);
    if (allies[0]) return allies[0];
  }
  const item = playable.find((c) => def(c.defId).type === "item" && c.defId !== "neverLandMap");
  if (item) return item;
  return playable[0] ?? null;
}

function liveActions(state: GameState): ActionSlot[] {
  return availableActions(state).filter((a) => a.available);
}

function pickAction(state: GameState): ActionSlot | "end" | null {
  const acts = liveActions(state);
  if (acts.length === 0) return "end";

  const find = (kind: ActionSlot["kind"]) => acts.find((a) => a.kind === kind);

  if (peterReadyToFinish(state)) {
    const v = find("vanquish");
    if (v) return v;
  }

  const peter = peterCard(state);
  if (peter && peter.location === "jollyRoger" && anyTauntInRealm(state) && !peterReadyToFinish(state)) {
    const mh = find("moveHero");
    if (mh && mh.available && movableHeroes(state).length > 0) return mh;
    const escort = usefulPlay(state);
    if (escort && (escort.defId === "ingeniousDevice" || escort.defId === "ayeAyeSir" || escort.defId === "mrStarkey") && find("playCard")) {
      return find("playCard")!;
    }
  }
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger") {
    const mh = find("moveHero");
    if (mh && mh.available && movableHeroes(state).some((h) => h.defId === "peterPan")) return mh;
  }

  if (playableMap(state)) {
    const play = find("playCard");
    if (play) return play;
  }

  const blocked = handHasOnlyUnaffordablePays(state);

  if (needPowerForMap(state) || blocked || (wantEarlyPower(state) && !playableMap(state) && !usefulPlay(state))) {
    const gains = acts.filter((a) => a.kind === "gainPower").sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    if (gains[0] && state.power + (gains[0].amount ?? 1) <= 12) return gains[0];
  }

  const card = usefulPlay(state);
  if (card && canPayNow(state, card) && find("playCard")) return find("playCard")!;

  if (find("discard") && wantsNamedDiscard(state)) return find("discard")!;

  // Fate is a hunt for Peter, not a stand-in for a card the captain cannot pay.
  if (!blocked && !state.peterPanRevealed && find("fate")) return find("fate")!;

  const tick = tickTockAt(state);
  if (tick && find("vanquish") && vanquishableHeroes(state).some((h) => h.hero.defId === "tickTock")) {
    return find("vanquish")!;
  }

  if (jrStrength(state) < 8 && find("moveItemAlly") && movableAlliesAndItems(state).some((c) => def(c.defId).type === "ally" && findCardLocation(state, c.instanceId) !== "jollyRoger")) {
    return find("moveItemAlly")!;
  }

  if (!blocked && card && canPayNow(state, card) && find("playCard")) {
    return find("playCard")!;
  }

  const leftoverGain = acts.filter((a) => a.kind === "gainPower").sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1))[0];
  if (leftoverGain && state.power < 8) return leftoverGain;

  if (find("discard") && wantsNamedDiscard(state)) return find("discard")!;

  if (find("fate") && !state.peterPanRevealed) {
    const gainOpen = Boolean(find("gainPower"));
    const discardDigs = Boolean(find("discard") && wantsNamedDiscard(state));
    if (!(blocked && (gainOpen || discardDigs))) return find("fate")!;
  }

  return "end";
}

function actionWhy(state: GameState, slot: ActionSlot): string {
  if (slot.kind === "vanquish" && peterReadyToFinish(state)) {
    return withReach(
      "Peter is on the Jolly Roger and your Allies can meet his Strength. The clash there completes the objective.",
      state,
      peterCard(state)?.location,
    );
  }
  if (slot.kind === "vanquish" && anyTauntInRealm(state) && vanquishableHeroes(state).length === 0) {
    return vanquishBlockedReason(state);
  }
  if (slot.kind === "playCard" && anyTauntInRealm(state) && vanquishableHeroes(state).length === 0) {
    const card = usefulPlay(state);
    if (card?.defId === "cannon") {
      return `${vanquishBlockedReason(state)} Playing Cannon adds another Vanquish token — it does not ignore Taunt or add Strength.`;
    }
  }
  if (slot.kind === "moveHero") {
    const step = peterStep(state);
    return step
      ? `Click ${slot.label}, then Peter Pan, then ${placeVerb(step.dest)} to walk him ${locName(step.from)} → ${locName(step.dest)}. He only loses the duel if you vanquish him anywhere else.`
      : "Click Move a Hero, then Peter Pan, then the glowing square toward the Jolly Roger. He only loses the duel if you vanquish him anywhere else.";
  }
  if (slot.kind === "playCard" && playableMap(state)) {
    return "Click Play a Card, then Never Land Map in your hand, then Choose this place on any unlocked square. The Map unlocks Hangman’s Tree — until that hideout opens, Peter cannot start the walk to the ship.";
  }
  if (slot.kind === "playCard") {
    const card = usefulPlay(state);
    if (card && def(card.defId).type === "ally") {
      return `Click Play a Card, then ${cardName(card)} in your hand, then ${placeVerb(playHome(state, card))}. An Ally on the Jolly Roger is Strength waiting for Peter.`;
    }
    if (card && (card.defId === "worthyOpponent" || card.defId === "giveThemAScare")) {
      return `Click Play a Card, then ${cardName(card)} in your hand. Hunt cards are how Hook finds Peter at a table — plus being Fated. The computer always Fates you here after each turn.`;
    }
    if (card) {
      return playCta(state, card, "open");
    }
  }
  if (slot.kind === "gainPower") {
    const tokens = liveActions(state).filter((a) => a.kind === "gainPower");
    const tokenLine =
      tokens.length > 1
        ? ` Power tokens you can still take here: ${tokens.map((t) => t.label).join(", ")}.`
        : ` This token is ${slot.label}.`;
    if (needPowerForMap(state)) {
      return `Bank Power now so the Never Land Map is affordable. Allies for the final clash will want a reserve too.${tokenLine}`;
    }
    const pricey = cheapestUnaffordable(state);
    if (pricey && handHasOnlyUnaffordablePays(state)) {
      const cost = def(pricey.defId).cost;
      return `Save ${cardName(pricey)} for when you have ${cost} Power. You have ${state.power} now, so that card is not a Play yet.${tokenLine}`;
    }
    return `Bank Power as a reserve for the next Item or Ally you draw. That is why ${slot.label} still matters even when the Map is not in hand.${tokenLine}`;
  }
  if (slot.kind === "discard") {
    const picks = discardPicks(state);
    if (picks.length) return discardWhy(state, picks);
    return "The Map is still in the deck. Discard here digs for it so the tree can open.";
  }
  if (slot.kind === "fate") {
    const hunt =
      cheapestUnaffordable(state) && !state.peterPanRevealed
        ? " Peter is still hidden, so this Fate action is the hunt. It does not pay for a card."
        : "";
    return `Practice self-Fate: this flips Hook’s own Fate deck. At a table your Fate action hits another villain; Hook finds Peter with hunt cards and by being Fated. If Peter is in the pair, play him — he lands at Hangman’s Tree.${hunt}`;
  }
  if (slot.kind === "moveItemAlly") {
    return "Slide crew toward the Jolly Roger so their Strength is waiting when Peter arrives.";
  }
  if (slot.kind === "vanquish") {
    const off = vanquishableHeroes(state).find((hero) => hero.location !== state.villainLocation);
    return withReach(
      "Clear a blocking Hero if the clash is safe. Leave Peter alone unless he is already on the ship.",
      state,
      off?.location,
    );
  }
  return "Spend the useful action here, then we will look at the next link in the chain.";
}

function adviseActions(state: GameState): CoachAdvice {
  const pick = pickAction(state);
  if (!pick || pick === "end") {
    return say(
      "End the turn (click End turn). Draw back to four, then Fate will answer.",
      "You have spent the useful actions at this stop. Ending is the refill — stay ready to move again next turn.",
      ["btn:end"],
      state,
    );
  }
  return say(fullActionDo(state, pick), actionWhy(state, pick), [`act:${pick.key}`], state);
}

function playTargetWhy(card: CardInstance, dest: LocationId): string {
  if (card.defId === "neverLandMap") {
    return `Playing the Map unlocks Hangman’s Tree right away. After that, Peter can be walked from the hideout toward the Jolly Roger.`;
  }
  if (def(card.defId).type === "ally") {
    return dest === "jollyRoger"
      ? "Station crew on the ship so their Strength is ready for Peter’s clash."
      : "This Ally can march closer to the ship on a later Move Ally/Item.";
  }
  if (card.defId === "ingeniousDevice") {
    return "The Device adds a Move a Hero action — the fastest escort once the tree is open.";
  }
  return `Play ${cardName(card)} to ${locName(dest)} — click ${placeVerb(dest)} next so it serves the Map → Tree → Peter → ship plan.`;
}

function advisePending(state: GameState): CoachAdvice {
  const p = state.pending;
  if (!p) return adviseActions(state);

  switch (p.kind) {
    case "playChooseCard": {
      const card = usefulPlay(state) ?? playableHandCards(state)[0];
      if (!card) {
        return say("Cancel the play (click Cancel)", "Nothing in hand is worth the action right now.", ["btn:cancel"], state);
      }
      const why =
        card.defId === "neverLandMap"
          ? "The Map is the only key to Hangman’s Tree. Click it in your hand, then Choose this place on any unlocked square."
          : def(card.defId).type === "ally"
            ? `Click ${cardName(card)} in your hand, then ${placeVerb(playHome(state, card))}. Allies at the Jolly Roger become the clash that finishes Peter.`
            : playTargetWhy(card, playHome(state, card));
      return say(playCta(state, card, "pick"), why, [`card:${card.instanceId}`], state);
    }
    case "playChooseLocation": {
      const card = findCard(state, p.cardId);
      if (!card) return say("Choose a glowing location (click Choose this place on an unlocked square).", "Drop the card on an unlocked place.", [], state);
      const dest = playHome(state, card);
      return say(
        playCta(state, card, "place"),
        playTargetWhy(card, dest),
        [`loc:${dest}`],
        state,
      );
    }
    case "playChooseAllyAttach": {
      const pick = preferredAttachAlly(state);
      if (!pick) return say("Cancel", "There is no Ally to arm. Cancel and play a crew member first.", ["btn:cancel"], state);
      const ally = cardName(pick.ally);
      const place = pick.location === "jollyRoger" ? "the Jolly Roger" : locName(pick.location);
      return say(
        cutlassStrapLine(state),
        `${ally} at ${place} is a legal attach the picker will accept. Click ${ally} in the ally picker or drag Cutlass onto ${ally}. +2 Strength there makes Peter’s clash safer.`,
        [`card:${pick.ally.instanceId}`, `btn:attach:${pick.ally.instanceId}`],
        state,
      );
    }
    case "playChoosePayment": {
      const card = findCard(state, p.cardId);
      const cost = card ? def(card.defId).cost : 0;
      const name = card ? cardName(card) : "this card";
      const mapOut = mapInRealm(state);
      if (state.power >= cost) {
        return say(
          `Pay with Power (click Pay with Power) — ${name} costs ${cost} and you have ${state.power}.`,
          mapOut
            ? "Keep the Never Land Map in the realm. You already used it to open the tree, and later Items can still lean on it if you are short."
            : `${name} costs ${cost}. You have ${state.power}. Click Pay with Power to finish the play.`,
          ["btn:pay-power"],
          state,
        );
      }
      if (mapOut) {
        return say(
          "Discard the Map to pay (click Discard the Map)",
          "Power is short. The tree is already open, so spending the Map keeps the plan moving.",
          ["btn:pay-map"],
          state,
        );
      }
      return say(
        "Cancel — not enough Power (click Cancel)",
        `${name} costs ${cost} and you have ${state.power}. Click Cancel, then Gain more Power before you play it.`,
        ["btn:cancel"],
        state,
      );
    }
    case "discardSelect": {
      const junk = discardPicks(state, p.selected);
      if (junk[0]) {
        return say(
          `Discard ${cardName(junk[0])} at ${locName(state.villainLocation)} (click that card in your hand, then Confirm).`,
          discardWhy(state, junk),
          [`card:${junk[0].instanceId}`],
          state,
        );
      }
      return say(
        "Confirm the discard (click Confirm)",
        p.selected.length
          ? "Those cards can go. Click Confirm and keep hunting the Map."
          : "Nothing extra to toss. Click Confirm to spend the action and stay on tempo.",
        ["btn:confirm"],
        state,
      );
    }
    case "vanquishHero": {
      const targets = vanquishableHeroes(state);
      const peter = targets.find((h) => h.hero.defId === "peterPan");
      if (peter && peter.location === "jollyRoger") {
        return say(
          "Vanquish Peter Pan at the Jolly Roger (click Peter Pan, then tap Allies until Strength meets him, then Confirm).",
          withReach("This is the last link. The clash only wins if it happens on the ship.", state, peter.location),
          [`card:${peter.hero.instanceId}`],
          state,
        );
      }
      const croc = targets.find((h) => h.hero.defId === "tickTock");
      const pick = croc ?? targets.find((h) => h.hero.defId !== "peterPan") ?? targets[0];
      if (!pick) return say("Cancel Vanquish", "No safe clash right now.", ["btn:cancel"], state);
      if (pick.hero.defId === "peterPan" && pick.location !== "jollyRoger") {
        return say(
          "Cancel — do not vanquish Peter here",
          "A clash with Peter away from the Jolly Roger loses the duel. Wait until he stands on the ship.",
          ["btn:cancel"],
          state,
        );
      }
      return say(
        `Vanquish ${cardName(pick.hero)} at ${locName(pick.location)} (click ${cardName(pick.hero)}, then tap Allies, then Confirm).`,
        withReach(
          pick.hero.defId === "tickTock"
            ? "The crocodile empties your hand if you step onto his space. Clear him if the Strength is there."
            : "Clear the blocker so your next actions — Play, Gain, or Move a Hero — are uncovered.",
          state,
          pick.location,
        ),
        [`card:${pick.hero.instanceId}`],
        state,
      );
    }
    case "vanquishAllies": {
      const hero = findCard(state, p.heroId);
      const need = hero ? heroStrength(state, hero) : 0;
      const pool = vanquishAllyPool(state, p.heroId);
      const selectedStr = p.selected.reduce((n, id) => {
        const ally = pool.find((a) => a.ally.instanceId === id)?.ally;
        return n + (ally ? allyStrength(state, ally) : 0);
      }, 0);
      const heroLoc = hero ? findCardLocation(state, hero.instanceId) : null;
      if (selectedStr >= need && p.selected.length > 0) {
        const usedNeighbor = p.selected.some((id) => {
          const ally = pool.find((row) => row.ally.instanceId === id);
          return ally?.ally.defId === "boardingParty" && heroLoc && ally.location !== heroLoc;
        });
        const confirmWhy =
          hero?.defId === "peterPan"
            ? "The Strength is there. Click Confirm and the objective chain is complete."
            : "That is enough Strength. Click Confirm so you can return to the rest of the turn.";
        return say(
          "Confirm the clash (click Confirm)",
          usedNeighbor ? `${confirmWhy} ${BOARDING_REACH_WHY}` : withReach(confirmWhy, state, heroLoc),
          ["btn:confirm"],
          state,
        );
      }
      const nextAlly = pool
        .filter((a) => !p.selected.includes(a.ally.instanceId))
        .sort((a, b) => allyStrength(state, b.ally) - allyStrength(state, a.ally))[0];
      if (!nextAlly) {
        return say("Cancel the clash", "You do not have the Strength. Back out and gather more crew.", ["btn:cancel"], state);
      }
      const neighborCrew =
        nextAlly.ally.defId === "boardingParty" && heroLoc && nextAlly.location !== heroLoc
          ? ` ${BOARDING_REACH_WHY}`
          : "";
      return say(
        `Add ${cardName(nextAlly.ally)} to the clash (click that Ally). You need ${need} Strength.`,
        `Click ${cardName(nextAlly.ally)} now. Keep tapping Allies at this place until the total meets the Hero, then Confirm.${neighborCrew}`,
        [`card:${nextAlly.ally.instanceId}`],
        state,
      );
    }
    case "movePieceSelect": {
      const pieces = movableAlliesAndItems(state);
      const ally = pieces
        .filter((c) => def(c.defId).type === "ally")
        .map((c) => ({ c, loc: findCardLocation(state, c.instanceId)! }))
        .filter((x) => x.loc && x.loc !== "jollyRoger" && towardRoger(x.loc))
        .sort((a, b) => LOCATION_IDS.indexOf(b.loc) - LOCATION_IDS.indexOf(a.loc))[0];
      const pick = ally?.c ?? pieces[0];
      if (!pick) return say("Cancel", "Nothing useful to slide.", ["btn:cancel"], state);
      const from = findCardLocation(state, pick.instanceId);
      const dest = from ? towardRoger(from) : null;
      return say(
        dest && from
          ? `Move ${cardName(pick)} from ${locName(from)} to ${locName(dest)} (click ${cardName(pick)}, then ${placeVerb(dest)}).`
          : `Move ${cardName(pick)} (click that card, then ${dest ? placeVerb(dest) : placeVerb("jollyRoger")}).`,
        "Crew belongs at the Jolly Roger before Peter arrives.",
        [`card:${pick.instanceId}`],
        state,
      );
    }
    case "movePieceDest": {
      const from = findCardLocation(state, p.pieceId);
      const dests = from ? adjacentUnlocked(state, from) : [];
      const toward = from ? towardRoger(from) : null;
      const dest = toward && dests.includes(toward) ? toward : dests[0];
      if (!dest) return say("Cancel", "No adjacent unlocked step.", ["btn:cancel"], state);
      const card = findCard(state, p.pieceId);
      return say(
        `Move ${card ? cardName(card) : "that card"} to ${locName(dest)} (click ${placeVerb(dest)}).`,
        "One step closer to the Jolly Roger keeps the final clash supplied.",
        [`loc:${dest}`],
        state,
      );
    }
    case "moveHeroSelect":
    case "starkeyHero": {
      const legalHeroes =
        p.kind === "starkeyHero"
          ? (() => {
              const loc = findCardLocation(state, p.starkeyId);
              return loc ? state.locations[loc].heroes : [];
            })()
          : movableHeroes(state);
      const peter = legalHeroes.find((h) => h.defId === "peterPan");
      if (peter && (p.kind === "starkeyHero" || state.hangmansUnlocked)) {
        const from = findCardLocation(state, peter.instanceId);
        const dest = from ? towardRoger(from) : null;
        const dests = from ? adjacentUnlocked(state, from) : [];
        const step = dest && dests.includes(dest) ? dest : dests[0];
        return say(
          step
            ? `Move Peter Pan toward the Jolly Roger (click Peter Pan, then ${placeVerb(step)}).`
            : "Move Peter Pan toward the Jolly Roger (click Peter Pan, then Choose this place on the glowing square toward the ship).",
          "He travels one unlocked step at a time. The win only counts if you vanquish him on the ship.",
          [`card:${peter.instanceId}`],
          state,
        );
      }
      const croc = legalHeroes.find((h) => h.defId === "tickTock");
      const pick = croc ?? legalHeroes[0];
      if (!pick) return say("Cancel (click Cancel)", "No Hero can step right now.", ["btn:cancel"], state);
      return say(
        `Move ${cardName(pick)} (click that Hero, then Choose this place on a glowing adjacent square).`,
        pick.defId === "tickTock"
          ? "Nudge the crocodile off the path you still need to walk."
          : "Slide the Hero off a useful action so Play, Gain, or Fate comes back.",
        [`card:${pick.instanceId}`],
        state,
      );
    }
    case "moveHeroDest":
    case "starkeyDest": {
      const from = findCardLocation(state, p.heroId);
      const hero = findCard(state, p.heroId);
      const dests = from ? adjacentUnlocked(state, from) : [];
      const toward = from && hero?.defId === "peterPan" ? towardRoger(from) : null;
      const awayFromCroc = dests.find((id) => tickTockAt(state) !== id);
      const dest =
        toward && dests.includes(toward)
          ? toward
          : hero?.defId === "tickTock"
            ? (dests.find((id) => id !== "mermaidLagoon" && id !== "hangmansTree" && id !== state.villainLocation) ??
              dests.find((id) => id !== state.villainLocation) ??
              dests[0])
            : (awayFromCroc ?? dests[0]);
      if (!dest) return say("Cancel", "No adjacent unlocked step.", ["btn:cancel"], state);
      return say(
        `Move ${hero ? cardName(hero) : "that Hero"} to ${locName(dest)} (click ${placeVerb(dest)}).`,
        hero?.defId === "peterPan"
          ? "Each step west brings him closer to the Jolly Roger, where the final clash must happen."
          : "Park the Hero where they block you least.",
        [`loc:${dest}`],
        state,
      );
    }
    case "ayeAyeAlly": {
      const allies = allAllies(state).filter((a) => adjacentIds(a.location).some((id) => id === towardRoger(a.location)));
      const pick = allies[0] ?? allAllies(state)[0];
      if (!pick) return say("Cancel", "No Ally to reposition.", ["btn:cancel"], state);
      return say(
        `Reposition ${cardName(pick.ally)} at ${locName(pick.location)} (click ${cardName(pick.ally)}, then ${pick.location !== "jollyRoger" && towardRoger(pick.location) ? placeVerb(towardRoger(pick.location)!) : placeVerb("jollyRoger")}).`,
        "Aye Aye Sir also grants +2 Strength this turn — point that bonus at the ship if you can.",
        [`card:${pick.ally.instanceId}`],
        state,
      );
    }
    case "ayeAyeDest": {
      const from = findCardLocation(state, p.allyId);
      const toward = from ? towardRoger(from) : null;
      const dests = from ? adjacentUnlocked(state, from) : [];
      const dest = toward && dests.includes(toward) ? toward : dests[0];
      if (!dest) return say("Cancel", "No unlocked adjacent step.", ["btn:cancel"], state);
      return say(`Move that Ally to ${locName(dest)} (click ${placeVerb(dest)}).`, "Close the gap to the Jolly Roger.", [`loc:${dest}`], state);
    }
    case "vanquishConfirmLoss": {
      return say(
        "Cancel — this clash loses the duel",
        "Peter is not on the Jolly Roger. Confirming the vanquish is an intentional-loss lesson. First voyages should cancel and walk him to the ship.",
        ["btn:cancel"],
        state,
      );
    }
    case "cunningAlly": {
      const ally = state.hand.filter((c) => def(c.defId).type === "ally").sort((a, b) => def(b.defId).strength - def(a.defId).strength)[0];
      if (!ally) return say("Skip Cunning", "No Ally in hand to sneak ashore.", ["btn:skip-cond"], state);
      return say(
        `Play ${cardName(ally)} for free (click ${cardName(ally)} in your hand, then ${placeVerb(bestAllyHome(state))}).`,
        "Cunning spends no Play action. Drop the strongest Ally you can onto the ship.",
        [`card:${ally.instanceId}`],
        state,
      );
    }
    case "cunningLocation": {
      const dest = bestAllyHome(state);
      return say(`Place the Ally at ${locName(dest)} (click ${placeVerb(dest)}).`, "Free crew belongs at the Jolly Roger.", [`loc:${dest}`], state);
    }
    case "fateChooseCard": {
      const peter = p.cards.find((c) => c.defId === "peterPan");
      if (peter) {
        return say(
          "Play Peter Pan",
          "He always lands at Hangman’s Tree. Once the Map has opened that hideout, you can walk him to the ship.",
          [`card:${peter.instanceId}`],
          state,
        );
      }
      const mild = p.cards.find((c) => c.defId !== "tickTock" && c.defId !== "splittingHeadache") ?? p.cards[0];
      return say(
        `Play ${mild ? cardName(mild) : "one Fate card"}`,
        mild?.defId === "tickTock"
          ? "If you must play the crocodile, park him off the path you still need."
          : "Play the gentler card and discard the rest. You can still hunt Peter later.",
        mild ? [`card:${mild.instanceId}`] : [],
        state,
      );
    }
    case "fateChooseLocation":
    case "worthyLocation":
    case "obsessionLocation": {
      const card = findCard(state, "cardId" in p ? p.cardId : p.heroId) ?? state.heldCard;
      const dest = card ? parkHeroLocation(state, card) : legalPlayLocations(state)[0];
      if (!dest) return say("Choose an unlocked location", "Heroes need an open place to land.", [], state);
      return say(
        `Place ${card ? cardName(card) : "the Hero"} at ${locName(dest)} (click ${placeVerb(dest)}).`,
        card?.defId === "tickTock"
          ? "Keep the crocodile off Mermaid Lagoon and Hangman’s Tree so your Power and escort stay usable."
          : "Park this Hero where they cover the fewest actions you still need.",
        [`loc:${dest}`],
        state,
      );
    }
    case "fateChooseAttach": {
      const itemId = state.heldCard?.defId ?? (p.kind === "fateChooseAttach" ? findCard(state, p.cardId)?.defId : undefined) ?? "pixieDust";
      const legal = attachableHeroes(state, itemId);
      const offPeter = legal.filter((h) => h.defId !== "peterPan");
      const pick = offPeter[0] ?? legal[0];
      if (!pick) return say("Choose a Hero", "The attachment needs a Hero in the realm.", [], state);
      return say(
        `Attach it to ${cardName(pick)}`,
        itemId === "pixieDust" && !state.hangmansUnlocked
          ? "Pixie Dust does not cling to Peter while Hangman’s Tree is still locked. Park the +2 on another Hero."
          : "Keep extra Strength off Peter if you can. He is already a tall clash.",
        [`card:${pick.instanceId}`],
        state,
      );
    }
    case "fateChooseItem": {
      const items = allLocationItems(state);
      const junk = items.find((i) => i.item.defId !== "neverLandMap" && i.item.defId !== "ingeniousDevice");
      const pick = junk ?? items.find((i) => i.item.defId !== "neverLandMap") ?? items[0];
      if (!pick) {
        return say(
          "Continue",
          "No Item ashore — this Fate card is discarded. You do not pick anything. Acknowledge, then make the required move.",
          ["btn:ack"],
          state,
        );
      }
      return say(
        `Discard ${cardName(pick.item)}`,
        "Protect the Map and the Device if they are still helping the escort.",
        [`card:${pick.item.instanceId}`],
        state,
      );
    }
    case "tinkerDiscard": {
      return say(
        "Skip the discard",
        "Keep your crew if you can. Allies at the ship are the clash that finishes Peter.",
        ["btn:skip-cond"],
        state,
      );
    }
    case "scarePeek": {
      const peter = p.cards.find((c) => c.defId === "peterPan");
      const croc = p.cards.find((c) => c.defId === "tickTock");
      if (peter) {
        const other = p.cards.find((c) => c.instanceId !== peter.instanceId) ?? peter;
        return say(
          `Return the peek with ${cardName(peter)} on top`,
          "A later hunt or being Fated can reveal him onto Hangman’s Tree, even while that hideout is locked.",
          [`btn:scare-order:${peter.instanceId},${other.instanceId}`],
          state,
        );
      }
      if (croc || p.cards.some((c) => c.defId === "splittingHeadache")) {
        return say(
          "Discard both peeked cards",
          "Send the crocodile or the headache to the Fate discard so they do not land on your Map or your path. They can still return when Fate reshuffles.",
          ["btn:scare-discard"],
          state,
        );
      }
      return say(
        "Discard both peeked cards",
        "A cleaner Fate deck makes Worthy Opponent and later hunts more likely to find Peter. Discarded cards can still return when Fate reshuffles.",
        ["btn:scare-discard"],
        state,
      );
    }
    case "obsessionDecide": {
      const hero = state.heldCard;
      if (hero?.defId === "peterPan") {
        return say(
          "Play Peter Pan",
          "He lands at Hangman’s Tree. If the Map has already opened it, you can start walking him to the ship.",
          ["btn:play-hero"],
          state,
        );
      }
      if (hero?.defId === "tickTock") {
        return say("Banish Tick Tock", "The crocodile is a hand-wiping trap. Send him out of the realm.", ["btn:banish-hero"], state);
      }
      return say(
        "Banish this Hero",
        "A quieter realm leaves your actions uncovered while you finish the Map and the walk.",
        ["btn:banish-hero"],
        state,
      );
    }
    case "conditionOffer": {
      const cond = findCard(state, p.conditionId);
      const allies = state.hand.filter((c) => def(c.defId).type === "ally");
      if (cond?.defId === "cunning" && allies.length === 0) {
        return say(
          "Not now — Cunning needs an Ally in hand",
          "The trigger is live, but there is no Ally to slip ashore. Skip the Condition so it stays in hand.",
          ["btn:skip-cond"],
          state,
        );
      }
      return say(
        "Play the Condition",
        p.reason.includes("Cunning") || cond?.defId === "cunning"
          ? "A free Ally now is a gift — put that Strength on the ship."
          : "If Peter is still hidden, this hunt can flip him onto Hangman’s Tree.",
        ["btn:accept-cond"],
        state,
      );
    }
    case "fateReport": {
      if (/no item/i.test(p.note) && /discard/i.test(p.note)) {
        return say(
          "Continue",
          "No Item ashore — this Fate card is discarded. You do not pick anything. Acknowledge, then make the required move.",
          ["btn:ack"],
          state,
        );
      }
      if (p.resume === "nextTurn") {
        return say(
          "Continue",
          "Fate has had its say. Read the full card text — especially Tick Tock — then take your next move. The modal stays until you acknowledge.",
          ["btn:ack"],
          state,
        );
      }
      if (p.played?.defId === "tickTock" && !p.markAction) {
        return say(
          "Continue",
          "The crocodile emptied your hand. Read the lasting trap on this card before you spend the rest of this stop.",
          ["btn:ack"],
          state,
        );
      }
      return say(
        "Continue",
        "Read the full paraphrased ability on this card before you return to the board.",
        ["btn:ack"],
        state,
      );
    }
    default:
      return say(
        "Follow the glowing prompts (click the gold-outlined card, place, or button the prompt names).",
        "Take the highlighted legal option to keep the objective chain moving.",
        [],
        state,
      );
  }
}

function clampToLegal(state: GameState, advice: CoachAdvice): CoachAdvice {
  const legal = highlightSet(state);
  const highlights = advice.highlights.filter((key) => key.startsWith("btn:") || legal.has(key));
  const cleaned = highlights.length === advice.highlights.length ? advice : { ...advice, highlights };

  if (state.phase === "actions" && !state.pending) {
    const acts = liveActions(state);
    const wantsHeroWalk = /Move a Hero|Move Peter/i.test(cleaned.do);
    if (wantsHeroWalk && !acts.some((a) => a.kind === "moveHero")) {
      return adviseActions(state);
    }
    const actHi = cleaned.highlights.find((key) => key.startsWith("act:"));
    if (actHi && !acts.some((a) => a.key === actHi.slice(4))) {
      return adviseActions(state);
    }
    const gainAmt = cleaned.do.match(/Gain (\d+)/);
    if (gainAmt && !acts.some((a) => a.kind === "gainPower" && (a.amount ?? 1) === Number(gainAmt[1]))) {
      return adviseActions(state);
    }
  }

  return cleaned;
}

function adviseUnchecked(state: GameState): CoachAdvice {
  if (state.phase === "title") {
    return {
      do: "Start a Tutorial voyage",
      why: "Coach will point at the next legal click and explain how it serves Map → Tree → Peter → ship.",
      highlights: [],
    };
  }
  if (state.won) {
    return {
      do: "The ship is yours",
      why: "Peter was vanquished at the Jolly Roger after the Map opened the tree and the walk across the realm.",
      highlights: [],
    };
  }
  if (state.lost) {
    return {
      do: "Study the tide and try again",
      why: state.loseReason || "The chain broke — usually Peter was clashed away from the ship, or the colors were struck.",
      highlights: ["btn:again"],
    };
  }
  if (state.phase === "move" && !state.pending) return adviseMove(state);
  if (state.pending) return advisePending(state);
  if (state.phase === "actions") return adviseActions(state);
  return say("Watch the prompt", "The next legal click will light up as soon as the realm is ready.", [], state);
}

function rescueUnaffordable(state: GameState): CoachAdvice {
  const pricey = cheapestUnaffordable(state);
  const cost = pricey ? def(pricey.defId).cost : 0;
  const save = pricey
    ? `Save ${cardName(pricey)} for when you have ${cost} Power.`
    : "Save that card until you can pay its cost.";
  const pendingKind = state.pending?.kind;
  if (
    pendingKind === "playChooseCard" ||
    pendingKind === "playChooseLocation" ||
    pendingKind === "playChooseAllyAttach" ||
    pendingKind === "playChoosePayment"
  ) {
    return say("Cancel — not enough Power (click Cancel)", `${save} You have ${state.power}.`, ["btn:cancel"], state);
  }
  if (state.phase === "actions" && !state.pending) {
    const acts = liveActions(state);
    const gain = [...acts.filter((a) => a.kind === "gainPower")].sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1))[0];
    if (gain) return say(fullActionDo(state, gain), actionWhy(state, gain), [`act:${gain.key}`], state);
    const discard = acts.find((a) => a.kind === "discard");
    if (discard) return say(fullActionDo(state, discard), actionWhy(state, discard), [`act:${discard.key}`], state);
  }
  if (state.phase === "move" && !state.pending) {
    const dest = pickMove(state);
    const next: GameState = { ...state, villainLocation: dest, usedActions: [], pending: null, phase: "actions" };
    const gains = liveSlots(next, dest)
      .filter((a) => a.kind === "gainPower")
      .sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    const follow = gains[0]
      ? `then take ${gains[0].label}`
      : hasKind(next, dest, "discard") && discardPicks(next)[0]
        ? `then ${discardDo(next, locName(dest)).replace(/\.$/, "")}`
        : "then bank Power before you play";
    return say(
      `Move to ${locName(dest)} (click Move here on ${locName(dest)}), ${follow}.`,
      save,
      [`loc:${dest}`],
      state,
    );
  }
  return say("End the turn (click End turn). Draw back to four, then Fate will answer.", save, ["btn:end"], state);
}

function guardAffordability(state: GameState, advice: CoachAdvice): CoachAdvice {
  if (!namesUnaffordablePlay(state, advice.do)) return advice;
  return rescueUnaffordable(state);
}

function withWalkOnWhy(state: GameState, advice: CoachAdvice): CoachAdvice {
  if (state.phase !== "move" || state.pending) return advice;
  if (/walk-on/i.test(advice.why)) return advice;
  const croc = tickTockAt(state);
  if (!croc || !legalMoveLocations(state).includes(croc)) return advice;
  const destKey = advice.highlights.find((key) => key.startsWith("loc:"));
  const dest = destKey?.slice(4) as LocationId | undefined;
  const clause =
    dest === croc
      ? `Tick Tock’s walk-on is this step: moving the captain onto ${locName(croc)} discards every card in hand. The hand empties only when the captain moves onto that place — seating or sliding the crocodile onto the captain does not.`
      : `Tick Tock’s walk-on: skip ${locName(croc)}. The hand empties only if the captain moves onto that place. Seating or sliding the crocodile onto the captain does not.`;
  return { ...advice, why: `${advice.why} ${clause}` };
}

export function advise(state: GameState): CoachAdvice {
  return withWalkOnWhy(state, guardAffordability(state, clampToLegal(state, adviseUnchecked(state))));
}
