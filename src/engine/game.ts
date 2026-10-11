import { def, fateCardIds, villainCardIds } from "./cards";
import { RIVAL_GOAL, RIVAL_LOSE_REASON, fatePush, rivalGain } from "./rival";
import {
  chooseAttachTarget,
  chooseFateCard,
  chooseHeadacheItem,
  chooseHeroLocation,
  chooseTinkerAlly,
  explainFateChoice,
} from "./fateAi";
import {
  adjacentUnlocked,
  allAllies,
  allLocationItems,
  allyStrength,
  attachableHeroes,
  availableActions,
  canPlayCunning,
  canPlayObsession,
  handAllies,
  clashAndCrocLine,
  coveringHero,
  fateEmptyLine,
  findCard,
  findCardLocation,
  heroStrength,
  isUnlocked,
  legalMoveLocations,
  legalPlayLocations,
  mapInRealm,
  movableAlliesAndItems,
  movableHeroes,
  moveHeroBlockedReason,
  movePieceBlockedReason,
  playableHandCards,
  playBlockedReason,
  unlockedLocations,
  vanquishAllyPool,
  vanquishBlockedReason,
  vanquishableHeroes,
} from "./queries";
import { locName } from "./realm";
import {
  LOCATION_IDS,
  type CardInstance,
  type GameState,
  type Input,
  type LocationId,
  type Pending,
  type VoyageMemory,
} from "./types";
import { shuffle } from "./rng";

export function emptyVoyage(): VoyageMemory {
  return {
    mapOpened: false,
    peterSeated: false,
    peterHow: "",
    walkedWest: false,
    fateMoments: [],
    lastClash: null,
  };
}

function rememberFate(state: GameState, text: string): void {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return;
  if (state.voyage.fateMoments[state.voyage.fateMoments.length - 1] === line) return;
  state.voyage.fateMoments.push(line);
  if (state.voyage.fateMoments.length > 5) state.voyage.fateMoments.shift();
}

function emptyLocations(): GameState["locations"] {
  return {
    jollyRoger: { id: "jollyRoger", heroes: [], allies: [], items: [] },
    skullRock: { id: "skullRock", heroes: [], allies: [], items: [] },
    mermaidLagoon: { id: "mermaidLagoon", heroes: [], allies: [], items: [] },
    hangmansTree: { id: "hangmansTree", heroes: [], allies: [], items: [] },
  };
}

export function titleState(): GameState {
  return {
    screen: "title",
    difficulty: "normal",
    seed: 1,
    rng: 1,
    instanceSeq: 1,
    logSeq: 1,
    turn: 1,
    rivalProgress: 0,
    coachOn: false,
    power: 0,
    handSize: 4,
    villainLocation: "jollyRoger",
    departedFrom: null,
    hangmansUnlocked: false,
    peterPanRevealed: false,
    peterPanLocation: null,
    won: false,
    lost: false,
    loseReason: "",
    hand: [],
    villainDeck: [],
    villainDiscard: [],
    fateDeck: [],
    fateDiscard: [],
    locations: emptyLocations(),
    attachments: [],
    phase: "title",
    pending: null,
    usedActions: [],
    tempStrength: {},
    defeatedHeroStrengthsThisTurn: [],
    log: [],
    lastComputerFateNote: "",
    lastFateShow: null,
    voyage: emptyVoyage(),
    bannerNote: "",
  };
}

function mint(state: GameState, defId: string): CardInstance {
  const instanceId = `${defId}-${state.instanceSeq++}`;
  return { instanceId, defId };
}

function log(state: GameState, text: string, tone: GameState["log"]["0"]["tone"] = "info"): void {
  state.log.unshift({ id: state.logSeq++, text, tone });
  if (state.log.length > 80) state.log.pop();
}

function buildDeck(state: GameState, ids: string[]): CardInstance[] {
  return ids.map((id) => mint(state, id));
}

function reshuffleVillain(state: GameState): void {
  if (state.villainDeck.length > 0) return;
  if (state.villainDiscard.length === 0) return;
  const shuffled = shuffle(state.villainDiscard, state.rng);
  state.rng = shuffled.rng;
  state.villainDeck = shuffled.items;
  state.villainDiscard = [];
  log(state, "The villain discard is shuffled into a new deck.");
}

function reshuffleFate(state: GameState): void {
  if (state.fateDeck.length > 0) return;
  if (state.fateDiscard.length === 0) return;
  const shuffled = shuffle(state.fateDiscard, state.rng);
  state.rng = shuffled.rng;
  state.fateDeck = shuffled.items;
  state.fateDiscard = [];
  log(state, "The Fate discard is shuffled into a new deck.", "fate");
}

function drawVillain(state: GameState, n: number): CardInstance[] {
  const drawn: CardInstance[] = [];
  for (let i = 0; i < n; i++) {
    reshuffleVillain(state);
    const card = state.villainDeck.shift();
    if (!card) break;
    drawn.push(card);
  }
  return drawn;
}

function noteFateDeckEmpty(state: GameState): void {
  const line = fateEmptyLine(state);
  if (!line) return;
  if (state.log.some((e) => e.text === line)) return;
  log(state, line, "fate");
}

function drawFate(state: GameState, n: number): CardInstance[] {
  const drawn: CardInstance[] = [];
  for (let i = 0; i < n; i++) {
    reshuffleFate(state);
    const card = state.fateDeck.shift();
    if (!card) break;
    drawn.push(card);
  }
  if (drawn.length > 0) noteFateDeckEmpty(state);
  return drawn;
}

function takeFromHand(state: GameState, instanceId: string): CardInstance | null {
  const i = state.hand.findIndex((c) => c.instanceId === instanceId);
  if (i < 0) return null;
  return state.hand.splice(i, 1)[0] ?? null;
}

function discardVillainCard(state: GameState, card: CardInstance): void {
  state.villainDiscard.unshift(card);
}

function discardFateCard(state: GameState, card: CardInstance): void {
  state.fateDiscard.unshift(card);
}

function discardRealmItem(state: GameState, card: CardInstance): void {
  if (def(card.defId).deck === "fate") discardFateCard(state, card);
  else discardVillainCard(state, card);
}

function detachAll(state: GameState, hostId: string): void {
  const kept: GameState["attachments"] = [];
  for (const a of state.attachments) {
    if (a.attachedTo === hostId) {
      if (def(a.item.defId).deck === "fate") discardFateCard(state, a.item);
      else discardVillainCard(state, a.item);
    } else {
      kept.push(a);
    }
  }
  state.attachments = kept;
}

function removeFromRealm(state: GameState, instanceId: string): CardInstance | null {
  for (const id of LOCATION_IDS) {
    const loc = state.locations[id];
    for (const key of ["heroes", "allies", "items"] as const) {
      const i = loc[key].findIndex((c) => c.instanceId === instanceId);
      if (i >= 0) {
        const card = loc[key].splice(i, 1)[0];
        if (card) return card;
      }
    }
  }
  const att = state.attachments.findIndex((a) => a.item.instanceId === instanceId);
  if (att >= 0) {
    const row = state.attachments.splice(att, 1)[0];
    if (row) return row.item;
  }
  return takeFromHand(state, instanceId);
}

function placeHero(state: GameState, hero: CardInstance, locationId: LocationId): void {
  state.locations[locationId].heroes.push(hero);
  if (hero.defId === "peterPan") {
    state.peterPanRevealed = true;
    state.peterPanLocation = locationId;
  }
}

