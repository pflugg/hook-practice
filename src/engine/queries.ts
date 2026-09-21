import { def } from "./cards";
import { LOCATION_IDS, type ActionSlot, type CardInstance, type FateShow, type GameState, type LocationId } from "./types";
import { REALM, actionLabel, adjacentIds, locName } from "./realm";

export function cardName(card: CardInstance): string {
  return def(card.defId).name;
}

export function isUnlocked(state: GameState, id: LocationId): boolean {
  return id !== "hangmansTree" || state.hangmansUnlocked;
}

export function unlockedLocations(state: GameState): LocationId[] {
  return LOCATION_IDS.filter((id) => isUnlocked(state, id));
}

export function findCardLocation(state: GameState, instanceId: string): LocationId | null {
  for (const id of LOCATION_IDS) {
    const loc = state.locations[id];
    if (
      loc.heroes.some((c) => c.instanceId === instanceId) ||
      loc.allies.some((c) => c.instanceId === instanceId) ||
      loc.items.some((c) => c.instanceId === instanceId)
    ) {
      return id;
    }
  }
  return null;
}

export function findCard(state: GameState, instanceId: string): CardInstance | null {
  const piles = [
    state.hand,
    state.villainDeck,
    state.villainDiscard,
    state.fateDeck,
    state.fateDiscard,
    ...LOCATION_IDS.flatMap((id) => [
      state.locations[id].heroes,
      state.locations[id].allies,
      state.locations[id].items,
    ]),
    ...state.attachments.map((a) => [a.item]),
  ];
  for (const pile of piles) {
    const found = pile.find((c) => c.instanceId === instanceId);
    if (found) return found;
  }
  return null;
}

export function attachmentsOn(state: GameState, instanceId: string): CardInstance[] {
  return state.attachments.filter((a) => a.attachedTo === instanceId).map((a) => a.item);
}

export function hasTaunt(state: GameState, instanceId: string): boolean {
  return attachmentsOn(state, instanceId).some((c) => c.defId === "taunt");
}

export function anyTauntInRealm(state: GameState): boolean {
  return LOCATION_IDS.some((id) =>
    state.locations[id].heroes.some((h) => hasTaunt(state, h.instanceId)),
  );
}

export function locationsWithHeroes(state: GameState): number {
  return LOCATION_IDS.filter((id) => state.locations[id].heroes.length > 0).length;
}

export function heroStrength(state: GameState, hero: CardInstance): number {
  const d = def(hero.defId);
  let n = d.strength;
  const attached = attachmentsOn(state, hero.instanceId);
  if (attached.some((c) => c.defId === "pixieDust")) n += 2 * attached.filter((c) => c.defId === "pixieDust").length;
  if (hero.defId === "john" && attached.length > 0) n += 1;
  if (hero.defId === "michael") n += locationsWithHeroes(state);
  const wendyOut = LOCATION_IDS.some((id) => state.locations[id].heroes.some((h) => h.defId === "wendy"));
  if (wendyOut && hero.defId !== "wendy") n += 1;
  return n;
}

export function allyStrength(state: GameState, ally: CardInstance): number {
  const d = def(ally.defId);
  let n = d.strength;
  const loc = findCardLocation(state, ally.instanceId);
  if (ally.defId === "smee" && loc === "jollyRoger") n += 2;
  const attached = attachmentsOn(state, ally.instanceId);
  n += 2 * attached.filter((c) => c.defId === "cutlass").length;
  n += state.tempStrength[ally.instanceId] ?? 0;
  return n;
}

export function allHeroes(state: GameState): { hero: CardInstance; location: LocationId }[] {
  return LOCATION_IDS.flatMap((id) =>
    state.locations[id].heroes.map((hero) => ({ hero, location: id })),
  );
}

export function allAllies(state: GameState): { ally: CardInstance; location: LocationId }[] {
  return LOCATION_IDS.flatMap((id) =>
    state.locations[id].allies.map((ally) => ({ ally, location: id })),
  );
}

