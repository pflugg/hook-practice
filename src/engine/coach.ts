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
  canPlayObsession,
  cardName,
  coveringHero,
  findCard,
  findCardLocation,
  heroStrength,
  adjacentUnlocked,
  legalMoveLocations,
  legalPlayLocations,
  unlockedLocations,
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
  return LOCATION_IDS[i - 1] ?? null;
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

/** Uncovered Gain stops that do not discard a held hand by walking onto Tick Tock. */
function safeUncoveredGains(state: GameState): LocationId[] {
  return LOCATION_IDS.filter((id) => {
    if (id === "hangmansTree" && !state.hangmansUnlocked) return false;
    if (tickTockAt(state) === id) return false;
    return liveSlots(state, id).some((action) => action.kind === "gainPower");
  });
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

/** Villain Items that strap onto an Ally. Cutlass is the only one. */
function isAllyAttachItem(card: CardInstance): boolean {
  return card.defId === "cutlass";
}

/** Power cannot cover the printed cost, or no legal Ally is ashore to receive it. */
function attachBlocked(state: GameState, card: CardInstance): boolean {
  if (!isAllyAttachItem(card)) return false;
  if (state.power < def(card.defId).cost) return true;
  return preferredAttachAlly(state) === null;
}

function blockedAttachInHand(state: GameState): CardInstance | null {
  return state.hand.find((card) => attachBlocked(state, card)) ?? null;
}

function coachPlayable(state: GameState): CardInstance[] {
  const savingMap = !state.hangmansUnlocked && Boolean(mapInHand(state));
  return playableHandCards(state).filter((card) => canPayNow(state, card) && !attachBlocked(state, card) &&
    (!savingMap || card.defId === "neverLandMap" || def(card.defId).cost === 0 || state.power - def(card.defId).cost >= 4));
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
  // Cunning's Ally drop is free. "Play Brute for free" is not an unpaid Power play.
  if (state.pending?.kind === "cunningAlly" || state.pending?.kind === "cunningLocation") return null;
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
  // Worthy Opponent is the free +2 that finishes a covered-Gain Map reserve. Never dig it away.
  if (card.defId === "worthyOpponent" && needPowerForMap(state)) return 9_000;
  if (reserveStall(state) && card.defId !== "worthyOpponent") {
    const copies = state.hand.filter((other) => other.defId === card.defId).length;
    if (copies > 1) return 30;
    // These plays would spend the short reserve and still leave the Map unpaid.
    if (d.cost > 0 && state.power - d.cost < 4) return 70 + d.cost;
  }
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
  if (isDeadCondition(state, card) && card.defId === "cunning") return 45;
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

/** A Gain that is uncovered on a fresh visit, even if this turn already used it. */
function freshSafeGains(state: GameState): LocationId[] {
  return LOCATION_IDS.filter((id) => {
    if (id === "hangmansTree" && !state.hangmansUnlocked) return false;
    if (tickTockAt(state) === id) return false;
    const fresh = { ...state, villainLocation: id, usedActions: [], pending: null, phase: "actions" as const };
    return availableActions(fresh).some((action) => action.kind === "gainPower" && action.available);
  });
}

/** No safe Gain will be open even on a fresh visit, and the Map is still short of 4. */
function reserveStall(state: GameState): boolean {
  return needPowerForMap(state) && freshSafeGains(state).length === 0;
}

/** Safe Gains are covered even on a fresh visit, and the Map is still short. Dig instead of pacing. */
function mapReserveNeedsDig(state: GameState): boolean {
  return reserveStall(state) && discardPicks(state).length > 0;
}

function wantsNamedDiscard(state: GameState): boolean {
  if (discardPicks(state).length === 0) return false;
  if (handHasOnlyUnaffordablePays(state) || diggingForMap(state) || mapReserveNeedsDig(state)) return true;
  if (state.hand.some((card) => isDeadCondition(state, card))) return true;
  if (blockedAttachInHand(state)) return true;
  return jrStrength(state) < 8 && state.hand.some((card) => def(card.defId).type === "ally" && cannotPay(state, card));
}

/** Headline always names the card and the reason. Null when nothing in hand should be tossed. */
function discardDo(state: GameState, where: string): string | null {
  const pick = discardPicks(state)[0];
  if (!pick) return null;
  const name = cardName(pick);
  const reason = discardWhy(state, [pick]).replace(/\.$/, "");
  return `Discard ${name} at ${where} — ${reason}. Click Discard, then click ${name} in your hand, then Confirm.`;
}

function discardWhy(state: GameState, picks: CardInstance[]): string {
  const name = picks.map((card) => cardName(card)).join(" and ");
  const blockedAttach = picks.find((card) => attachBlocked(state, card));
  if (blockedAttach && picks.length === 1) {
    const d = def(blockedAttach.defId);
    const bits: string[] = [];
    if (state.power < d.cost) bits.push(`You have ${state.power} Power; ${cardName(blockedAttach)} costs ${d.cost}.`);
    if (!preferredAttachAlly(state)) bits.push(`${cardName(blockedAttach)} needs an Ally already ashore.`);
    const because = bits.length ? `${bits.join(" ")} ` : "";
    return `${because}Discard ${cardName(blockedAttach)} to dig toward an Ally you can play.`;
  }
  const spentObsession = picks.some((card) => card.defId === "obsession" && state.peterPanRevealed);
  if (spentObsession) {
    const peter = peterCard(state);
    const where = peter?.location === "jollyRoger" ? "Peter is already on the Jolly Roger." : "Peter is already in the realm.";
    const taunt = anyTauntInRealm(state) ? " Taunt means he must be vanquished first." : "";
    const dig =
      jrStrength(state) < 8
        ? " Discard Obsession to dig for Allies and crew the ship before that clash."
        : " Discard Obsession to dig toward the next card that serves the chain.";
    return `Obsession is spent. ${where}${taunt}${dig}`;
  }
  const pricey = cheapestUnaffordable(state);
  const powerLine = pricey
    ? `You have ${state.power} Power; ${cardName(pricey)} costs ${def(pricey.defId).cost}.`
    : `You have ${state.power} Power.`;
  const deadLine = picks.some((card) => isDeadCondition(state, card)) ? ` ${name} no longer serves this objective.` : "";
  const goal = mapReserveNeedsDig(state)
    ? "a card that adds Power, such as Worthy Opponent, while the Map stays in hand"
    : !state.hangmansUnlocked
      ? mapInHand(state) ? "useful crew while keeping the Map" : "cheaper crew and the Map"
      : jrStrength(state) < 8
        ? "cheaper crew"
        : "the next card that serves the chain";
  return `${powerLine}${deadLine} Discard ${name} to dig toward ${goal}.`;
}

function parkHeroLocation(state: GameState, hero: CardInstance): LocationId {
  const legal = unlockedLocations(state);
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
      mapInHand(state)
        ? `Moving onto Tick Tock at ${locName(croc)} discards your held Never Land Map with the whole hand. Seating or sliding the crocodile onto the captain does not empty the hand.`
        : `Tick Tock waits at ${locName(croc)} — if the captain moves onto that place, the whole hand is discarded. Seating or sliding the crocodile onto the captain does not empty the hand.`,
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
    notes.unshift(mapInHand(state)
      ? "That step lands on Tick Tock and discards your held Never Land Map with the whole hand. Keep the Map by choosing a safe shore if one is available."
      : "That recommended step lands on Tick Tock. Only go if you accept an empty hand.");
  }
  return notes[0];
}

const BOARDING_REACH_WHY =
  "Boarding Party’s neighboring reach is the exception: that crew may join a clash at the captain’s place or one unlocked step away when the party stands with the captain or with the Hero. A Boarding Party on the Hero’s far side does not reach. Other Allies cannot be spent on a Hero the captain is not standing beside.";

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

  if (peterReadyToFinish(relocated(state, id)) && vanquish) score += 1200;
  const peter = peterCard(state);
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger" && moveHero) score += 900;
  if (playableMap(state) && play) score += 700;
  const blocked = handHasOnlyUnaffordablePays(state);
  if (blocked) score += gainAmt * 180;
  else if (needPowerForMap(state) || wantEarlyPower(state)) score += gainAmt * 120;
  // An empty hand cannot dig. Scoring the Discard symbol anyway made Jolly Roger and Skull Rock look equally useful and the captain paced between them.
  if (discard && discardPicks(state).length > 0 && (diggingForMap(state) || wantsNamedDiscard(state))) {
    score += state.power >= 4 ? 380 : 70;
  }
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

function relocated(state: GameState, id: LocationId): GameState {
  return { ...state, villainLocation: id, usedActions: [], pending: null, phase: "actions" };
}

function safeVanquishTargets(state: GameState): { hero: CardInstance; location: LocationId }[] {
  return vanquishableHeroes(state).filter((h) => h.hero.defId !== "peterPan" || h.location === "jollyRoger");
}

function preferredVanquishTarget(state: GameState): { hero: CardInstance; location: LocationId } | null {
  const targets = safeVanquishTargets(state);
  const peter = targets.find((h) => h.hero.defId === "peterPan" && h.location === "jollyRoger");
  const croc = targets.find((h) => h.hero.defId === "tickTock");
  return peter ?? croc ?? targets[0] ?? null;
}

/** A clash that exists only if the captain stands at `dest`. */
function newVanquishAt(state: GameState, dest: LocationId): boolean {
  if (!hasKind(state, dest, "vanquish")) return false;
  const there = safeVanquishTargets(relocated(state, dest));
  if (there.length === 0) return false;
  const elsewhere = legalMoveLocations(state).filter((id) => id !== dest && tickTockAt(state) !== id);
  if (elsewhere.length === 0) return true;
  return there.some((target) =>
    elsewhere.every((id) => {
      const at = safeVanquishTargets(relocated(state, id));
      return !at.some((h) => h.hero.instanceId === target.hero.instanceId);
    }),
  );
}

function peterWalkReason(state: GameState, dest: LocationId): boolean {
  const peter = peterCard(state);
  if (!peter || !state.hangmansUnlocked || peter.location === "jollyRoger") return false;
  if (!hasKind(state, dest, "moveHero")) return false;
  return movableHeroes(relocated(state, dest)).some((h) => h.defId === "peterPan");
}

/** Going back clears a Hero who is covering a useful action at that stop. */
function uncoverReason(state: GameState, dest: LocationId): boolean {
  const cover = coveringHero(state, dest);
  if (!cover) return false;
  const coveredUseful = slotsAt(state, dest).some(
    (a) =>
      a.covered &&
      !a.used &&
      (a.kind === "gainPower" || a.kind === "playCard" || a.kind === "discard" || a.kind === "fate" || a.kind === "moveHero"),
  );
  if (!coveredUseful) return false;
  const there = relocated(state, dest);
  if (safeVanquishTargets(there).some((t) => t.hero.instanceId === cover.instanceId)) return true;
  return Boolean(hasKind(state, dest, "moveHero") && movableHeroes(there).some((h) => h.instanceId === cover.instanceId));
}

/** Play is a reason to return only when no other safe stop can play the card. */
function playDestinationReason(state: GameState, dest: LocationId): boolean {
  const card = usefulPlay(state);
  if (!card || !canPayNow(state, card) || !hasKind(state, dest, "playCard")) return false;
  const others = legalMoveLocations(state).filter((id) => id !== dest && tickTockAt(state) !== id);
  return !others.some((id) => hasKind(state, id, "playCard"));
}

/** The only safe Discard stop, and the hand has a named card to dig. */
function digReturnReason(state: GameState, dest: LocationId): boolean {
  if (!hasKind(state, dest, "discard") || !wantsNamedDiscard(state)) return false;
  const others = legalMoveLocations(state).filter((id) => id !== dest && tickTockAt(state) !== id);
  return !others.some((id) => hasKind(state, id, "discard"));
}

function stopServes(state: GameState, id: LocationId): boolean {
  if (hasKind(state, id, "gainPower") && state.power < 12) return true;
  if (hasKind(state, id, "discard") && wantsNamedDiscard(state)) return true;
  if (hasKind(state, id, "playCard") && usefulPlay(state)) return true;
  if (peterWalkReason(state, id)) return true;
  const there = relocated(state, id);
  return Boolean(hasKind(state, id, "vanquish") && preferredVanquishTarget(there));
}

/** Peter is on the ship, but standing there still cannot start the clash. */
function shipTrap(state: GameState, id: LocationId): boolean {
  if (id !== "jollyRoger" || stopServes(state, id)) return false;
  const peter = peterCard(state);
  return Boolean(peter && peter.location === "jollyRoger" && !peterReadyToFinish(state));
}

function concreteReturnReason(state: GameState, dest: LocationId): boolean {
  if (dest === "jollyRoger" && hasKind(state, dest, "vanquish") && peterReadyToFinish(relocated(state, dest))) return true;
  if (peterWalkReason(state, dest)) return true;
  if (newVanquishAt(state, dest)) return true;
  if (uncoverReason(state, dest)) return true;
  if (playDestinationReason(state, dest)) return true;
  if (digReturnReason(state, dest)) return true;
  return false;
}

interface MoveChoice {
  dest: LocationId;
  forcedBounce: boolean;
  skipped?: LocationId;
  avoidedShip?: boolean;
}

/**
 * Do not walk straight back to last turn's stop unless a clash, an uncover,
 * a play that exists nowhere else, or Peter's walk requires it.
 * If every other step is Tick Tock, returning is allowed and must be explained.
 */
function chooseMove(state: GameState): MoveChoice {
  const legal = legalMoveLocations(state);
  // Evaluate the board after the required move, not from the current shore.
  // A legal winning clash takes priority over Power, backtracking, or a hand wipe.
  if (legal.includes("jollyRoger") && hasKind(state, "jollyRoger", "vanquish") &&
      peterReadyToFinish(relocated(state, "jollyRoger"))) {
    return { dest: "jollyRoger", forcedBounce: false };
  }
  // A held Map is a concrete reason to revisit safe income. Do not spend its
  // reserve on optional crew or lose it by entering Tick Tock's shore.
  if (!state.hangmansUnlocked && mapInHand(state)) {
    const safe = legal.filter((id) => tickTockAt(state) !== id);
    const ready = state.power >= 4 ? safe.find((id) => hasKind(state, id, "playCard")) : undefined;
    if (ready) return { dest: ready, forcedBounce: false };
    const income = safe.map((id) => ({ id, amount: liveSlots(state, id).filter((a) => a.kind === "gainPower").reduce((n, a) => n + (a.amount ?? 1), 0) }))
      .filter((stop) => stop.amount > 0).sort((a, b) => b.amount - a.amount)[0];
    if (income) return { dest: income.id, forcedBounce: false };
    // Covered Gains are not a reason to board Tick Tock. Uncover a Gain, or hold the Map on a safe shore.
    if (state.power < 4) {
      const uncover = safe.find((id) => uncoverReason(state, id));
      if (uncover) return { dest: uncover, forcedBounce: false };
      const dig = safe.find((id) => hasKind(state, id, "discard") && mapReserveNeedsDig(state));
      if (dig) return { dest: dig, forcedBounce: false };
      const hold = safe.find((id) => hasKind(state, id, "fate") || hasKind(state, id, "discard"));
      if (hold) return { dest: hold, forcedBounce: false };
      if (safe[0]) return { dest: safe[0], forcedBounce: false };
    }
  }
  const departed = state.departedFrom && legal.includes(state.departedFrom) ? state.departedFrom : null;
  const ranked = [...legal].sort((a, b) => scoreMove(state, b) - scoreMove(state, a));
  const best = ranked[0] ?? legal[0] ?? "skullRock";
  const nonCroc = (id: LocationId) => tickTockAt(state) !== id;
  const allowed = ranked.filter((id) => nonCroc(id) && (!departed || id !== departed || concreteReturnReason(state, id)));
  const withoutShipTrap = allowed.filter((id) => !shipTrap(state, id));
  const pool = withoutShipTrap.length > 0 ? withoutShipTrap : allowed;
  if (pool[0]) {
    const dest = pool[0];
    const skipped = departed && dest !== departed && ranked[0] === departed ? departed : undefined;
    const avoidedShip = dest !== "jollyRoger" && legal.includes("jollyRoger") && shipTrap(state, "jollyRoger");
    return { dest, forcedBounce: false, skipped, avoidedShip };
  }
  if (departed && nonCroc(departed)) {
    return { dest: departed, forcedBounce: true };
  }
  return { dest: best, forcedBounce: false };
}

function tickTockStayLine(state: GameState): string | null {
  const croc = tickTockAt(state);
  if (!croc || !state.departedFrom || state.departedFrom === state.villainLocation) return null;
  return `${locName(croc)} has Tick Tock — stay one turn to Gain, don’t bounce.`;
}

function forcedBounceLead(state: GameState, dest: LocationId): string {
  const croc = tickTockAt(state);
  const next = relocated(state, dest);
  const gain = pickAction(next);
  const stayingToGain = Boolean(gain && gain !== "end" && gain.kind === "gainPower");
  if (croc && stayingToGain) return `${locName(croc)} has Tick Tock — stay one turn to Gain, don’t bounce.`;
  if (croc) return `${locName(croc)} has Tick Tock — don’t bounce onto that square. ${locName(dest)} is the only step that keeps the hand.`;
  return `Moving back to ${locName(dest)} is the only open step. Don’t bounce again next turn.`;
}

function withBounceWhy(state: GameState, choice: MoveChoice, why: string): string {
  let text = why;
  if (choice.forcedBounce) text = `${forcedBounceLead(state, choice.dest)} ${text}`;
  if (choice.avoidedShip) {
    text = `${text} Peter is on the Jolly Roger, but Vanquish cannot start — Taunt or an empty crew blocks the clash. Don’t walk back to the ship just to end the turn. Dig for Allies first.`;
  }
  if (choice.skipped) {
    text = `${text} You just left ${locName(choice.skipped)}. No new clash, uncover, or play is waiting there, so this turn does not bounce back.`;
  }
  return text;
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
    if (attachBlocked(state, card)) {
      const hostMissing = preferredAttachAlly(state) === null;
      const short = state.power < d.cost;
      if (short && hostMissing) {
        return `Gain Power or play an Ally before ${name}. You have ${state.power} Power and ${name} costs ${d.cost}, and no Ally is ashore.`;
      }
      if (short) return `Gain Power before ${name}. You have ${state.power} Power; ${name} costs ${d.cost}.`;
      return cutlassStrapLine(state);
    }
    const host = preferredAttachAlly(state);
    if (!host) return cutlassStrapLine(state);
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
    const pay = d.cost > 0 ? `, then click Pay ${d.cost} Power` : "";
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
    if (shipTrap(state, "jollyRoger")) {
      return "then end the turn only if no uncovered Discard, Gain, or Play remains — do not walk back to the ship for a clash you cannot start";
    }
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
    if (card && canPayNow(next, card) && !attachBlocked(next, card)) {
      const d = def(card.defId);
      if (d.id === "cutlass") {
        const host = preferredAttachAlly(next);
        if (host) return `then ${cutlassStrapLine(next)}`;
      } else if (d.type === "effect") {
        return `then play ${cardName(card)}`;
      } else {
        return `then play ${cardName(card)} to ${locName(playHome(next, card))}`;
      }
    }
    const gains = liveSlots(next, dest)
      .filter((a) => a.kind === "gainPower")
      .sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    if (gains[0]) return `then take ${gains[0].label}`;
    const namedDiscard = hasKind(next, dest, "discard") ? discardDo(next, locName(dest)) : null;
    if (namedDiscard) return `then ${namedDiscard.replace(/\.$/, "")}`;
    return "then bank Power before you play";
  }
  if (pick.kind === "gainPower") return `then take ${pick.label}`;
  if (pick.kind === "vanquish") {
    const hero = preferredVanquishTarget(next);
    return hero
      ? `then take Vanquish and click ${cardName(hero.hero)} at ${locName(hero.location)}`
      : "then take Vanquish";
  }
  if (pick.kind === "discard") {
    const named = discardDo(next, locName(dest));
    return named ? `then ${named.replace(/\.$/, "")}` : "then bank Power before you play";
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
      const card = usefulPlay(state);
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
      const hero = preferredVanquishTarget(state);
      return hero
        ? `Take Vanquish at ${here} (click that action), then click ${cardName(hero.hero)} at ${locName(hero.location)}, tap Allies until Strength meets the Hero, then Confirm.`
        : `Take Vanquish at ${here} (click that action).`;
    }
    case "discard": {
      const named = discardDo(state, here);
      if (named) return named;
      return `Take Gain or Play at ${here} before discarding. Nothing in hand is a named dig.`;
    }
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
  if (dest === "jollyRoger" && peterReadyToFinish(relocated(state, dest))) {
    return "Peter is already on the ship and your crew can finish the clash. Take the Vanquish action there — that is the only place the win counts.";
  }
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger" && hasKind(state, dest, "moveHero")) {
    const step = peterStep(state);
    return step
      ? `The tree is open and Peter is at ${locName(step.from)}. After you land, click Move a Hero, then Peter Pan, then ${placeVerb(step.dest)} (${locName(step.from)} → ${locName(step.dest)}).`
      : "The tree is open and Peter is ashore. After you land, click Move a Hero, then Peter Pan, then the glowing square toward the Jolly Roger.";
  }
  if (playableMap(state) && hasKind(state, dest, "playCard")) {
    return "You are holding the Never Land Map with enough Power. After you land, click Play a Card, then the Map in your hand, then Choose this place where the captain stands. The Map unlocks Hangman’s Tree from that square.";
  }
  if (needPowerForMap(state) && safeUncoveredGains(state).length === 0 && hasKind(state, dest, "discard") && discardPicks(state)[0]) {
    return `${discardWhy(state, discardPicks(state))} Safe Gains are covered. This Discard digs for Power without stepping onto Tick Tock, and the Map stays in hand.`;
  }
  if (needPowerForMap(state) && safeUncoveredGains(state).length === 0 && !hasKind(state, dest, "gainPower")) {
    return `Safe Gains are covered, and moving onto Tick Tock would discard the held Never Land Map. ${locName(dest)} keeps the Map. Uncover a Gain, or play a free card such as Worthy Opponent, before any optional purchase.`;
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
  const choice = chooseMove(state);
  const dest = choice.dest;
  return say(
    `Move to ${locName(dest)} (click Move here on ${locName(dest)}), ${plannedAfterMove(state, dest)}.`,
    withBounceWhy(state, choice, moveWhy(state, dest)),
    [`loc:${dest}`],
    state,
  );
}