function placeAlly(state: GameState, ally: CardInstance, locationId: LocationId): void {
  state.locations[locationId].allies.push(ally);
}

function placeItem(state: GameState, item: CardInstance, locationId: LocationId): void {
  state.locations[locationId].items.push(item);
}

function updatePeterLoc(state: GameState): void {
  for (const id of LOCATION_IDS) {
    if (state.locations[id].heroes.some((h) => h.defId === "peterPan")) {
      state.peterPanLocation = id;
      state.peterPanRevealed = true;
      return;
    }
  }
}

function discardHand(state: GameState): void {
  while (state.hand.length) {
    discardVillainCard(state, state.hand.shift()!);
  }
}

function abilityLine(card: CardInstance): string {
  const d = def(card.defId);
  return `${d.name}: ${d.text}`;
}

export const HEADACHE_NO_ITEM_BANNER = "No Item ashore — this Fate card is discarded.";

export const HEADACHE_NO_ITEM_NOTE =
  `${HEADACHE_NO_ITEM_BANNER} Splitting Headache finds no Item and is discarded.`;

export function isNoItemFateDiscard(note: string): boolean {
  return /no item/i.test(note) && /discard/i.test(note);
}

function discardHeadacheIfNeeded(state: GameState, card: CardInstance | undefined): void {
  if (!card) return;
  if (state.fateDiscard.some((c) => c.instanceId === card.instanceId)) return;
  state.fateDeck = state.fateDeck.filter((c) => c.instanceId !== card.instanceId);
  discardFateCard(state, card);
}

function finishHeadacheWithoutItems(
  state: GameState,
  card: CardInstance | undefined,
  opts: {
    resume: "nextTurn" | "actions";
    drawn?: CardInstance[];
    discarded?: CardInstance[];
    choiceReason?: string;
  },
): void {
  discardHeadacheIfNeeded(state, card);
  state.heldCard = undefined;
  log(state, HEADACHE_NO_ITEM_NOTE, "fate");
  openFateReport(state, {
    drawn: opts.drawn ?? (card ? [card] : []),
    played: card,
    discarded: opts.discarded ?? [],
    note: HEADACHE_NO_ITEM_NOTE,
    choiceReason: opts.choiceReason,
    resume: opts.resume,
    markAction: opts.resume === "actions",
  });
}

function headacheCardFromChoice(state: GameState, cardId: string): CardInstance {
  if (state.heldCard?.instanceId === cardId) return state.heldCard;
  return findCard(state, cardId) ?? state.heldCard ?? { instanceId: cardId, defId: "splittingHeadache" };
}

/** Empty-shore Headache must never sit on fateChooseItem — convert to a Continue report. */
function recoverEmptyHeadacheChoice(state: GameState): void {
  const p = state.pending;
  if (p?.kind !== "fateChooseItem") return;
  if (allLocationItems(state).length > 0) return;
  finishHeadacheWithoutItems(state, headacheCardFromChoice(state, p.cardId), {
    resume: p.actor === "ai" ? "nextTurn" : "actions",
  });
}

function acknowledgeOpenFate(state: GameState): void {
  if (state.pending?.kind === "fateReport") {
    if (state.pending.resume === "nextTurn") {
      beginNextTurn(state, state.pending.played?.defId);
    } else if (state.pending.markAction) {
      consumeCurrentAction(state);
    } else {
      state.pending = null;
      state.phase = "actions";
    }
    return;
  }
  if (state.phase === "fateAdversary") {
    beginNextTurn(state);
  }
}

function openFateReport(
  state: GameState,
  opts: {
    drawn: CardInstance[];
    played?: CardInstance;
    discarded?: CardInstance[];
    note: string;
    choiceReason?: string;
    resume: "nextTurn" | "actions";
    markAction?: boolean;
  },
): void {
  const played = opts.played;
  state.pending = {
    kind: "fateReport",
    drawn: opts.drawn,
    played,
    discarded: opts.discarded ?? [],
    note: opts.note,
    abilityText: played ? abilityLine(played) : "",
    choiceReason: opts.choiceReason,
    resume: opts.resume,
    markAction: opts.markAction,
  };
  state.phase = opts.resume === "nextTurn" ? "fateAdversary" : "resolving";
  rememberFate(state, opts.note);
  if (opts.resume === "nextTurn") {
    state.lastComputerFateNote = opts.note;
    state.lastFateShow = {
      drawn: opts.drawn,
      played,
      discarded: opts.discarded ?? [],
      note: opts.note,
      abilityText: played ? abilityLine(played) : "",
      choiceReason: opts.choiceReason,
    };
  }
}

const TICK_TOCK_SNAP_NOTE =
  "Tick Tock snaps — the whole hand is discarded. The crocodile stays in the realm. The hand empties only when the captain moves onto this place.";

function tickTockAt(state: GameState, dest: LocationId): CardInstance | undefined {
  return state.locations[dest].heroes.find((h) => h.defId === "tickTock");
}

function snapTickTockHand(state: GameState): boolean {
  if (!tickTockAt(state, state.villainLocation)) return false;
  const pair = clashAndCrocLine(state);
  discardHand(state);
  log(
    state,
    pair ? `Tick Tock snaps — the whole hand is discarded. ${pair}` : "Tick Tock snaps — the whole hand is discarded.",
    "bad",
  );
  return true;
}

function openTickTockSnapReport(state: GameState, opts?: { markAction?: boolean }): void {
  const croc = tickTockAt(state, state.villainLocation);
  if (!croc) return;
  const pair = clashAndCrocLine(state);
  openFateReport(state, {
    drawn: [croc],
    played: croc,
    discarded: [],
    note: pair ? `${TICK_TOCK_SNAP_NOTE} ${pair}` : TICK_TOCK_SNAP_NOTE,
    resume: "actions",
    markAction: opts?.markAction,
  });
}

/** Hand empties only when the captain moves onto Tick Tock's place — not when the crocodile is seated or slid onto the captain. */
function checkTickTock(state: GameState, dest: LocationId, moved?: CardInstance | "captain"): boolean {
  if (moved !== "captain") return false;
  if (dest !== state.villainLocation) return false;
  const croc = tickTockAt(state, dest);
  if (!croc) return false;
  snapTickTockHand(state);
  openTickTockSnapReport(state);
  return true;
}

function markActionUsed(state: GameState, key: string): void {
  if (!state.usedActions.includes(key)) state.usedActions.push(key);
}

function consumeCurrentAction(state: GameState): void {
  if (state.actionKey) markActionUsed(state, state.actionKey);
  state.actionKey = undefined;
  state.heldCard = undefined;
  state.pending = null;
  state.phase = "actions";
}

function beginAction(state: GameState, key: string, pending: Pending): void {
  state.actionKey = key;
  state.phase = "resolving";
  state.pending = pending;
}

function revealPeter(state: GameState, peter: CardInstance, extras: CardInstance[], how: string): void {
  placeHero(state, peter, "hangmansTree");
  extras.forEach((c) => discardFateCard(state, c));
  state.voyage.peterSeated = true;
  state.voyage.peterHow = how;
  log(state, "Peter Pan is revealed and lands at Hangman's Tree.", "fate");
}

function forceObsessionPeter(state: GameState, hero: CardInstance): void {
  const peterNote = "Obsession finds Peter Pan. A revealed Peter must be played to Hangman's Tree.";
  revealPeter(state, hero, [], peterNote);
  openFateReport(state, {
    drawn: [hero],
    played: hero,
    discarded: [],
    note: peterNote,
    resume: "actions",
    markAction: true,
  });
}

