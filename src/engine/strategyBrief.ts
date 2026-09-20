import { def } from "./cards";
import { locName } from "./realm";
import {
  allHeroes,
  allyStrength,
  anyTauntInRealm,
  availableActions,
  cardName,
  coveringHero,
  hasTaunt,
  heroStrength,
  fateEmptyLine,
  mapInRealm,
  playableHandCards,
  vanquishableHeroes,
} from "./queries";
import { LOCATION_IDS, type CardInstance, type GameState, type LocationId } from "./types";

export interface ObjectiveLine {
  key: "map" | "peter" | "walk" | "clash";
  label: string;
  done: boolean;
  status: string;
  current?: boolean;
}

export interface StrategyBrief {
  objective: ObjectiveLine[];
  where: string;
  moment: string;
  setup: string;
}

function peterCard(state: GameState): { hero: CardInstance; location: LocationId } | null {
  return allHeroes(state).find((h) => h.hero.defId === "peterPan") ?? null;
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

function stepsFromRoger(id: LocationId): number {
  return LOCATION_IDS.indexOf(id);
}

function mapInHand(state: GameState): boolean {
  return state.hand.some((c) => c.defId === "neverLandMap");
}

function peterReadyToFinish(state: GameState): boolean {
  const peter = peterCard(state);
  if (!peter || peter.location !== "jollyRoger") return false;
  return vanquishableHeroes(state).some((h) => h.hero.defId === "peterPan");
}

function objectiveLines(state: GameState): ObjectiveLine[] {
  const peter = peterCard(state);
  const mapDone = state.hangmansUnlocked;
  const peterDone = state.peterPanRevealed;
  const atShip = peter?.location === "jollyRoger";
  const ready = peterReadyToFinish(state);

  const mapStatus = mapDone
    ? "Hangman’s Tree is open. Heroes and the captain can step there, so the walk toward the ship can begin."
    : mapInHand(state)
      ? "You are holding the Never Land Map. It is the only key that opens Hangman’s Tree — play it when you can afford 4 Power."
      : "The tree is still locked. Until the Map is played, Peter cannot leave the hideout even if Fate drops him there.";

  let peterStatus: string;
  if (!peterDone) {
    peterStatus =
      "Peter is still hidden in Fate. A Fate action, or a hunt card such as Worthy Opponent, can find him. When he is first found he always lands at Hangman’s Tree, even while that place is locked.";
  } else if (peter) {
    peterStatus = `Peter is ashore at ${locName(peter.location)}. The rest of the chain is about walking him west and meeting him with enough Strength on the ship.`;
  } else {
    peterStatus = "Peter was revealed but is no longer on the table. If he left anywhere except the Jolly Roger after a clash, the practice duel is lost.";
  }

  let walkStatus: string;
  if (!peterDone || !peter) {
    walkStatus = "No walk yet. Finding Peter is the next gate after — or alongside — opening the tree.";
  } else if (!mapDone && peter.location === "hangmansTree") {
    walkStatus =
      "He is at the hideout, but the tree is still locked, so he cannot take a step. Opening it with the Map is what frees the path.";
  } else if (atShip) {
    walkStatus = "He is already on the Jolly Roger. The walk is finished; the last question is whether your crew can win the clash there.";
  } else {
    const n = stepsFromRoger(peter.location);
    walkStatus = `He is ${n} unlocked step${n === 1 ? "" : "s"} from the Jolly Roger (the realm reads ship → Skull Rock → Mermaid Lagoon → Hangman’s Tree). Each Move a Hero action walks him one neighboring place.`;
  }

  let clashStatus: string;
  const need = peter ? heroStrength(state, peter.hero) : 8;
  const have = jrStrength(state);
  const taunted = allHeroes(state).find(({ hero }) => hasTaunt(state, hero.instanceId));
  const tauntBlocks = Boolean(taunted && anyTauntInRealm(state) && !ready);
  if (ready) {
    clashStatus = `Ready to vanquish. Allies at the Jolly Roger can meet Peter’s Strength (${need}). A Vanquish action on the ship completes the chain.`;
  } else if (tauntBlocks && taunted) {
    clashStatus = `Taunt is in the way: ${cardName(taunted.hero)} at ${locName(taunted.location)} must be vanquished first. Peter’s live Strength is ${need}; ship crew is about ${have}.`;
  } else if (atShip) {
    clashStatus = `Peter is on the ship, but the crew there totals about ${have} Strength against his ${need}. Play or slide more Allies onto the Jolly Roger before you open the clash.`;
  } else {
    clashStatus = `The winning clash only counts at the Jolly Roger. Station Allies there now (you have about ${have} Strength on the ship) so you are not scrambling after Peter arrives.`;
  }

  const clashDone = state.won || ready;
  const lines: ObjectiveLine[] = [
    { key: "map", label: "Open Hangman’s Tree", done: mapDone, status: mapStatus },
    { key: "peter", label: peterDone ? "Peter found" : "Find Peter", done: peterDone, status: peterStatus },
    {
      key: "walk",
      label: atShip ? "Peter is on the ship" : "Walk him to the ship",
      done: Boolean(atShip),
      status: walkStatus,
    },
    {
      key: "clash",
      label: ready ? "Ready to vanquish" : tauntBlocks ? "Taunt is in the way" : "Vanquish him there",
      done: clashDone,
      status: clashStatus,
    },
  ];
  const current = lines.find((line) => !line.done);
  if (current) current.current = true;
  return lines;
}

function whereYouAre(state: GameState): string {
  if (state.phase === "title") {
    return "You are still at the title. Tutorial starts Coach and this briefing together so the first voyage teaches the chain, not just the clicks.";
  }
  if (state.won) {
    return "The table is settled. Peter was vanquished at the Jolly Roger after the Map opened the tree and the walk across the realm.";
  }
  if (state.lost) {
    return state.loseReason
      ? `${state.loseReason} Read the chain again before the next voyage: Map, tree, find Peter, walk, clash only on the ship.`
      : "The tide turned. The usual break is clashing Peter away from the Jolly Roger, or stepping onto Tick Tock with a hand you still needed.";
  }

  const loc = locName(state.villainLocation);
  const cover = coveringHero(state, state.villainLocation);
  const croc = tickTockAt(state);
  const hand = state.hand.length;
  const playable = playableHandCards(state).length;
  const tree = state.hangmansUnlocked
    ? "Hangman’s Tree is unlocked."
    : "Hangman’s Tree is locked — treat that as a closed gate, not scenery.";

  const handNote =
    hand === 0
      ? "Your hand is empty. That usually means Tick Tock just snapped it, or you spent everything; ending the turn is how you draw back to four."
      : hand <= 2
        ? `Your hand is thin (${hand} card${hand === 1 ? "" : "s"}). A Discard now digs, but it also spends cards you may want for the ship.`
        : `You hold ${hand} cards${playable ? `, and ${playable} look playable with your current Power` : ""}. A full hand is a good time to Discard junk if you are still hunting the Map.`;

  const coverNote = cover
    ? ` ${cardName(cover)} is standing on ${loc}, so the top-row actions here stay covered until that Hero leaves or is clashed.`
    : ` No Hero is covering the top row at ${loc}, so both printed rows are usable if you have not spent them yet.`;

  const crocNote = croc
      ? ` Tick Tock is at ${locName(croc)}. Sharing that place with the captain — stepping there, or sliding the crocodile onto him — empties the whole hand.`
    : " Tick Tock is not ashore, so movement is safer than it will be later.";

  const fateNote = fateEmptyLine(state);
  const fateCue = fateNote ? ` ${fateNote}` : "";

  return `The captain is at ${loc} with ${state.power} Power on turn ${state.turn}. ${tree}${coverNote}${crocNote} ${handNote}${fateCue} Allies already on the Jolly Roger total about ${jrStrength(state)} Strength — that number is the late-game clock.`;
}

function thisMoment(state: GameState): string {
  if (state.won) {
    return "There is no more decision. The practice chain is complete: the Map opened the hideout, Peter was found, he walked to the ship, and the clash happened in the only place that counts.";
  }
  if (state.lost) {
    return "The duel is over. Use the log and this brief to see which gate broke — a locked tree, a clash off the ship, or a crocodile emptying the hand — then sail again.";
  }

  const p = state.pending;
  if (state.phase === "move" && !p) {
    return "This is the required move. Every turn the captain must leave the current unlocked place before any actions fire. That rule is the spine of the evening: you are choosing which toolbox you will get this turn — Power at the lagoon, Discard and Fate at Skull Rock, Vanquish and Play on the ship, or Move a Hero at the tree. You cannot stay put to “finish up.” Pick the stop that serves the next gate on the chain.";
  }

  if (!p && state.phase === "actions") {
    const live = availableActions(state).filter((a) => a.available);
    const names = live.map((a) => a.label).join(", ") || "none still unused";
    return `This is the action stretch at ${locName(state.villainLocation)}. After the move, you may use each uncovered action here once, in any order, or you may end the turn. Heroes cover only the top printed row; extra Item actions are never covered. Available right now: ${names}. Spend what advances the chain (Power for the Map, Play for the Map or Allies, Move a Hero once Peter can walk, Vanquish only when the ship clash is honest), then stop. Drawing back to four and facing Fate is part of the rhythm, not a failure.`;
  }

  if (!p) {
    return "The table is between beats. Watch the prompt — as soon as a phase is ready, this briefing will name what the rules are asking and why that beat exists.";
  }

  switch (p.kind) {
    case "playChooseCard":
      return "You opened a Play action, so the decision is which card earns the slot. This is not “play something because it glows.” The Map opens the tree. Allies belong on the Jolly Roger so Strength is waiting. Hunt cards (Worthy Opponent, Give Them a Scare) fish Fate when Peter is still hidden. Escort pieces (the Device, Mr. Starkey, Aye Aye Sir) matter after the tree is open. If nothing serves those jobs, you can cancel and keep the rest of the turn.";
    case "playChooseLocation":
      return "The card is chosen; now it needs a place. Allies and ship gear want the Jolly Roger so the final clash is stocked. The Map can sit anywhere unlocked — playing it is what opens the tree, not the square you drop it on. Items that add extra actions belong where you will actually stand to use them.";
    case "playChoosePayment":
      return mapInRealm(state)
        ? "An Item is asking for its cost. The Never Land Map is in the realm, so you may spend Power or discard the Map instead. Once the tree is open, keeping the Map is usually wiser."
        : "This card is asking for its printed Power cost. Pay with Power to finish the play — there is no Map in the realm to substitute.";
    case "playChooseAllyAttach":
      return "The Cutlass wants an Ally to wear it — that is +2 Strength on that crew. Use the picker and tap Strap Cutlass to the Ally you want, or click that Ally’s card on the board. Prefer someone already on the Jolly Roger, or the Ally you will walk there. Cancel puts you back on Play a Card if this was the wrong tool.";
    case "discardSelect":
      return "A Discard action lets you throw cards away so the deck can offer new ones. It still spends the action even if you toss nothing. Keep the Map. Keep hunt cards while Peter is hidden. Keep Allies you can still afford if the ship is light. Toss the rest — digging for the Map is how most opening voyages actually start.";
    case "vanquishHero":
      return "You opened Vanquish, so you are naming a Hero at the captain’s current place — or a neighboring unlocked Hero a Boarding Party can reach. Remote clashes from across the realm are not legal. Peter only counts as a win on the Jolly Roger. Clashing him anywhere else loses this practice duel on purpose, so the lesson sticks. Tick Tock is worth clearing if the Strength is there, because the crocodile empties your hand if you later step onto him.";
    case "vanquishConfirmLoss":
      return "You named Peter away from the Jolly Roger. This practice duel treats that clash as an instant loss so the ship-only lesson sticks. A confirm gate is up so first voyages can back out. Cancel unless you mean to practice that failure.";
    case "vanquishAllies":
      return "The Hero is named; now you tap Allies until their Strength meets that Hero. Watch the live Strength meter in the prompt. You do not have to spend everyone if a smaller group is enough. Confirm when the total is there. This is the same motion you will use on Peter at the ship — practice the count now.";
    case "moveHeroSelect":
    case "moveHeroDest":
    case "starkeyHero":
    case "starkeyDest":
      return "This is a one-step Hero walk on the unlocked realm. The educational job is almost always Peter: slide him toward the Jolly Roger, never away, and never clash him mid-path. Other Heroes are worth moving only to uncover a top-row action you still need, or to ease Tick Tock off a place you must visit.";
    case "movePieceSelect":
    case "movePieceDest":
    case "ayeAyeAlly":
    case "ayeAyeDest":
      return "You are sliding an Ally or loose Item one unlocked step. Think of it as logistics for the ship. Crew on Skull Rock or the lagoon is late-game Strength that has not arrived yet. Aye Aye Sir also grants a temporary +2, which is a fine way to push someone onto the Jolly Roger the turn you might clash.";
    case "fateChooseCard":
    case "fateChooseLocation":
    case "fateChooseAttach":
    case "fateChooseItem":
    case "worthyLocation":
      return "This is your Fate action — you are the one flipping the other deck. If Peter is in the pair, play him: he lands at Hangman’s Tree. Park Tick Tock off the lagoon and the tree if you can. Other Heroes should cover the fewest actions you still need. This beat exists so you can hunt Peter without waiting for the computer’s turn.";
    case "fateReport":
      if (p.resume === "nextTurn") {
        return "Fate has already acted. This modal stays up with the full paraphrased card text until you press Continue — it will not auto-dismiss. Read what landed: who is covering your next stop, whether Peter appeared, whether Tick Tock is now on a place you wanted to walk. Then acknowledge. The next required move will use that new map of the realm.";
      }
      if (p.played?.defId === "tickTock" && !p.markAction) {
        return "You stepped onto Tick Tock. The hand wipe already happened; this modal is here so you can read the crocodile’s lasting text before you take any more actions. Continue is required. Click the board mini later to inspect the same wording again.";
      }
      return "The Fate card is already seated or spent. Stay on this modal and read the full paraphrased ability — hover titles are not enough — then press Continue before the board takes focus again.";
    case "scarePeek":
      return "You peeked at two Fate cards without revealing them. Looking is not finding Peter — a peek will not force him onto the tree. You may discard both to the Fate discard (they can return when Fate reshuffles), or put them back in either order. If Peter is in the peek, return him on top so the next real Fate flip can find him. If the crocodile or a headache is there, discarding both is often the kinder table.";
    case "obsessionDecide":
    case "obsessionLocation":
      return "Obsession hunted a Hero out of Fate. If it is Peter, play him — he still goes to Hangman’s Tree. If it is Tick Tock, sending him out of the realm saves your hand later. This is a practice-only trigger: you may fire it on your own turn while Peter is still hidden, because there is no opponent’s turn here.";
    case "cunningAlly":
    case "cunningLocation":
    case "conditionOffer":
      return "A Condition is ready. In this solo tool those cards do not wait for an opponent. Cunning lets a free Ally come ashore if a Strength-4 Hero is already out — drop that Ally on the ship. Obsession hunts a Hero while Peter is hidden. Playing the Condition is usually the lesson; skipping it is legal if the board is already loud.";
    case "tinkerDiscard":
      return "A newly placed Hero may discard one Ally at that same place. Skipping keeps your crew. Allies on the Jolly Roger are the clash that finishes Peter, so do not feed them away unless the Ally was stranded and useless.";
    default:
      return "Follow the glowing legal targets. This targeting step is still part of the same chain — Map, tree, find Peter, walk, clash on the ship — not a side puzzle.";
  }
}

function whatItSetsUp(state: GameState): string {
  if (state.won) {
    return "What it set up was the whole voyage. You can Resign or Play again and watch the same gates from the other side of the table — Fate will try to cover them.";
  }
  if (state.lost) {
    return "The next voyage is the setup. Open the tree before you walk Peter, keep Strength on the ship before he arrives, and never clash him on the path. That is the whole curriculum.";
  }

  const peter = peterCard(state);
  const parts: string[] = [];

  if (peterReadyToFinish(state)) {
    parts.push(
      "You are at the last gate. A Vanquish on the Jolly Roger, with enough Allies tapped, is the win — not a bonus action. Everything earlier (Map, hunt, walk, stacking crew) existed to make this clash legal and safe.",
    );
    parts.push(
      "If a Hero is covering the ship’s top row, that does not block Vanquish on the bottom. Take the clash. Celebrating early by ending the turn only hands Fate another chance to pile Strength on Peter.",
    );
    return parts.join(" ");
  }

  if (peter && peter.location === "jollyRoger") {
    parts.push(
      `Peter is already on the ship, so the mid-game walk is over. The setup now is Strength: you have about ${jrStrength(state)} on the Jolly Roger against his ${heroStrength(state, peter.hero)}. Play Allies there, strap a Cutlass, or slide crew in with Move Ally/Item.`,
    );
    parts.push(
      "Do not wander off hunting more Fate unless you truly cannot make the number. Extra Heroes only make the clash taller. When the total is there, stand on the ship and Vanquish.",
    );
    return parts.join(" ");
  }

  if (peter && state.hangmansUnlocked && peter.location !== "jollyRoger") {
    parts.push(
      `The tree is open and Peter is at ${locName(peter.location)}. The mid-game is an escort. Move a Hero (printed at Hangman’s Tree, or from the Device) walks him one step toward the Jolly Roger. Mr. Starkey can nudge a Hero when he comes ashore.`,
    );
    parts.push(
      `At the same time, keep stacking Allies on the ship — you are at ${jrStrength(state)} Strength there. Walking him in before the crew is ready just gives Fate a turn to sit on the clash. Never vanquish him on the path; that ends the practice duel as a loss.`,
    );
    if (tickTockAt(state)) {
      parts.push("And keep the captain off Tick Tock’s square while you do this. An empty hand mid-escort is how the walk stalls.");
    }
    return parts.join(" ");
  }

  if (peter && !state.hangmansUnlocked) {
    parts.push(
      "Peter is already on the table, but Hangman’s Tree is still locked, so he cannot start the walk. The Map is now urgent, not optional. Gain Power if you hold it and cannot afford 4; Discard if it is still in the deck; Play it the moment you can.",
    );
    parts.push(
      "Finding him early is not a mistake — it is a clock. Use the turns while he waits to park Allies on the Jolly Roger so the clash is built before the path opens.",
    );
    return parts.join(" ");
  }

  if (mapInHand(state)) {
    const afford = state.power >= def("neverLandMap").cost;
    parts.push(
      afford
        ? "You are holding the Never Land Map with enough Power. Playing it is the setup for everything else: the tree opens, Peter can leave, Move a Hero starts to matter, and the ship becomes a destination instead of a dream."
        : `You are holding the Map but have ${state.power} Power (it costs 4). This stretch is a Power engine — Mermaid Lagoon’s Gain 3 is the fastest bank — so the next Play action can actually drop the key.`,
    );
    parts.push(
      "After it is down, the mid-game splits: hunt Peter if he is still hidden, and keep feeding Allies to the Jolly Roger so you are not poor when the walk begins.",
    );
    return parts.join(" ");
  }

  if (!state.hangmansUnlocked) {
    parts.push(
      "Early game is a Power-and-dig problem. The Map is the only key to Hangman’s Tree, and without that gate Peter cannot walk even if Fate finds him. Bank toward 4 Power, Discard cards that are not the Map or a hunt, and Play the Map the turn it appears.",
    );
    parts.push(
      "While you dig, cheap Allies can still go to the Jolly Roger. That is not distraction — it is the late-game clash arriving early. Fate will try to cover rich actions and park trouble on the lagoon; move around Tick Tock and keep the chain in mind: Map, tree, find, walk, ship clash.",
    );
    return parts.join(" ");
  }

  parts.push(
    "The tree is open and Peter is still hidden, so the setup is a hunt. Fate actions, Worthy Opponent, Give Them a Scare, and Obsession exist to flip him onto Hangman’s Tree. You do not need to wait politely for the computer.",
  );
  parts.push(
    `Meanwhile the ship should not sit empty — you have about ${jrStrength(state)} Strength there. An Ally played “too early” is an Ally you will not have to find later while Peter is already walking. When he appears, switch immediately to escort plus clash math.`,
  );
  return parts.join(" ");
}

export function strategyBrief(state: GameState): StrategyBrief {
  return {
    objective: objectiveLines(state),
    where: whereYouAre(state),
    moment: thisMoment(state),
    setup: whatItSetsUp(state),
  };
}
