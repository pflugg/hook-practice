/**
 * Play complete Hook vs computer Fate games from the deal to a win or a loss.
 *
 *   npx vite-node scripts/soak-games.ts -- --games 200 --out /tmp/hook-soak/summary.json
 *
 * Seeds are `seedStart + i` (default start 1). Even indexes play Easy, odd indexes play Normal.
 * The captain follows the hammer policy (Hook's objective line). Computer Fate answers each
 * End turn. A click that does not change the board is retried from the legal highlight set.
 * Games are not resigned at a turn cap. Hitting the step or turn guard is a stall.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { def } from "../src/engine/cards";
import { applyInput, createGame, highlightSet } from "../src/engine/game";
import { allyStrength, availableActions, legalMoveLocations, playableHandCards, vanquishableHeroes } from "../src/engine/queries";
import { LOCATION_IDS, type CardInstance, type Difficulty, type GameState, type Input } from "../src/engine/types";

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
  const hammer = await import("./hammer-worker.ts");
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
  if (state.lost && !/Jolly Roger/i.test(state.loseReason)) problems.push(`loss-reason:${state.loseReason || "empty"}`);
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

function peterShip(state: GameState): boolean {
  return state.locations.jollyRoger.heroes.some((hero) => hero.defId === "peterPan");
}

function shipVanquishReady(state: GameState): boolean {
  return vanquishableHeroes(state).some((hero) => hero.hero.defId === "peterPan" && hero.location === "jollyRoger");
}

function shipStrength(state: GameState): number {
  return state.locations.jollyRoger.allies.reduce((sum, ally) => sum + allyStrength(state, ally), 0);
}

function eastmostOffShipAlly(state: GameState): { instanceId: string; location: LocationId } | null {
  for (let i = LOCATION_IDS.length - 1; i >= 1; i -= 1) {
    const location = LOCATION_IDS[i];
    if (!location) continue;
    const ally = state.locations[location].allies[0];
    if (ally) return { instanceId: ally.instanceId, location };
  }
  return null;
}

function alliesInPiles(state: GameState): number {
  const piles = [...state.hand, ...state.villainDeck, ...state.villainDiscard];
  return piles.filter((card) => def(card.defId).type === "ally").length;
}

function finishInput(state: GameState): Input | null {
  if (state.won || state.lost || state.phase === "over" || !peterShip(state)) return null;
  const ready = shipVanquishReady(state);
  const enough = shipStrength(state) >= 8 || ready;
  if (state.pending?.kind === "playChooseCard" && !enough) {
    const ally = playableHandCards(state)
      .filter((card) => def(card.defId).type === "ally" && def(card.defId).cost <= state.power)
      .sort((a, b) => def(b.defId).strength - def(a.defId).strength)[0];
    return ally ? { type: "selectCard", instanceId: ally.instanceId } : null;
  }
  if (state.pending?.kind === "discardSelect" && !enough) {
    if (state.pending.selected.length > 0) return { type: "confirm" };
    const junk = state.hand.find((card) => def(card.defId).type !== "ally");
    return junk ? { type: "selectCard", instanceId: junk.instanceId } : { type: "confirm" };
  }
  if (state.pending?.kind === "moveHeroSelect" && alliesInPiles(state) === 0) {
    const hero = state.locations.mermaidLagoon.heroes.find((card) => card.defId !== "peterPan") ?? state.locations.mermaidLagoon.heroes[0];
    return hero ? { type: "selectCard", instanceId: hero.instanceId } : null;
  }
  if (state.pending?.kind === "moveHeroDest" && alliesInPiles(state) === 0) {
    return { type: "selectLocation", locationId: "skullRock" };
  }
  if (state.pending?.kind === "movePieceSelect" && alliesInPiles(state) === 0) {
    const ally = eastmostOffShipAlly(state);
    return ally ? { type: "selectCard", instanceId: ally.instanceId } : null;
  }
  if (state.pending?.kind === "movePieceDest" && alliesInPiles(state) === 0) {
    const pieceId = state.pending.pieceId;
    const index = LOCATION_IDS.findIndex((id) =>
      state.locations[id].allies.some((ally) => ally.instanceId === pieceId) ||
      state.locations[id].items.some((item) => item.instanceId === pieceId),
    );
    const west = index > 0 ? LOCATION_IDS[index - 1] : null;
    return west ? { type: "selectLocation", locationId: west } : null;
  }
  if (state.pending) return null;

  const legal = state.phase === "move" ? legalMoveLocations(state) : [];
  const ferry = !enough && alliesInPiles(state) === 0 && eastmostOffShipAlly(state);
  const lagoonBlocked = state.locations.mermaidLagoon.heroes.length > 0;
  if (state.phase === "move" && !ferry && state.villainLocation !== "jollyRoger" && legal.includes("jollyRoger")) {
    return { type: "selectLocation", locationId: "jollyRoger" };
  }
  if (state.phase === "move" && ferry && lagoonBlocked && state.villainLocation !== "hangmansTree" && legal.includes("hangmansTree")) {
    return { type: "selectLocation", locationId: "hangmansTree" };
  }
  if (state.phase === "move" && ferry && !lagoonBlocked && state.villainLocation !== "mermaidLagoon" && legal.includes("mermaidLagoon")) {
    return { type: "selectLocation", locationId: "mermaidLagoon" };
  }
  if (state.phase !== "actions") return null;

  if (state.villainLocation === "jollyRoger" && !ferry) {
    const vanquish = availableActions(state).find((action) => action.available && action.kind === "vanquish");
    if (ready && vanquish) return { type: "selectAction", actionKey: vanquish.key };
    const play = availableActions(state).find((action) => action.available && action.kind === "playCard");
    const ally = playableHandCards(state).find((card) => def(card.defId).type === "ally" && def(card.defId).cost <= state.power);
    if (!enough && play && ally) return { type: "selectAction", actionKey: play.key };
    const discard = availableActions(state).find((action) => action.available && action.kind === "discard");
    if (!enough && discard && state.hand.some((card) => def(card.defId).type !== "ally") && alliesInPiles(state) > 0) {
      return { type: "selectAction", actionKey: discard.key };
    }
    const gain = availableActions(state).find((action) => action.available && action.kind === "gainPower");
    if (!enough && gain && state.power < 6) return { type: "selectAction", actionKey: gain.key };
    if (!enough) return { type: "endTurn" };
  }
  if (ferry && state.villainLocation === "hangmansTree" && lagoonBlocked) {
    const moveHero = availableActions(state).find((action) => action.available && action.kind === "moveHero");
    if (moveHero) return { type: "selectAction", actionKey: moveHero.key };
  }
  if (ferry && state.villainLocation === "mermaidLagoon" && !lagoonBlocked) {
    const move = availableActions(state).find((action) => action.available && action.kind === "moveItemAlly");
    if (move) return { type: "selectAction", actionKey: move.key };
  }
  return null;
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
      if (process.env.SOAK_TRACE === "1") {
        const peter = LOCATION_IDS.flatMap((id) => state.locations[id].heroes.filter((hero) => hero.defId === "peterPan").map(() => id)).join(",");
        const heroes = vanquishableHeroes(state).map((hero) => hero.hero.defId).join(",");
        const allies = LOCATION_IDS.map((id) => `${id}:${state.locations[id].allies.map((ally) => ally.defId).join("+") || "-"}`).join(" ");
        console.error(`trace seed ${seed} turn ${state.turn} @${state.villainLocation} peter ${peter || "-"} vanquish ${heroes || "-"} ${allies}`);
      }
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