function spendPower(state: GameState, n: number): boolean {
  if (state.power < n) return false;
  state.power -= n;
  return true;
}

function discardMap(state: GameState): boolean {
  const map = mapInRealm(state);
  if (!map) return false;
  removeFromRealm(state, map.instanceId);
  discardVillainCard(state, map);
  log(state, "The Never Land Map is discarded to cover an Item's cost.");
  return true;
}

function endIfOver(state: GameState): boolean {
  return state.won || state.lost;
}

function finishVanquish(state: GameState, heroId: string, allyIds: string[]): void {
  const loc = findCardLocation(state, heroId);
  const hero = findCard(state, heroId);
  if (!loc || !hero) return;
  const strength = heroStrength(state, hero);
  const allyTotal = allyIds.reduce((sum, id) => {
    const ally = findCard(state, id);
    return sum + (ally ? allyStrength(state, ally) : 0);
  }, 0);
  state.voyage.lastClash = {
    heroName: def(hero.defId).name,
    place: locName(loc),
    locationId: loc,
    captainPlace: locName(state.villainLocation),
    allyStrength: allyTotal,
    heroStrength: strength,
    reach: loc === state.villainLocation ? "same-place" : "neighbor",
    onShip: loc === "jollyRoger",
  };
  for (const id of allyIds) {
    const ally = removeFromRealm(state, id);
    if (ally) {
      detachAll(state, ally.instanceId);
      discardVillainCard(state, ally);
    }
  }
  removeFromRealm(state, heroId);
  detachAll(state, heroId);
  discardFateCard(state, hero);
  state.defeatedHeroStrengthsThisTurn.push(strength);
  log(state, `${def(hero.defId).name} is vanquished at ${locName(loc)}.`, "good");
  if (hero.defId === "peterPan") {
    if (loc === "jollyRoger") {
      state.won = true;
      state.phase = "over";
      state.pending = null;
      log(state, "Peter Pan falls at the Jolly Roger. Victory!", "good");
    } else {
      state.lost = true;
      state.loseReason = "Peter Pan was vanquished away from the Jolly Roger. The objective is lost.";
      state.phase = "over";
      state.pending = null;
      log(state, state.loseReason, "bad");
    }
    state.peterPanLocation = null;
  }
}

function startComputerFate(state: GameState): void {
  state.tempStrength = {};
  state.defeatedHeroStrengthsThisTurn = [];
  const drawn = drawFate(state, 2);
  if (drawn.length === 0) {
    noteFateDeckEmpty(state);
    beginNextTurn(state);
    return;
  }
  const choice = chooseFateCard(state, drawn, state.difficulty);
  state.rng = choice.rng;
  const play = choice.card;
  const discarded = drawn.filter((c) => c.instanceId !== play.instanceId);
  const choiceReason = explainFateChoice(state, drawn, play, state.difficulty);
  if (play.defId === "peterPan") {
    const peterNote = "Fate plays Peter Pan. He is forced to Hangman's Tree.";
    revealPeter(state, play, discarded, peterNote);
    openFateReport(state, {
      drawn,
      played: play,
      discarded,
      note: peterNote,
      choiceReason,
      resume: "nextTurn",
    });
    return;
  }
  discarded.forEach((c) => discardFateCard(state, c));
  resolveComputerFateCard(state, play, drawn, discarded, choiceReason);
}

function resolveComputerFateCard(
  state: GameState,
  card: CardInstance,
  drawn: CardInstance[],
  discarded: CardInstance[],
  choiceReason?: string,
): void {
  const d = def(card.defId);
  let note = `Fate plays ${d.name}.`;
  if (d.type === "hero") {
    const dest = chooseHeroLocation(state, card, state.difficulty);
    state.rng = dest.rng;
    placeHero(state, card, dest.id);
    note = `Fate seats ${d.name} at ${locName(dest.id)}.`;
    if (card.defId === "tinkerBell") {
      const ally = chooseTinkerAlly(state, dest.id);
      if (ally) {
        removeFromRealm(state, ally.instanceId);
        detachAll(state, ally.instanceId);
        discardVillainCard(state, ally);
        note += ` Tinker Bell dismisses ${def(ally.defId).name}.`;
      }
    }
  } else if (d.id === "pixieDust" || d.id === "taunt") {
    const target = chooseAttachTarget(state, state.difficulty, d.id);
    state.rng = target.rng;
    if (!target.hero) {
      discardFateCard(state, card);
      note = `${d.name} has no Hero to attach to, so it is discarded.`;
    } else {
      state.attachments.push({ item: card, attachedTo: target.hero.instanceId });
      note = `${d.name} clings to ${def(target.hero.defId).name}.`;
    }
  } else if (d.id === "splittingHeadache") {
    const item = chooseHeadacheItem(state);
    if (!item) {
      finishHeadacheWithoutItems(state, card, { resume: "nextTurn", drawn, discarded, choiceReason });
      return;
    }
    removeFromRealm(state, item.instanceId);
    discardRealmItem(state, item);
    discardFateCard(state, card);
    note = `Splitting Headache discards ${def(item.defId).name}.`;
  } else {
    discardFateCard(state, card);
  }
  log(state, note, "fate");
  openFateReport(state, { drawn, played: card, discarded, note, choiceReason, resume: "nextTurn" });
}

function beginNextTurn(state: GameState, playedFateId?: string): void {
  if (endIfOver(state)) return;
  const gain = rivalGain(state.difficulty, playedFateId);
  state.rivalProgress = Math.min(RIVAL_GOAL, state.rivalProgress + gain);
  const push = fatePush(playedFateId);
  const playedName = playedFateId && push > 0 ? def(playedFateId).name : "";
  const hurry = playedName ? ` ${playedName} adds ${push}.` : "";
  log(state, `The rival villain advances to ${state.rivalProgress} of ${RIVAL_GOAL}.${hurry}`, "bad");
  if (state.rivalProgress >= RIVAL_GOAL) {
    state.lost = true;
    state.loseReason = RIVAL_LOSE_REASON;
    state.phase = "over";
    state.pending = null;
    log(state, state.loseReason, "bad");
    return;
  }
  state.turn += 1;
  state.usedActions = [];
  state.tempStrength = {};
  state.pending = null;
  state.phase = "move";
  log(state, `Turn ${state.turn}. Move the captain.`);
}

function refillHand(state: GameState): void {
  const need = state.handSize - state.hand.length;
  if (need > 0) {
    const drawn = drawVillain(state, need);
    state.hand.push(...drawn);
    if (drawn.length) log(state, `Drew ${drawn.length} card${drawn.length === 1 ? "" : "s"} to refill the hand.`);
  }
}

function playPeterIfPresent(state: GameState, cards: CardInstance[]): boolean {
  const peter = cards.find((c) => c.defId === "peterPan");
  if (!peter) return false;
    revealPeter(
    state,
    peter,
    cards.filter((c) => c.instanceId !== peter.instanceId),
    "Peter Pan is revealed and lands at Hangman's Tree.",
  );
  return true;
}

function startPlayerFate(state: GameState): void {
  const drawn = drawFate(state, 2);
  if (drawn.length === 0) {
    noteFateDeckEmpty(state);
    consumeCurrentAction(state);
    return;
  }
  if (playPeterIfPresent(state, drawn)) {
    const peter = drawn.find((c) => c.defId === "peterPan")!;
    openFateReport(state, {
      drawn,
      played: peter,
      discarded: drawn.filter((c) => c.instanceId !== peter.instanceId),
      note: "Peter Pan is revealed and lands at Hangman's Tree.",
      resume: "actions",
      markAction: true,
    });
    return;
  }
  state.pending = { kind: "fateChooseCard", cards: drawn, actor: "player" };
  state.phase = "resolving";
}