export function allLocationItems(state: GameState): { item: CardInstance; location: LocationId }[] {
  const loose = LOCATION_IDS.flatMap((id) =>
    state.locations[id].items.map((item) => ({ item, location: id })),
  );
  const strapped = state.attachments.flatMap((a) => {
    const location = findCardLocation(state, a.attachedTo);
    return location ? [{ item: a.item, location }] : [];
  });
  return [...loose, ...strapped];
}

/** +2 Fate Items (Pixie Dust) do not attach to Peter while Hangman’s Tree is still locked. */
export function canAttachFateItem(state: GameState, itemDefId: string, hero: CardInstance): boolean {
  if (itemDefId === "pixieDust" && hero.defId === "peterPan" && !state.hangmansUnlocked) return false;
  return true;
}

export function attachableHeroes(state: GameState, itemDefId: string): CardInstance[] {
  return allHeroes(state)
    .filter(({ hero }) => canAttachFateItem(state, itemDefId, hero))
    .map(({ hero }) => hero);
}

export function mapInRealm(state: GameState): CardInstance | null {
  for (const id of LOCATION_IDS) {
    const found = state.locations[id].items.find((c) => c.defId === "neverLandMap");
    if (found) return found;
  }
  return null;
}

export function mapInHand(state: GameState): CardInstance | null {
  return state.hand.find((c) => c.defId === "neverLandMap") ?? null;
}

/** True while the last computer Fate subject is still on the table (seated Hero or clinging attachment). */
export function fateShowStillInPlay(state: GameState, show: FateShow | null | undefined): boolean {
  const played = show?.played;
  if (!played) return false;
  const id = played.instanceId;
  if (LOCATION_IDS.some((loc) => state.locations[loc].heroes.some((h) => h.instanceId === id))) return true;
  if (state.attachments.some((a) => a.item.instanceId === id)) return true;
  return false;
}

export function strongestHeroInRealm(state: GameState): number {
  const heroes = allHeroes(state);
  if (heroes.length === 0) return 0;
  return Math.max(...heroes.map(({ hero }) => heroStrength(state, hero)));
}

export function handAllies(state: GameState): CardInstance[] {
  return state.hand.filter((c) => def(c.defId).type === "ally");
}

export function canPlayCunning(state: GameState): boolean {
  return (
    state.hand.some((c) => c.defId === "cunning") &&
    strongestHeroInRealm(state) >= 4 &&
    handAllies(state).length > 0
  );
}

export function canPlayObsession(state: GameState): boolean {
  return state.hand.some((c) => c.defId === "obsession") && !state.peterPanRevealed;
}

export function fateEmptyLine(state: GameState): string {
  if (state.fateDeck.length > 0) return "";
  if (state.fateDiscard.length > 0) {
    return "Fate deck is empty. The discard will reshuffle before the next Fate flip.";
  }
  return "Fate has no cards left, so the computer will not answer.";
}

/** A cheap clash sitting on Tick Tock’s square — wipe and vanquish are one sentence. */
export function clashBesideCroc(state: GameState): {
  location: LocationId;
  place: string;
  heroName: string;
  heroNeed: number;
  allyName: string;
  allyHave: number;
} | null {
  let crocAt: LocationId | null = null;
  for (const id of LOCATION_IDS) {
    if (state.locations[id].heroes.some((h) => h.defId === "tickTock")) {
      crocAt = id;
      break;
    }
  }
  if (!crocAt) return null;
  const heroes = state.locations[crocAt].heroes.filter((h) => h.defId !== "tickTock");
  if (!heroes.length) return null;
  const pool = vanquishAllyPoolAt(state, crocAt);
  if (!pool.length) return null;
  for (const hero of heroes) {
    if (hero.defId === "peterPan" && crocAt !== "jollyRoger") continue;
    const need = heroStrength(state, hero);
    const have = pool.reduce((sum, a) => sum + allyStrength(state, a.ally), 0);
    if (have < need) continue;
    if (hero.defId === "lostBoys" && pool.length < 2) continue;
    const best = [...pool].sort((a, b) => allyStrength(state, b.ally) - allyStrength(state, a.ally))[0];
    return {
      location: crocAt,
      place: locName(crocAt),
      heroName: cardName(hero),
      heroNeed: need,
      allyName: cardName(best.ally),
      allyHave: allyStrength(state, best.ally),
    };
  }
  return null;
}

