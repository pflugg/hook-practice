/**
 * Play complete Hook vs computer Fate games from the deal to a win or a loss.
 *
 *   npx vite-node scripts/soak-games.ts -- --games 200 --out /tmp/hook-soak/summary.json
 *
 * Seeds are `seedStart + i` (default start 1). Even indexes play Easy, odd indexes play Normal.
 * The captain unlocks the hideout, then follows the hammer policy until Peter is aboard.
 * After that a closing plan stacks Strength on the ship and vanquishes him. Computer Fate answers each
 * End turn. A click that does not change the board is retried from the legal highlight set.
 * Games are not resigned at a turn cap. Hitting the step or turn guard is a stall.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { def } from "../src/engine/cards";
import { applyInput, createGame, highlightSet } from "../src/engine/game";
import { allyStrength, availableActions, canPlayCunning, hasTaunt, heroStrength, legalMoveLocations, mapInRealm, movableHeroes, playableHandCards, vanquishAllyPoolAt, vanquishableHeroes } from "../src/engine/queries";
import { LOCATION_IDS, type CardInstance, type Difficulty, type GameState, type Input, type LocationId } from "../src/engine/types";

interface Rng {
  next: () => number;
  pick: <T>(items: T[]) => T;
}

type Policy = (state: GameState, rng: Rng) => Input | null;
type Progress = (state: GameState) => Input[];

let policy: Policy | null = null;
let progress: Progress | null = null;
let rngFor: ((seed: number) => Rng) | null = null;

export async function loadHammer(): Promise<void> {
  process.env.HAMMER_AS_LIB = "1";
  const hammer = await import("./hammer-worker");
  policy = hammer.policyInput;
  progress = hammer.progressing;
  rngFor = hammer.makeRng;
}

const STEP_CAP = 3500;
const TURN_CAP = 120;
const STEPS_PER_TURN_CAP = 80;
const SLOW_GAME_MS = 5000;

interface GameRow {
  seed: number;
  difficulty: Difficulty;
  result: "win" | "loss" | "crash" | "stall" | "invariant";
  turns: number;
  steps: number;
  ms: number;
  heapUsed: number;
  detail: string;
  probes: string[];
}

interface SoakSummary {
  gamesRequested: number;
  finished: number;
  wins: number;
  losses: number;
  crashes: number;
  stalls: number;
  invariantViolations: number;
  slowGames: number;
  avgTurns: number;
  avgMs: number;
  maxMs: number;
  maxHeapUsed: number;
  heapAtStart: number;
  heapAtEnd: number;
  rows: GameRow[];
}

const args = process.argv.slice(2);
function arg(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  const value = i >= 0 ? args[i + 1] : undefined;
  return value ?? fallback;
}

function boardKey(input: Input): string | null {
  if (input.type === "selectLocation") return `loc:${input.locationId}`;
  if (input.type === "selectAction") return `act:${input.actionKey}`;
  if (input.type === "selectCard") return `card:${input.instanceId}`;
  return null;
}

function cardIds(state: GameState): string[] {
  const ids: string[] = [];
  const push = (card?: CardInstance | null) => {
    if (card) ids.push(card.instanceId);
  };
  for (const card of state.hand) push(card);
  for (const card of state.villainDeck) push(card);
  for (const card of state.villainDiscard) push(card);
  for (const card of state.fateDeck) push(card);
  for (const card of state.fateDiscard) push(card);
  for (const id of LOCATION_IDS) {
    const loc = state.locations[id];
    for (const card of loc.heroes) push(card);
    for (const card of loc.allies) push(card);
    for (const card of loc.items) push(card);
  }
  for (const row of state.attachments) push(row.item);
  const seen = new Set(ids);
  if (state.heldCard && !seen.has(state.heldCard.instanceId)) push(state.heldCard);
  const pending = state.pending;
  if (pending && "cards" in pending && Array.isArray(pending.cards)) {
    for (const card of pending.cards) {
      if (!seen.has(card.instanceId)) {
        push(card);
        seen.add(card.instanceId);
      }
    }
  }
  return ids;
}

function fingerprint(state: GameState): string {
  const pending = state.pending;
  let extra = "";
  if (pending && "selected" in pending && Array.isArray(pending.selected)) extra += pending.selected.join(",");
  if (pending && "cardId" in pending) extra += pending.cardId;
  if (pending && "heroId" in pending) extra += pending.heroId;
  if (pending && "pieceId" in pending) extra += pending.pieceId;
  if (pending && "allyId" in pending) extra += pending.allyId;
  const realm = LOCATION_IDS.map((id) => {
    const loc = state.locations[id];
    return [...loc.heroes, ...loc.allies, ...loc.items].map((card) => card.instanceId).join(".");
  }).join("/");
  return [
    state.phase,
    pending?.kind ?? "",
    extra,
    state.power,
    state.villainLocation,
    state.hand.map((card) => card.instanceId).join(","),
    state.usedActions.join(","),
    state.turn,
    state.rivalProgress,
    state.won ? 1 : 0,
    state.lost ? 1 : 0,
    state.hangmansUnlocked ? 1 : 0,
    realm,
    state.attachments.map((row) => `${row.item.instanceId}@${row.attachedTo}`).join(","),
  ].join("|");
}

function invariants(state: GameState, origin: Set<string>): string[] {
  const problems: string[] = [];
  if (state.power < 0) problems.push("negative-power");
  if (!state.hangmansUnlocked && state.villainLocation === "hangmansTree") problems.push("captain-on-locked-tree");
  if (state.won && state.lost) problems.push("won-and-lost");
  if ((state.won || state.lost) && state.phase !== "over") problems.push("terminal-without-over");
  if (state.phase === "over" && !state.won && !state.lost) problems.push("over-without-result");
  if (state.won) {
    const clash = state.voyage.lastClash;
    if (!clash || clash.heroName !== "Peter Pan" || !clash.onShip) problems.push("win-off-ship");
  }
  if (state.lost && !/Jolly Roger|rival villain/i.test(state.loseReason)) {
    problems.push(`loss-reason:${state.loseReason || "empty"}`);
  }
  if (state.peterPanLocation) {
    const at = state.locations[state.peterPanLocation].heroes.some((hero) => hero.defId === "peterPan");
    if (!at) problems.push("peter-desync");
  }
  const ids = cardIds(state);
  if (new Set(ids).size !== ids.length) problems.push("duplicate-card");
  const now = new Set(ids);
  const missing = [...origin].filter((id) => !now.has(id));
  const extra = [...now].filter((id) => !origin.has(id));
  if (missing.length || extra.length) problems.push(`card-census missing ${missing.length} extra ${extra.length}`);
  const dupUsed = state.usedActions.filter((key, index) => state.usedActions.indexOf(key) !== index);
  if (dupUsed.length) problems.push("used-action-twice");
  if (!state.hangmansUnlocked && state.phase === "move" && !state.pending) {
    const refused = applyInput(state, { type: "selectLocation", locationId: "hangmansTree" });
    if (refused.villainLocation === "hangmansTree") problems.push("locked-tree-move-accepted");
  }
  if (state.pending?.kind === "conditionOffer") {
    const refused = applyInput(state, { type: "endTurn" });
    if (refused.pending?.kind !== "conditionOffer" || refused.turn !== state.turn) problems.push("end-turn-during-condition-offer");
  }
  return problems;
}

function boardChangedIllegally(state: GameState, input: Input, next: GameState): boolean {
  const key = boardKey(input);
  if (!key) return false;
  const legal = highlightSet(state);
  const allowed = legal.has(key) || (input.type === "selectCard" && legal.has(`sel:${input.instanceId}`));
  if (allowed) return false;
  return fingerprint(next) !== fingerprint(state);
}

interface Rated {
  score: number;
  input: Input;
}

type CaptainMode = "unlock" | "crew";

function peterShip(state: GameState): boolean {
  return state.locations.jollyRoger.heroes.some((hero) => hero.defId === "peterPan");
}

function captainMode(state: GameState): CaptainMode | null {
  if (!state.hangmansUnlocked) return "unlock";
  if (peterShip(state)) return "crew";
  return null;
}

function fresh(state: GameState, location: LocationId): GameState {
  return { ...state, villainLocation: location, phase: "actions", pending: null, usedActions: [] };
}

function openSlot(state: GameState, kind: "gainPower" | "discard" | "playCard" | "vanquish" | "moveItemAlly" | "moveHero") {
  return availableActions(state).find((action) => action.available && action.kind === kind) ?? null;
}

function handCard(state: GameState, defId: string): CardInstance | undefined {
  return state.hand.find((card) => card.defId === defId);
}

function findSpot(state: GameState, instanceId: string): LocationId | null {
  for (const id of LOCATION_IDS) {
    const loc = state.locations[id];
    if ([...loc.heroes, ...loc.allies, ...loc.items].some((card) => card.instanceId === instanceId)) return id;
  }
  return null;
}

function westOf(id: LocationId): LocationId | null {
  const index = LOCATION_IDS.indexOf(id);
  if (index <= 0) return null;
  return LOCATION_IDS[index - 1] ?? null;
}

function eastOf(id: LocationId): LocationId | null {
  const index = LOCATION_IDS.indexOf(id);
  if (index < 0 || index >= LOCATION_IDS.length - 1) return null;
  return LOCATION_IDS[index + 1] ?? null;
}

function crocAt(state: GameState): LocationId | null {
  for (const id of LOCATION_IDS) {
    if (state.locations[id].heroes.some((hero) => hero.defId === "tickTock")) return id;
  }
  return null;
}

function snapsHand(state: GameState, location: LocationId): boolean {
  return crocAt(state) === location && state.hand.length > 0;
}

function strengthAt(state: GameState, ally: CardInstance, location: LocationId): number {
  let total = def(ally.defId).strength;
  if (ally.defId === "smee" && location === "jollyRoger") total += 2;
  total += 2 * state.attachments.filter((row) => row.attachedTo === ally.instanceId && row.item.defId === "cutlass").length;
  total += state.tempStrength[ally.instanceId] ?? 0;
  return total;
}

function allySpots(state: GameState): { ally: CardInstance; location: LocationId }[] {
  return LOCATION_IDS.flatMap((id) => state.locations[id].allies.map((ally) => ({ ally, location: id })));
}

function peterNeed(state: GameState): number {
  for (const id of LOCATION_IDS) {
    const peter = state.locations[id].heroes.find((hero) => hero.defId === "peterPan");
    if (peter) return heroStrength(state, peter);
  }
  return 8;
}

function joinsShip(ally: CardInstance, location: LocationId): boolean {
  return location === "jollyRoger" || (ally.defId === "boardingParty" && location === "skullRock");
}

function shipPoolTotal(state: GameState): number {
  const view = { ...state, villainLocation: "jollyRoger" as const };
  return vanquishAllyPoolAt(view, "jollyRoger").reduce((sum, row) => sum + allyStrength(view, row.ally), 0);
}

function clashGap(state: GameState): number {
  return Math.max(0, peterNeed(state) - shipPoolTotal(state));
}

function reachableStrength(state: GameState): number {
  const ashore = allySpots(state).reduce((sum, spot) => sum + strengthAt(state, spot.ally, "jollyRoger"), 0);
  const held = state.hand
    .filter((card) => def(card.defId).type === "ally")
    .reduce((sum, ally) => sum + strengthAt(state, ally, "jollyRoger"), 0);
  const cutlass = state.hand.filter((card) => card.defId === "cutlass").length * 2;
  return ashore + held + cutlass;
}

interface Shift {
  ally: CardInstance;
  from: LocationId;
  dest: LocationId;
  gain: number;
}

function bestShift(state: GameState): Shift | null {
  let best: { shift: Shift; score: number } | null = null;
  for (const spot of allySpots(state)) {
    const dest = westOf(spot.location);
    if (!dest) continue;
    if ((dest === "hangmansTree" || spot.location === "hangmansTree") && !state.hangmansUnlocked) continue;
    const before = joinsShip(spot.ally, spot.location) ? strengthAt(state, spot.ally, spot.location) : 0;
    const after = joinsShip(spot.ally, dest) ? strengthAt(state, spot.ally, dest) : 0;
    const gain = after - before;
    const closer = LOCATION_IDS.indexOf(dest) < LOCATION_IDS.indexOf(spot.location);
    if (gain <= 0 && !closer) continue;
    const score = gain * 100 + (closer ? 1 : 0);
    if (!best || score > best.score) best = { shift: { ally: spot.ally, from: spot.location, dest, gain }, score };
  }
  return best?.shift ?? null;
}

function playableNamed(state: GameState, defId: string): CardInstance | null {
  const card = handCard(state, defId);
  if (!card) return null;
  return playableHandCards(state).some((playable) => playable.instanceId === card.instanceId) ? card : null;
}

function playableAlly(state: GameState): CardInstance | null {
  const playable = new Set(playableHandCards(state).map((card) => card.instanceId));
  const allies = state.hand.filter((card) => def(card.defId).type === "ally" && playable.has(card.instanceId));
  allies.sort((a, b) => strengthAt(state, b, "jollyRoger") - strengthAt(state, a, "jollyRoger"));
  return allies[0] ?? null;
}

function bestHandAlly(state: GameState): CardInstance | null {
  const allies = state.hand.filter((card) => def(card.defId).type === "ally");
  allies.sort((a, b) => strengthAt(state, b, "jollyRoger") - strengthAt(state, a, "jollyRoger"));
  return allies[0] ?? null;
}

function powerShort(state: GameState): number {
  const costs: number[] = [];
  for (const card of state.hand) {
    if (def(card.defId).type === "ally") costs.push(def(card.defId).cost);
  }
  if (handCard(state, "cutlass") && !canPayTauntThenPeter(state) && allySpots(state).length > 0) costs.push(def("cutlass").cost);
  if (handCard(state, "ayeAyeSir") && (bestShift(state)?.gain ?? 0) > 0) costs.push(def("ayeAyeSir").cost);
  if (costs.length === 0) return 0;
  return Math.max(0, Math.min(...costs) - state.power);
}

function peterReady(state: GameState): boolean {
  return vanquishableHeroes(state).some((hero) => hero.hero.defId === "peterPan" && hero.location === "jollyRoger");
}

function tauntedFoes(state: GameState): { hero: CardInstance; location: LocationId }[] {
  const foes: { hero: CardInstance; location: LocationId }[] = [];
  for (const id of LOCATION_IDS) {
    for (const hero of state.locations[id].heroes) {
      if (hero.defId === "peterPan" || !hasTaunt(state, hero.instanceId)) continue;
      foes.push({ hero, location: id });
    }
  }
  return foes;
}

function clashStrengths(state: GameState): number[] {
  const values = [
    ...allySpots(state).map((spot) => strengthAt(state, spot.ally, "jollyRoger")),
    ...state.hand.filter((card) => def(card.defId).type === "ally").map((ally) => strengthAt(state, ally, "jollyRoger")),
  ];
  values.sort((a, b) => b - a);
  const cutlasses = state.hand.filter((card) => card.defId === "cutlass").length;
  for (let i = 0; i < cutlasses && i < values.length; i += 1) values[i] = (values[i] ?? 0) + 2;
  return values;
}

function withoutMask(strengths: number[], mask: number): number[] {
  return strengths.filter((_, index) => (mask & (1 << index)) === 0);
}

function affordableTauntNow(state: GameState, foe: { hero: CardInstance; location: LocationId }): boolean {
  const pool = vanquishAllyPoolAt(state, foe.location).map((row) => allyStrength(state, row.ally));
  const need = heroStrength(state, foe.hero);
  const minCount = foe.hero.defId === "lostBoys" ? 2 : 1;
  const mask = cheapestMask(pool, need, minCount);
  if (mask === null) return false;
  let remaining = clashStrengths(state).slice();
  for (const strength of pool.filter((_, index) => (mask & (1 << index)) !== 0)) {
    const index = remaining.indexOf(strength);
    if (index >= 0) remaining.splice(index, 1);
  }
  for (const other of tauntedFoes(state)) {
    if (other.hero.instanceId === foe.hero.instanceId) continue;
    const otherNeed = heroStrength(state, other.hero);
    const otherCount = other.hero.defId === "lostBoys" ? 2 : 1;
    const otherMask = cheapestMask(remaining, otherNeed, otherCount);
    if (otherMask === null) return false;
    remaining = withoutMask(remaining, otherMask);
  }
  return remaining.reduce((sum, strength) => sum + strength, 0) >= peterNeed(state);
}

function canPayTauntThenPeter(state: GameState): boolean {
  const foes = tauntedFoes(state);
  if (foes.length === 0) return clashGap(state) <= 0;
  let remaining = clashStrengths(state);
  let spent = 0;
  for (const foe of foes) {
    const need = heroStrength(state, foe.hero);
    const minCount = foe.hero.defId === "lostBoys" ? 2 : 1;
    const mask = cheapestMask(remaining, need, minCount);
    if (mask === null) return false;
    let cost = 0;
    remaining = remaining.filter((strength, index) => {
      if ((mask & (1 << index)) === 0) return true;
      cost += strength;
      return false;
    });
    spent += cost;
  }
  const total = clashStrengths(state).reduce((sum, value) => sum + value, 0);
  return total - spent >= peterNeed(state);
}

function cheapestMask(strengths: number[], need: number, minCount: number): number | null {
  const width = strengths.length;
  if (width > 16) return null;
  let bestMask: number | null = null;
  let best = Infinity;
  const limit = 1 << width;
  for (let mask = 0; mask < limit; mask += 1) {
    let count = 0;
    let sum = 0;
    for (let i = 0; i < width; i += 1) {
      if ((mask & (1 << i)) === 0) continue;
      count += 1;
      sum += strengths[i] ?? 0;
    }
    if (count < minCount || sum < need || sum >= best) continue;
    best = sum;
    bestMask = mask;
  }
  return bestMask;
}

function lagoonBlocker(state: GameState): CardInstance | null {
  return state.locations.mermaidLagoon.heroes.find((hero) => hero.defId !== "peterPan") ?? null;
}

function tauntToWalk(state: GameState): CardInstance | null {
  if (!canPayTauntThenPeter(state)) return null;
  const movable = new Set(movableHeroes(state).map((hero) => hero.instanceId));
  for (let index = LOCATION_IDS.length - 1; index >= 0; index -= 1) {
    const id = LOCATION_IDS[index];
    if (!id || id === "jollyRoger") continue;
    const hero = state.locations[id].heroes.find(
      (card) => card.defId !== "peterPan" && hasTaunt(state, card.instanceId) && movable.has(card.instanceId),
    );
    if (hero) return hero;
  }
  return null;
}

function heroToMove(state: GameState): CardInstance | null {
  const movable = new Set(movableHeroes(state).map((hero) => hero.instanceId));
  const candidates: CardInstance[] = [];
  const crocHome = crocAt(state);
  if (crocHome === "jollyRoger" || crocHome === "mermaidLagoon") {
    const croc = state.locations[crocHome].heroes.find((hero) => hero.defId === "tickTock");
    if (croc && movable.has(croc.instanceId)) candidates.push(croc);
  }
  const walked = tauntToWalk(state);
  if (walked) candidates.push(walked);
  const blocker = lagoonBlocker(state);
  const offShip = allySpots(state).some((spot) => spot.location !== "jollyRoger");
  if (blocker && movable.has(blocker.instanceId) && (offShip || powerShort(state) > 0)) candidates.push(blocker);
  return candidates.find((hero) => heroDest(state, hero.instanceId)) ?? null;
}

function alliesRemain(state: GameState): boolean {
  const piles = [...state.hand, ...state.villainDeck, ...state.villainDiscard, ...allySpots(state).map((spot) => spot.ally)];
  return piles.some((card) => def(card.defId).type === "ally");
}

function junk(state: GameState): CardInstance[] {
  const mode = captainMode(state);
  const keepCunning = state.hand.find((card) => card.defId === "cunning");
  return state.hand.filter((card) => {
    if (mode === "unlock") {
      if (card.defId === "neverLandMap") return false;
      if (card.defId === "worthyOpponent" && state.power < 4 && handCard(state, "neverLandMap")) return false;
      return !handCard(state, "neverLandMap");
    }
    if (def(card.defId).type === "ally") return false;
    if (card.defId === "cutlass" && !canPayTauntThenPeter(state)) return false;
    if (card.defId === "ingeniousDevice" && tauntedFoes(state).some((foe) => foe.location !== "jollyRoger")) return false;
    if (card.defId === "ayeAyeSir" && bestShift(state)) return false;
    if (card.defId === "cunning" && alliesRemain(state) && card === keepCunning) return false;
    if (card.defId === "obsession" && !state.peterPanRevealed) return false;
    return true;
  });
}

function heroDest(state: GameState, heroId: string): LocationId | null {
  const from = findSpot(state, heroId);
  if (!from) return null;
  const hero = state.locations[from].heroes.find((card) => card.instanceId === heroId);
  if (hero && hero.defId !== "peterPan" && hasTaunt(state, hero.instanceId)) {
    const handFeedsClash = state.hand.some((card) => def(card.defId).type === "ally" || card.defId === "cutlass");
    if (from === "jollyRoger" && handFeedsClash && !canPayTauntThenPeter({ ...state, hand: [] })) {
      const east = eastOf(from);
      if (east) return east;
    }
    if (canPayTauntThenPeter(state)) {
      const west = westOf(from);
      if (west && (west !== "hangmansTree" || state.hangmansUnlocked)) return west;
    } else if (from === "jollyRoger" || from === "mermaidLagoon") {
      const east = eastOf(from);
      if (east && (east !== "hangmansTree" || state.hangmansUnlocked)) return east;
    }
    return null;
  }
  const preferred: LocationId[] = hero?.defId === "tickTock"
    ? ["hangmansTree", "skullRock", "mermaidLagoon", "jollyRoger"]
    : ["skullRock", "hangmansTree", "mermaidLagoon", "jollyRoger"];
  for (const dest of preferred) {
    if (dest === from) continue;
    if (dest === "hangmansTree" && !state.hangmansUnlocked) continue;
    if (Math.abs(LOCATION_IDS.indexOf(dest) - LOCATION_IDS.indexOf(from)) !== 1) continue;
    return dest;
  }
  return null;
}

function bestRated(options: Rated[]): Rated | null {
  let best: Rated | null = null;
  for (const option of options) {
    if (!best || option.score > best.score) best = option;
  }
  return best;
}

function rateUnlock(state: GameState): Rated | null {
  const map = handCard(state, "neverLandMap");
  const play = openSlot(state, "playCard");
  const gain = openSlot(state, "gainPower");
  const discard = openSlot(state, "discard");
  const snapped = snapsHand(state, state.villainLocation);
  const worthy = playableNamed(state, "worthyOpponent");
  const options: Rated[] = [];
  if (map && state.power >= 4 && play && !snapped) {
    options.push({ score: 100, input: { type: "selectAction", actionKey: play.key } });
  }
  if (state.power < 4 && gain && !snapped) {
    options.push({ score: 90 + (gain.amount ?? 1), input: { type: "selectAction", actionKey: gain.key } });
  }
  if (worthy && map && state.power < 4 && state.power + 2 >= 4 && play && !snapped) {
    options.push({ score: 85, input: { type: "selectAction", actionKey: play.key } });
  }
  if (!map && state.power >= 4 && discard && junk(state).length > 0 && !snapped) {
    options.push({ score: 70, input: { type: "selectAction", actionKey: discard.key } });
  }
  if (state.power < 4 && gain && snapped) {
    options.push({ score: 30, input: { type: "selectAction", actionKey: gain.key } });
  }
  return bestRated(options);
}

function rateCrew(state: GameState): Rated | null {
  const options: Rated[] = [];
  const vanquish = openSlot(state, "vanquish");
  const gap = clashGap(state);
  const play = openSlot(state, "playCard");
  if (vanquish && peterReady(state)) {
    options.push({ score: 1000, input: { type: "selectAction", actionKey: vanquish.key } });
  }
  if (
    vanquish &&
    vanquishableHeroes(state).some(
      (hero) => hero.hero.defId !== "peterPan" && hasTaunt(state, hero.hero.instanceId) && affordableTauntNow(state, hero),
    )
  ) {
    options.push({ score: 960, input: { type: "selectAction", actionKey: vanquish.key } });
  }
  if (vanquish && gap <= 0 && tauntedFoes(state).length === 0 && vanquishableHeroes(state).some((hero) => hero.hero.defId !== "peterPan")) {
    options.push({ score: 900, input: { type: "selectAction", actionKey: vanquish.key } });
  }
  const cunning = handCard(state, "cunning");
  if (cunning && state.villainLocation === "jollyRoger" && canPlayCunning(state)) {
    const ally = bestHandAlly(state);
    options.push({
      score: 800 + (ally ? strengthAt(state, ally, "jollyRoger") : 0),
      input: { type: "selectCard", instanceId: cunning.instanceId },
    });
  }
  if (play && state.villainLocation === "jollyRoger") {
    const ally = playableAlly(state);
    if (ally) {
      options.push({ score: 700 + strengthAt(state, ally, "jollyRoger"), input: { type: "selectAction", actionKey: play.key } });
    }
  }
  const cutlass = playableNamed(state, "cutlass");
  if (play && cutlass && !canPayTauntThenPeter(state) && allySpots(state).length > 0) {
    options.push({ score: gap <= 2 ? 680 : 520, input: { type: "selectAction", actionKey: play.key } });
  }
  const device = playableNamed(state, "ingeniousDevice");
  if (play && device && state.villainLocation === "jollyRoger" && tauntedFoes(state).some((foe) => foe.location !== "jollyRoger")) {
    options.push({ score: 640, input: { type: "selectAction", actionKey: play.key } });
  }
  const aye = playableNamed(state, "ayeAyeSir");
  const shift = bestShift(state);
  if (play && aye && shift && shift.gain > 0) {
    options.push({ score: gap <= shift.gain + 2 ? 660 : 480, input: { type: "selectAction", actionKey: play.key } });
  }
  const move = openSlot(state, "moveItemAlly");
  if (move && shift && (shift.gain > 0 || reachableStrength(state) >= peterNeed(state))) {
    options.push({ score: shift.gain > 0 ? 400 + shift.gain * 20 : 250, input: { type: "selectAction", actionKey: move.key } });
  }
  const moveHero = openSlot(state, "moveHero");
  const moving = heroToMove(state);
  if (moveHero && moving) {
    const clearingTaunt = hasTaunt(state, moving.instanceId) && moving.defId !== "peterPan";
    const urgent = clearingTaunt && canPayTauntThenPeter(state);
    const parkingCroc = moving.defId === "tickTock" && !hasTaunt(state, moving.instanceId) && !canPayTauntThenPeter(state);
    options.push({ score: urgent ? 970 : clearingTaunt ? 450 : parkingCroc ? 100 : 350, input: { type: "selectAction", actionKey: moveHero.key } });
  }
  const gain = openSlot(state, "gainPower");
  const short = powerShort(state);
  const snapped = snapsHand(state, state.villainLocation);
  if (gain && short > 0 && !snapped) {
    options.push({ score: 300 + (gain.amount ?? 1) * 10, input: { type: "selectAction", actionKey: gain.key } });
  }
  const discard = openSlot(state, "discard");
  if (discard && junk(state).length > 0 && !canPayTauntThenPeter(state) && !snapped) {
    options.push({ score: 280, input: { type: "selectAction", actionKey: discard.key } });
  }
  if (move && shift) options.push({ score: 150, input: { type: "selectAction", actionKey: move.key } });
  if (gain && short > 0) options.push({ score: 40, input: { type: "selectAction", actionKey: gain.key } });
  return bestRated(options);
}

function rate(state: GameState): Rated | null {
  const mode = captainMode(state);
  if (mode === "unlock") return rateUnlock(state);
  if (mode === "crew") return rateCrew(state);
  return null;
}

function attachHost(state: GameState): CardInstance | null {
  const view = { ...state, villainLocation: "jollyRoger" as const };
  const pool = vanquishAllyPoolAt(view, "jollyRoger");
  const ranked = [...pool].sort((a, b) => allyStrength(view, b.ally) - allyStrength(view, a.ally));
  return ranked[0]?.ally ?? allySpots(state)[0]?.ally ?? null;
}

function heroDump(state: GameState): LocationId {
  const unlocked = LOCATION_IDS.filter((id) => id !== "hangmansTree" || state.hangmansUnlocked);
  return unlocked.find((id) => state.locations[id].heroes.length > 0) ?? "jollyRoger";
}

function pendingInput(state: GameState): Input | null {
  const pending = state.pending;
  if (!pending || !captainMode(state)) return null;
  const mode = captainMode(state);
  if (pending.kind === "playChooseCard") {
    if (mode === "unlock") {
      const map = playableNamed(state, "neverLandMap");
      if (map && state.power >= 4) return { type: "selectCard", instanceId: map.instanceId };
      const worthy = playableNamed(state, "worthyOpponent");
      if (worthy && state.power < 4) return { type: "selectCard", instanceId: worthy.instanceId };
      return null;
    }
    const ally = state.villainLocation === "jollyRoger" ? playableAlly(state) : null;
    if (ally) return { type: "selectCard", instanceId: ally.instanceId };
    const cutlass = playableNamed(state, "cutlass");
    if (cutlass && !canPayTauntThenPeter(state)) return { type: "selectCard", instanceId: cutlass.instanceId };
    const aye = playableNamed(state, "ayeAyeSir");
    if (aye && (bestShift(state)?.gain ?? 0) > 0) return { type: "selectCard", instanceId: aye.instanceId };
    const device = playableNamed(state, "ingeniousDevice");
    if (device && tauntedFoes(state).some((foe) => foe.location !== "jollyRoger")) {
      return { type: "selectCard", instanceId: device.instanceId };
    }
    return null;
  }
  if (pending.kind === "playChooseLocation" || pending.kind === "cunningLocation") {
    return { type: "selectLocation", locationId: state.villainLocation };
  }
  if (pending.kind === "playChoosePayment") {
    const card = state.hand.find((held) => held.instanceId === pending.cardId);
    if (!card) return { type: "cancel" };
    const cost = def(card.defId).cost;
    if (state.power >= cost) return { type: "payWithPower" };
    if (def(card.defId).type === "item" && card.defId !== "neverLandMap" && mapInRealm(state) && state.hangmansUnlocked) {
      return { type: "payWithMap" };
    }
    return { type: "cancel" };
  }
  if (pending.kind === "playChooseAllyAttach") {
    const host = attachHost(state);
    return host ? { type: "selectCard", instanceId: host.instanceId } : null;
  }
  if (pending.kind === "vanquishHero") {
    const targets = vanquishableHeroes(state);
    const taunt = targets.find((hero) => hero.hero.defId !== "peterPan" && hasTaunt(state, hero.hero.instanceId));
    const peter = targets.find((hero) => hero.hero.defId === "peterPan" && hero.location === "jollyRoger");
    const pick = taunt ?? peter;
    return pick ? { type: "selectCard", instanceId: pick.hero.instanceId } : null;
  }
  if (pending.kind === "vanquishAllies") {
    const hero = LOCATION_IDS.flatMap((id) => state.locations[id].heroes).find((card) => card.instanceId === pending.heroId);
    const pool = vanquishAllyPoolAt(state, findSpot(state, pending.heroId) ?? state.villainLocation);
    const need = hero ? heroStrength(state, hero) : 99;
    const minCount = hero?.defId === "lostBoys" ? 2 : 1;
    const chosen = pool.filter((row) => pending.selected.includes(row.ally.instanceId));
    const chosenStrength = chosen.reduce((sum, row) => sum + allyStrength(state, row.ally), 0);
    if (chosenStrength >= need && chosen.length >= minCount) return { type: "confirm" };
    const rest = pool.filter((row) => !pending.selected.includes(row.ally.instanceId));
    const mask = cheapestMask(rest.map((row) => allyStrength(state, row.ally)), Math.max(0, need - chosenStrength), Math.max(0, minCount - chosen.length));
    const index = mask === null ? -1 : rest.findIndex((_, i) => (mask & (1 << i)) !== 0);
    const next = index >= 0 ? rest[index] : undefined;
    return next ? { type: "selectCard", instanceId: next.ally.instanceId } : { type: "cancel" };
  }
  if (pending.kind === "discardSelect") {
    const next = junk(state).find((card) => !pending.selected.includes(card.instanceId));
    return next ? { type: "selectCard", instanceId: next.instanceId } : { type: "confirm" };
  }
  if (pending.kind === "movePieceSelect") {
    const shift = bestShift(state);
    return shift ? { type: "selectCard", instanceId: shift.ally.instanceId } : null;
  }
  if (pending.kind === "movePieceDest") {
    const from = findSpot(state, pending.pieceId);
    const dest = from ? westOf(from) : null;
    return dest ? { type: "selectLocation", locationId: dest } : null;
  }
  if (pending.kind === "moveHeroSelect") {
    const hero = heroToMove(state);
    return hero ? { type: "selectCard", instanceId: hero.instanceId } : null;
  }
  if (pending.kind === "moveHeroDest") {
    const dest = heroDest(state, pending.heroId);
    return dest ? { type: "selectLocation", locationId: dest } : null;
  }
  if (pending.kind === "ayeAyeAlly") {
    const shift = bestShift(state);
    return shift ? { type: "selectCard", instanceId: shift.ally.instanceId } : null;
  }
  if (pending.kind === "ayeAyeDest") {
    const from = findSpot(state, pending.allyId);
    const dest = from ? westOf(from) : null;
    return dest ? { type: "selectLocation", locationId: dest } : null;
  }
  if (pending.kind === "conditionOffer") {
    const card = state.hand.find((held) => held.instanceId === pending.conditionId);
    if (card?.defId === "cunning" && canPlayCunning(state) && state.villainLocation === "jollyRoger") {
      return { type: "acceptCondition" };
    }
    return { type: "skipCondition" };
  }
  if (pending.kind === "cunningAlly") {
    const ally = bestHandAlly(state);
    return ally ? { type: "selectCard", instanceId: ally.instanceId } : { type: "cancel" };
  }
  if (pending.kind === "starkeyHero" && peterShip(state)) return { type: "cancel" };
  if (pending.kind === "worthyLocation" || pending.kind === "obsessionLocation" || pending.kind === "fateChooseLocation") {
    return { type: "selectLocation", locationId: heroDump(state) };
  }
  return null;
}

function finishInput(state: GameState): Input | null {
  if (state.won || state.lost || state.phase === "over") return null;
  if (state.pending) return pendingInput(state);
  if (!captainMode(state)) return null;
  if (state.phase === "move") {
    let best: { score: number; location: LocationId } | null = null;
    for (const id of legalMoveLocations(state)) {
      if (snapsHand(state, id)) continue;
      const rated = rate(fresh(state, id));
      if (!rated) continue;
      if (!best || rated.score > best.score) best = { score: rated.score, location: id };
    }
    const holdAlly = state.hand.some((card) => def(card.defId).type === "ally");
    const digOnCroc =
      (captainMode(state) === "unlock" && !handCard(state, "neverLandMap") && state.power >= 4 && state.hand.length > 0) ||
      (captainMode(state) === "crew" && !holdAlly && !canPayTauntThenPeter(state) && junk(state).length > 0);
    if (digOnCroc) {
      for (const id of legalMoveLocations(state)) {
        if (!snapsHand(state, id)) continue;
        if (!best || best.score < 60) best = { score: 60, location: id };
      }
    }
    if (best) return { type: "selectLocation", locationId: best.location };
    let snappedBest: { score: number; location: LocationId } | null = null;
    for (const id of legalMoveLocations(state)) {
      if (!snapsHand(state, id)) continue;
      const rated = rate(fresh({ ...state, hand: [] }, id));
      if (!rated || rated.input.type !== "selectAction") continue;
      const chosen = rated.input;
      const slot = availableActions(fresh({ ...state, hand: [] }, id)).find((action) => action.key === chosen.actionKey);
      if (!slot || (slot.kind !== "gainPower" && slot.kind !== "vanquish" && slot.kind !== "moveHero" && slot.kind !== "moveItemAlly")) continue;
      if (!snappedBest || rated.score > snappedBest.score) snappedBest = { score: rated.score, location: id };
    }
    return snappedBest ? { type: "selectLocation", locationId: snappedBest.location } : null;
  }
  if (state.phase !== "actions") return null;
  return rate(state)?.input ?? { type: "endTurn" };
}

function chooseInput(state: GameState, rng: Rng): Input | null {
  if (!policy || !progress) throw new Error("hammer policy is not loaded");
  const closing = finishInput(state);
  if (closing && fingerprint(applyInput(state, closing)) !== fingerprint(state)) return closing;
  const input = policy(state, rng);
  if (input && fingerprint(applyInput(state, input)) !== fingerprint(state)) return input;
  return progress(state)[0] ?? null;
}

export function playSoakGame(seed: number, difficulty: Difficulty): GameRow {
  const started = Date.now();
  let state: GameState;
  try {
    state = createGame(difficulty, seed);
  } catch (error) {
    return {
      seed,
      difficulty,
      result: "crash",
      turns: 0,
      steps: 0,
      ms: Date.now() - started,
      heapUsed: process.memoryUsage().heapUsed,
      detail: error instanceof Error ? error.message : String(error),
      probes: [],
    };
  }
  if (!rngFor) throw new Error("hammer policy is not loaded");
  const rng = rngFor(seed);
  const origin = new Set(cardIds(state));
  const probes: string[] = [];
  let offerProbed = false;
  let stepsThisTurn = 0;
  let turnWatch = state.turn;
  const opening = invariants(state, origin);
  if (opening.length) {
    return {
      seed,
      difficulty,
      result: "invariant",
      turns: state.turn,
      steps: 0,
      ms: Date.now() - started,
      heapUsed: process.memoryUsage().heapUsed,
      detail: opening.join("; "),
      probes: opening,
    };
  }

  for (let step = 1; step <= STEP_CAP; step += 1) {
    if (state.won || state.lost || state.phase === "over") {
      return {
        seed,
        difficulty,
        result: state.won ? "win" : "loss",
        turns: state.turn,
        steps: step - 1,
        ms: Date.now() - started,
        heapUsed: process.memoryUsage().heapUsed,
        detail: state.won ? "win" : state.loseReason,
        probes,
      };
    }
    if (state.turn > TURN_CAP) {
      return row(seed, difficulty, "stall", state, step, started, `turn cap ${TURN_CAP}`, probes);
    }
    if (state.turn !== turnWatch) {
      turnWatch = state.turn;
      stepsThisTurn = 0;
    }
    stepsThisTurn += 1;
    if (stepsThisTurn > STEPS_PER_TURN_CAP) {
      return row(seed, difficulty, "stall", state, step, started, `no turn advance in ${STEPS_PER_TURN_CAP} steps`, probes);
    }
    let input: Input | null;
    try {
      input = chooseInput(state, rng);
    } catch (error) {
      return row(seed, difficulty, "crash", state, step, started, error instanceof Error ? error.message : String(error), probes);
    }
    if (!input) return row(seed, difficulty, "stall", state, step, started, "no legal input changes the board", probes);
    let next: GameState;
    try {
      next = applyInput(state, input);
    } catch (error) {
      return row(seed, difficulty, "crash", state, step, started, error instanceof Error ? error.message : String(error), probes);
    }
    if (boardChangedIllegally(state, input, next)) {
      return row(seed, difficulty, "invariant", state, step, started, `illegal ${input.type} changed the board`, probes);
    }
    const problems = invariants(next, origin).filter((problem) => {
      if (problem !== "end-turn-during-condition-offer") return true;
      if (offerProbed) return false;
      offerProbed = true;
      probes.push(problem);
      return false;
    });
    if (problems.length) {
      return row(seed, difficulty, "invariant", next, step, started, problems.join("; "), probes.concat(problems));
    }
    state = next;
  }
  return row(seed, difficulty, "stall", state, STEP_CAP, started, `step cap ${STEP_CAP}`, probes);
}

function row(
  seed: number,
  difficulty: Difficulty,
  result: GameRow["result"],
  state: GameState,
  steps: number,
  started: number,
  detail: string,
  probes: string[] = [],
): GameRow {
  return {
    seed,
    difficulty,
    result,
    turns: state.turn,
    steps,
    ms: Date.now() - started,
    heapUsed: process.memoryUsage().heapUsed,
    detail: `${detail} phase ${state.phase} pending ${state.pending?.kind ?? "-"}`,
    probes,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main(): Promise<void> {
  await loadHammer();
  const games = Number(arg("games", "200"));
  const seedStart = Number(arg("seed-start", "1"));
  const out = arg("out", "/tmp/hook-soak/summary.json");
  const heapAtStart = process.memoryUsage().heapUsed;
  const rows: GameRow[] = [];
  for (let i = 0; i < games; i += 1) {
    const seed = seedStart + i;
    const difficulty: Difficulty = i % 2 === 0 ? "easy" : "normal";
    const played = playSoakGame(seed, difficulty);
    rows.push(played);
    if (played.result !== "win" && played.result !== "loss") {
      console.error(`FAIL seed ${seed} ${difficulty} ${played.result} ${played.detail}`);
    }
  }
  const finishedRows = rows.filter((played) => played.result === "win" || played.result === "loss");
  const summary: SoakSummary = {
    gamesRequested: games,
    finished: finishedRows.length,
    wins: rows.filter((played) => played.result === "win").length,
    losses: rows.filter((played) => played.result === "loss").length,
    crashes: rows.filter((played) => played.result === "crash").length,
    stalls: rows.filter((played) => played.result === "stall").length,
    invariantViolations: rows.filter((played) => played.result === "invariant" || played.probes.length > 0).length,
    slowGames: rows.filter((played) => played.ms > SLOW_GAME_MS).length,
    avgTurns: Number(average(finishedRows.map((played) => played.turns)).toFixed(2)),
    avgMs: Number(average(rows.map((played) => played.ms)).toFixed(2)),
    maxMs: rows.reduce((max, played) => Math.max(max, played.ms), 0),
    maxHeapUsed: rows.reduce((max, played) => Math.max(max, played.heapUsed), 0),
    heapAtStart,
    heapAtEnd: process.memoryUsage().heapUsed,
    rows,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(summary, null, 2));
  const line = {
    gamesRequested: summary.gamesRequested,
    finished: summary.finished,
    wins: summary.wins,
    losses: summary.losses,
    crashes: summary.crashes,
    stalls: summary.stalls,
    invariantViolations: summary.invariantViolations,
    conditionOfferProbes: rows.filter((played) => played.probes.includes("end-turn-during-condition-offer")).length,
    slowGames: summary.slowGames,
    avgTurns: summary.avgTurns,
    avgMs: summary.avgMs,
    maxMs: summary.maxMs,
    maxHeapUsed: summary.maxHeapUsed,
    heapAtStart: summary.heapAtStart,
    heapAtEnd: summary.heapAtEnd,
  };
  console.log(JSON.stringify(line));
  if (summary.finished !== games || summary.crashes || summary.stalls || summary.invariantViolations || summary.slowGames) {
    process.exitCode = 1;
  }
}

if (args.includes("--games")) main();