function afterPaymentPlay(
  state: GameState,
  card: CardInstance,
  locationId?: LocationId,
  attachTo?: string,
): void {
  const d = def(card.defId);
  takeFromHand(state, card.instanceId);
  if (d.id === "neverLandMap") {
    if (!locationId) return;
    placeItem(state, card, locationId);
    state.hangmansUnlocked = true;
    state.voyage.mapOpened = true;
    log(state, "The Never Land Map is spread open. Hangman's Tree is unlocked.", "good");
    consumeCurrentAction(state);
    return;
  }
  if (d.id === "cutlass") {
    if (!attachTo) {
      state.hand.push(card);
      return;
    }
    state.attachments.push({ item: card, attachedTo: attachTo });
    log(state, `Cutlass is strapped to ${def(findCard(state, attachTo)?.defId ?? "swashbuckler").name}.`);
    consumeCurrentAction(state);
    return;
  }
  if (d.type === "item") {
    if (!locationId) return;
    placeItem(state, card, locationId);
    log(state, `${d.name} is placed at ${locName(locationId)}.`);
    consumeCurrentAction(state);
    return;
  }
  if (d.type === "ally") {
    if (!locationId) return;
    placeAlly(state, card, locationId);
    log(state, `${d.name} comes ashore at ${locName(locationId)}.`);
    if (d.id === "mrStarkey") {
      const heroes = state.locations[locationId].heroes;
      if (heroes.length && adjacentUnlocked(state, locationId).length) {
        state.pending = { kind: "starkeyHero", starkeyId: card.instanceId };
        return;
      }
    }
    consumeCurrentAction(state);
    return;
  }
  resolveEffect(state, card);
}

function resolveEffect(state: GameState, card: CardInstance): void {
  discardVillainCard(state, card);
  if (card.defId === "giveThemAScare") {
    const peeked = drawFate(state, 2);
    if (peeked.length === 0) {
      log(state, "Give Them a Scare finds an empty Fate deck.");
      consumeCurrentAction(state);
      return;
    }
    state.pending = { kind: "scarePeek", cards: peeked };
    return;
  }
  if (card.defId === "worthyOpponent") {
    state.power += 2;
    log(state, "Worthy Opponent: +2 Power.");
    const extras: CardInstance[] = [];
    let hero: CardInstance | undefined;
    for (let i = 0; i < 20; i++) {
      const [cardDrawn] = drawFate(state, 1);
      if (!cardDrawn) break;
      if (def(cardDrawn.defId).type === "hero") {
        hero = cardDrawn;
        break;
      }
      extras.push(cardDrawn);
    }
    extras.forEach((c) => discardFateCard(state, c));
    if (!hero) {
      log(state, "No Hero remained in Fate.");
      consumeCurrentAction(state);
      return;
    }
    if (hero.defId === "peterPan") {
      const peterNote = "Worthy Opponent finds Peter Pan. He is forced to Hangman's Tree.";
      revealPeter(state, hero, [], peterNote);
      openFateReport(state, {
        drawn: [hero],
        played: hero,
        discarded: [],
        note: peterNote,
        resume: "actions",
        markAction: true,
      });
      return;
    }
    state.heldCard = hero;
    state.pending = { kind: "worthyLocation", heroId: hero.instanceId };
    return;
  }
  if (card.defId === "ayeAyeSir") {
    if (allAllies(state).length === 0) {
      consumeCurrentAction(state);
      return;
    }
    state.pending = { kind: "ayeAyeAlly" };
    return;
  }
  consumeCurrentAction(state);
}

function maybeAskPayment(
  state: GameState,
  card: CardInstance,
  locationId?: LocationId,
  attachTo?: string,
): void {
  const d = def(card.defId);
  if (d.cost <= 0) {
    playAfterCost(state, card, locationId, attachTo);
    return;
  }
  state.pending = { kind: "playChoosePayment", cardId: card.instanceId, locationId, attachTo };
}

function playAfterCost(
  state: GameState,
  card: CardInstance,
  locationId?: LocationId,
  attachTo?: string,
): void {
  afterPaymentPlay(state, card, locationId, attachTo);
}

function playHeldHero(state: GameState, hero: CardInstance, locationId: LocationId, tinkerActor: "player" | "ai"): void {
  placeHero(state, hero, locationId);
  log(state, `${def(hero.defId).name} is played to ${locName(locationId)}.`, "fate");
  if (hero.defId === "tinkerBell" && state.locations[locationId].allies.length) {
    state.pending = { kind: "tinkerDiscard", tinkerId: hero.instanceId, locationId, actor: tinkerActor };
    return;
  }
  openFateReport(state, {
    drawn: [hero],
    played: hero,
    discarded: [],
    note: `${def(hero.defId).name} is played to ${locName(locationId)}.`,
    resume: "actions",
    markAction: true,
  });
}

export function createGame(difficulty: GameState["difficulty"] = "normal", seed = Date.now()): GameState {
  const state = titleState();
  state.screen = "play";
  state.difficulty = difficulty;
  state.seed = seed;
  state.rng = seed >>> 0 || 1;
  const villain = shuffle(buildDeck(state, villainCardIds()), state.rng);
  state.rng = villain.rng;
  state.villainDeck = villain.items;
  const fate = shuffle(buildDeck(state, fateCardIds()), state.rng);
  state.rng = fate.rng;
  state.fateDeck = fate.items;
  state.hand = drawVillain(state, 4);
  state.phase = "move";
  state.villainLocation = "jollyRoger";
  log(state, "The realm is dealt. Move from the Jolly Roger to begin.", "info");
  return state;
}

const RESIGN_BLOCKING_PENDING = new Set([
  "fateReport",
  "scarePeek",
  "fateChooseCard",
  "fateChooseItem",
  "playChoosePayment",
  "conditionOffer",
  "obsessionDecide",
  "vanquishConfirmLoss",
  "worthyLocation",
  "obsessionLocation",
  "playChooseAllyAttach",
]);

/** Resign must not fire through a blocking modal, Fate, a win/loss overlay, or after the duel is over. */
export function resignBlocked(state: GameState): boolean {
  if (state.phase === "over" || state.won || state.lost || state.screen === "help") return true;
  const kind = state.pending?.kind;
  return Boolean(kind && RESIGN_BLOCKING_PENDING.has(kind));
}

