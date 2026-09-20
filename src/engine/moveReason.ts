import { def } from "./cards";
import { locName } from "./realm";
import {
  availableActions,
  cardName,
  coveringHero,
  findCard,
  findCardLocation,
  mapInRealm,
  playableHandCards,
  promptText,
} from "./queries";
import { LOCATION_IDS, type CardInstance, type GameState, type Input, type LocationId } from "./types";

export interface MoveReason {
  chose: string;
  why: string;
  next: string;
  soft?: boolean;
}

export const IDLE_MOVE_REASON: MoveReason = {
  chose: "No move selected yet.",
  why: "This panel explains the choice you just made — not the next suggestion (that is Coach) and not the voyage map (that is the Strategy brief). Click a glowing location, action, or card and it will name what you picked, why it serves the captain’s chain, and what to watch next.",
  next: "The practice chain is always the same: play the Never Land Map to unlock Hangman’s Tree, find Peter, walk him to the Jolly Roger, and vanquish him there. Fate will try to cover useful actions and park trouble on the path.",
  soft: true,
};

function isCardPickCopy(reason: MoveReason): boolean {
  return (
    /from hand/i.test(reason.chose) ||
    /You chose Worthy Opponent/i.test(reason.chose) ||
    /You opened Play a Card/i.test(reason.chose) ||
    (/Worthy Opponent is a hunt/i.test(reason.why) && /chose|from hand/i.test(reason.chose))
  );
}

