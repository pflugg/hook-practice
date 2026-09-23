/**
 * Headless Hook Practice hammer.
 *
 * Drives the real engine (`applyInput`) and Coach (`advise`) for a wall-clock
 * budget. Five processes share the hour. Findings are deduped to JSON.
 *
 *   npx vite-node scripts/hammer-worker.ts -- --worker 0 --ms 3600000 --out /tmp/hammer
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { def } from "../src/engine/cards";
import { advise } from "../src/engine/coach";
import { applyInput, createGame, highlightSet } from "../src/engine/game";
import {
  allAllies,
  anyTauntInRealm,
  availableActions,
  canPlayCunning,
  canPlayObsession,
  findCard,
  heroStrength,
  legalMoveLocations,
  mapInRealm,
  playableHandCards,
  preferredAttachAlly,
  vanquishableHeroes,
  vanquishAllyPool,
  allyStrength,
  movableHeroes,
  movableAlliesAndItems,
} from "../src/engine/queries";
import { endgameRecap } from "../src/engine/recap";
import { adjacentIds, locName } from "../src/engine/realm";
import {
  bounceLoopScene,
  hourEqualVanquishScene,
  nearWinScene,
  tauntDigScene,
  tickTockOntoCaptainScene,
} from "../src/engine/scenes";
import { strategyBrief } from "../src/engine/strategyBrief";
import { LOCATION_IDS, type CardInstance, type GameState, type Input, type LocationId } from "../src/engine/types";

type Severity = "must" | "should" | "nice";

interface Sample {
  mode: string;
  difficulty?: string;
  seed?: number;
  scene?: string;
  turn: number;
  step: number;
  detail: string;
  adviceDo?: string;
  adviceWhy?: string;
  input?: Input;
  recent: Input[];
}

interface Finding {
  severity: Severity;
  id: string;
  summary: string;
  count: number;
  samples: Sample[];
}

interface Coverage {
  gamesCompleted: number;
  sceneRuns: number;
  steps: number;
  wins: number;
  losses: number;
  resigns: number;
  offShipLosses: number;
  easyGames: number;
  normalGames: number;
  coachCalls: number;
  easyFatePeter: number;
  normalFatePeter: number;
  nearwinPlays: number;
  nearwinWins: number;
  tauntDigs: number;
  namedDiscards: number;
  cutlassChecks: number;
  equalVanquishes: number;
  tickTockWalkOns: number;
  tickTockSlides: number;
  bounceChecks: number;
  winRecaps: number;
  uiHydrations: number;
  softlockScans: number;
}

const args = process.argv.slice(2);
function arg(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const workerId = Number(arg("worker", "0"));
const budgetMs = Number(arg("ms", "3600000"));
const outDir = arg("out", "/tmp/hammer");
mkdirSync(outDir, { recursive: true });

const findings = new Map<string, Finding>();
const coverage: Coverage = {
  gamesCompleted: 0,
  sceneRuns: 0,
  steps: 0,
  wins: 0,
  losses: 0,
  resigns: 0,
  offShipLosses: 0,
  easyGames: 0,
  normalGames: 0,
  coachCalls: 0,
  easyFatePeter: 0,
  normalFatePeter: 0,
  nearwinPlays: 0,
  nearwinWins: 0,
  tauntDigs: 0,
  namedDiscards: 0,
  cutlassChecks: 0,
  equalVanquishes: 0,
  tickTockWalkOns: 0,
  tickTockSlides: 0,
  bounceChecks: 0,
  winRecaps: 0,
  uiHydrations: 0,
  softlockScans: 0,
};

let currentMode = "boot";
let currentSeed = 0;
let currentScene: string | undefined;
let currentStep = 0;
const recent: Input[] = [];

function remember(input: Input): void {
  recent.push(input);
  if (recent.length > 18) recent.shift();
}

function record(severity: Severity, id: string, summary: string, detail: string, advice?: { do: string; why: string }, input?: Input): void {
  const sample: Sample = {
    mode: currentMode,
    seed: currentSeed || undefined,
    scene: currentScene,
    turn: 0,
    step: currentStep,
    detail,
    adviceDo: advice?.do,
    adviceWhy: advice?.why,
    input,
    recent: recent.slice(-8),
  };
  const existing = findings.get(id);
  if (existing) {
    existing.count += 1;
    if (existing.samples.length < 3) existing.samples.push(sample);
    return;
  }
  findings.set(id, { severity, id, summary, count: 1, samples: [sample] });
  console.log(`[w${workerId}] ${severity.toUpperCase()} ${id}: ${summary}`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cardIds(state: GameState): string[] {
  const ids: string[] = [];
  const push = (card?: CardInstance | null) => {
    if (card) ids.push(card.instanceId);
  };
  state.hand.forEach(push);
  state.villainDeck.forEach(push);
  state.villainDiscard.forEach(push);
  state.fateDeck.forEach(push);
  state.fateDiscard.forEach(push);
  for (const id of LOCATION_IDS) {
    const loc = state.locations[id];
    loc.heroes.forEach(push);
    loc.allies.forEach(push);
    loc.items.forEach(push);
  }
  state.attachments.forEach((row) => push(row.item));
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

function brief(state: GameState): string {
  const hand = state.hand.map((card) => def(card.defId).name).join(", ");
  const realm = LOCATION_IDS.map((id) => {
    const loc = state.locations[id];
    const bits = [...loc.heroes, ...loc.allies, ...loc.items].map((card) => def(card.defId).name);
    return `${locName(id)}[${bits.join(", ")}]`;
  }).join(" ");
  return `turn ${state.turn} ${state.phase} @${locName(state.villainLocation)} power ${state.power} pending ${state.pending?.kind ?? "-"} departed ${state.departedFrom ?? "-"} hand [${hand}] ${realm}`;
}

function crocAt(state: GameState): LocationId | null {
  for (const id of LOCATION_IDS) {
    if (state.locations[id].heroes.some((hero) => hero.defId === "tickTock")) return id;
  }
  return null;
}

function peterSeated(state: GameState): { hero: CardInstance; location: LocationId } | null {
  for (const id of LOCATION_IDS) {
    const hero = state.locations[id].heroes.find((card) => card.defId === "peterPan");
    if (hero) return { hero, location: id };
  }
  return null;
}

function freshLogs(before: GameState, after: GameState): string[] {
  const seen = new Set(before.log.map((entry) => entry.id));
  return after.log.filter((entry) => !seen.has(entry.id)).map((entry) => entry.text);
}

function consult(state: GameState): { do: string; why: string; warning?: string; highlights: string[] } | null {
  coverage.coachCalls += 1;
  try {
    return advise(state);
  } catch (error) {
    record("must", "coach-throw", "Coach threw while reading a live board", `${brief(state)} :: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    return null;
  }
}

function checkTeachingSurfaces(state: GameState): void {
  try {
    strategyBrief(state);
  } catch (error) {
    record("must", "brief-throw", "Strategy brief threw on a live board", `${brief(state)} :: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (state.won || state.lost) {
    try {
      const recap = endgameRecap(state);
      if (state.won) {
        coverage.winRecaps += 1;
        const text = `${recap.headline} ${recap.lead} ${recap.steps} ${recap.clash} ${recap.fate}`;
        if (!/Jolly Roger|ship/i.test(text)) {
          record("must", "win-recap-omits-ship", "Win recap never names the ship", `${brief(state)} :: ${text}`);
        }
        if (!/Equal Strength is enough/.test(recap.clash)) {
          record("must", "win-recap-omits-equal", "Win recap omits equal-Strength honesty", `${brief(state)} :: ${recap.clash}`);
        }
      }
    } catch (error) {
      record("must", "recap-throw", "Endgame recap threw", `${brief(state)} :: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function checkCoach(state: GameState): void {
  const advice = consult(state);
  if (!advice) return;
  const legal = highlightSet(state);
  for (const key of advice.highlights) {
    if (key.startsWith("btn:")) continue;
    if (!legal.has(key)) {
      record(
        "must",
        "illegal-highlight",
        "Coach highlights a click the engine does not treat as legal",
        `${brief(state)} highlight ${key} do=${advice.do}`,
        advice,
      );
    }
  }

  for (const card of state.hand) {
    const name = def(card.defId).name;
    const d = def(card.defId);
    if (d.type === "condition") continue;
    if (!new RegExp(`\\bPlay ${escapeRegExp(name)}\\b`, "i").test(advice.do)) continue;
    const mapPays = d.type === "item" && Boolean(mapInRealm(state)) && d.cost > 0;
    if (d.cost > state.power && !mapPays) {
      record(
        "must",
        "unaffordable-play-cta",
        "Coach tells you to Play a card the current Power cannot pay",
        `${brief(state)} card ${name} cost ${d.cost}`,
        advice,
      );
    }
    if (card.defId === "cutlass" && (state.power < d.cost || allAllies(state).length === 0)) {
      record(
        "must",
        "cutlass-play-cta",
        "Coach tells you to Play Cutlass with no Power or no Ally ashore",
        `${brief(state)} allies ${allAllies(state).length}`,
        advice,
      );
    }
  }

  const cutlassBlocked =
    state.hand.some((card) => card.defId === "cutlass" && (state.power < def("cutlass").cost || !preferredAttachAlly(state))) ||
    (state.pending &&
      "cardId" in state.pending &&
      findCard(state, state.pending.cardId)?.defId === "cutlass" &&
      (state.power < def("cutlass").cost || !preferredAttachAlly(state)));
  if (cutlassBlocked && /\bstrap\b/i.test(advice.do)) {
    record("must", "cutlass-strap-cta", "Coach tells you to strap Cutlass when the attach is blocked", brief(state), advice);
  }

  if (state.phase === "actions" && !state.pending && /^End the turn/i.test(advice.do)) {
    const slots = availableActions(state).filter((slot) => slot.available);
    if (state.power < 12 && slots.some((slot) => slot.kind === "gainPower")) {
      record("must", "end-with-open-gain", "Coach ends the turn while a Gain is still open and Power is under 12", brief(state), advice);
    }
    if (state.peterPanRevealed && state.hand.some((card) => card.defId === "obsession") && slots.some((slot) => slot.kind === "discard")) {
      record(
        "must",
        "end-instead-of-obsession-dig",
        "Coach ends the turn instead of discarding a spent Obsession",
        brief(state),
        advice,
      );
    }
  }

  if (state.phase === "move" && !state.pending) {
    const croc = crocAt(state);
    if (croc && legalMoveLocations(state).includes(croc) && !/walk-on|moves onto|captain moves/i.test(advice.why)) {
      record(
        "must",
        "tick-tock-teaching",
        "Move-phase Coach omits the walk-on-only Tick Tock rule while the crocodile is a legal step",
        brief(state),
        advice,
      );
    }
  }

  if (state.phase === "actions" && !state.pending && anyTauntInRealm(state) && vanquishableHeroes(state).length === 0) {
    const uncovered = availableActions(state).some((slot) => slot.kind === "vanquish" && !slot.used && !slot.covered);
    const text = `${advice.do}\n${advice.why}\n${advice.warning ?? ""}`;
    if (uncovered && !/Taunt/.test(text)) {
      record("must", "taunt-silence", "Taunt blocks every clash and Coach never names Taunt", brief(state), advice);
    }
  }

  if (/\bDiscard\b/.test(advice.do) && !/no uncovered Discard/i.test(advice.do) && !/Discard the Map/i.test(advice.do)) {
    const names = [
      ...state.hand.map((card) => def(card.defId).name),
      ...state.attachments.map((row) => def(row.item.defId).name),
    ];
    for (const id of LOCATION_IDS) names.push(...state.locations[id].items.map((card) => def(card.defId).name));
    if (state.pending?.kind === "scarePeek") names.push(...state.pending.cards.map((card) => def(card.defId).name));
    if (state.pending?.kind === "discardSelect") {
      for (const id of state.pending.selected) {
        const card = findCard(state, id);
        if (card) names.push(def(card.defId).name);
      }
    }
    const named = names.some((name) => name.length > 0 && advice.do.includes(name));
    const instructs = /^Discard\b/.test(advice.do) || /click Discard/.test(advice.do) || /then Discard\b/.test(advice.do);
    if (instructs && !named) {
      record("must", "bare-discard", "Coach says Discard without naming the card to dig", brief(state), advice);
    }
  }

  if (/banish/i.test(advice.do) && /out of the realm/i.test(`${advice.do} ${advice.why}`)) {
    record(
      "should",
      "banish-means-discard",
      "Coach says Banish / out of the realm for an Obsession Hero that returns via the Fate discard",
      brief(state),
      advice,
    );
  }

  if (state.phase === "actions" && !state.pending && advice.highlights.some((key) => key.startsWith("act:"))) {
    const key = advice.highlights.find((item) => item.startsWith("act:"))!.slice(4);
    const slot = availableActions(state).find((item) => item.key === key);
    if (slot?.kind === "fate" && !/practice self-fate|another villain|hunt card/i.test(`${advice.do} ${advice.why}`)) {
      record(
        "should",
        "fate-teaching",
        "Coach recommends the Fate action without saying it is practice self-Fate",
        brief(state),
        advice,
      );
    }
  }
}

function checkState(state: GameState, originIds: Set<string> | null): void {
  if (state.power < 0) record("must", "negative-power", "Power dropped below zero", brief(state));
  if (!state.hangmansUnlocked && state.villainLocation === "hangmansTree") {
    record("must", "captain-on-locked-tree", "Captain stands on Hangman's Tree while it is locked", brief(state));
  }
  if (state.peterPanLocation) {
    const at = state.locations[state.peterPanLocation].heroes.some((hero) => hero.defId === "peterPan");
    if (!at) record("must", "peter-desync", "peterPanLocation does not match the board", brief(state));
  }
  const ids = cardIds(state);
  if (new Set(ids).size !== ids.length) {
    record("must", "duplicate-card", "The same card instance sits in two zones", `${brief(state)} ids ${ids.length}`);
  }
  if (originIds) {
    const now = new Set(ids);
    const missing = [...originIds].filter((id) => !now.has(id));
    const extra = [...now].filter((id) => !originIds.has(id));
    if (missing.length || extra.length) {
      record(
        "must",
        "card-census",
        "A card instance appeared or vanished",
        `${brief(state)} missing ${missing.length} extra ${extra.length} sample ${missing[0] ?? extra[0] ?? ""}`,
      );
    }
  }
  if (state.pending?.kind === "fateReport") {
    const peter = state.pending.drawn.find((card) => card.defId === "peterPan");
    if (peter) {
      const seated = LOCATION_IDS.some((id) => state.locations[id].heroes.some((hero) => hero.instanceId === peter.instanceId));
      const dumped =
        state.fateDiscard.some((card) => card.instanceId === peter.instanceId) ||
        state.pending.discarded.some((card) => card.instanceId === peter.instanceId);
      if (!seated || dumped) {
        record("must", "buried-peter", "A revealed Peter was not seated at the hideout", brief(state));
      } else if (state.difficulty === "easy") coverage.easyFatePeter += 1;
      else coverage.normalFatePeter += 1;
    }
  }
  const dupUsed = state.usedActions.filter((key, index) => state.usedActions.indexOf(key) !== index);
  if (dupUsed.length) record("must", "used-action-twice", "An action key is marked used more than once", `${brief(state)} ${dupUsed.join(",")}`);
  checkCoach(state);
  checkTeachingSurfaces(state);
}

function checkTransition(before: GameState, input: Input, after: GameState): void {
  const lines = freshLogs(before, after);
  const snap = lines.find((line) => /Tick Tock snaps/.test(line));
  if (snap) {
    const walked =
      input.type === "selectLocation" &&
      before.phase === "move" &&
      !before.pending &&
      before.locations[input.locationId].heroes.some((hero) => hero.defId === "tickTock");
    if (!walked) {
      record("must", "tick-tock-not-walk-on", "The hand snap fired without the captain moving onto Tick Tock", `${brief(before)} -> ${input.type}`);
    }
    if (after.hand.length !== 0) record("must", "tick-tock-hand-remains", "Tick Tock snapped but the hand was not emptied", brief(after));
  }
  const drop = before.hand.length - after.hand.length;
  if (drop > 1 && !snap) {
    const discarded =
      input.type === "confirm" && before.pending?.kind === "discardSelect" ? before.pending.selected.length : 0;
    if (discarded < drop) {
      record("must", "unexpected-hand-wipe", "The hand lost more than one card without a captain walk-on or a matching Discard", brief(before));
    }
  }
  if (!before.hangmansUnlocked && after.hangmansUnlocked) {
    const opened = lines.some((line) => /map|unlock/i.test(line));
    if (!opened) record("must", "silent-unlock", "Hangman's Tree unlocked without a Map log line", brief(after));
  }
  if (!after.hangmansUnlocked) {
    const beforeDust = new Set(
      before.attachments
        .filter((row) => row.item.defId === "pixieDust" && findCard(before, row.attachedTo)?.defId === "peterPan")
        .map((row) => row.item.instanceId),
    );
    for (const row of after.attachments) {
      if (row.item.defId !== "pixieDust" || beforeDust.has(row.item.instanceId)) continue;
      if (findCard(after, row.attachedTo)?.defId === "peterPan") {
        record("must", "pixie-on-locked-peter", "Pixie Dust attached to Peter while Hangman's Tree is locked", brief(after));
      }
    }
  }
  if (after.won && !before.won) {
    const clash = after.voyage.lastClash;
    if (!clash || clash.heroName !== "Peter Pan" || !clash.onShip) {
      record("must", "win-off-ship", "The duel was won without vanquishing Peter on the Jolly Roger", brief(after));
    }
  }
  const vanquished = lines.find((line) => /is vanquished/.test(line));
  if (vanquished && before.pending?.kind === "vanquishAllies") {
    const hero = findCard(before, before.pending.heroId);
    const pool = vanquishAllyPool(before, before.pending.heroId);
    const chosen = pool.filter((row) => before.pending?.kind === "vanquishAllies" && before.pending.selected.includes(row.ally.instanceId));
    const total = chosen.reduce((sum, row) => sum + allyStrength(before, row.ally), 0);
    if (hero && total < heroStrength(before, hero)) {
      record("must", "vanquish-under-strength", "A clash resolved with less Ally Strength than the Hero", `${brief(before)} ${total} vs ${heroStrength(before, hero)}`);
    }
    if (hero?.defId === "lostBoys" && chosen.length < 2) {
      record("must", "lost-boys-one-ally", "Lost Boys were vanquished with fewer than two Allies", brief(before));
    }
    if (hero && total === heroStrength(before, hero) && total > 0) coverage.equalVanquishes += 1;
  }
}

function legalInputs(state: GameState): Input[] {
  const inputs: Input[] = [];
  if (state.phase === "over" || state.won || state.lost) return inputs;
  for (const key of highlightSet(state)) {
    if (key.startsWith("loc:")) inputs.push({ type: "selectLocation", locationId: key.slice(4) as LocationId });
    else if (key.startsWith("act:")) inputs.push({ type: "selectAction", actionKey: key.slice(4) });
    else if (key.startsWith("card:") || key.startsWith("sel:")) inputs.push({ type: "selectCard", instanceId: key.slice(key.indexOf(":") + 1) });
  }
  const buttons: Input[] = [
    { type: "endTurn" },
    { type: "cancel" },
    { type: "confirm" },
    { type: "acknowledgeFate" },
    { type: "acceptCondition" },
    { type: "skipCondition" },
    { type: "payWithPower" },
    { type: "payWithMap" },
    { type: "scareDiscardBoth" },
    { type: "playOrDiscardHero", play: true },
    { type: "playOrDiscardHero", play: false },
  ];
  inputs.push(...buttons);
  if (state.pending?.kind === "scarePeek" && state.pending.cards.length >= 2) {
    const [a, b] = state.pending.cards;
    inputs.push({ type: "scareReturn", order: [a.instanceId, b.instanceId] });
    inputs.push({ type: "scareReturn", order: [b.instanceId, a.instanceId] });
  }
  return inputs;
}

function progressing(state: GameState): Input[] {
  const before = fingerprint(state);
  const outs: Input[] = [];
  for (const input of legalInputs(state)) {
    try {
      if (fingerprint(applyInput(state, input)) !== before) outs.push(input);
    } catch (error) {
      record("must", "apply-throw", "applyInput threw", `${brief(state)} ${JSON.stringify(input)} ${error instanceof Error ? error.message : String(error)}`, undefined, input);
    }
  }
  coverage.softlockScans += 1;
  return outs;
}

interface Rng {
  next: () => number;
  pick: <T>(items: T[]) => T;
}

function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return {
    next,
    pick<T>(items: T[]): T {
      return items[Math.floor(next() * items.length)]!;
    },
  };
}

function inputFromAdvice(state: GameState, advice: { highlights: string[] }): Input | null {
  if (state.pending?.kind === "fateReport") return { type: "acknowledgeFate" };
  for (const key of advice.highlights) {
    if (key.startsWith("loc:")) return { type: "selectLocation", locationId: key.slice(4) as LocationId };
    if (key.startsWith("act:")) return { type: "selectAction", actionKey: key.slice(4) };
    if (key.startsWith("card:")) return { type: "selectCard", instanceId: key.slice(5) };
    if (key.startsWith("btn:attach:")) return { type: "selectCard", instanceId: key.slice("btn:attach:".length) };
    if (key === "btn:end") return { type: "endTurn" };
    if (key === "btn:cancel") return { type: "cancel" };
    if (key === "btn:confirm") return { type: "confirm" };
    if (key === "btn:ack") return { type: "acknowledgeFate" };
    if (key === "btn:pay-power") return { type: "payWithPower" };
    if (key === "btn:pay-map") return { type: "payWithMap" };
    if (key === "btn:accept-cond") return { type: "acceptCondition" };
    if (key === "btn:skip-cond") return { type: "skipCondition" };
    if (key === "btn:play-hero") return { type: "playOrDiscardHero", play: true };
    if (key === "btn:banish-hero") return { type: "playOrDiscardHero", play: false };
    if (key === "btn:scare-discard") return { type: "scareDiscardBoth" };
    if (key.startsWith("btn:scare-order:")) {
      const [a, b] = key.slice("btn:scare-order:".length).split(",");
      if (a && b) return { type: "scareReturn", order: [a, b] };
    }
  }
  return null;
}

function towardShip(id: LocationId): LocationId | null {
  const index = LOCATION_IDS.indexOf(id);
  return index > 0 ? LOCATION_IDS[index - 1] : null;
}

function slot(state: GameState, kind: string) {
  return availableActions(state).find((action) => action.available && action.kind === kind);
}

function digTarget(state: GameState): CardInstance | null {
  const spent = state.hand.find((card) => card.defId === "obsession" && state.peterPanRevealed);
  if (spent) return spent;
  const cunning = state.hand.find((card) => card.defId === "cunning" && !canPlayCunning(state));
  if (cunning) return cunning;
  const cutlass = state.hand.find(
    (card) => card.defId === "cutlass" && (state.power < def("cutlass").cost || allAllies(state).length === 0),
  );
  if (cutlass) return cutlass;
  const pricey = state.hand
    .filter((card) => {
      const d = def(card.defId);
      if (card.defId === "neverLandMap" || d.type === "condition") return false;
      if (d.cost <= state.power) return false;
      if (d.type === "item" && mapInRealm(state)) return false;
      return d.cost > 0;
    })
    .sort((a, b) => def(a.defId).cost - def(b.defId).cost);
  return pricey[0] ?? null;
}

function bestPlay(state: GameState): CardInstance | null {
  const cards = playableHandCards(state).filter((card) => {
    const d = def(card.defId);
    if (card.defId === "cutlass" && (state.power < d.cost || allAllies(state).length === 0)) return false;
    if (d.cost > state.power && !(d.type === "item" && mapInRealm(state))) return false;
    return true;
  });
  if (!state.hangmansUnlocked) {
    const map = cards.find((card) => card.defId === "neverLandMap" && state.power >= 4);
    if (map) return map;
  }
  const peter = peterSeated(state);
  if (!state.peterPanRevealed) {
    const hunt = cards.find((card) => card.defId === "worthyOpponent" || card.defId === "giveThemAScare");
    if (hunt && (def(hunt.defId).cost <= state.power || (def(hunt.defId).type === "item" && mapInRealm(state)))) return hunt;
  }
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger") {
    const escort = cards.find((card) => card.defId === "ingeniousDevice" || card.defId === "mrStarkey" || card.defId === "ayeAyeSir");
    if (escort && def(escort.defId).cost <= state.power) return escort;
  }
  const shipStrength = state.locations.jollyRoger.allies.reduce((sum, ally) => sum + allyStrength(state, ally), 0);
  if (shipStrength < 8) {
    const allies = cards
      .filter((card) => def(card.defId).type === "ally" && def(card.defId).cost <= state.power)
      .sort((a, b) => def(b.defId).strength - def(a.defId).strength);
    if (allies[0]) return allies[0];
  }
  const cutlass = cards.find((card) => card.defId === "cutlass" && state.power >= 1 && preferredAttachAlly(state));
  if (cutlass) return cutlass;
  return cards.find((card) => def(card.defId).cost <= state.power) ?? null;
}

function policyInput(state: GameState, rng: Rng): Input | null {
  if (state.phase === "over" || state.won || state.lost) return null;
  if (state.pending?.kind === "fateReport") return { type: "acknowledgeFate" };
  const pending = state.pending;
  if (pending?.kind === "conditionOffer") {
    const cond = findCard(state, pending.conditionId);
    if (cond?.defId === "cunning" && !canPlayCunning(state)) return { type: "skipCondition" };
    return { type: "acceptCondition" };
  }
  if (pending?.kind === "cunningAlly") {
    const ally = state.hand.find((card) => def(card.defId).type === "ally");
    return ally ? { type: "selectCard", instanceId: ally.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "cunningLocation") {
    const legal = legalMoveLocations({ ...state, villainLocation: "hangmansTree" });
    void legal;
    const dest = (["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const).find((id) =>
      id === "hangmansTree" ? state.hangmansUnlocked : true,
    );
    return { type: "selectLocation", locationId: dest && (dest !== "hangmansTree" || state.hangmansUnlocked) ? (state.hangmansUnlocked || dest !== "hangmansTree" ? "jollyRoger" : dest) : "skullRock" };
  }
  if (pending?.kind === "playChooseCard") {
    const card = bestPlay(state);
    return card ? { type: "selectCard", instanceId: card.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "playChooseLocation") {
    const card = findCard(state, pending.cardId);
    const dest: LocationId =
      card && def(card.defId).type === "ally" ? "jollyRoger" : state.villainLocation === "hangmansTree" && !state.hangmansUnlocked ? "skullRock" : state.villainLocation;
    const safe = dest === "hangmansTree" && !state.hangmansUnlocked ? "jollyRoger" : dest;
    return { type: "selectLocation", locationId: safe };
  }
  if (pending?.kind === "playChooseAllyAttach") {
    const host = preferredAttachAlly(state);
    return host ? { type: "selectCard", instanceId: host.ally.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "playChoosePayment") {
    const card = findCard(state, pending.cardId);
    const cost = card ? def(card.defId).cost : 99;
    if (state.power >= cost) return { type: "payWithPower" };
    if (mapInRealm(state)) return { type: "payWithMap" };
    return { type: "cancel" };
  }
  if (pending?.kind === "discardSelect") {
    if (pending.selected.length > 0) return { type: "confirm" };
    const target = digTarget(state);
    return target ? { type: "selectCard", instanceId: target.instanceId } : { type: "confirm" };
  }
  if (pending?.kind === "vanquishHero") {
    const targets = vanquishableHeroes(state).filter((hero) => hero.hero.defId !== "peterPan" || hero.location === "jollyRoger");
    const peter = targets.find((hero) => hero.hero.defId === "peterPan");
    const pick = peter ?? targets[0];
    return pick ? { type: "selectCard", instanceId: pick.hero.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "vanquishConfirmLoss") return { type: "cancel" };
  if (pending?.kind === "vanquishAllies") {
    const hero = findCard(state, pending.heroId);
    const pool = vanquishAllyPool(state, pending.heroId);
    const selected = pool.filter((row) => pending.selected.includes(row.ally.instanceId));
    const total = selected.reduce((sum, row) => sum + allyStrength(state, row.ally), 0);
    const need = hero ? heroStrength(state, hero) : 99;
    const boys = hero?.defId === "lostBoys";
    if (total >= need && pending.selected.length > 0 && (!boys || pending.selected.length >= 2)) return { type: "confirm" };
    const next = pool
      .filter((row) => !pending.selected.includes(row.ally.instanceId))
      .sort((a, b) => allyStrength(state, b.ally) - allyStrength(state, a.ally))[0];
    return next ? { type: "selectCard", instanceId: next.ally.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "moveHeroSelect" || pending?.kind === "starkeyHero") {
    const heroes = pending.kind === "starkeyHero"
      ? state.locations[findHeroLoc(state, pending.starkeyId) ?? "jollyRoger"].heroes
      : movableHeroes(state);
    const peter = heroes.find((hero) => hero.defId === "peterPan");
    const pick = peter ?? heroes.find((hero) => hero.defId !== "tickTock") ?? heroes[0];
    return pick ? { type: "selectCard", instanceId: pick.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "moveHeroDest" || pending?.kind === "starkeyDest") {
    const from = findHeroLoc(state, pending.heroId);
    const hero = findCard(state, pending.heroId);
    const dests = from ? adjacentIds(from).filter((id) => id !== "hangmansTree" || state.hangmansUnlocked) : [];
    const toward = from && hero?.defId === "peterPan" ? towardShip(from) : null;
    const dest = toward && dests.includes(toward) ? toward : dests.find((id) => id !== state.villainLocation) ?? dests[0];
    return dest ? { type: "selectLocation", locationId: dest } : { type: "cancel" };
  }
  if (pending?.kind === "movePieceSelect") {
    const pieces = movableAlliesAndItems(state);
    const ally = pieces.find((card) => def(card.defId).type === "ally");
    return (ally ?? pieces[0]) ? { type: "selectCard", instanceId: (ally ?? pieces[0]).instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "movePieceDest" || pending?.kind === "ayeAyeDest") {
    const id = pending.kind === "ayeAyeDest" ? pending.allyId : pending.pieceId;
    const from = findHeroLoc(state, id);
    const dests = from ? adjacentIds(from).filter((loc) => loc !== "hangmansTree" || state.hangmansUnlocked) : [];
    const toward = from ? towardShip(from) : null;
    const dest = toward && dests.includes(toward) ? toward : dests[0];
    return dest ? { type: "selectLocation", locationId: dest } : { type: "cancel" };
  }
  if (pending?.kind === "ayeAyeAlly") {
    const ally = allAllies(state)[0];
    return ally ? { type: "selectCard", instanceId: ally.ally.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "scarePeek") {
    const peter = pending.cards.find((card) => card.defId === "peterPan");
    if (peter) {
      const other = pending.cards.find((card) => card.instanceId !== peter.instanceId) ?? peter;
      return { type: "scareReturn", order: [peter.instanceId, other.instanceId] };
    }
    return { type: "scareDiscardBoth" };
  }
  if (pending?.kind === "fateChooseCard") {
    const peter = pending.cards.find((card) => card.defId === "peterPan");
    const mild = pending.cards.find((card) => card.defId !== "tickTock" && card.defId !== "splittingHeadache") ?? pending.cards[0];
    const pick = peter ?? mild;
    return pick ? { type: "selectCard", instanceId: pick.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "fateChooseLocation" || pending?.kind === "worthyLocation" || pending?.kind === "obsessionLocation") {
    const quiet = (["skullRock", "jollyRoger", "mermaidLagoon"] as const).find((id) => id !== state.villainLocation) ?? "skullRock";
    return { type: "selectLocation", locationId: quiet };
  }
  if (pending?.kind === "fateChooseAttach") {
    const itemId = state.heldCard?.defId ?? "pixieDust";
    const heroes = LOCATION_IDS.flatMap((id) => state.locations[id].heroes).filter((hero) => {
      if (itemId === "pixieDust" && hero.defId === "peterPan" && !state.hangmansUnlocked) return false;
      if (itemId === "pixieDust" && hero.defId === "peterPan") return false;
      return true;
    });
    const pick = heroes[0];
    return pick ? { type: "selectCard", instanceId: pick.instanceId } : { type: "cancel" };
  }
  if (pending?.kind === "fateChooseItem") {
    const items = LOCATION_IDS.flatMap((id) => state.locations[id].items);
    const junk = items.find((card) => card.defId !== "neverLandMap" && card.defId !== "ingeniousDevice") ?? items[0];
    return junk ? { type: "selectCard", instanceId: junk.instanceId } : { type: "acknowledgeFate" };
  }
  if (pending?.kind === "tinkerDiscard") return { type: "skipCondition" };
  if (pending?.kind === "obsessionDecide") {
    if (state.heldCard?.defId === "peterPan") return { type: "playOrDiscardHero", play: true };
    if (state.heldCard?.defId === "tickTock") return { type: "playOrDiscardHero", play: false };
    return { type: "playOrDiscardHero", play: false };
  }
  if (pending?.kind === "starkeyDest") return { type: "cancel" };

  if (state.phase === "move" && !state.pending) {
    const legal = legalMoveLocations(state);
    const safe = legal.filter((id) => !(crocAt(state) === id && state.hand.length > 0));
    const pool = safe.length ? safe : legal;
    let best = pool[0] ?? "skullRock";
    let bestScore = -Infinity;
    for (const id of pool) {
      const relocated = { ...state, villainLocation: id, phase: "actions" as const, usedActions: [], pending: null };
      let score = 0;
      if (crocAt(state) === id) score -= 5000;
      if (state.departedFrom === id) score -= 200;
      const actions = availableActions(relocated).filter((action) => action.available);
      const gain = actions.filter((action) => action.kind === "gainPower").reduce((sum, action) => sum + (action.amount ?? 1), 0);
      if (state.power < 8) score += gain * 30;
      if (!state.hangmansUnlocked && state.hand.some((card) => card.defId === "neverLandMap") && state.power >= 4 && actions.some((action) => action.kind === "playCard")) {
        score += 400;
      }
      const peter = peterSeated(relocated);
      if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger" && actions.some((action) => action.kind === "moveHero")) score += 500;
      if (digTarget(state) && actions.some((action) => action.kind === "discard")) score += 220;
      if (id === "mermaidLagoon") score += 15;
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return { type: "selectLocation", locationId: best };
  }

  if (state.phase === "actions" && !state.pending) {
    if (canPlayObsession(state) && !state.peterPanRevealed) {
      const obsession = state.hand.find((card) => card.defId === "obsession");
      if (obsession && !state.hand.some((card) => card.defId === "neverLandMap" && state.power >= 4)) {
        return { type: "selectCard", instanceId: obsession.instanceId };
      }
    }
    if (canPlayCunning(state)) {
      const cunning = state.hand.find((card) => card.defId === "cunning");
      if (cunning) return { type: "selectCard", instanceId: cunning.instanceId };
    }
    const peter = peterSeated(state);
    if (peter && peter.location === "jollyRoger" && vanquishableHeroes(state).some((hero) => hero.hero.defId === "peterPan")) {
      const vanquish = slot(state, "vanquish");
      if (vanquish) return { type: "selectAction", actionKey: vanquish.key };
    }
    if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger") {
      const moveHero = slot(state, "moveHero");
      if (moveHero && movableHeroes(state).some((hero) => hero.defId === "peterPan")) {
        return { type: "selectAction", actionKey: moveHero.key };
      }
    }
    const play = slot(state, "playCard");
    const card = bestPlay(state);
    if (play && card) return { type: "selectAction", actionKey: play.key };
    const gain = availableActions(state)
      .filter((action) => action.available && action.kind === "gainPower")
      .sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1))[0];
    if (gain && state.power < 10) return { type: "selectAction", actionKey: gain.key };
    const discard = slot(state, "discard");
    if (discard && digTarget(state)) return { type: "selectAction", actionKey: discard.key };
    const fate = slot(state, "fate");
    if (fate && !state.peterPanRevealed) return { type: "selectAction", actionKey: fate.key };
    const vanquish = slot(state, "vanquish");
    if (vanquish && vanquishableHeroes(state).some((hero) => hero.hero.defId !== "peterPan" || hero.location === "jollyRoger")) {
      return { type: "selectAction", actionKey: vanquish.key };
    }
    const slide = slot(state, "moveItemAlly");
    if (slide && movableAlliesAndItems(state).some((item) => def(item.defId).type === "ally")) {
      return { type: "selectAction", actionKey: slide.key };
    }
    if (gain && state.power < 12) return { type: "selectAction", actionKey: gain.key };
    return { type: "endTurn" };
  }
  if (state.phase === "fateAdversary") return { type: "acknowledgeFate" };
  return rng.pick(progressing(state).concat([{ type: "cancel" }]));
}

function findHeroLoc(state: GameState, instanceId: string): LocationId | null {
  for (const id of LOCATION_IDS) {
    const loc = state.locations[id];
    if ([...loc.heroes, ...loc.allies, ...loc.items].some((card) => card.instanceId === instanceId)) return id;
  }
  return null;
}

interface TurnMark {
  from: LocationId;
  to: LocationId;
  useful: string[];
  took: string[];
}

function playVoyage(mode: "coach-easy" | "coach-normal" | "policy-easy" | "policy-normal" | "chaos-normal", seed: number, deadline: number): void {
  currentMode = mode;
  currentSeed = seed;
  currentScene = undefined;
  currentStep = 0;
  recent.length = 0;
  const difficulty = mode.endsWith("easy") ? "easy" : "normal";
  if (difficulty === "easy") coverage.easyGames += 1;
  else coverage.normalGames += 1;
  let state = createGame(difficulty, seed);
  const origin = new Set(cardIds(state));
  const rng = makeRng(seed ^ (workerId + 1) * 97);
  const followCoach = mode.startsWith("coach");
  const turnCap = mode.startsWith("chaos") ? 22 : 64;
  const history: TurnMark[] = [];
  let open: TurnMark | null = null;
  let stuck = 0;
  checkState(state, origin);

  for (let guard = 0; guard < 2800 && Date.now() < deadline; guard += 1) {
    if (state.won || state.lost || state.phase === "over") break;
    if (state.turn > turnCap) {
      state = applyInput(state, { type: "resign" });
      break;
    }
    currentStep = guard;
    let input: Input | null = null;
    const advice = followCoach ? consult(state) : null;
    if (followCoach && advice) input = inputFromAdvice(state, advice);
    if (!input) input = mode.startsWith("chaos") ? rng.pick(legalInputs(state).concat([{ type: "endTurn" }])) : policyInput(state, rng);
    if (!input) break;
    const before = state;
    const beforeFp = fingerprint(before);
    let after: GameState;
    try {
      after = applyInput(before, input);
    } catch (error) {
      record("must", "apply-throw", "applyInput threw", `${brief(before)} ${JSON.stringify(input)} ${error instanceof Error ? error.stack ?? error.message : String(error)}`, advice ?? undefined, input);
      break;
    }
    remember(input);
    if (fingerprint(after) === beforeFp && before.phase !== "over") {
      stuck += 1;
      if (stuck >= 3) {
        const outs = progressing(before);
        if (outs.length === 0) {
          record("must", "softlock", "No legal input changes the board", brief(before), advice ?? undefined, input);
          break;
        }
        if (followCoach && advice) {
          record(
            "must",
            "coach-noop",
            "Coach's click does not change the board while another click would",
            `${brief(before)} tried ${JSON.stringify(input)}`,
            advice,
            input,
          );
        }
        input = outs[0]!;
        try {
          after = applyInput(before, input);
        } catch (error) {
          record("must", "apply-throw", "applyInput threw", `${error instanceof Error ? error.message : String(error)}`, undefined, input);
          break;
        }
        remember(input);
        stuck = 0;
      }
    } else {
      stuck = 0;
    }
    checkTransition(before, input, after);
    if (before.phase === "move" && input.type === "selectLocation" && after.villainLocation !== before.villainLocation) {
      if (open) history.push(open);
      const actions = availableActions(after).filter((action) => action.available);
      const useful: string[] = [];
      if (after.power < 12 && actions.some((action) => action.kind === "gainPower")) useful.push("gain");
      if (actions.some((action) => action.kind === "discard") && digTarget(after)) useful.push("dig");
      if (actions.some((action) => action.kind === "playCard") && bestPlay(after)) useful.push("play");
      open = { from: before.villainLocation, to: after.villainLocation, useful, took: [] };
    }
    if (open && after.usedActions.length > before.usedActions.length) {
      open.took.push("acted");
    }
    if (input.type === "endTurn" && (before.phase === "actions" || before.phase === "resolving")) {
      if (open) {
        history.push(open);
        open = null;
      }
      if (followCoach && history.length >= 4) {
        const last = history.slice(-4);
        const bounce =
          last[0]!.to === last[1]!.from &&
          last[1]!.to === last[0]!.from &&
          last[2]!.from === last[0]!.from &&
          last[2]!.to === last[0]!.to &&
          last[3]!.from === last[1]!.from &&
          last[3]!.to === last[1]!.to &&
          last.every((mark) => mark.took.length === 0) &&
          last.some((mark) => mark.useful.length > 0);
        if (bounce) {
          record(
            "must",
            "coach-bounce-loop",
            "Following Coach paced between two stops and ended each turn while Gain, Discard, or Play was open",
            last.map((mark) => `${locName(mark.from)}->${locName(mark.to)} useful ${mark.useful.join("+") || "none"}`).join(" | "),
          );
        }
      }
    }
    state = after;
    coverage.steps += 1;
    checkState(state, origin);
    if (state.turn === 1 && state.phase === "move" && !state.pending && state.hangmansUnlocked === false) {
      const refused = applyInput(state, { type: "selectLocation", locationId: "hangmansTree" });
      if (refused.villainLocation === "hangmansTree") {
        record("must", "locked-move-accepted", "The engine accepted a move onto locked Hangman's Tree", brief(state));
      }
    }
  }
  if (!state.won && !state.lost) {
    try {
      state = applyInput(state, { type: "resign" });
    } catch {
      /* already terminal */
    }
  }
  checkTeachingSurfaces(state);
  coverage.gamesCompleted += 1;
  if (state.won) coverage.wins += 1;
  else if (/away from the Jolly Roger/i.test(state.loseReason)) {
    coverage.losses += 1;
    coverage.offShipLosses += 1;
  } else if (/struck the colors/i.test(state.loseReason)) coverage.resigns += 1;
  else coverage.losses += 1;
}