export function applyInput(prev: GameState, input: Input): GameState {
  if (input.type === "resign" && resignBlocked(prev)) return prev;
  const state = structuredClone(prev);
  if (input.type !== "openHelp" && input.type !== "closeHelp") {
    state.bannerNote = "";
  }

  if (input.type === "start") {
    return createGame(input.difficulty, input.seed ?? Date.now());
  }
  if (input.type === "newGame") {
    return titleState();
  }
  if (input.type === "openHelp") {
    state.screen = "help";
    return state;
  }
  if (input.type === "closeHelp") {
    state.screen = state.phase === "title" ? "title" : "play";
    return state;
  }
  if (input.type === "resign") {
    state.lost = true;
    state.loseReason = "You struck the colors.";
    state.phase = "over";
    state.pending = null;
    log(state, "The captain resigns.", "bad");
    return state;
  }

  if (state.phase === "over" || state.won || state.lost) return state;

  recoverEmptyHeadacheChoice(state);

  if (input.type === "acknowledgeFate") {
    acknowledgeOpenFate(state);
    return state;
  }

  if (input.type === "endTurn") {
    if (state.pending?.kind === "fateReport") {
      acknowledgeOpenFate(state);
      return state;
    }
    if ((state.phase === "actions" || state.phase === "resolving") && !state.pending) {
      refillHand(state);
      startComputerFate(state);
    }
    return state;
  }

  if (input.type === "cancel") {
    if (state.pending?.kind === "fateReport") return state;
    if (state.pending?.kind === "conditionOffer") {
      const offered = findCard(state, state.pending.conditionId);
      const name = offered ? def(offered.defId).name : "The Condition";
      log(state, `${name} stays in hand.`);
      state.pending = null;
      state.phase = "actions";
      return state;
    }
    if (state.pending?.kind === "cunningLocation") {
      const note =
        "Cunning is already played. Choose an Ally again, or Cancel to decline the free crew. The Condition does not return.";
      log(state, note);
      state.bannerNote = note;
      state.pending = { kind: "cunningAlly" };
      return state;
    }
    if (state.pending?.kind === "cunningAlly") {
      const note = "Cunning stays in the discard. You declined the free Ally, so no crew comes ashore.";
      log(state, note);
      state.bannerNote = note;
      state.pending = null;
      state.phase = "actions";
      state.actionKey = undefined;
      return state;
    }
    // These steps already pulled a card out of a deck. Cancel used to drop `pending`
    // and leave the card only on `heldCard`, so the next Fate overwrite deleted it.
    if (
      state.pending?.kind === "fateChooseLocation" ||
      state.pending?.kind === "fateChooseAttach" ||
      state.pending?.kind === "worthyLocation" ||
      state.pending?.kind === "obsessionDecide" ||
      state.pending?.kind === "obsessionLocation" ||
      state.pending?.kind === "ayeAyeAlly"
    ) {
      return state;
    }
    if (state.pending?.kind === "ayeAyeDest") {
      state.pending = { kind: "ayeAyeAlly" };
      return state;
    }
    if (state.pending?.kind === "starkeyHero" || state.pending?.kind === "tinkerDiscard") {
      consumeCurrentAction(state);
      return state;
    }
    if (state.pending?.kind === "playChoosePayment") {
      if (state.pending.attachTo) {
        state.pending = { kind: "playChooseAllyAttach", cardId: state.pending.cardId };
      } else if (state.pending.locationId) {
        state.pending = { kind: "playChooseLocation", cardId: state.pending.cardId };
      } else {
        state.pending = { kind: "playChooseCard" };
      }
      state.phase = "resolving";
      return state;
    }
    if (state.pending?.kind === "playChooseAllyAttach" || state.pending?.kind === "playChooseLocation") {
      state.pending = { kind: "playChooseCard" };
      state.phase = "resolving";
      return state;
    }
    if (state.pending?.kind === "playChooseCard") {
      state.pending = null;
      state.phase = "actions";
      state.actionKey = undefined;
      return state;
    }
    if (state.pending?.kind === "vanquishConfirmLoss") {
      state.pending = { kind: "vanquishHero" };
      return state;
    }
    if (state.phase === "resolving") {
      if (state.pending?.kind === "scarePeek") return state;
      if (state.pending?.kind === "fateChooseCard") return state;
      if (state.pending?.kind === "fateChooseItem") return state;
      state.pending = null;
      state.phase = "actions";
      state.actionKey = undefined;
    }
    return state;
  }

  if (input.type === "selectLocation") {
    return handleLocation(state, input.locationId);
  }
  if (input.type === "selectAction") {
    return handleAction(state, input.actionKey);
  }
  if (input.type === "selectCard") {
    return handleCard(state, input.instanceId);
  }
  if (input.type === "confirm") {
    return handleConfirm(state);
  }
  if (input.type === "scareDiscardBoth") {
    if (state.pending?.kind === "scarePeek") {
      state.pending.cards.forEach((c) => discardFateCard(state, c));
      log(state, "Both peeked Fate cards go to the Fate discard. They can return when Fate reshuffles.");
      consumeCurrentAction(state);
    }
    return state;
  }
  if (input.type === "scareReturn") {
    if (state.pending?.kind !== "scarePeek") return state;
    const peeked = state.pending.cards;
    const wanted = new Set(peeked.map((c) => c.instanceId));
    const ordered: string[] = [];
    for (const id of input.order) {
      if (!wanted.has(id) || ordered.includes(id)) continue;
      ordered.push(id);
    }
    // A one-card peek used to send the same id twice and unshift that card twice.
    if (ordered.length !== peeked.length) return state;
    for (let i = ordered.length - 1; i >= 0; i--) {
      const card = peeked.find((c) => c.instanceId === ordered[i]);
      if (!card) return state;
      state.fateDeck.unshift(card);
    }
    log(
      state,
      peeked.length === 1
        ? "The peeked Fate card returns to the top of the deck."
        : "Peeked Fate cards return to the top of the deck.",
    );
    consumeCurrentAction(state);
    return state;
  }
  if (input.type === "payWithMap" || input.type === "payWithPower") {
    if (state.pending?.kind !== "playChoosePayment") return state;
    const card = findCard(state, state.pending.cardId);
    if (!card) return state;
    if (input.type === "payWithMap") {
      // The Map substitutes for another Item only — never an Ally or Effect.
      if (def(card.defId).type !== "item" || card.defId === "neverLandMap") return state;
      if (!discardMap(state)) return state;
    } else {
      const cost = def(card.defId).cost;
      if (!spendPower(state, cost)) {
        log(state, "Not enough Power.", "bad");
        return state;
      }
      log(state, `Spent ${cost} Power on ${def(card.defId).name}. ${state.power} Power left.`);
    }
    playAfterCost(state, card, state.pending.locationId, state.pending.attachTo);
    return state;
  }
  if (input.type === "playOrDiscardHero") {
    if (state.pending?.kind !== "obsessionDecide") return state;
    const hero = state.heldCard;
    if (!hero) return state;
    if (hero.defId === "peterPan") {
      forceObsessionPeter(state, hero);
      return state;
    }
    if (!input.play) {
      discardFateCard(state, hero);
      log(state, `${def(hero.defId).name} goes to the Fate discard. The Hero can return when Fate reshuffles.`);
      consumeCurrentAction(state);
      return state;
    }
    state.pending = { kind: "obsessionLocation", heroId: hero.instanceId };
    return state;
  }
  if (input.type === "skipCondition") {
    if (state.pending?.kind === "conditionOffer") {
      const offered = findCard(state, state.pending.conditionId);
      const name = offered ? def(offered.defId).name : "The Condition";
      log(state, `${name} stays in hand.`);
      state.pending = null;
      state.phase = "actions";
    }
    if (state.pending?.kind === "tinkerDiscard") {
      const tinker = findCard(state, state.pending.tinkerId);
      openFateReport(state, {
        drawn: tinker ? [tinker] : [],
        played: tinker ?? undefined,
        discarded: [],
        note: "Tinker Bell is seated. No Ally was dismissed.",
        resume: "actions",
        markAction: true,
      });
    }
    return state;
  }
  if (input.type === "acceptCondition") {
    if (state.pending?.kind !== "conditionOffer") return state;
    const offered = findCard(state, state.pending.conditionId);
    if (offered?.defId === "cunning" && handAllies(state).length === 0) {
      const why = "Cunning needs an Ally in hand. The Condition stays put.";
      log(state, why);
      state.bannerNote = why;
      state.pending = null;
      state.phase = "actions";
      return state;
    }
    const cond = takeFromHand(state, state.pending.conditionId);
    if (!cond) return state;
    discardVillainCard(state, cond);
    if (cond.defId === "cunning") {
      log(state, "Cunning is played and goes to the discard. Choose an Ally to slip ashore where the captain stands.");
      state.phase = "resolving";
      state.pending = { kind: "cunningAlly" };
      return state;
    }
    if (cond.defId === "obsession") {
      log(state, "Obsession is played and goes to the discard. Fate is hunted until a Hero appears.");
      const extras: CardInstance[] = [];
      let hero: CardInstance | undefined;
      for (let i = 0; i < 20; i++) {
        const [c] = drawFate(state, 1);
        if (!c) break;
        if (def(c.defId).type === "hero") {
          hero = c;
          break;
        }
        extras.push(c);
      }
      extras.forEach((c) => discardFateCard(state, c));
      if (!hero) {
        log(state, "Obsession finds no Hero.");
        state.pending = null;
        state.phase = "actions";
        return state;
      }
      if (hero.defId === "peterPan") {
        forceObsessionPeter(state, hero);
        return state;
      }
      state.heldCard = hero;
      state.phase = "resolving";
      state.pending = { kind: "obsessionDecide", heroId: hero.instanceId, extras };
      return state;
    }
  }

  return state;
}