/** Same preference the Cutlass attach picker uses: ship first, then strongest legal Ally. */
export function preferredAttachAlly(state: GameState): { ally: CardInstance; location: LocationId } | null {
  const allies = allAllies(state);
  if (!allies.length) return null;
  const atRoger = allies.find((a) => a.location === "jollyRoger");
  if (atRoger) return atRoger;
  return [...allies].sort((a, b) => allyStrength(state, b.ally) - allyStrength(state, a.ally))[0] ?? null;
}

function atPlace(id: LocationId): string {
  const name = locName(id);
  return name === "Jolly Roger" ? "at the Jolly Roger" : `at ${name}`;
}

export function cutlassStrapLine(state: GameState): string {
  const host = preferredAttachAlly(state);
  if (!host) return "The Cutlass needs an Ally already ashore. Play a crew member first.";
  const ally = cardName(host.ally);
  return `Strap the Cutlass to ${ally} ${atPlace(host.location)} (click ${ally} in the ally picker / drag Cutlass onto ${ally}).`;
}

export function clashAndCrocLine(state: GameState): string {
  const pair = clashBesideCroc(state);
  if (!pair) return "";
  if (state.villainLocation !== pair.location) return "";
  return `${pair.heroName} is ${pair.heroNeed} and ${pair.allyName} is ${pair.allyHave}, but standing here, or sliding the crocodile onto you, discards your hand.`;
}

/** Why Vanquish is dark — Taunt first, then live Strength vs the Allies that can actually reach. */
export function vanquishBlockedReason(state: GameState): string {
  const taunted = allHeroes(state).find(({ hero }) => hasTaunt(state, hero.instanceId));
  if (taunted) {
    const pool = vanquishAllyPoolAt(state, taunted.location);
    const have = pool.reduce((sum, a) => sum + allyStrength(state, a.ally), 0);
    const need = heroStrength(state, taunted.hero);
    const name = cardName(taunted.hero);
    const place = locName(taunted.location);
    if (!canVanquishAt(state, taunted.location)) {
      return `Taunt: ${name} must be vanquished first. ${name} is at ${place} — stand there, or send a Boarding Party to that neighboring unlocked place. Allies who can reach him total ${have} vs his ${need}.`;
    }
    return `Taunt: ${name} must be vanquished first, and your Allies here total ${have} vs his ${need}.`;
  }

  const inRange = allHeroes(state).filter(({ location }) => canVanquishAt(state, location));
  if (inRange.length === 0) {
    return "No Hero is in range of a Vanquish here. Name a Hero at the captain’s place, or a neighboring unlocked Hero a Boarding Party can reach.";
  }
  const bits = inRange.map(({ hero, location }) => {
    const pool = vanquishAllyPoolAt(state, location);
    const have = pool.reduce((sum, a) => sum + allyStrength(state, a.ally), 0);
    const need = heroStrength(state, hero);
    const boys = hero.defId === "lostBoys" && pool.length < 2 ? " (Lost Boys need two Allies)" : "";
    return `${cardName(hero)} is ${need} and your Allies here total ${have}${boys}`;
  });
  return `No Hero can be vanquished right now. ${bits.join("; ")}.`;
}

export function playableHandCards(state: GameState): CardInstance[] {
  const map = mapInRealm(state);
  return state.hand.filter((card) => {
    const d = def(card.defId);
    if (d.type === "condition") return false;
    if (d.type === "item" && map && d.cost > 0) return true;
    if (d.cost > state.power) return false;
    if (d.id === "cutlass" && allAllies(state).length === 0) return false;
    if (d.id === "ayeAyeSir" && allAllies(state).filter((a) => isUnlocked(state, a.location)).length === 0) {
      return false;
    }
    return true;
  });
}