function isStaleReason(state: GameState, last: MoveReason): boolean {
  const p = state.pending;
  if (isCardPickCopy(last)) {
    if (
      p?.kind === "playChooseCard" ||
      p?.kind === "playChooseLocation" ||
      p?.kind === "playChoosePayment" ||
      p?.kind === "playChooseAllyAttach" ||
      p?.kind === "cunningAlly" ||
      p?.kind === "cunningLocation"
    ) {
      return false;
    }
    return true;
  }
  return false;
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

function explainCurrentMoment(state: GameState): MoveReason {
  const p = state.pending;
  if (state.phase === "actions" && !p) {
    const live = availableActions(state).filter((a) => a.available);
    const names = live.map((a) => a.label).join(", ") || "none still unused";
    return pack(
      `No new click this beat — you are on the action stretch at ${locName(state.villainLocation)}.`,
      `${promptText(state)} Available right now: ${names}. ${chainLine(state)}`,
      `Take an uncovered action that serves the next gate, or end the turn to refill and face Fate.${crocWatch(state)}`,
      true,
    );
  }
  if (p?.kind === "playChooseCard") {
    const playable = playableHandCards(state);
    const map = playable.find((c) => c.defId === "neverLandMap");
    const ally = playable.find((c) => def(c.defId).type === "ally");
    const card = map ?? ally ?? playable[0];
    const name = card ? cardName(card) : "a glowing card";
    const dest =
      card && def(card.defId).type === "ally"
        ? "jollyRoger"
        : state.villainLocation;
    return pack(
      `You opened Play a Card at ${locName(state.villainLocation)}.`,
      `Click ${name} in your hand — affordable cards are outlined in gold. ${
        card && def(card.defId).type === "ally"
          ? `${name} belongs on the Jolly Roger so Strength is waiting.`
          : card?.defId === "neverLandMap"
            ? "The Map can sit on any unlocked square — playing it is what opens Hangman’s Tree."
            : "Pick the card that serves the Map, the escort, or the ship clash."
      } ${chainLine(state)}`,
      card && def(card.defId).type !== "effect" && card.defId !== "cutlass"
        ? `After you click ${name}, click ${placeVerb(dest)}.`
        : `After you click ${name}, follow the next prompt (pay, strap, or the hunt resolves). Cancel returns you to the action stretch.`,
    );
  }
  if (p?.kind === "playChooseLocation") {
    const card = findCard(state, p.cardId);
    const name = card ? cardName(card) : "that card";
    const dest =
      card && (def(card.defId).type === "ally" || card.defId === "cannon" || card.defId === "hooksCase")
        ? "jollyRoger"
        : state.villainLocation;
    return pack(
      `You chose ${name} and still need a place.`,
      `${promptText(state)} Click ${placeVerb(dest)} to drop ${name} on ${locName(dest)}. Allies and ship gear want the Jolly Roger; the Map can sit anywhere unlocked. ${chainLine(state)}`,
      `If a payment prompt appears next, click Pay with Power (or Cancel to keep the rest of this stop).`,
    );
  }
  if (p?.kind === "playChoosePayment") {
    const card = findCard(state, p.cardId);
    const name = card ? cardName(card) : "this card";
    const cost = card ? def(card.defId).cost : 0;
    return pack(
      `You still owe Power for ${name}.`,
      `${name} costs ${cost} and you have ${state.power}. Click Pay with Power to finish the play${mapInRealm(state) ? ", or Discard the Map if the tree is already open and you are short" : ""}.`,
      "After you pay, the card lands and you return to the action stretch at this stop.",
    );
  }
  if (p?.kind === "moveHeroSelect" || p?.kind === "starkeyHero") {
    return pack(
      "You opened a Hero walk.",
      `${promptText(state)} Click Peter Pan if he is glowing, then Choose this place on the adjacent square toward the Jolly Roger — never away, and never a mid-path clash.`,
      "Other Heroes are worth moving only to uncover a top-row action or to ease Tick Tock off your path.",
    );
  }
  if (p?.kind === "moveHeroDest" || p?.kind === "starkeyDest") {
    const hero = findCard(state, p.heroId);
    const name = hero ? cardName(hero) : "that Hero";
    return pack(
      `You picked ${name} to walk.`,
      `${promptText(state)} Click Choose this place on the glowing adjacent square${hero?.defId === "peterPan" ? " toward the Jolly Roger" : ""}.`,
      hero?.defId === "peterPan"
        ? "Each step west is the escort you are practicing. Do not vanquish him anywhere except the ship."
        : `${chainLine(state)}${crocWatch(state)}`,
    );
  }
  if (p?.kind === "vanquishHero") {
    return pack(
      `You opened Vanquish at ${locName(state.villainLocation)}.`,
      `${promptText(state)} Click the glowing Hero you mean to clash — Peter Pan only on the Jolly Roger. Then tap Allies until Strength meets him and Confirm.`,
      "Cancel if the glowing target is Peter away from the ship.",
    );
  }
  if (p?.kind === "vanquishAllies") {
    return pack(
      "You named a vanquish target.",
      `${promptText(state)} Click glowing Allies until the Strength meter meets the Hero, then click Confirm.`,
      "You do not have to spend every Ally if a smaller group meets the number.",
    );
  }
  if (p?.kind === "discardSelect") {
    return pack(
      `You opened Discard at ${locName(state.villainLocation)}.`,
      `${promptText(state)} Click cards in hand to mark them, then click Confirm. Discarding none still spends the action. Keep the Map and hunt cards while Peter is hidden.`,
      `${chainLine(state)}`,
    );
  }
  if (p?.kind === "worthyLocation") {
    const hero = state.heldCard ?? findCard(state, p.heroId);
    const name = hero ? cardName(hero) : "the Hero";
    const dest = hero?.defId === "tickTock" ? "skullRock" : "jollyRoger";
    return pack(
      `Worthy Opponent found ${name}.`,
      hero?.defId === "tickTock"
        ? `Click ${placeVerb("skullRock")} or another quiet unlocked square — not Mermaid Lagoon or Hangman’s Tree — so Power and escort stay usable.`
        : `Click ${placeVerb(dest)} to seat ${name} where they cover the fewest actions you still need. ${chainLine(state)}`,
      "Then you return to the action stretch at this stop.",
    );
  }
  if (p?.kind === "fateReport") {
    const played = p.played;
    if (played) {
      const lesson = fateCardLesson(played, p.note, heroSeat(state, played));
      return pack(
        p.resume === "nextTurn"
          ? `Fate played ${def(played.defId).name}.`
          : `Read ${def(played.defId).name} before you continue.`,
        `${lesson.why} Click Continue when you have read the full text.`,
        lesson.next,
      );
    }
    return pack("Fate has something to read.", p.note || promptText(state), "Click Continue, then take the next legal click.");
  }
  return {
    ...IDLE_MOVE_REASON,
    chose: promptText(state) || IDLE_MOVE_REASON.chose,
    why: `${promptText(state)} ${IDLE_MOVE_REASON.why}`,
    next: "Click the glowing card, place, or button the prompt names.",
  };
}

/** Keep Why-this-move aligned with the current prompt — card-pick copy must not linger after Play resolves. */
export function liveMoveReason(state: GameState, last: MoveReason | null): MoveReason {
  if (state.phase === "title") return IDLE_MOVE_REASON;
  if (!last || isStaleReason(state, last)) return explainCurrentMoment(state);
  return last;
}

function tickTockAt(state: GameState): LocationId | null {
  for (const id of LOCATION_IDS) {
    if (state.locations[id].heroes.some((h) => h.defId === "tickTock")) return id;
  }
  return null;
}

function coverNote(state: GameState, id: LocationId): string {
  const cover = coveringHero(state, id);
  return cover
    ? ` ${def(cover.defId).name} is covering the top row here, so those printed actions stay shut until that Hero leaves or is vanquished.`
    : " The top row is uncovered, so every printed action at this stop is usable once.";
}

function crocWatch(state: GameState): string {
  const croc = tickTockAt(state);
  return croc
    ? ` Tick Tock waits at ${locName(croc)} — sharing that place with the captain (stepping there, or sliding the crocodile onto him) empties the whole hand.`
    : " Tick Tock is not ashore yet, so movement is safer than it will be later.";
}

function chainLine(state: GameState): string {
  if (!state.hangmansUnlocked) {
    return "Hangman’s Tree is still locked, so the immediate job is Power and the Never Land Map. Until that hideout opens, Peter cannot walk toward the ship even if Fate drops him there.";
  }
  if (!state.peterPanRevealed) {
    return "The tree is open. The next gate is finding Peter — a Fate action or a hunt card such as Worthy Opponent — so you can walk him west.";
  }
  if (state.peterPanLocation !== "jollyRoger") {
    return `Peter is ashore at ${state.peterPanLocation ? locName(state.peterPanLocation) : "the realm"}. The remaining job is walking him to the Jolly Roger and meeting him with enough Strength there.`;
  }
  return "Peter is on the Jolly Roger. Vanquish him there to finish the chain; clashing him anywhere else loses this practice duel.";
}

function pack(chose: string, why: string, next: string, soft = false): MoveReason {
  return { chose, why, next, soft };
}

function locationToolbox(id: LocationId): string {
  switch (id) {
    case "mermaidLagoon":
      return "Mermaid Lagoon is the Power engine: Gain 3 plus two Play slots. Most opening voyages come here to buy the Never Land Map (cost 4) that unlocks Hangman’s Tree.";
    case "skullRock":
      return "Skull Rock is the digging and hunting stop: Discard and a Fate action live here. Use it when the hand is clogged or you want to flip Fate yourself instead of waiting on the computer.";
    case "jollyRoger":
      return "The Jolly Roger is the finish line. Vanquish and Play live here. Allies and ship gear belong on this deck so Strength is waiting when Peter arrives.";
    case "hangmansTree":
      return "Hangman’s Tree is the escort stop. Move a Hero, a Fate action, and Gain 2 live here. Once the Map has opened this hideout, this is where Peter starts his walk west.";
  }
}

function playCardWhy(defId: string, state: GameState): { why: string; next: string } {
  switch (defId) {
    case "neverLandMap":
      return {
        why: "The Never Land Map is the only key that unlocks Hangman’s Tree. That is gate one of the chain: Map → open the hideout → find Peter → walk him to the Jolly Roger → vanquish him there. Playing it is not flavor; without it Peter cannot leave the tree.",
        next: `The Map can sit at any unlocked place — the unlock is what matters, not the square. ${chainLine(state)} After this you can start thinking about Fate hunts and an Ally stack on the ship.`,
      };
    case "pirateBrute":
    case "smee":
    case "swashbuckler":
    case "boardingParty":
      return {
        why: `${def(defId).name} is crew Strength. Peter is Strength 8 unbuffed; two Pirate Brutes, or Smee plus help, will finish him on the Jolly Roger. Stationing that Strength now is how the late-game clash arrives early.`,
        next: "Drop Allies on the Jolly Roger whenever you can. Walking Peter across a thin ship is how voyages stall. Fate will try to cover rich actions and park Tick Tock on the path — keep the chain in mind while you stack.",
      };
    case "mrStarkey":
      return {
        why: "Mr. Starkey is escort. After he lands he can nudge a Hero one unlocked step, which is how Peter slides toward the ship without spending a Move a Hero action.",
        next: "Prefer to land him where a Hero already stands, then push Peter west — never away from the Jolly Roger. Splitting Headache loves escort Items; Starkey himself is safer than the Device if Fate is hungry.",
      };
    case "ingeniousDevice":
      return {
        why: "Ingenious Device is a portable Move a Hero. It is the fast escort once the tree is open. That is how you walk Peter without standing at Hangman’s Tree every turn.",
        next: "Place it where you will actually stand to use it. Fate’s Splitting Headache loves this Item — if the computer is about to act, know you might lose it.",
      };
    case "worthyOpponent":
      return {
        why: "Worthy Opponent is a hunt: +2 Power and you reveal Fate cards until a Hero appears. That is how you find Peter without waiting for a Fate action or the computer’s turn.",
        next: "If the Hero is Peter, he still lands at Hangman’s Tree. If it is Tick Tock, park him off the lagoon and the tree. You will still need the Map if the hideout is locked.",
      };
    case "giveThemAScare":
      return {
        why: "Give Them a Scare peeks the top of Fate without finding Peter. Looking is not revealing: a peek will not force him onto the tree. It lets you send trouble to the Fate discard or stack Peter on top for the next real Fate flip.",
        next: "If Tick Tock or Splitting Headache is in the peek, discarding both is often kinder — they can still return when Fate reshuffles. If Peter is there, return him on top so the next Fate action can find him.",
      };
    case "cutlass":
      return {
        why: "The Cutlass is +2 Strength on one Ally already ashore. That is how a thin ship becomes a honest clash without drawing another Brute.",
        next: "Strap it to crew on the Jolly Roger, or to the Ally you will walk there. It needs an Ally in the realm — play a crew member first if the picker is empty.",
      };
    case "cannon":
      return {
        why: "The Cannon is a local Vanquish you can take from the place it sits. Useful for clearing Tick Tock or a covering Hero without standing on the Jolly Roger.",
        next: "Do not use it on Peter unless he is already on the ship. Clashing him anywhere else loses this practice duel on purpose so the lesson sticks.",
      };
    case "hooksCase":
      return {
        why: "Hook's Case adds an extra Gain 1 Power action at the place it sits. That extra Gain is never covered by a Hero, so it is a reliable trickle when the printed Power row is shut.",
        next: "Take that extra Gain when you still need Power for the Map or a Play. It is not a discard or extra Play — only Gain 1.",
      };
    case "ayeAyeSir":
      return {
        why: "Aye Aye Sir slides an Ally one unlocked step and grants a temporary +2. That is logistics plus a burst for the turn you might clash.",
        next: "Push crew onto the Jolly Roger. The +2 expires at the end of the turn, so spend it the same stretch you vanquish if you can.",
      };
    case "cunning":
      return {
        why: "Cunning is a Condition: when a Strength 4+ Hero is ashore, you may slip an Ally in for free. That is how the ship stack grows without spending the Play action’s Power.",
        next: "Put that free Ally on the Jolly Roger. You can still take other actions this stop.",
      };
    case "obsession":
      return {
        why: "Obsession hunts Fate for a Hero while Peter is still hidden. It is a practice-only trigger on your own turn because there is no opponent sitting across the table.",
        next: "If it finds Peter, play him — he goes to Hangman’s Tree. If it finds Tick Tock, banishing him saves the hand later.",
      };
    default:
      return {
        why: `${def(defId).name} is in your hand because it might serve Power, digging, hunting Fate, escort, or the ship clash. The chain is Map → tree → find Peter → walk to the ship → vanquish there.`,
        next: `${chainLine(state)}${crocWatch(state)}`,
      };
  }
}

function fateCardLesson(card: CardInstance, note: string, seatedAt?: LocationId | null): { why: string; next: string } {
  const name = def(card.defId).name;
  const place = seatedAt ? ` at ${locName(seatedAt)}` : "";
  switch (card.defId) {
    case "tickTock":
      return {
        why: `Fate seated Tick Tock${place}. The crocodile hurts because if the captain later moves onto that place, every card in hand is discarded — Power, the Map, hunt cards, all of it. That is how a voyage stalls mid-escort. ${def("tickTock").text}`,
        next: `Give ${locName(seatedAt ?? "mermaidLagoon")} a wide berth unless you accept an empty hand and a refill next turn. Vanquish the crocodile if local Strength is there. Do not let the required move walk you onto him by habit.`,
      };
    case "peterPan":
      return {
        why: `Fate revealed Peter Pan. That is not a setback — it is gate two of your own chain. He is forced to Hangman’s Tree even if that hideout is still locked. ${def("peterPan").text}`,
        next: stateUnlockHint(note),
      };
    case "wendy":
      return {
        why: `Fate seated Wendy${place}. She makes every other Hero in the realm +1 Strength, so vanquishes get more expensive and covering Heroes cling harder.`,
        next: "Clear small Heroes when you can, and do not walk Peter onto the ship until the Ally stack still meets the new totals. Covered top-row actions stay shut until those Heroes move or fall.",
      };
    case "tinkerBell":
      return {
        why: `Fate seated Tinker Bell${place}. She may have dismissed an Ally at the same place. Losing crew on the Jolly Roger delays the clash; losing crew elsewhere is milder.`,
        next: "Rebuild Strength on the ship before you escort Peter. If she covered a rich stop, plan the next required move around the open bottom row.",
      };
    case "lostBoys":
      return {
        why: `Fate seated Lost Boys${place}. They need at least two Allies to vanquish, so they are a tax on your crew even when the Strength total looks fine.`,
        next: "Do not spend two Allies on them if Peter is close to the ship and the stack is thin. Covering the top row is their other job — take uncovered actions or move them off.",
      };
    case "john":
    case "michael":
      return {
        why: `Fate seated ${name}${place}. A Hero’s first job is covering the top printed actions at that stop, which can shut Gain, Play, or Fate you wanted this turn.`,
        next: `${coverHint(seatedAt)} You can vanquish them later or walk around the covered row. Keep the Map-and-Peter chain ahead of side clashes.`,
      };
    case "splittingHeadache":
      return {
        why: `Fate played Splitting Headache. ${note} That card exists to strip escort Items and the Map after it is on the table — the tools that open the tree and walk Peter.`,
        next: "If the Map was discarded after the tree was already open, the hideout stays unlocked. If you lost the Device, use Move a Hero at the tree or Mr. Starkey. Rebuild Items only when they still serve the chain.",
      };
    case "pixieDust":
    case "taunt":
      return {
        why: `Fate attached ${name}. ${note} Buffed Heroes cost more Strength to vanquish, and Taunt can force you to fight the wrong body first.`,
        next: "Do not clash Peter until the ship stack still meets the new number. If Taunt is on a side Hero, you may have to clear that Hero before you can touch Peter.",
      };
    default:
      return {
        why: `Fate played ${name}. ${note} Computer Fate is pressure on the same chain you are practicing: cover useful actions, park Tick Tock on rich stops, and strip Items that escort Peter.`,
        next: "Read the full card text before you leave the modal. Then take the next required move with the new map of the realm.",
      };
  }
}

function stateUnlockHint(_note: string): string {
  return "If Hangman’s Tree is still locked, playing the Map is now urgent — Peter cannot leave until it opens. If it is already open, start the walk west and keep Allies stacking on the Jolly Roger. Do not vanquish him anywhere except the ship.";
}

function coverHint(id: LocationId | undefined | null): string {
  if (!id) return "Check which top-row actions just closed.";
  return `Check the top row at ${locName(id)}.`;
}

function heroSeat(state: GameState, card: CardInstance): LocationId | null {
  return findCardLocation(state, card.instanceId);
}

function sameTable(before: GameState, after: GameState): boolean {
  return (
    before.phase === after.phase &&
    before.pending?.kind === after.pending?.kind &&
    before.villainLocation === after.villainLocation &&
    before.power === after.power &&
    before.turn === after.turn &&
    before.logSeq === after.logSeq &&
    before.usedActions.join() === after.usedActions.join() &&
    before.hand.length === after.hand.length &&
    before.won === after.won &&
    before.lost === after.lost
  );
}

export function explainSelection(before: GameState, input: Input, after: GameState): MoveReason | null {
  if (input.type === "start") {
    return pack(
      `You set sail on ${after.difficulty === "easy" ? "Easy" : "Normal"} Fate.`,
      "This is a practice table for the captain’s chain, so you can teach it at a real table later. You always begin at the Jolly Roger and must move before any action. Coach names the next click; the Strategy brief maps the voyage; this panel will explain each choice after you make it.",
      "Make the required first move. Mermaid Lagoon buys Power for the Map. Skull Rock digs and hunts. Do not stay put — the rules will not let you.",
    );
  }
  if (input.type === "newGame" || input.type === "openHelp" || input.type === "closeHelp") return null;
  if (input.type === "resign") {
    return pack(
      "You struck the colors.",
      "Resigning ends the duel so you can review the log. Common breaks are clashing Peter off the ship, stepping onto Tick Tock with a hand you still needed, or never finding the Map.",
      "Sail again with Coach and Move reasons on if you want the same lesson slower.",
      true,
    );
  }

  if (input.type === "cancel") {
    if (sameTable(before, after) && before.pending?.kind === "fateReport") return null;
    return pack(
      "You cancelled that choice.",
      `Nothing on the chain committed. The captain is still at ${locName(after.villainLocation)} with ${after.power} Power. ${chainLine(after)}`,
      "Pick another glowing action or card, or end the turn to refill and face Fate. Coach still names a next click if it is on.",
      true,
    );
  }

  if (input.type === "acknowledgeFate") {
    const report = before.pending?.kind === "fateReport" ? before.pending : null;
    if (!report) return null;
    const played = report.played;
    const seat = played ? heroSeat(after, played) ?? heroSeat(before, played) : null;
    if (played) {
      const lesson = fateCardLesson(played, report.note, seat);
      return pack(
        report.resume === "nextTurn"
          ? `You acknowledged Fate playing ${def(played.defId).name}.`
          : `You finished reading ${def(played.defId).name}.`,
        lesson.why,
        lesson.next,
      );
    }
    return pack(
      "You acknowledged Fate.",
      report.note || "Fate already acted. This modal was only the read-and-continue beat.",
      "The next required move uses the new board. Watch covered actions and Tick Tock.",
    );
  }

  if (input.type === "endTurn") {
    const report = after.pending?.kind === "fateReport" ? after.pending : null;
    const played = report?.played;
    return pack(
      "You ended the turn.",
      "Ending is part of the rhythm, not a failure. The hand refills toward four, then the computer performs one Fate action. That pressure is why you practice: Fate will cover rich stops, seat Tick Tock, or strip an Item.",
      played
        ? `Fate already played ${def(played.defId).name}. Read the full text in the modal, then Continue. ${report?.note ?? ""}`
        : "If a Fate report is up, stay there until Continue. Then the next required move begins.",
    );
  }

  if (input.type === "selectLocation") {
    return explainLocation(before, after, input.locationId);
  }
  if (input.type === "selectAction") {
    return explainAction(before, after, input.actionKey);
  }
  if (input.type === "selectCard") {
    return explainCard(before, after, input.instanceId);
  }
  if (input.type === "confirm") {
    return explainConfirm(before, after);
  }
  if (input.type === "payWithPower") {
    return pack(
      "You paid with Power.",
      mapInRealm(after) || mapInRealm(before)
        ? "Spending Power keeps the Never Land Map in the realm if it is already unlocking the tree. Once Hangman’s Tree is open, keeping the Map is usually wiser than discarding it to cover a later Item."
        : "You spent Power equal to the card’s printed cost. Watch how much is left for the next Play.",
      `${chainLine(after)} Watch the remaining Power if another Play is still uncovered.`,
    );
  }
  if (input.type === "payWithMap") {
    return pack(
      "You discarded the Never Land Map to cover an Item’s cost.",
      "The tree stays unlocked if it was already open — the Map’s job as a key is done. You lose it as a later payment and as a target Fate might have stripped anyway.",
      "Only do this after the hideout is open. If you still needed the unlock, this was the wrong spend.",
    );
  }
  if (input.type === "scareDiscardBoth") {
    return pack(
      "You discarded both peeked Fate cards.",
      "Those cards go to the Fate discard, so they will not sit on top for the next Fate flip. They can still return when Fate reshuffles — this is not a remove-from-game pile.",
      "You did not find Peter this way — a peek never forces him onto the tree. Hunt again with a real Fate action or Worthy Opponent if he is still hidden.",
    );
  }
  if (input.type === "scareReturn") {
    return pack(
      "You returned the peeked Fate cards to the deck.",
      "The first card you named is now on top, so the next real Fate flip will see it first. If that card is Peter, you just stacked the find.",
      "If you stacked trouble instead, the computer may play it after your next end turn. Plan the next move around that risk.",
    );
  }
  if (input.type === "acceptCondition") {
    return pack(
      "You played the ready Condition.",
      "Conditions fire because the table already meets their trigger — a strong Hero ashore for Cunning, or Peter still hidden for Obsession. That is free or discounted progress on the chain.",
      after.pending?.kind === "cunningAlly"
        ? "Choose an Ally in hand and drop them on the Jolly Roger if you can."
        : "Follow the hunt. Play Peter if he appears; consider banishing Tick Tock.",
    );
  }
  if (input.type === "skipCondition") {
    return pack(
      "You skipped the Condition.",
      "The card stays in hand. That is fine when the free Ally would land in the wrong place, or when you would rather hunt Peter later.",
      `${chainLine(after)} You can still take the rest of this stop’s actions.`,
      true,
    );
  }
  if (input.type === "playOrDiscardHero") {
    const hero = before.heldCard;
    const name = hero ? def(hero.defId).name : "the Hero";
    if (input.play) {
      return pack(
        `You chose to play ${name} into the realm.`,
        hero?.defId === "peterPan"
          ? "Peter still goes to Hangman’s Tree. That is the find you wanted."
          : `Seating ${name} covers a stop and may raise vanquish costs. Park them where they block the fewest actions you still need.`,
        hero?.defId === "tickTock"
          ? "If you can still banish instead, consider it. Otherwise keep the captain off that square."
          : "Choose the unlocked place next, then read the lasting text before you leave the report.",
      );
    }
    return pack(
      `You banished ${name}.`,
      hero?.defId === "tickTock"
        ? "Sending the crocodile out of the realm saves your hand later. That is a correct defensive spend of Obsession."
        : `Banishing ${name} keeps the realm quieter so top-row actions stay open while you finish the Map and the walk.`,
      `${chainLine(after)} Fate can still redraw pressure later.`,
    );
  }

  if (sameTable(before, after)) return null;
  return pack(
    "You made a legal choice.",
    chainLine(after),
    `Watch covered actions and Fate.${crocWatch(after)}`,
  );
}

function explainLocation(before: GameState, after: GameState, locationId: LocationId): MoveReason | null {
  const p = before.pending;
  if (before.phase === "move" && !p) {
    if (after.villainLocation !== locationId) return null;
    const snap = after.pending?.kind === "fateReport" && after.pending.played?.defId === "tickTock" && /snaps/i.test(after.pending.note);
    return pack(
      `You moved the captain to ${locName(locationId)}.`,
      `Every turn the captain must leave the current unlocked place before actions fire. ${locationToolbox(locationId)}${coverNote(after, locationId)} ${chainLine(after)}`,
      snap
        ? "Tick Tock already emptied the hand. Read the crocodile’s lasting text in the modal, then Continue. Ending the turn is how you draw back to four."
        : `Use the uncovered actions that serve the next gate, then end the turn to refill and face Fate.${crocWatch(after)}`,
    );
  }
  if (!p) return null;

  if (p.kind === "playChooseLocation" || p.kind === "cunningLocation") {
    const card = findCard(before, p.kind === "playChooseLocation" ? p.cardId : p.allyId);
    const name = card ? cardName(card) : "that card";
    if (p.kind === "playChooseLocation" && after.pending?.kind === "playChoosePayment") {
      const cost = card ? def(card.defId).cost : 0;
      return pack(
        `You chose ${locName(locationId)} for ${name}.`,
        `${name} still needs its Power cost (${cost}). Pay it to finish the play — that is the printed price, not a silent spend.`,
        mapInRealm(after)
          ? "You may pay with Power or discard the Never Land Map if it is already unlocking the tree."
          : `You have ${after.power} Power. Pay ${cost} to put ${name} on the table.`,
      );
    }
    const extra = card ? playCardWhy(card.defId, after) : { why: chainLine(after), next: crocWatch(after) };
    return pack(
      `You played ${name} to ${locName(locationId)}.`,
      `${extra.why} This square is now part of that plan: Allies and ship gear want the Jolly Roger; the Map can sit anywhere unlocked.`,
      extra.next,
    );
  }
  if (p.kind === "fateChooseLocation" || p.kind === "worthyLocation" || p.kind === "obsessionLocation") {
    const hero = before.heldCard ?? findCard(before, "cardId" in p ? p.cardId : p.heroId);
    const name = hero ? cardName(hero) : "that Hero";
    return pack(
      `You seated ${name} at ${locName(locationId)}.`,
      hero?.defId === "tickTock"
        ? `Keep the crocodile off Mermaid Lagoon and Hangman’s Tree so Power and escort stay usable. ${def("tickTock").text}`
        : `A Hero covers the top row at ${locName(locationId)}. Park them where they block the fewest actions you still need. ${chainLine(after)}`,
      "Read the full lasting text on the report if it is up, then Continue. The next required move uses this new cover map.",
    );
  }
  if (p.kind === "moveHeroDest" || p.kind === "starkeyDest") {
    const hero = findCard(after, p.heroId) ?? findCard(before, p.heroId);
    const name = hero ? cardName(hero) : "that Hero";
    const towardShip = LOCATION_IDS.indexOf(locationId) < LOCATION_IDS.indexOf(findCardLocation(before, p.heroId) ?? locationId);
    const snap = after.pending?.kind === "fateReport" && after.pending.played?.defId === "tickTock" && /snaps/i.test(after.pending.note);
    return pack(
      `You moved ${name} to ${locName(locationId)}.`,
      snap
        ? "You slid Tick Tock onto the captain. Sharing a place with the crocodile empties the whole hand — same trap as stepping onto him."
        : hero?.defId === "peterPan"
          ? towardShip
            ? "That step is west toward the Jolly Roger. Peter only counts as a win on the ship. Walking him closer is the escort you are practicing."
            : "That step is away from the Jolly Roger. In this practice duel you almost never want that — the lesson is the walk toward the ship, never a mid-path clash."
          : `Moving ${name} can uncover a top row you still need, or ease Tick Tock off a square you must visit.`,
      snap
        ? "Tick Tock already emptied the hand. Read the crocodile’s lasting text in the modal, then Continue. Ending the turn is how you draw back to four."
        : hero?.defId === "peterPan"
          ? "Keep Allies stacking on the Jolly Roger so the clash is honest when he arrives. Do not vanquish him anywhere else."
          : `${chainLine(after)}${crocWatch(after)}`,
    );
  }
  if (p.kind === "ayeAyeDest" || p.kind === "movePieceDest") {
    return pack(
      `You slid that piece to ${locName(locationId)}.`,
      "This is logistics for the ship. Crew and loose gear on Skull Rock or the lagoon is late-game Strength that has not arrived yet.",
      locationId === "jollyRoger"
        ? "Good — the clash lives here. Confirm you still have enough Strength for Peter (8 unbuffed, more if Wendy or dust is out)."
        : "Another step later can still finish the delivery. Aye Aye’s +2 is only until the turn ends.",
    );
  }
  return null;
}

function explainAction(before: GameState, after: GameState, actionKey: string): MoveReason | null {
  const slot = availableActions(before).find((a) => a.key === actionKey);
  if (!slot) {
    if (sameTable(before, after)) return null;
  }
  const here = locName(after.villainLocation);
  switch (slot?.kind) {
    case "gainPower": {
      const amt = slot.amount ?? 1;
      return pack(
        `You took Gain ${amt} at ${here}.`,
        `Power is the Map’s price and the cost of most crew. ${amt >= 3 ? "This is the richest Power action on the realm — it is why opening voyages visit Mermaid Lagoon." : "Smaller Gains still add up; the Map costs 4."} ${chainLine(after)}`,
        `You can only take this action once this stop. A Play action can still spend what you just earned.${crocWatch(after)}`,
      );
    }
    case "discard":
      return pack(
        `You opened Discard at ${here}.`,
        "Discarding is how you dig for the Never Land Map when the hand is full of cards you cannot afford or do not need. The action is spent even if you toss nothing.",
        "Keep the Map. Keep hunt cards while Peter is hidden. Keep Allies you can still afford if the ship is light. Confirm when the selection is right.",
      );
    case "playCard":
      return pack(
        `You opened Play a Card at ${here}.`,
        "This is not “play something because it glows.” Click a glowing card in your hand next. The Map opens the tree. Allies belong on the Jolly Roger. Hunt cards fish Fate. Escort pieces matter after the hideout is open.",
        "Affordable cards are outlined. After you click the card, click Choose this place on the square you want (Allies want the Jolly Roger). Cancel returns you to the action stretch if this was the wrong tool.",
      );
    case "fate":
      return pack(
        `You took the Fate action at ${here}.`,
        "You are flipping the other deck yourself. If Peter is in the pair, play him: he lands at Hangman’s Tree. That is how you hunt without waiting for the computer’s end-of-turn Fate.",
        "Park Tick Tock off the lagoon and the tree if you can. Read the full text of whatever you seat before you Continue.",
      );
    case "vanquish":
      return pack(
        `You opened Vanquish at ${here}.`,
        "Name a Hero your local (or boarding) Allies can meet. Peter only counts as a win on the Jolly Roger. Clashing him anywhere else loses this practice duel so the lesson sticks.",
        "Tick Tock is worth clearing if the Strength is there, because the crocodile empties the hand if you later step onto him. Confirm only when the Allies meet the number.",
      );
    case "moveHero":
      return pack(
        `You opened Move a Hero at ${here}.`,
        "Click the glowing Hero next — almost always Peter Pan. Then click Choose this place on the adjacent unlocked square toward the Jolly Roger, never away, and never a mid-path clash.",
        "Other Heroes are worth moving only to uncover a top-row action you still need, or to ease Tick Tock off a place you must visit.",
      );
    case "moveItemAlly":
      return pack(
        `You opened Move Ally/Item at ${here}.`,
        "Slide crew or loose gear one unlocked step toward the ship. That is how Strength arrives before Peter does.",
        `${chainLine(after)} Aye Aye Sir is the burst version of this same idea.`,
      );
    default:
      if (sameTable(before, after)) return null;
      return pack(`You used an action at ${here}.`, chainLine(after), `Watch Fate and covered rows.${crocWatch(after)}`);
  }
}

function explainCard(before: GameState, after: GameState, instanceId: string): MoveReason | null {
  const p = before.pending;
  const card = findCard(before, instanceId) ?? findCard(after, instanceId);
  const name = card ? cardName(card) : "that card";

  if (before.phase === "actions" && !p && card && (card.defId === "cunning" || card.defId === "obsession")) {
    return pack(
      `You offered ${name}.`,
      playCardWhy(card.defId, after).why,
      "Accept if the trigger still serves the chain; skip if you would rather wait.",
    );
  }

  if (!p) {
    if (sameTable(before, after)) return null;
    return pack(`You selected ${name}.`, chainLine(after), playCardWhy(card?.defId ?? "smee", after).next);
  }

  if (p.kind === "playChooseCard") {
    if (!card) return null;
    if (
      after.pending?.kind &&
      after.pending.kind !== "playChooseCard" &&
      after.pending.kind !== "playChooseLocation" &&
      after.pending.kind !== "playChoosePayment" &&
      after.pending.kind !== "playChooseAllyAttach"
    ) {
      return liveMoveReason(after, null);
    }
    if (after.phase === "actions" && !after.pending) {
      const lesson = playCardWhy(card.defId, after);
      return pack(
        `You played ${name}.`,
        `${lesson.why} That Play action is spent — you are back on the action stretch.`,
        lesson.next,
      );
    }
    const lesson = playCardWhy(card.defId, after);
    return pack(
      `You chose ${name} from hand.`,
      lesson.why,
      card.defId === "cutlass"
        ? "The picker will ask which Ally wears it. Cancel returns to Play a Card."
        : def(card.defId).type === "effect"
          ? lesson.next
          : `Click a glowing location next. ${lesson.next}`,
    );
  }
  if (p.kind === "playChooseAllyAttach") {
    return pack(
      `You strapped the Cutlass to ${name}.`,
      `${name} is now +2 Strength. That is how a thin ship becomes a honest clash.`,
      "Prefer that this Ally is already on the Jolly Roger, or about to walk there.",
    );
  }
  if (p.kind === "discardSelect") {
    const selected = after.pending?.kind === "discardSelect" ? after.pending.selected : [];
    const nowOn = selected.includes(instanceId);
    return pack(
      nowOn ? `You marked ${name} to discard.` : `You unmarked ${name}.`,
      "Discarding is a dig for the Map and for cards that still serve the chain. The action will spend even if you confirm with nothing selected.",
      "Keep the Map and affordable ship Allies. Confirm when the pile looks right.",
    );
  }
  if (p.kind === "vanquishHero") {
    const lossWarn = after.pending?.kind === "vanquishConfirmLoss";
    return pack(
      `You named ${name} as the vanquish target.`,
      card?.defId === "peterPan"
        ? after.villainLocation === "jollyRoger" || findCardLocation(before, instanceId) === "jollyRoger"
          ? "Peter on the Jolly Roger is the win check. Meet his Strength with Allies and confirm."
          : "Stop — vanquishing Peter away from the Jolly Roger loses the duel. Cancel unless you are practicing that failure on purpose."
        : `Clearing ${name} uncovers the top row and may remove Tick Tock’s trap or Wendy’s buff.`,
      lossWarn
        ? "A confirm gate is up because this clash loses the practice duel. Cancel unless you mean to practice that failure."
        : "Select Allies until the Strength meets the Hero, then confirm.",
    );
  }
  if (p.kind === "vanquishAllies") {
    return pack(
      `You toggled ${name} into the vanquish party.`,
      "You do not have to spend every Ally if a smaller group meets the number. Lost Boys still need at least two bodies.",
      "Confirm when the total is there. This is the same motion you will use on Peter at the ship.",
    );
  }
  if (p.kind === "fateChooseCard") {
    return pack(
      `You chose to play ${name} from the Fate pair.`,
      card?.defId === "peterPan"
        ? "Peter always lands at Hangman’s Tree. That is the find."
        : card?.defId === "tickTock"
          ? "If you must play the crocodile, park him off the path you still need. The other card is discarded."
          : "The other card is discarded. Play the gentler pressure when you are the one flipping Fate.",
      "If a location or attach choice is next, make it, then read the report before Continue.",
    );
  }
  if (p.kind === "cunningAlly") {
    return pack(
      `You chose ${name} as the free Cunning Ally.`,
      "This Ally skips its Power cost. Put that gift on the Jolly Roger if you can.",
      "Click the glowing place next.",
    );
  }
  if (p.kind === "moveHeroSelect" || p.kind === "starkeyHero") {
    return pack(
      `You picked ${name} to walk.`,
      card?.defId === "peterPan"
        ? "Peter should step toward the Jolly Roger, never away."
        : `Move ${name} only to uncover a row or to ease Tick Tock off your path.`,
      "Click an adjacent unlocked location.",
    );
  }
  if (p.kind === "movePieceSelect" || p.kind === "ayeAyeAlly") {
    return pack(
      `You picked ${name} to reposition.`,
      "Slide toward the Jolly Roger so Strength arrives before Peter does.",
      "Click an adjacent unlocked location.",
    );
  }
  if (p.kind === "fateChooseAttach") {
    return pack(
      `You attached that Fate item to ${name}.`,
      "Attachments raise the cost of a later vanquish. Prefer a side Hero over Peter if you have the choice.",
      "Read the report, then get back to the Map-and-walk chain.",
    );
  }
  if (p.kind === "fateChooseItem" || p.kind === "tinkerDiscard") {
    return pack(
      `You named ${name} for that discard.`,
      "Losing an escort Item or a ship Ally hurts the walk. Losing a spare elsewhere is milder.",
      "The report will stay until Continue so you can read what just fired.",
    );
  }
  if (sameTable(before, after)) return null;
  return pack(`You selected ${name}.`, chainLine(after), `Follow the glowing prompt.${crocWatch(after)}`);
}

function explainConfirm(before: GameState, after: GameState): MoveReason | null {
  const p = before.pending;
  if (p?.kind === "discardSelect") {
    return pack(
      p.selected.length
        ? `You discarded ${p.selected.length} card${p.selected.length === 1 ? "" : "s"}.`
        : "You confirmed Discard with nothing selected.",
      "The action is spent either way. Digging is how most opening voyages actually find the Map.",
      `${chainLine(after)} You can still take other uncovered actions at this stop.`,
    );
  }
  if (p?.kind === "vanquishConfirmLoss") {
    return pack(
      "You chose to continue the off-ship clash with Peter.",
      "This practice duel will lose if you finish the vanquish away from the Jolly Roger. The extra confirm is so first voyages do not trip that trap by accident.",
      "Select Allies if you still mean it, or cancel to name a different Hero.",
    );
  }
  if (p?.kind === "vanquishAllies") {
    const hero = findCard(before, p.heroId);
    const name = hero ? cardName(hero) : "that Hero";
    if (after.won) {
      return pack(
        "You vanquished Peter Pan at the Jolly Roger.",
        "That is the whole chain completed: Map, tree, find, walk, ship clash. This is the motion to practice with kids at a real table — the win check is the place, not just the Strength.",
        "Sail again if you want the same lesson with Coach talking less, or resign from the title when you are done.",
      );
    }
    if (after.lost) {
      return pack(
        `You vanquished ${name} off the Jolly Roger.`,
        "In this practice duel that loses on purpose when the Hero is Peter. The lesson is: walk him to the ship, then clash.",
        "Read the result modal, then sail again. Keep Allies on the Jolly Roger next time before the escort.",
      );
    }
    return pack(
      `You vanquished ${name}.`,
      hero?.defId === "tickTock"
        ? "Clearing the crocodile removes the hand-wipe trap from that square. That is a defensive spend of Allies that often pays for itself."
        : `The top row at that stop opens again. ${chainLine(after)}`,
      "Do not spend the last Allies you needed for Peter unless the ship clash is already honest.",
    );
  }
  if (sameTable(before, after)) return null;
  return pack("You confirmed.", chainLine(after), "Watch the prompt for the next legal click.");
}