function usefulPlay(state: GameState): CardInstance | null {
  const playable = coachPlayable(state);
  const map = playable.find((c) => c.defId === "neverLandMap");
  if (map) return map;
  if (needPowerForMap(state)) {
    const income = playable.find((c) => c.defId === "worthyOpponent");
    if (income) return income;
  }
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
  if (card && canPayNow(state, card) && !attachBlocked(state, card) && find("playCard")) return find("playCard")!;

  const waitingAttach = blockedAttachInHand(state);
  if (waitingAttach && state.power < def(waitingAttach.defId).cost) {
    const gains = acts.filter((a) => a.kind === "gainPower").sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    if (gains[0] && state.power + (gains[0].amount ?? 1) <= 12) return gains[0];
  }

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

  if (!blocked && card && canPayNow(state, card) && !attachBlocked(state, card) && find("playCard")) {
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

  // Ending while Gain or a real clash is still open is what paced the ship and Skull Rock.
  const bank = bankableGain(state, acts);
  if (bank) return bank;

  if (find("vanquish") && preferredVanquishTarget(state)) return find("vanquish")!;

  return "end";
}

function bankableGain(state: GameState, acts: ActionSlot[]): ActionSlot | undefined {
  if (state.power >= 12) return undefined;
  return [...acts.filter((a) => a.kind === "gainPower")].sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1))[0];
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
    return "Click Play a Card, then Never Land Map in your hand, then Choose this place where the captain stands. The Map unlocks Hangman’s Tree from that square — until that hideout opens, Peter cannot start the walk to the ship.";
  }
  if (slot.kind === "playCard") {
    const card = usefulPlay(state);
    if (card && def(card.defId).type === "ally") {
      const home = playHome(state, card);
      return home === "jollyRoger"
        ? `Click Play a Card, then ${cardName(card)} in your hand, then ${placeVerb(home)}. An Ally on the Jolly Roger is Strength waiting for Peter.`
        : `Click Play a Card, then ${cardName(card)} in your hand, then ${placeVerb(home)}. Allies and Items land where the captain stands. Walk that crew toward the ship later with Move Ally/Item.`;
    }
    if (card && (card.defId === "worthyOpponent" || card.defId === "giveThemAScare")) {
      if (card.defId === "worthyOpponent" && needPowerForMap(state)) {
        return "Worthy Opponent costs no Power and gains 2 toward the Map’s 4-Power reserve. It also seats a Hero. Keep paid crew and Items waiting until the Map opens the tree.";
      }
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
    let base: string;
    const waitingAttach = blockedAttachInHand(state);
    if (needPowerForMap(state)) {
      base = `Save 4 Power so the held Never Land Map is affordable. Keep optional crew and Items waiting until the tree opens.${tokenLine}`;
    } else if (waitingAttach && state.power < def(waitingAttach.defId).cost) {
      const cost = def(waitingAttach.defId).cost;
      const ashore = preferredAttachAlly(state)
        ? ""
        : ` ${cardName(waitingAttach)} also needs an Ally already ashore.`;
      base = `You have ${state.power} Power; ${cardName(waitingAttach)} costs ${cost}. Gain before that attach is a real Play.${ashore}${tokenLine}`;
    } else {
      const pricey = cheapestUnaffordable(state);
      if (pricey && handHasOnlyUnaffordablePays(state)) {
        const cost = def(pricey.defId).cost;
        base = `Save ${cardName(pricey)} for when you have ${cost} Power. You have ${state.power} now, so that card is not a Play yet.${tokenLine}`;
      } else {
        base = `Bank Power as a reserve for the next Item or Ally you draw. That is why ${slot.label} still matters even when the Map is not in hand.${tokenLine}`;
      }
    }
    const stay = tickTockStayLine(state);
    return stay ? `${base} ${stay}` : base;
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

function endTurnWhy(state: GameState): string {
  const croc = tickTockAt(state);
  const crocLine = croc ? ` ${locName(croc)} has Tick Tock, so do not step on that square next.` : "";
  const slots = availableActions(state);
  const idle: string[] = [];
  const playOpen = slots.some((action) => action.kind === "playCard" && !action.used && !action.covered);
  const discardOpen = slots.some((action) => action.kind === "discard" && action.available);
  if (state.hand.length > 0 && playOpen && playableHandCards(state).length === 0) {
    idle.push("Play is uncovered, but nothing in hand can be paid right now.");
  } else if (state.hand.length > 0 && playOpen && !usefulPlay(state) && needPowerForMap(state)) {
    idle.push("Play is uncovered, but those cards would spend the Power saved for the Never Land Map.");
  }
  if (state.hand.length > 0 && discardOpen && discardPicks(state).length === 0) {
    idle.push("Discard is uncovered, but every card in hand still serves the chain.");
  } else if (discardOpen && mapReserveNeedsDig(state)) {
    const dig = discardPicks(state)[0];
    if (dig) idle.push(`Discard is uncovered. Dig ${cardName(dig)} for Power before ending.`);
  }
  const base = idle.length ? idle.join(" ") : "No Discard, Gain, or Play is left uncovered here.";
  const reserve = needPowerForMap(state)
    ? safeUncoveredGains(state).length === 0
      ? " Safe Gains are covered. Keep the held Map and do not step onto Tick Tock — that discards the Map. Use an open Discard to dig for a card that adds Power, such as Worthy Opponent."
      : " Keep the held Map and save its 4 Power before optional purchases. Revisit a safe Gain next turn even if that means returning to the last shore."
    : "";
  return `${base} Ending refills the hand.${reserve}${crocLine} The next move should be a stop where one of those actions is usable, not a walk back to a clash you cannot start.`;
}

function liveCunningAdvice(state: GameState): CoachAdvice | null {
  if (!canPlayCunning(state)) return null;
  const cunning = state.hand.find((card) => card.defId === "cunning");
  const ally = state.hand
    .filter((card) => def(card.defId).type === "ally")
    .sort((a, b) => def(b.defId).strength - def(a.defId).strength)[0];
  if (!cunning || !ally) return null;
  const dest = legalPlayLocations(state).includes("jollyRoger") ? "jollyRoger" : state.villainLocation;
  const ashore =
    dest === "jollyRoger"
      ? `${cardName(ally)} comes ashore on the Jolly Roger.`
      : `${cardName(ally)} comes ashore at ${locName(dest)}, where the captain stands.`;
  return say(
    `Play Cunning (click Cunning in your hand), then click ${cardName(ally)} and ${placeVerb(dest)}. It does not spend a Play a Card action.`,
    `A Hero of Strength 4 or more is ashore, and ${cardName(ally)} is in hand. ${ashore} Cunning is a printed Condition. This practice tool’s trigger lets you slip that Ally in for free on your turn.`,
    [`card:${cunning.instanceId}`],
    state,
  );
}

function liveObsessionAdvice(state: GameState): CoachAdvice | null {
  if (!canPlayObsession(state)) return null;
  const obsession = state.hand.find((card) => card.defId === "obsession");
  if (!obsession) return null;
  return say(
    "Play Obsession (click Obsession in your hand). If it finds Peter, play him — he goes to Hangman’s Tree.",
    "Peter is still hidden. Obsession is a printed Condition. This practice tool’s trigger lets you hunt your Fate deck on your turn without spending Play a Card. At a table it watches another player’s turn.",
    [`card:${obsession.instanceId}`],
    state,
  );
}

function adviseActions(state: GameState): CoachAdvice {
  const pick = pickAction(state);
  const finishingPeter = Boolean(pick && pick !== "end" && pick.kind === "vanquish" && peterReadyToFinish(state));
  if (!finishingPeter) {
    const cunning = liveCunningAdvice(state);
    if (cunning) return cunning;
  }
  if (!pick || pick === "end") {
    const obsession = liveObsessionAdvice(state);
    if (obsession) return obsession;
    return say(
      "End the turn (click End turn). Draw back to four, then Fate will answer.",
      endTurnWhy(state),
      ["btn:end"],
      state,
    );
  }
  return say(fullActionDo(state, pick), actionWhy(state, pick), [`act:${pick.key}`], state);
}

function playTargetWhy(card: CardInstance, dest: LocationId): string {
  if (def(card.defId).type === "effect") {
    return `Click ${cardName(card)} and follow its payment or effect choices. Effects resolve without choosing a place on the board.`;
  }
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
      const card = usefulPlay(state);
      if (!card) {
        const waiting = blockedAttachInHand(state);
        const why = needPowerForMap(state)
          ? "Keep the held Never Land Map and reserve 4 Power for it. Cancel this play rather than spend the reserve on optional crew or Items."
          : waiting
          ? discardWhy(state, [waiting])
          : "Nothing in hand is worth the action right now.";
        return say("Cancel the play (click Cancel)", why, ["btn:cancel"], state);
      }
      const why =
        card.defId === "neverLandMap"
          ? "The Map is the only key to Hangman’s Tree. Click it in your hand, then Choose this place where the captain stands."
          : def(card.defId).type === "ally"
            ? `Click ${cardName(card)} in your hand, then ${placeVerb(playHome(state, card))}. Allies at the Jolly Roger become the clash that finishes Peter.`
            : playTargetWhy(card, playHome(state, card));
      return say(playCta(state, card, "pick"), why, [`card:${card.instanceId}`], state);
    }
    case "playChooseLocation": {
      const card = findCard(state, p.cardId);
      if (!card) return say("Choose this place where the captain stands.", "Allies and Items from Play a Card land at the captain’s location.", [], state);
      const dest = playHome(state, card);
      return say(
        playCta(state, card, "place"),
        playTargetWhy(card, dest),
        [`loc:${dest}`],
        state,
      );
    }
    case "playChooseAllyAttach": {
      const held = findCard(state, p.cardId);
      if (held && attachBlocked(state, held)) {
        const why = state.power < def(held.defId).cost
          ? `You have ${state.power} Power; ${cardName(held)} costs ${def(held.defId).cost}. Cancel, then Gain Power or play an Ally.`
          : `${cardName(held)} needs an Ally already ashore. Cancel and play a crew member first.`;
        return say(`Cancel — ${cardName(held)} is not a play yet (click Cancel)`, why, ["btn:cancel"], state);
      }
      const pick = preferredAttachAlly(state);
      if (!pick) return say("Cancel — no Ally ashore (click Cancel)", "There is no Ally to arm. Cancel and play a crew member first.", ["btn:cancel"], state);
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
      const mapOut = Boolean(mapInRealm(state));
      const mapCoversItem = Boolean(
        card && def(card.defId).type === "item" && card.defId !== "neverLandMap" && mapOut,
      );
      if (state.power >= cost) {
        return say(
          `Pay ${cost} Power (click Pay ${cost} Power) — ${name} costs ${cost} and you have ${state.power}.`,
          mapOut
            ? "Keep the Never Land Map in the realm. You already used it to open the tree, and later Items can still lean on it if you are short."
            : `${name} costs ${cost}. You have ${state.power}. Click Pay ${cost} Power to finish the play.`,
          ["btn:pay-power"],
          state,
        );
      }
      if (mapCoversItem) {
        return say(
          "Discard the Map to pay (click Discard the Map)",
          "Power is short. The tree is already open, so spending the Map keeps this Item moving. The Map covers another Item, not an Ally or Effect.",
          ["btn:pay-map"],
          state,
        );
      }
      return say(
        "Cancel — not enough Power (click Cancel)",
        `${name} costs ${cost} and you have ${state.power}. Click Cancel in this window, or press Escape. That returns you safely so you can Gain more Power.`,
        ["btn:cancel"],
        state,
      );
    }
    case "discardSelect": {
      const junk = discardPicks(state, p.selected);
      if (junk[0]) {
        const name = cardName(junk[0]);
        const reason = discardWhy(state, junk).replace(/\.$/, "");
        return say(
          `Discard ${name} at ${locName(state.villainLocation)} — ${reason}. Click ${name} in your hand, then Confirm.`,
          discardWhy(state, junk),
          [`card:${junk[0].instanceId}`],
          state,
        );
      }
      if (p.selected.length) {
        const chosen = p.selected
          .map((id) => findCard(state, id))
          .filter((card): card is CardInstance => Boolean(card));
        if (chosen.length) {
          const name = chosen.map((card) => cardName(card)).join(" and ");
          return say(
            `Confirm discarding ${name} (click Confirm).`,
            `Discard ${name} to dig toward the next card that serves the chain.`,
            ["btn:confirm"],
            state,
          );
        }
      }
      return say(
        "Confirm to spend this action (click Confirm)",
        "Nothing extra to toss. Click Confirm to spend the action and stay on tempo.",
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
      const boysShort = hero?.defId === "lostBoys" && p.selected.length < 2;
      if (selectedStr >= need && p.selected.length > 0 && !boysShort) {
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
        if (hero?.defId === "lostBoys" && p.selected.length < 2) {
          return say(
            "Cancel the clash (click Cancel)",
            `Lost Boys need two Allies (${p.selected.length}/2), even when Strength is already met. One Ally cannot finish this clash.`,
            ["btn:cancel"],
            state,
          );
        }
        return say("Cancel the clash", "You do not have the Strength. Back out and gather more crew.", ["btn:cancel"], state);
      }
      const neighborCrew =
        nextAlly.ally.defId === "boardingParty" && heroLoc && nextAlly.location !== heroLoc
          ? ` ${BOARDING_REACH_WHY}`
          : "";
      const boysShortNow = hero?.defId === "lostBoys" && p.selected.length < 2;
      const addLine = boysShortNow
        ? `Add ${cardName(nextAlly.ally)} to the clash (click that Ally). Lost Boys need two Allies (${p.selected.length}/2), even when Strength already matches.`
        : `Add ${cardName(nextAlly.ally)} to the clash (click that Ally). You need ${need} Strength.`;
      return say(
        addLine,
        `Click ${cardName(nextAlly.ally)} now. Keep tapping Allies at this place until the total meets the Hero, then Confirm.${boysShortNow ? " Lost Boys need two Allies even if one Ally’s Strength is already enough." : ""}${neighborCrew}`,
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
      if (!ally) {
        return say(
          "Cancel — Cunning is already spent",
          "No Ally remains in hand. Cancel declines the free crew. The Condition stays in the discard and does not return.",
          ["btn:cancel"],
          state,
        );
      }
      const dest = bestAllyHome(state);
      const ashore =
        dest === "jollyRoger"
          ? "They come ashore on the Jolly Roger, where Peter’s clash is won."
          : `They come ashore at ${locName(dest)}, where the captain stands. Walk them toward the ship later with Move Ally/Item.`;
      return say(
        `Slip ${cardName(ally)} ashore for free (click ${cardName(ally)} in your hand, then ${placeVerb(dest)}).`,
        `Cunning is already in the discard and spends no Play action and no Power. ${ashore} Cancel declines the free crew and does not return the Condition.`,
        [`card:${ally.instanceId}`],
        state,
      );
    }
    case "cunningLocation": {
      const dest = bestAllyHome(state);
      const why =
        dest === "jollyRoger"
          ? "The free Ally comes ashore on the Jolly Roger. Cancel returns to the Ally choice; Cunning stays spent."
          : `The free Ally comes ashore at ${locName(dest)}, where the captain stands. Cancel returns to the Ally choice; Cunning stays spent.`;
      return say(`Place the Ally at ${locName(dest)} (click ${placeVerb(dest)}).`, why, [`loc:${dest}`], state);
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
      const dest = card ? parkHeroLocation(state, card) : unlockedLocations(state)[0];
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
        `Discard ${cardName(pick.item)} — it is the Item Splitting Headache can take.`,
        `Discard ${cardName(pick.item)}. Protect the Map and the Device if they are still helping the escort.`,
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
      const peeked = p.cards.map((card) => cardName(card)).join(" and ");
      if (croc || p.cards.some((c) => c.defId === "splittingHeadache")) {
        return say(
          `Discard both peeked cards — ${peeked}`,
          `Discard ${peeked}. Send the crocodile or the headache to the Fate discard so they do not land on your Map or your path. They can still return when Fate reshuffles.`,
          ["btn:scare-discard"],
          state,
        );
      }
      return say(
        `Discard both peeked cards — ${peeked}`,
        `Discard ${peeked}. A cleaner Fate deck makes Worthy Opponent and later hunts more likely to find Peter. Discarded cards can still return when Fate reshuffles.`,
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
        return say(
          "Discard Tick Tock",
          "Tick Tock is a hand-wiping trap. He goes to the Fate discard and can return when Fate reshuffles. This is not remove-from-game.",
          ["btn:discard-hero"],
          state,
        );
      }
      const found = hero ? cardName(hero) : "this Hero";
      return say(
        `Discard ${found}`,
        `${found} goes to the Fate discard and can return when Fate reshuffles. A quieter realm leaves your actions uncovered while you finish the Map and the walk.`,
        ["btn:discard-hero"],
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
    const namedDiscard = discard ? discardDo(state, locName(state.villainLocation)) : null;
    if (discard && namedDiscard) {
      return say(namedDiscard, discardWhy(state, discardPicks(state)), [`act:${discard.key}`], state);
    }
  }
  if (state.phase === "move" && !state.pending) {
    const choice = chooseMove(state);
    const dest = choice.dest;
    const next: GameState = { ...state, villainLocation: dest, usedActions: [], pending: null, phase: "actions" };
    const gains = liveSlots(next, dest)
      .filter((a) => a.kind === "gainPower")
      .sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    const namedDiscard = hasKind(next, dest, "discard") ? discardDo(next, locName(dest)) : null;
    const follow = gains[0]
      ? `then take ${gains[0].label}`
      : namedDiscard
        ? `then ${namedDiscard.replace(/\.$/, "")}`
        : "then bank Power before you play";
    return say(
      `Move to ${locName(dest)} (click Move here on ${locName(dest)}), ${follow}.`,
      withBounceWhy(state, choice, save),
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

function attachCtaBlocked(state: GameState, text: string): CardInstance | null {
  const cards = [...state.hand];
  if (state.pending && "cardId" in state.pending) {
    const held = findCard(state, state.pending.cardId);
    if (held && !cards.some((card) => card.instanceId === held.instanceId)) cards.push(held);
  }
  for (const card of cards) {
    if (!attachBlocked(state, card)) continue;
    const name = escapeRegExp(cardName(card));
    if (new RegExp(`\\bplay ${name}\\b`, "i").test(text)) return card;
    if (new RegExp(`\\bstrap the ${name}\\b`, "i").test(text)) return card;
  }
  return null;
}

function rescueBlockedAttach(state: GameState, card: CardInstance): CoachAdvice {
  const name = cardName(card);
  const cost = def(card.defId).cost;
  const bits: string[] = [];
  if (state.power < cost) bits.push(`You have ${state.power} Power; ${name} costs ${cost}.`);
  if (!preferredAttachAlly(state)) bits.push(`${name} needs an Ally already ashore.`);
  const why = `${bits.join(" ")} Gain Power, play an Ally, or discard ${name} to dig.`.trim();
  const pendingKind = state.pending?.kind;
  if (
    pendingKind === "playChooseCard" ||
    pendingKind === "playChooseLocation" ||
    pendingKind === "playChooseAllyAttach" ||
    pendingKind === "playChoosePayment"
  ) {
    return say(`Cancel — ${name} is not a play yet (click Cancel)`, why, ["btn:cancel"], state);
  }
  if (state.phase === "actions" && !state.pending) {
    const acts = liveActions(state);
    const playCard = acts.find((a) => a.kind === "playCard");
    const ally = usefulPlay(state);
    if (ally && playCard && def(ally.defId).type === "ally") {
      return say(playCta(state, ally, "open"), actionWhy(state, playCard), [`act:${playCard.key}`], state);
    }
    const gains = [...acts.filter((a) => a.kind === "gainPower")].sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    if (state.power < cost && gains[0]) return say(fullActionDo(state, gains[0]), why, [`act:${gains[0].key}`], state);
    const discard = acts.find((a) => a.kind === "discard");
    const named = discard ? discardDo(state, locName(state.villainLocation)) : null;
    if (discard && named) return say(named, discardWhy(state, discardPicks(state)), [`act:${discard.key}`], state);
    if (gains[0]) return say(fullActionDo(state, gains[0]), why, [`act:${gains[0].key}`], state);
  }
  if (state.phase === "move" && !state.pending) {
    const choice = chooseMove(state);
    const dest = choice.dest;
    const next: GameState = { ...state, villainLocation: dest, usedActions: [], pending: null, phase: "actions" };
    const gains = liveSlots(next, dest)
      .filter((a) => a.kind === "gainPower")
      .sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    const named = hasKind(next, dest, "discard") ? discardDo(next, locName(dest)) : null;
    const ally = usefulPlay(next);
    const follow =
      ally && def(ally.defId).type === "ally"
        ? `then play ${cardName(ally)}`
        : state.power < cost && gains[0]
          ? `then take ${gains[0].label}`
          : named
            ? `then ${named.replace(/\.$/, "")}`
            : gains[0]
              ? `then take ${gains[0].label}`
              : "then bank Power before you play";
    return say(
      `Move to ${locName(dest)} (click Move here on ${locName(dest)}), ${follow}.`,
      withBounceWhy(state, choice, why),
      [`loc:${dest}`],
      state,
    );
  }
  return say("End the turn (click End turn). Draw back to four, then Fate will answer.", why, ["btn:end"], state);
}

function guardBlockedAttach(state: GameState, advice: CoachAdvice): CoachAdvice {
  const blocked = attachCtaBlocked(state, advice.do);
  if (!blocked) return advice;
  return rescueBlockedAttach(state, blocked);
}

function discardNames(state: GameState): string[] {
  const names = [
    ...state.hand.map((card) => cardName(card)),
    ...allLocationItems(state).map(({ item }) => cardName(item)),
  ];
  if (state.pending?.kind === "scarePeek") names.push(...state.pending.cards.map((card) => cardName(card)));
  if (state.pending?.kind === "obsessionDecide") {
    const hero = state.heldCard ?? findCard(state, state.pending.heroId);
    if (hero) names.push(cardName(hero));
  }
  if (state.pending?.kind === "discardSelect") {
    for (const id of state.pending.selected) {
      const card = findCard(state, id);
      if (card) names.push(cardName(card));
    }
  }
  return names;
}

/** A Discard headline that never names the card being tossed. */
function bareDiscardHeadline(state: GameState, text: string): boolean {
  if (!/\bDiscard\b/.test(text)) return false;
  if (/no uncovered Discard/i.test(text)) return false;
  if (/Discard the Map/i.test(text)) return false;
  return !discardNames(state).some((name) => name.length > 0 && text.includes(name));
}

function guardNamedDiscard(state: GameState, advice: CoachAdvice): CoachAdvice {
  if (!bareDiscardHeadline(state, advice.do)) {
    const named = discardNames(state).find((name) => advice.do.includes(name) && /\bDiscard\b/.test(advice.do));
    if (named && !advice.why.includes(named) && !/Discard the Map/i.test(advice.do)) {
      return { ...advice, why: `${advice.why} Discard ${named}.` };
    }
    return advice;
  }
  const picks = discardPicks(state);
  if (picks[0]) {
    const named = discardDo(state, locName(state.villainLocation));
    if (named) {
      const move = advice.do.match(/^(Move to .+?\), )\s*/);
      return {
        ...advice,
        do: move ? `${move[1]}${named}` : named,
        why: advice.why.includes(cardName(picks[0])) ? advice.why : discardWhy(state, picks),
      };
    }
  }
  if (state.pending?.kind === "scarePeek" && state.pending.cards[0]) {
    const peeked = state.pending.cards.map((card) => cardName(card)).join(" and ");
    return {
      ...advice,
      do: `Discard both peeked cards — ${peeked}`,
      why: advice.why.includes(state.pending.cards[0] ? cardName(state.pending.cards[0]) : peeked)
        ? advice.why
        : `Discard ${peeked}. ${advice.why}`,
    };
  }
  const stripped = advice.do.replace(/\bDiscard\b[^.]*\.?/g, "").replace(/\s+/g, " ").trim();
  return {
    ...advice,
    do: stripped.length > 12 ? stripped : "End the turn (click End turn). Draw back to four, then Fate will answer.",
    why: advice.why,
  };
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
  const advice = withWalkOnWhy(state, guardAffordability(state, clampToLegal(state, adviseUnchecked(state))));
  return guardNamedDiscard(state, guardBlockedAttach(state, advice));
}