function handleLocation(state: GameState, locationId: LocationId): GameState {
  if (state.phase === "move" && !state.pending) {
    if (!legalMoveLocations(state).includes(locationId)) return state;
    state.departedFrom = state.villainLocation;
    state.villainLocation = locationId;
    state.usedActions = [];
    const snapped = checkTickTock(state, locationId, "captain");
    const cover = coveringHero(state, locationId);
    log(
      state,
      `The captain arrives at ${locName(locationId)}${cover ? ` — ${def(cover.defId).name} covers the top actions` : ""}.`,
    );
    if (!snapped) state.phase = "actions";
    return state;
  }
  const p = state.pending;
  if (!p) return state;
  if (p.kind === "playChooseLocation") {
    if (!legalPlayLocations(state).includes(locationId)) return state;
    const card = findCard(state, p.cardId);
    if (!card) return state;
    maybeAskPayment(state, card, locationId);
    return state;
  }
  if (p.kind === "cunningLocation") {
    if (!legalPlayLocations(state).includes(locationId)) return state;
    const ally = takeFromHand(state, p.allyId);
    if (!ally) return state;
    placeAlly(state, ally, locationId);
    log(state, `Cunning slips ${def(ally.defId).name} onto ${locName(locationId)} for free.`, "good");
    if (ally.defId === "mrStarkey" && state.locations[locationId].heroes.length) {
      state.pending = { kind: "starkeyHero", starkeyId: ally.instanceId };
      return state;
    }
    state.pending = null;
    state.phase = "actions";
    return state;
  }
  if (p.kind === "ayeAyeDest") {
    const from = findCardLocation(state, p.allyId);
    if (!from || !adjacentUnlocked(state, from).includes(locationId)) return state;
    const ally = removeFromRealm(state, p.allyId);
    if (!ally) return state;
    placeAlly(state, ally, locationId);
    state.tempStrength[ally.instanceId] = (state.tempStrength[ally.instanceId] ?? 0) + 2;
    log(state, `${def(ally.defId).name} shifts to ${locName(locationId)} and is +2 until the turn ends.`);
    consumeCurrentAction(state);
    return state;
  }
  if (p.kind === "movePieceDest") {
    const from = findCardLocation(state, p.pieceId);
    if (!from || !adjacentUnlocked(state, from).includes(locationId)) return state;
    const card = removeFromRealm(state, p.pieceId);
    if (!card) return state;
    if (def(card.defId).type === "ally") placeAlly(state, card, locationId);
    else placeItem(state, card, locationId);
    log(state, `${def(card.defId).name} moves to ${locName(locationId)}.`);
    consumeCurrentAction(state);
    return state;
  }
  if (p.kind === "moveHeroDest" || p.kind === "starkeyDest") {
    const heroId = p.kind === "moveHeroDest" ? p.heroId : p.heroId;
    const from = findCardLocation(state, heroId);
    if (!from || !adjacentUnlocked(state, from).includes(locationId)) return state;
    const hero = removeFromRealm(state, heroId);
    if (!hero) return state;
    placeHero(state, hero, locationId);
    updatePeterLoc(state);
    if (hero.defId === "peterPan" && LOCATION_IDS.indexOf(locationId) < LOCATION_IDS.indexOf(from)) {
      state.voyage.walkedWest = true;
    }
    log(state, `${def(hero.defId).name} is moved to ${locName(locationId)}.`);
    consumeCurrentAction(state);
    return state;
  }
  if (p.kind === "fateChooseLocation" || p.kind === "worthyLocation" || p.kind === "obsessionLocation") {
    if (!unlockedLocations(state).includes(locationId)) return state;
    const hero = state.heldCard ?? findCard(state, p.kind === "fateChooseLocation" ? p.cardId : p.heroId);
    if (!hero) return state;
    playHeldHero(state, hero, locationId, "player");
    return state;
  }
  return state;
}

function handleAction(state: GameState, actionKey: string): GameState {
  if (state.phase === "move") return state;
  if (state.phase !== "actions" && !(state.phase === "resolving" && !state.pending)) return state;
  const slot = availableActions(state).find((a) => a.key === actionKey);
  if (!slot) return state;
  if (slot.kind === "vanquish" && !slot.used && !slot.covered && vanquishableHeroes(state).length === 0) {
    const why = vanquishBlockedReason(state);
    log(state, why);
    state.bannerNote = why;
    return state;
  }
  if (slot.kind === "playCard" && !slot.used && !slot.covered && playableHandCards(state).length === 0) {
    const why = playBlockedReason(state);
    log(state, why);
    state.bannerNote = why;
    return state;
  }
  if (slot.kind === "moveItemAlly" && !slot.used && !slot.covered && movableAlliesAndItems(state).length === 0) {
    const why = movePieceBlockedReason(state);
    log(state, why);
    state.bannerNote = why;
    return state;
  }
  if (slot.kind === "moveHero" && !slot.used && !slot.covered && movableHeroes(state).length === 0) {
    const why = moveHeroBlockedReason(state);
    log(state, why);
    state.bannerNote = why;
    return state;
  }
  if (!slot.available) return state;

  if (slot.kind === "gainPower") {
    const amt = slot.amount ?? 1;
    state.power += amt;
    markActionUsed(state, slot.key);
    log(state, `Gained ${amt} Power.`, "good");
    return state;
  }
  if (slot.kind === "discard") {
    beginAction(state, slot.key, { kind: "discardSelect", selected: [] });
    return state;
  }
  if (slot.kind === "playCard") {
    beginAction(state, slot.key, { kind: "playChooseCard" });
    return state;
  }
  if (slot.kind === "fate") {
    state.actionKey = slot.key;
    startPlayerFate(state);
    return state;
  }
  if (slot.kind === "vanquish") {
    beginAction(state, slot.key, { kind: "vanquishHero" });
    return state;
  }
  if (slot.kind === "moveItemAlly") {
    beginAction(state, slot.key, { kind: "movePieceSelect" });
    return state;
  }
  if (slot.kind === "moveHero") {
    beginAction(state, slot.key, { kind: "moveHeroSelect" });
    return state;
  }
  return state;
}