export function coveringHero(state: GameState, id: LocationId): CardInstance | null {
  const heroes = state.locations[id].heroes;
  return heroes[0] ?? null;
}

/** Printed / extra actions may be taken only on the action stretch — never during the required move. */
export function actionsAreLive(state: GameState): boolean {
  return state.phase === "actions" && !state.pending;
}

export function availableActions(
  state: GameState,
  opts?: { asIfOnActionStretch?: boolean },
): ActionSlot[] {
  const locId = state.villainLocation;
  const loc = REALM[locId];
  const covered = coveringHero(state, locId) !== null;
  const live = Boolean(opts?.asIfOnActionStretch || actionsAreLive(state));
  const slots: ActionSlot[] = loc.actions.map((printed) => {
    const isCovered = printed.row === "top" && covered;
    const used = state.usedActions.includes(printed.key);
    const clashReady =
      printed.kind !== "vanquish" || vanquishableHeroes(state).length > 0;
    return {
      key: printed.key,
      kind: printed.kind,
      row: printed.row,
      amount: printed.amount,
      covered: isCovered,
      used,
      available: live && !isCovered && !used && clashReady,
      label: actionLabel(printed.kind, printed.amount),
    };
  });

  for (const item of state.locations[locId].items) {
    const extra =
      item.defId === "cannon"
        ? { kind: "vanquish" as const, label: "Vanquish (Cannon)" }
        : item.defId === "hooksCase"
          ? { kind: "gainPower" as const, label: "Gain 1 (Case)", amount: 1 }
          : item.defId === "ingeniousDevice"
            ? { kind: "moveHero" as const, label: "Move a Hero (Device)" }
            : null;
    if (!extra) continue;
    const key = `extra:${item.instanceId}`;
    const used = state.usedActions.includes(key);
    const extraReady = extra.kind !== "vanquish" || vanquishableHeroes(state).length > 0;
    slots.push({
      key,
      kind: extra.kind,
      row: "extra",
      amount: extra.kind === "gainPower" ? 1 : undefined,
      covered: false,
      used,
      available: live && !used && extraReady,
      label: extra.label,
      source: item.instanceId,
    });
  }
  return slots;
}

export function legalMoveLocations(state: GameState): LocationId[] {
  return unlockedLocations(state).filter((id) => id !== state.villainLocation);
}

export function legalPlayLocations(_state: GameState): LocationId[] {
  return unlockedLocations(_state);
}

export function adjacentUnlocked(state: GameState, id: LocationId): LocationId[] {
  return adjacentIds(id).filter((dest) => isUnlocked(state, dest) && isUnlocked(state, id));
}

export function vanquishAllyPoolAt(
  state: GameState,
  location: LocationId,
): { ally: CardInstance; location: LocationId }[] {
  const local = state.locations[location].allies.map((ally) => ({
    ally,
    location,
  }));
  const boarding = allAllies(state).filter(
    (a) =>
      a.ally.defId === "boardingParty" &&
      isUnlocked(state, a.location) &&
      (a.location === location || (isUnlocked(state, location) && adjacentIds(a.location).includes(location))),
  );
  const seen = new Set<string>();
  return [...local, ...boarding].filter((a) => {
    if (seen.has(a.ally.instanceId)) return false;
    seen.add(a.ally.instanceId);
    return true;
  });
}

/** Heroes the captain can name with the current Vanquish: same place, or a neighboring unlocked place a Boarding Party can reach. */
export function canVanquishAt(state: GameState, location: LocationId): boolean {
  if (location === state.villainLocation) return true;
  if (!isUnlocked(state, location)) return false;
  if (!adjacentIds(state.villainLocation).includes(location)) return false;
  return vanquishAllyPoolAt(state, location).some((a) => a.ally.defId === "boardingParty");
}