function expectMust(ok: boolean, id: string, summary: string, detail: string): void {
  if (!ok) record("must", id, summary, detail);
}

function runScripted(deadline: number): void {
  currentMode = "scripted";
  currentSeed = 0;
  coverage.sceneRuns += 1;

  currentScene = "nearwin";
  currentStep = 0;
  const near = nearWinScene();
  coverage.nearwinPlays += 1;
  expectMust(near.power === 2, "nearwin-power", "nearwin scene did not hydrate Power 2", brief(near));
  expectMust(near.turn === 8, "nearwin-turn", "nearwin scene did not hydrate turn 8", brief(near));
  expectMust(near.hangmansUnlocked, "nearwin-unlock", "nearwin scene left the tree locked", brief(near));
  expectMust(near.villainLocation === "skullRock", "nearwin-captain", "nearwin scene did not seat the captain at Skull Rock", brief(near));
  expectMust(Boolean(peterSeated(near)?.location === "skullRock"), "nearwin-peter", "nearwin scene did not seat Peter at Skull Rock", brief(near));
  checkState(near, null);
  const device = near.locations.skullRock.items.find((card) => card.defId === "ingeniousDevice");
  const peter = peterSeated(near)?.hero;
  const brutes = near.locations.jollyRoger.allies.filter((card) => card.defId === "pirateBrute");
  if (device && peter && brutes.length >= 2) {
    let state = applyInput(near, { type: "selectAction", actionKey: `extra:${device.instanceId}` });
    state = applyInput(state, { type: "selectCard", instanceId: peter.instanceId });
    state = applyInput(state, { type: "selectLocation", locationId: "jollyRoger" });
    if (state.phase !== "over") state = applyInput(state, { type: "endTurn" });
    if (state.pending?.kind === "fateReport") state = applyInput(state, { type: "acknowledgeFate" });
    if (state.phase === "move") state = applyInput(state, { type: "selectLocation", locationId: "jollyRoger" });
    const shipPeter = state.locations.jollyRoger.heroes.find((card) => card.defId === "peterPan");
    const vanquish = availableActions(state).find((action) => action.available && action.kind === "vanquish");
    if (shipPeter && vanquish) {
      state = applyInput(state, { type: "selectAction", actionKey: vanquish.key });
      state = applyInput(state, { type: "selectCard", instanceId: shipPeter.instanceId });
      for (const brute of brutes) {
        if (state.pending?.kind !== "vanquishAllies") break;
        state = applyInput(state, { type: "selectCard", instanceId: brute.instanceId });
      }
      const mathReady = state.pending?.kind === "vanquishAllies";
      state = applyInput(state, { type: "confirm" });
      expectMust(state.won, "nearwin-equal-win", "Two Brutes at Strength 8 did not vanquish Peter at Strength 8 on the ship", brief(state));
      if (state.won) {
        coverage.nearwinWins += 1;
        coverage.wins += 1;
        checkTeachingSurfaces(state);
      } else if (mathReady) {
        record("must", "nearwin-confirm-failed", "Equal-Strength confirm on the nearwin ship clash did not win", brief(state));
      }
    } else {
      record("must", "nearwin-no-clash", "Scripted nearwin walk did not open a ship clash", brief(state));
    }
  }
  coverage.gamesCompleted += 1;

  currentScene = "tauntdig";
  const dig = tauntDigScene();
  coverage.tauntDigs += 1;
  expectMust(dig.power === 7 && dig.turn === 38 && dig.hangmansUnlocked && dig.villainLocation === "skullRock", "tauntdig-hydrate", "tauntdig scene did not hydrate the turn-38 board", brief(dig));
  checkState(dig, null);
  const digAdvice = consult(dig);
  if (digAdvice) {
    expectMust(/Discard Obsession at Skull Rock/.test(digAdvice.do), "tauntdig-coach", "tauntdig Coach did not name an Obsession discard", `${digAdvice.do}`);
    expectMust(!/End the turn/i.test(digAdvice.do), "tauntdig-end", "tauntdig Coach ended instead of digging", digAdvice.do);
    expectMust(!/Move to (the )?Jolly Roger/.test(digAdvice.do), "tauntdig-ship", "tauntdig Coach walked back to the ship", digAdvice.do);
  }
  const obsession = dig.hand.find((card) => card.defId === "obsession");
  if (obsession) {
    let state = applyInput(dig, { type: "selectAction", actionKey: "sr-discard" });
    const named = consult(state);
    if (named && !named.do.includes("Obsession")) {
      record("must", "tauntdig-unnamed", "Discard picker Coach did not name Obsession", named.do, named);
    } else coverage.namedDiscards += 1;
    state = applyInput(state, { type: "selectCard", instanceId: obsession.instanceId });
    state = applyInput(state, { type: "confirm" });
    expectMust(!state.hand.some((card) => card.instanceId === obsession.instanceId), "tauntdig-discard-failed", "Named Obsession discard did not leave the hand", brief(state));
  }
  const moving = structuredClone(dig);
  moving.phase = "move";
  const moveAdvice = consult(moving);
  if (moveAdvice?.highlights.includes("loc:jollyRoger")) {
    record("must", "tauntdig-bounce", "From the tauntdig board Coach moves back to the ship", moveAdvice.do, moveAdvice);
  }

  currentScene = "bounceloop";
  const bounce = bounceLoopScene();
  coverage.bounceChecks += 1;
  checkState(bounce, null);
  const bounceAdvice = consult(bounce);
  if (bounceAdvice) {
    expectMust(/Gain/.test(bounceAdvice.do), "bounce-no-gain", "Bounce-loop scene Coach did not bank the open Gain", bounceAdvice.do);
    expectMust(!/End the turn/i.test(bounceAdvice.do), "bounce-ends", "Bounce-loop scene Coach ended the turn", bounceAdvice.do);
    expectMust(/walk-on|Tick Tock/i.test(`${bounceAdvice.do} ${bounceAdvice.why}`), "bounce-croc-copy", "Bounce-loop scene Coach did not mention Tick Tock", bounceAdvice.why);
  }

  currentScene = "hourequal";
  const equal = hourEqualVanquishScene();
  checkState(equal, null);
  const tinker = equal.locations.jollyRoger.heroes.find((hero) => hero.defId === "tinkerBell");
  const swash = equal.locations.jollyRoger.allies.find((ally) => ally.defId === "swashbuckler");
  if (tinker && swash) {
    expectMust(heroStrength(equal, tinker) === 2, "equal-strength-setup", "Tinker Bell was not Strength 2 in the equal clash scene", brief(equal));
    let state = applyInput(equal, { type: "selectAction", actionKey: "jr-vanquish" });
    expectMust(state.pending?.kind === "vanquishHero", "equal-vanquish-closed", "Equal Strength did not open Vanquish", brief(state));
    state = applyInput(state, { type: "selectCard", instanceId: tinker.instanceId });
    state = applyInput(state, { type: "selectCard", instanceId: swash.instanceId });
    state = applyInput(state, { type: "confirm" });
    expectMust(!state.locations.jollyRoger.heroes.some((hero) => hero.defId === "tinkerBell"), "equal-vanquish-failed", "Swashbuckler 2 did not vanquish Tinker Bell 2", brief(state));
    if (!state.locations.jollyRoger.heroes.some((hero) => hero.defId === "tinkerBell")) coverage.equalVanquishes += 1;
  }

  currentScene = "ticktock-slide";
  const slide = tickTockOntoCaptainScene();
  const handBefore = slide.hand.length;
  coverage.tickTockSlides += 1;
  const slid = applyInput(slide, { type: "selectLocation", locationId: "jollyRoger" });
  checkTransition(slide, { type: "selectLocation", locationId: "jollyRoger" }, slid);
  expectMust(slid.hand.length === handBefore, "tick-tock-slide-snap", "Sliding Tick Tock onto the captain emptied the hand", brief(slid));
  expectMust(slid.locations.jollyRoger.heroes.some((hero) => hero.defId === "tickTock"), "tick-tock-slide-missed", "Tick Tock did not slide onto the ship", brief(slid));

  currentScene = "ticktock-walk";
  const walk = createGame("normal", 99);
  walk.hand = walk.hand.slice(0, 4);
  walk.phase = "move";
  walk.villainLocation = "jollyRoger";
  walk.pending = null;
  walk.locations.skullRock.heroes.push(walk.fateDeck.find((card) => card.defId === "tickTock") ?? walk.fateDiscard.find((card) => card.defId === "tickTock") ?? { instanceId: "tick-probe", defId: "tickTock" });
  const crocCard = walk.locations.skullRock.heroes.find((hero) => hero.defId === "tickTock");
  if (crocCard) {
    walk.fateDeck = walk.fateDeck.filter((card) => card.instanceId !== crocCard.instanceId);
    walk.fateDiscard = walk.fateDiscard.filter((card) => card.instanceId !== crocCard.instanceId);
    const held = walk.hand.length;
    coverage.tickTockWalkOns += 1;
    const arrived = applyInput(walk, { type: "selectLocation", locationId: "skullRock" });
    checkTransition(walk, { type: "selectLocation", locationId: "skullRock" }, arrived);
    expectMust(arrived.hand.length === 0 && held > 0, "tick-tock-walk-missed", "Walking the captain onto Tick Tock did not empty the hand", brief(arrived));
  }

  currentScene = "cutlass";
  coverage.cutlassChecks += 1;
  const poor = createGame("normal", 3);
  poor.phase = "actions";
  poor.power = 0;
  poor.hand = [{ instanceId: "cutlass-probe", defId: "cutlass" }];
  poor.locations.jollyRoger.allies.push({ instanceId: "ally-probe", defId: "boardingParty" });
  checkState(poor, null);
  const rich = createGame("normal", 4);
  rich.phase = "actions";
  rich.power = 1;
  rich.hangmansUnlocked = true;
  rich.hand = [
    { instanceId: "cutlass-probe-2", defId: "cutlass" },
    { instanceId: "swash-probe", defId: "swashbuckler" },
  ];
  checkState(rich, null);
  const noAlly = consult(rich);
  if (noAlly && /\bPlay Cutlass\b/i.test(noAlly.do)) {
    record("must", "cutlass-no-ally", "Coach played Cutlass while the only Ally was still in hand", noAlly.do, noAlly);
  }

  currentScene = "lost-boys-equal";
  const boys = createGame("normal", 5);
  boys.phase = "actions";
  boys.villainLocation = "jollyRoger";
  boys.hangmansUnlocked = true;
  boys.power = 2;
  boys.hand = [];
  boys.locations.jollyRoger.heroes.push({ instanceId: "boys-probe", defId: "lostBoys" });
  boys.locations.jollyRoger.allies.push(
    { instanceId: "swash-a", defId: "swashbuckler" },
    { instanceId: "swash-b", defId: "swashbuckler" },
  );
  const boysHero = boys.locations.jollyRoger.heroes[0]!;
  expectMust(vanquishableHeroes(boys).some((hero) => hero.hero.instanceId === boysHero.instanceId), "lost-boys-equal-closed", "Two Swashbucklers at Strength 4 total could not vanquish Lost Boys at 4", brief(boys));
  const one = structuredClone(boys);
  one.locations.jollyRoger.allies.pop();
  expectMust(!vanquishableHeroes(one).some((hero) => hero.hero.defId === "lostBoys"), "lost-boys-one-opened", "Lost Boys became vanquishable with a single Ally", brief(one));

}