function handleCard(state: GameState, instanceId: string): GameState {
  if (state.phase === "actions" && !state.pending) {
    const card = state.hand.find((c) => c.instanceId === instanceId);
    if (!card) return state;
    if (card.defId === "cutlass" && allAllies(state).length === 0) {
      const why = "The Cutlass needs an Ally already ashore. Play a crew member first.";
      log(state, why, "info");
      state.bannerNote = why;
      return state;
    }
    if (card.defId === "cunning") {
      if (canPlayCunning(state)) {
        state.pending = {
          kind: "conditionOffer",
          conditionId: card.instanceId,
          reason: "A Strength 4+ Hero is ashore. Play Cunning to slip an Ally in for free?",
        };
        return state;
      }
      if (handAllies(state).length === 0) {
        const why = "Cunning needs an Ally in hand.";
        log(state, why);
        state.bannerNote = why;
      }
      return state;
    }
    if (card.defId === "obsession" && canPlayObsession(state)) {
      state.pending = {
        kind: "conditionOffer",
        conditionId: card.instanceId,
        reason: "Peter is still hidden. Play Obsession to hunt the Fate deck for a Hero?",
      };
      return state;
    }
    return state;
  }

  const p = state.pending;
  if (!p) return state;

  if (p.kind === "playChooseCard") {
    const held = state.hand.find((c) => c.instanceId === instanceId);
    if (held?.defId === "cutlass" && allAllies(state).length === 0) {
      const why = "The Cutlass needs an Ally already ashore. Play a crew member first.";
      log(state, why, "info");
      state.bannerNote = why;
      return state;
    }
    if (!playableHandCards(state).some((c) => c.instanceId === instanceId)) return state;
    const card = findCard(state, instanceId)!;
    const d = def(card.defId);
    if (d.type === "effect") {
      maybeAskPayment(state, card);
      return state;
    }
    if (d.id === "cutlass") {
      state.pending = { kind: "playChooseAllyAttach", cardId: instanceId };
      return state;
    }
    state.pending = { kind: "playChooseLocation", cardId: instanceId };
    return state;
  }

  if (p.kind === "playChooseAllyAttach") {
    if (!allAllies(state).some((a) => a.ally.instanceId === instanceId)) return state;
    const card = findCard(state, p.cardId);
    if (!card) {
      state.pending = { kind: "playChooseCard" };
      return state;
    }
    maybeAskPayment(state, card, undefined, instanceId);
    return state;
  }

  if (p.kind === "discardSelect") {
    if (!state.hand.some((c) => c.instanceId === instanceId)) return state;
    const selected = p.selected.includes(instanceId)
      ? p.selected.filter((id) => id !== instanceId)
      : [...p.selected, instanceId];
    state.pending = { kind: "discardSelect", selected };
    return state;
  }

  if (p.kind === "vanquishHero") {
    const target = vanquishableHeroes(state).find((h) => h.hero.instanceId === instanceId);
    if (!target) {
      state.bannerNote =
        "That Hero cannot be vanquished from here. Choose a glowing Hero at the captain’s place, or one a Boarding Party can reach.";
      return state;
    }
    if (target.hero.defId === "peterPan" && target.location !== "jollyRoger") {
      state.pending = { kind: "vanquishConfirmLoss", heroId: instanceId };
      return state;
    }
    state.pending = { kind: "vanquishAllies", heroId: instanceId, selected: [] };
    return state;
  }

  if (p.kind === "vanquishAllies") {
    const pool = vanquishAllyPool(state, p.heroId);
    if (!pool.some((a) => a.ally.instanceId === instanceId)) {
      state.bannerNote =
        "That Ally cannot join this clash. Choose a glowing Ally at the Hero’s place, or a Boarding Party that can reach it.";
      return state;
    }
    const selected = p.selected.includes(instanceId)
      ? p.selected.filter((id) => id !== instanceId)
      : [...p.selected, instanceId];
    state.pending = { kind: "vanquishAllies", heroId: p.heroId, selected };
    return state;
  }

  if (p.kind === "movePieceSelect") {
    if (!movableAlliesAndItems(state).some((c) => c.instanceId === instanceId)) return state;
    state.pending = { kind: "movePieceDest", pieceId: instanceId };
    return state;
  }

  if (p.kind === "moveHeroSelect") {
    if (!movableHeroes(state).some((c) => c.instanceId === instanceId)) return state;
    state.pending = { kind: "moveHeroDest", heroId: instanceId };
    return state;
  }

  if (p.kind === "ayeAyeAlly") {
    if (!allAllies(state).some((a) => a.ally.instanceId === instanceId && isUnlocked(state, a.location))) return state;
    state.pending = { kind: "ayeAyeDest", allyId: instanceId };
    return state;
  }

  if (p.kind === "starkeyHero") {
    const loc = findCardLocation(state, p.starkeyId);
    if (!loc) return state;
    if (!state.locations[loc].heroes.some((h) => h.instanceId === instanceId)) return state;
    state.pending = { kind: "starkeyDest", starkeyId: p.starkeyId, heroId: instanceId };
    return state;
  }

  if (p.kind === "fateChooseCard") {
    if (!p.cards.some((c) => c.instanceId === instanceId)) return state;
    const play = p.cards.find((c) => c.instanceId === instanceId)!;
    const rest = p.cards.filter((c) => c.instanceId !== instanceId);
    rest.forEach((c) => discardFateCard(state, c));
    return playPlayerFateCard(state, play);
  }

  if (p.kind === "fateChooseAttach") {
    const heldPreview = state.heldCard ?? findCard(state, p.cardId);
    const heroes = attachableHeroes(state, heldPreview?.defId ?? "pixieDust");
    if (!heroes.some((h) => h.instanceId === instanceId)) return state;
    const held = state.heldCard ?? findCard(state, p.cardId);
    if (!held) return state;
    state.attachments.push({ item: held, attachedTo: instanceId });
    const note = `${def(held.defId).name} attaches to ${def(findCard(state, instanceId)!.defId).name}.`;
    log(state, note, "fate");
    return finishPlayerFatePlay(state, held, note);
  }

  if (p.kind === "fateChooseItem") {
    if (!allLocationItems(state).some((i) => i.item.instanceId === instanceId)) return state;
    const item = removeFromRealm(state, instanceId);
    const headache = state.heldCard;
    if (item) {
      discardRealmItem(state, item);
      log(state, `Splitting Headache discards ${def(item.defId).name}.`, "fate");
    }
    if (headache) discardFateCard(state, headache);
    if (headache) {
      return finishPlayerFatePlay(
        state,
        headache,
        item ? `Splitting Headache discards ${def(item.defId).name}.` : HEADACHE_NO_ITEM_NOTE,
      );
    }
    consumeCurrentAction(state);
    return state;
  }

  if (p.kind === "tinkerDiscard") {
    if (!state.locations[p.locationId].allies.some((a) => a.instanceId === instanceId)) return state;
    const tinker = findCard(state, p.tinkerId);
    const ally = removeFromRealm(state, instanceId);
    if (ally) {
      detachAll(state, ally.instanceId);
      discardVillainCard(state, ally);
      log(state, `Tinker Bell discards ${def(ally.defId).name}.`, "fate");
    }
    if (tinker) {
      return finishPlayerFatePlay(
        state,
        tinker,
        ally ? `Tinker Bell discards ${def(ally.defId).name}.` : "Tinker Bell is seated.",
      );
    }
    consumeCurrentAction(state);
    return state;
  }

  if (p.kind === "cunningAlly") {
    const card = state.hand.find((c) => c.instanceId === instanceId);
    if (!card || def(card.defId).type !== "ally") return state;
    if (card.defId === "cutlass") return state;
    state.pending = { kind: "cunningLocation", allyId: instanceId };
    return state;
  }

  return state;
}