export function vanquishableHeroes(state: GameState): { hero: CardInstance; location: LocationId }[] {
  const tauntLock = anyTauntInRealm(state);
  return allHeroes(state).filter(({ hero, location }) => {
    if (tauntLock && !hasTaunt(state, hero.instanceId)) return false;
    if (!canVanquishAt(state, location)) return false;
    const pool = vanquishAllyPoolAt(state, location);
    if (pool.length === 0) return false;
    if (hero.defId === "lostBoys" && pool.length < 2) return false;
    const total = pool.reduce((sum, a) => sum + allyStrength(state, a.ally), 0);
    // Equal Strength is legal: ally total >= heroStrength (2 vs 2 opens the clash).
    return total >= heroStrength(state, hero);
  });
}

export function vanquishAllyPool(
  state: GameState,
  heroId: string,
): { ally: CardInstance; location: LocationId }[] {
  const found = allHeroes(state).find((h) => h.hero.instanceId === heroId);
  if (!found) return [];
  return vanquishAllyPoolAt(state, found.location);
}

export function vanquishClashMath(state: GameState): {
  heroName: string;
  need: number;
  selected: number;
  selectedAllies: number;
  lostBoys: boolean;
  ready: boolean;
} | null {
  const p = state.pending;
  if (p?.kind !== "vanquishAllies") return null;
  const hero = findCard(state, p.heroId);
  if (!hero) return null;
  const pool = vanquishAllyPool(state, p.heroId);
  const need = heroStrength(state, hero);
  const selected = p.selected.reduce((n, id) => {
    const ally = pool.find((a) => a.ally.instanceId === id)?.ally;
    return n + (ally ? allyStrength(state, ally) : 0);
  }, 0);
  const lostBoys = hero.defId === "lostBoys";
  const ready =
    selected >= need && p.selected.length > 0 && (!lostBoys || p.selected.length >= 2);
  return {
    heroName: cardName(hero),
    need,
    selected,
    selectedAllies: p.selected.length,
    lostBoys,
    ready,
  };
}

export function movableAlliesAndItems(state: GameState): CardInstance[] {
  const cards: CardInstance[] = [];
  for (const id of LOCATION_IDS) {
    if (!isUnlocked(state, id)) continue;
    if (adjacentUnlocked(state, id).length === 0) continue;
    cards.push(...state.locations[id].allies, ...state.locations[id].items);
  }
  return cards;
}

export function movableHeroes(state: GameState): CardInstance[] {
  const cards: CardInstance[] = [];
  for (const id of LOCATION_IDS) {
    if (!isUnlocked(state, id)) continue;
    if (adjacentUnlocked(state, id).length === 0) continue;
    cards.push(...state.locations[id].heroes);
  }
  return cards;
}

export function objectiveSteps(state: GameState): {
  map: boolean;
  peter: boolean;
  atRoger: boolean;
  win: boolean;
} {
  return {
    map: state.hangmansUnlocked,
    peter: state.peterPanRevealed,
    atRoger: state.peterPanLocation === "jollyRoger",
    win: state.won,
  };
}

function withClashAndCroc(state: GameState, text: string): string {
  const extra = clashAndCrocLine(state);
  return extra ? `${text} ${extra}` : text;
}