function hydrateUi(): void {
  const result = spawnSync("npx", ["vite-node", "scripts/hammer-scenes.ts"], {
    cwd: "/workspace",
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.status !== 0) {
    record(
      "must",
      "scene-ui-throw",
      "Scene hydration UI probe failed",
      `${result.stdout ?? ""}\n${result.stderr ?? ""}`.slice(0, 800),
    );
    return;
  }
  try {
    const parsed = JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "{}") as { ok?: boolean; hydrations?: number; errors?: string[] };
    if (!parsed.ok) {
      for (const error of parsed.errors ?? ["unknown scene failure"]) {
        record("must", "scene-setsail-hydrate", "Set Sail or boot dropped a ?scene= board", error);
      }
    } else {
      coverage.uiHydrations += parsed.hydrations ?? 1;
    }
  } catch (error) {
    record("must", "scene-ui-throw", "Scene hydration UI probe returned junk", `${result.stdout}\n${error instanceof Error ? error.message : String(error)}`);
  }
}

function snapshot(): Record<string, unknown> {
  return {
    workerId,
    pid: process.pid,
    budgetMs,
    elapsedMs: Date.now() - started,
    coverage,
    must: [...findings.values()].filter((finding) => finding.severity === "must"),
    should: [...findings.values()].filter((finding) => finding.severity === "should"),
    nice: [...findings.values()].filter((finding) => finding.severity === "nice"),
    updatedAt: new Date().toISOString(),
  };
}