function finishPlayerFatePlay(state: GameState, card: CardInstance, note: string, extras: CardInstance[] = []): GameState {
  openFateReport(state, {
    drawn: [card, ...extras],
    played: card,
    discarded: extras,
    note,
    resume: "actions",
    markAction: true,
  });
  return state;
}

function playPlayerFateCard(state: GameState, card: CardInstance): GameState {
  const d = def(card.defId);
  if (d.type === "hero") {
    state.heldCard = card;
    state.pending = { kind: "fateChooseLocation", cardId: card.instanceId, actor: "player" };
    return state;
  }
  if (d.id === "pixieDust" || d.id === "taunt") {
    const heroes = attachableHeroes(state, d.id);
    if (heroes.length === 0) {
      discardFateCard(state, card);
      log(state, `${d.name} has no Hero to attach to.`);
      return finishPlayerFatePlay(state, card, `${d.name} has no Hero to attach to, so it is discarded.`);
    }
    state.heldCard = card;
    state.pending = { kind: "fateChooseAttach", cardId: card.instanceId, actor: "player" };
    return state;
  }
  if (d.id === "splittingHeadache") {
    if (allLocationItems(state).length === 0) {
      finishHeadacheWithoutItems(state, card, { resume: "actions" });
      return state;
    }
    state.heldCard = card;
    state.pending = { kind: "fateChooseItem", cardId: card.instanceId, actor: "player" };
    return state;
  }
  discardFateCard(state, card);
  return finishPlayerFatePlay(state, card, `You play ${d.name}.`);
}

function handleConfirm(state: GameState): GameState {
  const p = state.pending;
  if (!p) return state;
  if (p.kind === "discardSelect") {
    for (const id of p.selected) {
      const card = takeFromHand(state, id);
      if (card) discardVillainCard(state, card);
    }
    log(state, p.selected.length ? `Discarded ${p.selected.length} card(s).` : "Discarded nothing.");
    consumeCurrentAction(state);
    return state;
  }
  if (p.kind === "vanquishConfirmLoss") {
    state.pending = { kind: "vanquishAllies", heroId: p.heroId, selected: [] };
    return state;
  }
  if (p.kind === "vanquishAllies") {
    const hero = findCard(state, p.heroId);
    if (!hero) return state;
    const pool = vanquishAllyPool(state, p.heroId);
    const chosen = pool.filter((a) => p.selected.includes(a.ally.instanceId));
    if (hero.defId === "lostBoys" && chosen.length < 2) {
      log(state, "Lost Boys require at least two Allies.", "bad");
      return state;
    }
    const total = chosen.reduce((n, a) => n + allyStrength(state, a.ally), 0);
    if (total < heroStrength(state, hero)) {
      log(state, "Not enough Strength.", "bad");
      return state;
    }
    finishVanquish(state, p.heroId, p.selected);
    if (!endIfOver(state)) consumeCurrentAction(state);
    return state;
  }
  return state;
}

export function highlightSet(state: GameState): Set<string> {
  const set = new Set<string>();
  if (state.phase === "move" && !state.pending) {
    legalMoveLocations(state).forEach((id) => set.add(`loc:${id}`));
    return set;
  }
  const p = state.pending;
  if (!p) {
    if (state.phase === "actions") {
      availableActions(state)
        .filter((a) => a.available)
        .forEach((a) => set.add(`act:${a.key}`));
      state.hand.forEach((c) => {
        if (c.defId === "cunning" && canPlayCunning(state)) set.add(`card:${c.instanceId}`);
        if (c.defId === "obsession" && canPlayObsession(state)) set.add(`card:${c.instanceId}`);
      });
    }
    return set;
  }
  switch (p.kind) {
    case "playChooseCard":
      playableHandCards(state).forEach((c) => set.add(`card:${c.instanceId}`));
      break;
    case "playChooseLocation":
    case "cunningLocation":
      legalPlayLocations(state).forEach((id) => set.add(`loc:${id}`));
      break;
    case "fateChooseLocation":
    case "worthyLocation":
    case "obsessionLocation":
      unlockedLocations(state).forEach((id) => set.add(`loc:${id}`));
      break;
    case "playChooseAllyAttach":
      allAllies(state).forEach((a) => set.add(`card:${a.ally.instanceId}`));
      break;
    case "ayeAyeAlly":
      allAllies(state)
        .filter((a) => isUnlocked(state, a.location))
        .forEach((a) => set.add(`card:${a.ally.instanceId}`));
      break;
    case "cunningAlly":
      state.hand.filter((c) => def(c.defId).type === "ally").forEach((c) => set.add(`card:${c.instanceId}`));
      break;
    case "discardSelect":
      state.hand.forEach((c) => set.add(`card:${c.instanceId}`));
      p.selected.forEach((id) => set.add(`sel:${id}`));
      break;
    case "vanquishHero":
      vanquishableHeroes(state).forEach((h) => set.add(`card:${h.hero.instanceId}`));
      break;
    case "vanquishAllies":
      vanquishAllyPool(state, p.heroId).forEach((a) => set.add(`card:${a.ally.instanceId}`));
      p.selected.forEach((id) => set.add(`sel:${id}`));
      break;
    case "movePieceSelect":
      movableAlliesAndItems(state).forEach((c) => set.add(`card:${c.instanceId}`));
      break;
    case "moveHeroSelect":
      movableHeroes(state).forEach((c) => set.add(`card:${c.instanceId}`));
      break;
    case "ayeAyeDest":
    case "movePieceDest": {
      const from = findCardLocation(state, p.kind === "ayeAyeDest" ? p.allyId : p.pieceId);
      if (from) adjacentUnlocked(state, from).forEach((id) => set.add(`loc:${id}`));
      break;
    }
    case "moveHeroDest":
    case "starkeyDest": {
      const from = findCardLocation(state, p.heroId);
      if (from) adjacentUnlocked(state, from).forEach((id) => set.add(`loc:${id}`));
      break;
    }
    case "starkeyHero": {
      const loc = findCardLocation(state, p.starkeyId);
      if (loc) state.locations[loc].heroes.forEach((h) => set.add(`card:${h.instanceId}`));
      break;
    }
    case "fateChooseCard":
    case "scarePeek":
      p.cards.forEach((c) => set.add(`card:${c.instanceId}`));
      break;
    case "fateChooseAttach": {
      const held = state.heldCard ?? findCard(state, p.cardId);
      attachableHeroes(state, held?.defId ?? "pixieDust").forEach((h) => set.add(`card:${h.instanceId}`));
      break;
    }
    case "fateChooseItem":
      allLocationItems(state).forEach((i) => set.add(`card:${i.item.instanceId}`));
      break;
    case "tinkerDiscard":
      state.locations[p.locationId].allies.forEach((a) => set.add(`card:${a.instanceId}`));
      break;
    default:
      break;
  }
  return set;
}

export function selectedSet(state: GameState): Set<string> {
  const p = state.pending;
  if (p?.kind === "discardSelect" || p?.kind === "vanquishAllies") return new Set(p.selected);
  return new Set();
}

/** Hidden fields live on the cloned object so mid-action context survives. */
export type EngineState = GameState;