export function promptText(state: GameState): string {
  if (state.phase === "title") return "Choose a heading and set sail.";
  if (state.won) return "Peter Pan is vanquished at the Jolly Roger. The duel is yours.";
  if (state.lost) return state.loseReason || "The tide has turned against you.";
  if (state.bannerNote) return state.bannerNote;
  if (state.phase === "move") {
    return withClashAndCroc(state, "Move the captain to a different unlocked location.");
  }
  const p = state.pending;
  if (!p) {
    if (state.phase === "actions") {
      const clashLocked =
        availableActions(state).some((a) => a.kind === "vanquish" && !a.used && !a.covered) &&
        vanquishableHeroes(state).length === 0 &&
        (anyTauntInRealm(state) || allHeroes(state).some(({ location }) => canVanquishAt(state, location)));
      const base = clashLocked
        ? `Perform any available actions, play a ready Condition, or end the turn. ${vanquishBlockedReason(state)}`
        : "Perform any available actions, play a ready Condition, or end the turn.";
      return withClashAndCroc(state, base);
    }
    return "";
  }
  switch (p.kind) {
    case "playChooseCard":
      return "Click a glowing card in your hand. Affordable cards are outlined in gold.";
    case "playChooseLocation":
      return withClashAndCroc(
        state,
        `Click a glowing location to play ${cardName(findCard(state, p.cardId)!)}.`,
      );
    case "playChooseAllyAttach":
      return `${cutlassStrapLine(state)} Cancel returns to your hand.`;
    case "playChoosePayment": {
      const card = findCard(state, p.cardId);
      const cost = card ? def(card.defId).cost : 0;
      const name = card ? cardName(card) : "this card";
      if (mapInRealm(state)) return "Pay with Power, or discard the Never Land Map instead?";
      return `${name} costs ${cost}. You have ${state.power}. Pay ${cost} Power.`;
    }
    case "starkeyHero":
      return "Mr. Starkey can nudge a Hero here. Choose one, or cancel.";
    case "starkeyDest":
      return "Choose an adjacent unlocked location for that Hero.";
    case "ayeAyeAlly":
      return "Choose an Ally to reposition.";
    case "ayeAyeDest":
      return "Choose an adjacent unlocked location.";
    case "discardSelect":
      return "Select cards to discard, then confirm. Discarding none still spends the action.";
    case "vanquishHero":
      return withClashAndCroc(
        state,
        "Choose a Hero at the captain's place. A Boarding Party can reach a neighboring unlocked Hero.",
      );
    case "vanquishConfirmLoss":
      return "Vanquishing Peter away from the Jolly Roger loses this practice duel. Continue only if you mean to practice that failure.";
    case "vanquishAllies": {
      const math = vanquishClashMath(state);
      if (!math) return "Select Allies whose Strength meets the Hero, then confirm.";
      const boys = math.lostBoys
        ? ` Lost Boys need two Allies (${math.selectedAllies}/2).`
        : "";
      return `Clash Strength ${math.selected} / ${math.need} against ${math.heroName}.${boys} Confirm when the total meets the Hero.`;
    }
    case "movePieceSelect":
      return "Choose an Ally or unattached Item to move.";
    case "movePieceDest":
      return "Choose an adjacent unlocked location.";
    case "moveHeroSelect":
      return "Choose a Hero to move one step.";
    case "moveHeroDest":
      return "Choose an adjacent unlocked location.";
    case "scarePeek":
      return "Discard both peeked Fate cards to the Fate discard (they can return when Fate reshuffles), or put them back on top in an order.";
    case "fateChooseCard":
      return "Practice self-Fate: play one Fate card from Hook’s own deck and discard the other. At a table this action would Fate another villain.";
    case "fateChooseLocation":
      return "Choose an unlocked location for this Hero.";
    case "fateChooseAttach":
      return "Attach this to a Hero in the realm. Pixie Dust cannot cling to Peter while Hangman’s Tree is still locked.";
    case "fateChooseItem":
      return allLocationItems(state).length === 0
        ? "No Item ashore — this Fate card is discarded. Splitting Headache finds no Item and is discarded."
        : "Choose an Item in the realm to discard.";
    case "tinkerDiscard":
      return "Tinker Bell may discard one Ally here. Choose one or skip.";
    case "worthyLocation":
      return "Choose where this revealed Hero lands.";
    case "obsessionDecide":
      return "Play this Hero into the realm, or banish them?";
    case "obsessionLocation":
      return "Choose an unlocked location for this Hero.";
    case "cunningAlly":
      return "Cunning: play an Ally from hand for free.";
    case "cunningLocation":
      return "Where should that Ally come ashore?";
    case "fateReport":
      return p.abilityText ? `${p.note} ${p.abilityText}` : p.note;
    case "conditionOffer":
      return p.reason;
  }
}