function flush(): void {
  const body = JSON.stringify(snapshot(), null, 2);
  writeFileSync(`${outDir}/worker-${workerId}.json`, body);
}

const started = Date.now();
const deadline = started + budgetMs;
let games = 0;
let lastLog = started;

const modes = ["coach-easy", "coach-normal", "policy-easy", "policy-normal", "chaos-normal", "scripted"] as const;

let lastUiAt = 0;

function main(): void {
  console.log(`[w${workerId}] hammer start budget ${budgetMs}ms`);
  if (workerId === 0) {
    hydrateUi();
    lastUiAt = Date.now();
  }
  flush();
  while (Date.now() < deadline) {
    const mode = modes[games % modes.length]!;
    const seed = (workerId + 1) * 1_000_003 + games * 997;
    try {
      if (mode === "scripted") runScripted(deadline);
      else playVoyage(mode, seed, deadline);
    } catch (error) {
      record("must", "worker-throw", "Worker loop threw", error instanceof Error ? error.stack ?? error.message : String(error));
    }
    games += 1;
    if (games % 2 === 0) flush();
    if (workerId === 0 && Date.now() - lastUiAt > 600_000) {
      hydrateUi();
      lastUiAt = Date.now();
    }
    if (Date.now() - lastLog > 30_000) {
      lastLog = Date.now();
      const seconds = Math.round((Date.now() - started) / 1000);
      const musts = [...findings.values()].filter((finding) => finding.severity === "must").map((finding) => `${finding.id}:${finding.count}`).join(",");
      console.log(
        `[w${workerId}] t=${seconds}s games=${coverage.gamesCompleted} steps=${coverage.steps} wins=${coverage.wins} losses=${coverage.losses} resigns=${coverage.resigns} scenes=${coverage.sceneRuns} musts=${musts || "none"}`,
      );
    }
  }
  if (workerId === 0) hydrateUi();
  flush();
  console.log(`[w${workerId}] done games=${coverage.gamesCompleted} steps=${coverage.steps} wins=${coverage.wins}`);
}

process.on("SIGTERM", () => {
  flush();
  process.exit(0);
});

try {
  main();
} catch (error) {
  record("must", "worker-fatal", "Worker fatal", error instanceof Error ? error.stack ?? error.message : String(error));
  flush();
  process.exit(1);
}
