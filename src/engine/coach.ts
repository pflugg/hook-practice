import { def } from "./cards";
import { adjacentIds, locName } from "./realm";
import {
  allAllies,
  allHeroes,
  allyStrength,
  availableActions,
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
  clashAndCrocLine,
  vanquishAllyPool,
  vanquishableHeroes,
} from "./queries";
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
  return availableActions({ ...state, villainLocation: id });
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

function diggingForMap(state: GameState): boolean {
  return !state.hangmansUnlocked && !mapInHand(state);
}

function keepOnDiscard(state: GameState, card: CardInstance): boolean {
  if (card.defId === "neverLandMap") return true;
  if (!state.hangmansUnlocked && card.defId === "neverLandMap") return true;
  if (!state.peterPanRevealed && (card.defId === "worthyOpponent" || card.defId === "giveThemAScare" || card.defId === "obsession")) {
    return true;
  }
  if (state.peterPanRevealed && state.peterPanLocation !== "jollyRoger") {
    if (card.defId === "ingeniousDevice" || card.defId === "mrStarkey" || card.defId === "ayeAyeSir") return true;
  }
  const d = def(card.defId);
  if (d.type === "ally" && jrStrength(state) < 8) return state.power >= d.cost;
  return false;
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

function crocCanSlideOnto(state: GameState, captainAt: LocationId): boolean {
  const croc = tickTockAt(state);
  if (!croc || croc === captainAt) return false;
  return adjacentUnlocked(state, croc).includes(captainAt);
}

function heroSlideReady(state: GameState): boolean {
  const kind = state.pending?.kind;
  if (kind === "moveHeroSelect" || kind === "moveHeroDest" || kind === "starkeyHero" || kind === "starkeyDest") {
    return true;
  }
  if (state.phase === "actions" && !state.pending) {
    return availableActions(state).some((a) => a.kind === "moveHero" && a.available);
  }
  return false;
}

function warningFor(state: GameState, highlights: string[]): string | undefined {
  const notes: string[] = [];
  const croc = tickTockAt(state);
  const slideNow = Boolean(croc && crocCanSlideOnto(state, state.villainLocation) && heroSlideReady(state));
  const pair = clashAndCrocLine(state);
  const moveOrSlide = state.phase === "move" || heroSlideReady(state);
  if (pair) {
    notes.push(pair);
  } else if (slideNow) {
    notes.push(
      "A Hero move can slide Tick Tock onto the captain this turn. That empties the hand the same as stepping onto him — park the crocodile elsewhere.",
    );
  } else if (croc && moveOrSlide) {
    notes.push(
      `Tick Tock waits at ${locName(croc)} — sharing that place (stepping there, or sliding the crocodile onto the captain) empties your hand.`,
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
  if (state.phase === "move" && !state.pending) {
    const destHi = highlights.find((h) => h.startsWith("loc:"));
    const dest = destHi?.slice(4) as LocationId | undefined;
    if (dest && crocCanSlideOnto(state, dest)) {
      notes.unshift(
        `Stopping at ${locName(dest)} puts Tick Tock one Hero-move from the captain. Sliding him onto you empties the hand.`,
      );
    }
  }
  const movingCroc =
    (state.pending?.kind === "moveHeroDest" || state.pending?.kind === "starkeyDest") &&
    findCard(state, state.pending.heroId)?.defId === "tickTock";
  if (movingCroc && highlights.some((h) => h === `loc:${state.villainLocation}`)) {
    notes.unshift(
      "That recommended step slides Tick Tock onto the captain. Only go if you accept an empty hand.",
    );
  }
  return notes[0];
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
  if (needPowerForMap(state) || wantEarlyPower(state)) score += gainAmt * 120;
  if (diggingForMap(state) && discard) score += state.power >= 4 ? 380 : 70;
  if (!state.peterPanRevealed && fate) score += state.hangmansUnlocked ? 360 : 40;
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

function moveWhy(state: GameState, dest: LocationId): string {
  const peter = peterCard(state);
  if (peterReadyToFinish(state) && dest === "jollyRoger") {
    return "Peter is already on the ship and your crew can finish the clash. Take the Vanquish action there — that is the only place the win counts.";
  }
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger" && hasKind(state, dest, "moveHero")) {
    return "The tree is open and Peter is ashore. A Move a Hero action walks him one step toward the Jolly Roger.";
  }
  if (playableMap(state) && hasKind(state, dest, "playCard")) {
    return "You are holding the Never Land Map with enough Power. Play it to unlock Hangman’s Tree so Peter can leave the hideout.";
  }
  if (needPowerForMap(state) && dest === "mermaidLagoon") {
    return "Gain 3 Power here — you are holding the Never Land Map and still need 4 to play it.";
  }
  if (wantEarlyPower(state) && dest === "mermaidLagoon") {
    return "Gain 3 here is the richest Power bank. Keep a reserve so the next Item or Ally you draw is playable.";
  }
  if (diggingForMap(state) && hasKind(state, dest, "discard")) {
    return "The Map is still in the deck. A Discard action lets you dig for it so the tree can open.";
  }
  if (!state.peterPanRevealed && hasKind(state, dest, "fate")) {
    return "Peter is still hidden. A Fate action can flip him onto Hangman’s Tree, even if that hideout is locked.";
  }
  return "Every turn starts with a required move. This stop lines up the next useful action on the Map → Tree → Peter → ship chain.";
}

function adviseMove(state: GameState): CoachAdvice {
  const dest = pickMove(state);
  return say(`Move to ${locName(dest)}`, moveWhy(state, dest), [`loc:${dest}`], state);
}

function usefulPlay(state: GameState): CardInstance | null {
  const playable = playableHandCards(state);
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

function pickAction(state: GameState): ActionSlot | "end" | null {
  const acts = availableActions(state).filter((a) => a.available);
  if (acts.length === 0) return "end";

  const find = (kind: ActionSlot["kind"]) => acts.find((a) => a.kind === kind);

  if (peterReadyToFinish(state)) {
    const v = find("vanquish");
    if (v) return v;
  }

  const peter = peterCard(state);
  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger") {
    const mh = find("moveHero");
    if (mh && movableHeroes(state).some((h) => h.defId === "peterPan")) return mh;
  }

  if (playableMap(state)) {
    const play = find("playCard");
    if (play) return play;
  }

  if (needPowerForMap(state) || (wantEarlyPower(state) && !playableMap(state) && !usefulPlay(state))) {
    const gains = acts.filter((a) => a.kind === "gainPower").sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1));
    if (gains[0] && state.power + (gains[0].amount ?? 1) <= 12) return gains[0];
  }

  const card = usefulPlay(state);
  if (card && find("playCard")) return find("playCard")!;

  if (!state.peterPanRevealed && find("fate")) return find("fate")!;

  if (diggingForMap(state) && find("discard") && state.hand.some((c) => !keepOnDiscard(state, c))) {
    return find("discard")!;
  }

  const tick = tickTockAt(state);
  if (tick && find("vanquish") && vanquishableHeroes(state).some((h) => h.hero.defId === "tickTock")) {
    return find("vanquish")!;
  }

  if (jrStrength(state) < 8 && find("moveItemAlly") && movableAlliesAndItems(state).some((c) => def(c.defId).type === "ally" && findCardLocation(state, c.instanceId) !== "jollyRoger")) {
    return find("moveItemAlly")!;
  }

  if (find("playCard") && playableHandCards(state).length > 0 && usefulPlay(state)) {
    return find("playCard")!;
  }

  const leftoverGain = acts.filter((a) => a.kind === "gainPower").sort((a, b) => (b.amount ?? 1) - (a.amount ?? 1))[0];
  if (leftoverGain && state.power < 8) return leftoverGain;

  if (diggingForMap(state) && find("discard")) return find("discard")!;

  if (find("fate") && !state.peterPanRevealed) return find("fate")!;

  return "end";
}

function actionWhy(state: GameState, slot: ActionSlot): string {
  if (slot.kind === "vanquish" && peterReadyToFinish(state)) {
    return "Peter is on the Jolly Roger and your Allies can meet his Strength. The clash there completes the objective.";
  }
  if (slot.kind === "moveHero") {
    return "Walk Peter one unlocked step toward the Jolly Roger. He only loses the duel if you vanquish him anywhere else.";
  }
  if (slot.kind === "playCard" && playableMap(state)) {
    return "The Never Land Map unlocks Hangman’s Tree. Until that hideout opens, Peter cannot start the walk to the ship.";
  }
  if (slot.kind === "playCard") {
    const card = usefulPlay(state);
    if (card && def(card.defId).type === "ally") {
      return "An Ally on the Jolly Roger is Strength waiting for Peter. Play one while this action is open.";
    }
    if (card && (card.defId === "worthyOpponent" || card.defId === "giveThemAScare")) {
      return "These hunts can flip Peter onto Hangman’s Tree without waiting on a Fate action.";
    }
    if (card) {
      return `Play ${cardName(card)} if it helps the Map, the escort, or the ship’s clash.`;
    }
  }
  if (slot.kind === "gainPower") {
    if (needPowerForMap(state)) {
      return "Bank Power now so the Never Land Map is affordable. Allies for the final clash will want a reserve too.";
    }
    return "Bank Power as a reserve for the next Item or Ally you draw. That is why Gain still matters even when the Map is not in hand.";
  }
  if (slot.kind === "discard") {
    return "Toss cards you do not need so the deck can yield the Never Land Map — the tree stays locked without it.";
  }
  if (slot.kind === "fate") {
    return "A Fate action can reveal Peter onto Hangman’s Tree. Other cards from that reveal are swept aside.";
  }
  if (slot.kind === "moveItemAlly") {
    return "Slide crew toward the Jolly Roger so their Strength is waiting when Peter arrives.";
  }
  if (slot.kind === "vanquish") {
    return "Clear a blocking Hero if the clash is safe. Leave Peter alone unless he is already on the ship.";
  }
  return "Spend the useful action here, then we will look at the next link in the chain.";
}

function adviseActions(state: GameState): CoachAdvice {
  const pick = pickAction(state);
  if (!pick || pick === "end") {
    return say(
      "End the turn",
      "You have spent the useful actions. Draw back to four, then Fate will answer — stay ready to move again.",
      ["btn:end"],
      state,
    );
  }
  return say(`Take ${pick.label}`, actionWhy(state, pick), [`act:${pick.key}`], state);
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
  return `Drop ${cardName(card)} where it helps the Map → Tree → Peter → ship plan.`;
}

function advisePending(state: GameState): CoachAdvice {
  const p = state.pending;
  if (!p) return adviseActions(state);

  switch (p.kind) {
    case "playChooseCard": {
      const card = usefulPlay(state) ?? playableHandCards(state)[0];
      if (!card) {
        return say("Cancel the play", "Nothing in hand is worth the action right now.", ["btn:cancel"], state);
      }
      const destHint =
        card.defId === "neverLandMap"
          ? `Play ${cardName(card)}`
          : def(card.defId).type === "ally"
            ? `Play ${cardName(card)} to the Jolly Roger`
            : `Play ${cardName(card)}`;
      const why =
        card.defId === "neverLandMap"
          ? "The Map is the only key to Hangman’s Tree. Play it while you can afford it."
          : def(card.defId).type === "ally"
            ? "Allies at the Jolly Roger become the clash that finishes Peter."
            : playTargetWhy(card, bestAllyHome(state));
      return say(destHint, why, [`card:${card.instanceId}`], state);
    }
    case "playChooseLocation": {
      const card = findCard(state, p.cardId);
      if (!card) return say("Choose a glowing location", "Drop the card on an unlocked place.", [], state);
      const dest =
        def(card.defId).type === "ally" || card.defId === "cannon" || card.defId === "hooksCase"
          ? bestAllyHome(state)
          : legalPlayLocations(state).includes(state.villainLocation)
            ? state.villainLocation
            : (legalPlayLocations(state)[0] ?? "jollyRoger");
      return say(
        `Play ${cardName(card)} to ${locName(dest)}`,
        playTargetWhy(card, dest),
        [`loc:${dest}`],
        state,
      );
    }
    case "playChooseAllyAttach": {
      const allies = allAllies(state);
      const atRoger = allies.find((a) => a.location === "jollyRoger");
      const pick = atRoger ?? allies.sort((a, b) => allyStrength(state, b.ally) - allyStrength(state, a.ally))[0];
      if (!pick) return say("Cancel", "There is no Ally to arm. Cancel and play a crew member first.", ["btn:cancel"], state);
      return say(
        `Strap the Cutlass to ${cardName(pick.ally)}`,
        `Use the picker — tap “Strap Cutlass to ${cardName(pick.ally)}” — or click that Ally on the board. A stronger Ally on the ship makes Peter’s clash safer.`,
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
          "Pay with Power",
          mapOut
            ? "Keep the Never Land Map in the realm. You already used it to open the tree, and later Items can still lean on it if you are short."
            : `${name} costs ${cost}. You have ${state.power}. Pay with Power.`,
          ["btn:pay-power"],
          state,
        );
      }
      if (mapOut) {
        return say(
          "Discard the Map to pay",
          "Power is short. The tree is already open, so spending the Map keeps the plan moving.",
          ["btn:pay-map"],
          state,
        );
      }
      return say(
        "Cancel — not enough Power",
        `${name} costs ${cost} and you have ${state.power}. Cancel and Gain more Power before you play it.`,
        ["btn:cancel"],
        state,
      );
    }
    case "discardSelect": {
      const junk = state.hand.filter((c) => !keepOnDiscard(state, c) && !p.selected.includes(c.instanceId));
      if (junk[0]) {
        return say(
          `Discard ${cardName(junk[0])}`,
          "Let go of the spare card so the deck can offer the Map or the next escort piece.",
          [`card:${junk[0].instanceId}`],
          state,
        );
      }
      return say(
        "Confirm the discard",
        p.selected.length
          ? "Those cards can go. Confirm and keep hunting the Map."
          : "Nothing extra to toss. Confirm to spend the action and stay on tempo.",
        ["btn:confirm"],
        state,
      );
    }
    case "vanquishHero": {
      const targets = vanquishableHeroes(state);
      const peter = targets.find((h) => h.hero.defId === "peterPan");
      if (peter && peter.location === "jollyRoger") {
        return say(
          "Vanquish Peter Pan at the Jolly Roger",
          "This is the last link. The clash only wins if it happens on the ship.",
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
        `Vanquish ${cardName(pick.hero)} at ${locName(pick.location)}`,
        pick.hero.defId === "tickTock"
          ? "The crocodile empties your hand if you step onto his space. Clear him if the Strength is there."
          : "Clear the blocker so your next actions — Play, Gain, or Move a Hero — are uncovered.",
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
      if (selectedStr >= need && p.selected.length > 0) {
        return say(
          "Confirm the clash",
          hero?.defId === "peterPan"
            ? "The Strength is there. Confirm and the objective chain is complete."
            : "That is enough Strength. Confirm so you can return to the rest of the turn.",
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
      return say(
        `Add ${cardName(nextAlly.ally)} to the clash`,
        `You need ${need} Strength. Keep tapping Allies at this place until the total meets the Hero.`,
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
      return say(
        `Move ${cardName(pick)} toward the ship`,
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
        `Move ${card ? cardName(card) : "that card"} to ${locName(dest)}`,
        "One step closer to the Jolly Roger keeps the final clash supplied.",
        [`loc:${dest}`],
        state,
      );
    }
    case "moveHeroSelect":
    case "starkeyHero": {
      const peter = movableHeroes(state).find((h) => h.defId === "peterPan");
      if (peter && state.hangmansUnlocked) {
        return say(
          "Move Peter Pan toward the Jolly Roger",
          "He travels one unlocked step at a time. The win only counts if you vanquish him on the ship.",
          [`card:${peter.instanceId}`],
          state,
        );
      }
      const croc = movableHeroes(state).find((h) => h.defId === "tickTock");
      const pick = croc ?? movableHeroes(state)[0];
      if (!pick) return say("Cancel", "No Hero can step right now.", ["btn:cancel"], state);
      return say(
        `Move ${cardName(pick)}`,
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
        `Move ${hero ? cardName(hero) : "that Hero"} to ${locName(dest)}`,
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
        `Reposition ${cardName(pick.ally)}`,
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
      return say(`Move that Ally to ${locName(dest)}`, "Close the gap to the Jolly Roger.", [`loc:${dest}`], state);
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
        `Play ${cardName(ally)} for free`,
        "Cunning spends no Play action. Drop the strongest Ally you can onto the ship.",
        [`card:${ally.instanceId}`],
        state,
      );
    }
    case "cunningLocation": {
      const dest = bestAllyHome(state);
      return say(`Place the Ally at ${locName(dest)}`, "Free crew belongs at the Jolly Roger.", [`loc:${dest}`], state);
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
        `Place ${card ? cardName(card) : "the Hero"} at ${locName(dest)}`,
        card?.defId === "tickTock"
          ? "Keep the crocodile off Mermaid Lagoon and Hangman’s Tree so your Power and escort stay usable."
          : "Park this Hero where they cover the fewest actions you still need.",
        [`loc:${dest}`],
        state,
      );
    }
    case "fateChooseAttach": {
      const heroes = allHeroes(state).filter((h) => h.hero.defId !== "peterPan");
      const pick = heroes[0] ?? allHeroes(state)[0];
      if (!pick) return say("Choose a Hero", "The attachment needs a Hero in the realm.", [], state);
      return say(
        `Attach it to ${cardName(pick.hero)}`,
        "Keep extra Strength off Peter if you can. He is already a tall clash.",
        [`card:${pick.hero.instanceId}`],
        state,
      );
    }
    case "fateChooseItem": {
      const items = LOCATION_IDS.flatMap((id) => state.locations[id].items.map((item) => ({ item, id })));
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
          "The next Fate flip can reveal him onto Hangman’s Tree, even while that hideout is locked.",
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
        "A cleaner Fate deck makes Worthy Opponent and later Fate actions more likely to find Peter. Discarded cards can still return when Fate reshuffles.",
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
      return say(
        "Play the Condition",
        p.reason.includes("Cunning") || state.hand.some((c) => c.defId === "cunning")
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
      return say("Follow the glowing prompts", "Take the highlighted legal option to keep the objective chain moving.", [], state);
  }
}

export function advise(state: GameState): CoachAdvice {
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
