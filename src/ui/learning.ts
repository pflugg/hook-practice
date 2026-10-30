import type { CardInstance, GameState } from "../engine/types";
import type { LessonStep } from "../engine/lesson";
import { lessonClashBoard, lessonOpening } from "../engine/lesson";
import { hourEqualVanquishScene, nearWinScene } from "../engine/scenes";

export interface DrillPlan {
  id: string;
  label: string;
  works: boolean;
  feedback: string;
}

/** Setups are teaching fixtures; every action still uses the unchanged game reducer. */
export interface DrillSetup {
  id: string;
  name: string;
  level: "core" | "twist";
  focus: string;
  task: string;
  question: string;
  plans: readonly DrillPlan[];
  hints: readonly string[];
  takeaway: string;
  feedback?: (state: GameState) => string;
  open: () => GameState;
  complete: (state: GameState) => boolean;
}

export interface PracticeDrill {
  id: string;
  title: string;
  skill: string;
  setups: readonly DrillSetup[];
}

export interface DrillRun {
  drill: PracticeDrill;
  setup: DrillSetup;
  plans: readonly DrillPlan[];
  attempts: string[];
  chosen: string | null;
  started: boolean;
  guided: boolean;
  hintsShown: number;
}

/** Rotate the board; shuffle the choices once, never during a rerender. */
export function startDrill(drill: PracticeDrill, previousSetup?: string, sameSetup = false, guided = false): DrillRun {
  const previous = drill.setups.findIndex((setup) => setup.id === previousSetup);
  const index = previous < 0 ? 0 : sameSetup ? previous : (previous + 1) % drill.setups.length;
  const setup = drill.setups[index];
  if (!setup) throw new Error(`No setup for drill ${drill.id}`);
  const plans = [...setup.plans];
  for (let i = plans.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = plans[i];
    const b = plans[j];
    if (a && b) { plans[i] = b; plans[j] = a; }
  }
  return { drill, setup, plans, attempts: [], chosen: null, started: guided, guided, hintsShown: guided ? setup.hints.length : 0 };
}

export function chosenPlan(run: DrillRun): DrillPlan | undefined {
  return run.plans.find((plan) => plan.id === run.chosen);
}

function card(state: GameState, defId: string): CardInstance {
  return { instanceId: `${defId}-drill-${state.instanceSeq++}`, defId };
}

function combatSetup(wendy: boolean): GameState {
  const state = hourEqualVanquishScene();
  state.hand = [];
  if (wendy) {
    state.locations.mermaidLagoon.heroes.push(card(state, "wendy"));
    state.locations.jollyRoger.allies.push(card(state, "pirateBrute"));
  }
  return state;
}

function escortSetup(lagoon: boolean): GameState {
  const state = nearWinScene();
  if (lagoon) {
    state.locations.mermaidLagoon.heroes = state.locations.skullRock.heroes;
    state.locations.hangmansTree.items = state.locations.skullRock.items;
    state.locations.skullRock.heroes = [];
    state.locations.skullRock.items = [];
    state.villainLocation = "hangmansTree";
    state.peterPanLocation = "mermaidLagoon";
  }
  return state;
}

function shipSetup(dust: boolean): GameState {
  const state = lessonClashBoard(lessonOpening());
  const peter = state.locations.jollyRoger.heroes[0];
  if (dust && peter) {
    state.attachments.push({ item: card(state, "pixieDust"), attachedTo: peter.instanceId });
    state.hand.push(card(state, "cutlass"));
    state.power = 1;
  }
  return state;
}

const tinkerDefeated = (state: GameState) => state.voyage.lastClash?.heroName === "Tinker Bell";

export const PRACTICE_DRILLS: readonly PracticeDrill[] = [
  {
    id: "equal-strength",
    title: "Make the numbers work",
    skill: "Combat · 2 setups",
    setups: [
      {
        id: "combat-equal", name: "An even match", level: "core", focus: "Match Strength",
        task: "Clear Tinker Bell from the Jolly Roger. Check the Strength numbers before choosing your crew.",
        question: "Which plan clears this Hero with the crew already here?",
        plans: [
          { id: "equal-crew", label: "Vanquish with the Swashbuckler alone", works: true, feedback: "Tinker Bell is 2 and the Swashbuckler is 2. Equal Strength is enough. Both cards will be discarded in the clash." },
          { id: "wait-for-more", label: "Wait for more crew before trying", works: false, feedback: "You already have enough Strength at the ship. Recheck whether the rules require more than the Hero’s number." },
          { id: "move-hook", label: "Move Hook away before defeating her", works: false, feedback: "Hook has already moved this turn. The open Vanquish action can finish this setup now, using the crew with Tinker Bell." },
        ],
        hints: ["Compare the Strength bubbles on the Hero and Ally.", "Use Vanquish, select Tinker Bell, select the Swashbuckler, then Confirm."],
        takeaway: "Equal Strength is enough to vanquish. The Hero and the Allies you use are discarded; you do not need to overpay with extra crew.",
        open: () => combatSetup(false), complete: tinkerDefeated,
      },
      {
        id: "combat-wendy", name: "A changed number", level: "twist", focus: "Read buffs and save crew",
        task: "Clear Tinker Bell from the Jolly Roger while saving as much crew as you can. Read the other Heroes too.",
        question: "Which crew plan meets her current Strength and saves an Ally?",
        plans: [
          { id: "swash-only", label: "Use the Swashbuckler alone", works: false, feedback: "Wendy gives each other Hero +1 Strength. Tinker Bell is now 3, so a Strength-2 Swashbuckler cannot meet her." },
          { id: "both-allies", label: "Use both Allies together", works: false, feedback: "That would be legal, but it spends 6 Strength against 3 and discards both Allies. Find a plan that keeps one Ally." },
          { id: "brute-only", label: "Use the Pirate Brute alone", works: true, feedback: "Wendy makes Tinker Bell 3. The Brute’s 4 meets that number and leaves the Swashbuckler for a later clash." },
        ],
        hints: ["Wendy changes other Heroes’ Strength anywhere in the realm. Use the current bubble, not just the Hero’s base number.", "Vanquish Tinker Bell with the Brute’s 4 Strength; leave the Swashbuckler unselected."],
        takeaway: "Read current Strength after Fate effects. A smaller sufficient crew preserves Allies for your next clash.",
        feedback: (state) => state.voyage.lastClash?.allyStrength === 4
          ? "You used 4 Strength against Tinker Bell’s 3 and kept the Swashbuckler. That matches your saving plan."
          : `Your clash was legal. You committed ${state.voyage.lastClash?.allyStrength ?? 0} Strength against 3; the Brute alone would have kept the Swashbuckler in play.`,
        open: () => combatSetup(true), complete: tinkerDefeated,
      },
    ],
  },
  {
    id: "escort",
    title: "Bring Peter aboard",
    skill: "Escorting · 2 setups",
    setups: [
      {
        id: "escort-ship", name: "One shore from home", level: "core", focus: "Move a Hero",
        task: "Bring Peter one shore closer to the ship. Keep the waiting crew in place.",
        question: "Which plan moves Peter toward the objective?",
        plans: [
          { id: "move-hook", label: "Move Hook to the ship", works: false, feedback: "Moving Hook does not move Peter. Peter is still at Skull Rock, and Hook has already moved this turn." },
          { id: "device-west", label: "Use the Device to move Peter to the Jolly Roger", works: true, feedback: "The Device adds Move a Hero at Skull Rock. Peter can move one adjacent shore west, onto the ship; the Allies stay put." },
          { id: "vanquish-here", label: "Defeat Peter at Skull Rock", works: false, feedback: "Hook’s objective requires Peter to be defeated at the Jolly Roger. Keep him alive on the path and escort him there." },
        ],
        hints: ["Read the Item at Hook’s shore. It adds an action that moves a Hero without moving the captain.", "Use Move a Hero (Device), choose Peter, then choose the Jolly Roger."],
        takeaway: "Moving Hook and moving a Hero are different actions. An Item can add the escort action you need. Peter must reach the ship before the winning clash.",
        open: () => escortSetup(false), complete: (state) => state.peterPanLocation === "jollyRoger" && !state.lost,
      },
      {
        id: "escort-lagoon", name: "Two moves, one turn", level: "twist", focus: "Chain extra actions",
        task: "Peter is at Mermaid Lagoon. Bring him onto the ship this turn without moving the waiting crew.",
        question: "Which plan uses the actions at Hook’s shore to finish the escort now?",
        plans: [
          { id: "jump-to-ship", label: "Move Peter straight to the Jolly Roger", works: false, feedback: "Peter is at Mermaid Lagoon. Move a Hero travels one adjacent unlocked shore; the ship is two steps away." },
          { id: "move-once", label: "Move Peter once, then end the turn", works: false, feedback: "One step reaches Skull Rock, but Peter can reach the ship this turn. Look for two separate Move a Hero actions at Hangman’s Tree." },
          { id: "lagoon-west", label: "Use both Move a Hero actions to walk Peter west twice", works: true, feedback: "Hangman’s Tree has a printed Move a Hero and another from the Device. Use each once: Lagoon → Skull Rock → ship. The Hero can be elsewhere in the realm when you take the action." },
        ],
        hints: ["The tree offers two separate Hero moves: one printed and one from the Device. Each action can be used once, and can move a Hero elsewhere in your realm.", "Use one Move a Hero to take Peter from Lagoon to Skull Rock. Use the other to take him from Skull Rock to the Jolly Roger."],
        takeaway: "Extra Item actions create a bigger turn. Plan the full sequence, and remember that Hook’s action location can differ from the Hero’s location.",
        open: () => escortSetup(true), complete: (state) => state.peterPanLocation === "jollyRoger" && !state.lost,
      },
    ],
  },
  {
    id: "ship-clash",
    title: "Finish the voyage",
    skill: "Planning the win · 2 setups",
    setups: [
      {
        id: "clash-ready", name: "Take the opening", level: "core", focus: "Recognize the winning clash",
        task: "Defeat Peter at the Jolly Roger. Check the Hero, your crew, and the available actions.",
        question: "Which plan wins from this setup now?",
        plans: [
          { id: "clash-now", label: "Vanquish Peter with both Brutes now", works: true, feedback: "The two Brutes total 8 and Peter is 8. Hook is at the ship with Peter, and the bottom-row Vanquish is open. You have the winning clash." },
          { id: "wait-for-more", label: "End the turn to find more Strength", works: false, feedback: "Your crew already meets Peter’s 8. Ending the turn is unnecessary when a legal winning clash is available." },
          { id: "move-peter", label: "Move Peter away before fighting", works: false, feedback: "Peter is already at the required destination. Moving him off the ship would put the objective farther away." },
        ],
        hints: ["Add your Allies’ current Strength and compare it with Peter’s bubble. Check the location too.", "Use Vanquish, choose Peter, select both Brutes, then Confirm at 8 / 8."],
        takeaway: "Check location, current Strength, and available actions. When you have a legal winning clash, take it.",
        open: () => shipSetup(false), complete: (state) => state.won,
      },
      {
        id: "clash-dust", name: "Prepare before the clash", level: "twist", focus: "Sequence a strengthening play",
        task: "Defeat Peter at the Jolly Roger. Check the Hero, your crew, and the resources in your hand.",
        question: "Which plan can win this turn after the Fate change?",
        plans: [
          { id: "clash-now", label: "Vanquish immediately with both Brutes", works: false, feedback: "Pixie Dust gives Peter +2, so he is 10. The Brutes total only 8. The clash cannot be confirmed at that Strength." },
          { id: "arm-then-clash", label: "Attach the Cutlass, then Vanquish with both Brutes", works: true, feedback: "You have 1 Power, a Cutlass costing 1, and an open Play action. Its +2 makes your crew total 10, matching Peter. Prepare first, then clash." },
          { id: "defeat-elsewhere", label: "Defeat Peter away from the ship", works: false, feedback: "Hook still needs the clash at the Jolly Roger. Change your Strength, not Peter’s required destination." },
        ],
        hints: ["Read Pixie Dust on Peter and the Item in your hand. Compare both current Strength and costs.", "Play the Cutlass onto a Brute and pay 1 Power. Then Vanquish Peter with both Brutes at 10 / 10."],
        takeaway: "A plan that worked before Fate may no longer work. Count current Strength and prepare the extra Strength before opening the winning clash.",
        open: () => shipSetup(true), complete: (state) => state.won,
      },
    ],
  },
];

export const LESSON_INSIGHTS: Record<LessonStep, string> = {
  move: "Choose your toolbox: Hook must move to a different unlocked shore before using its actions.",
  gain: "Power pays for cards. Your 3 Power plus Gain 1 covers the Map’s cost of 4.",
  play: "An action lets you play one card; paying its cost completes the play. The Map permanently opens the tree.",
  fate: "Read what changed before continuing. This solo adversary Fates you every turn; humans choose whether to Fate.",
  escort: "Move a Hero shifts Peter one adjacent shore. It does not move Hook. You are bringing Peter toward the ship.",
  clash: "Lesson setup: we skipped the remaining walk and placed two Brutes on the ship. Choose both: 4 + 4 meets Peter’s 8.",
};

export const TABLE_HABITS = [
  ["Fate another villain", "At a human table your Fate action targets an opponent. Here it is practice self-Fate, and the computer Fates you after every turn."],
  ["Place cards across your realm", "The published rules generally let you play Allies and Items to any unlocked location. This trainer restricts them to Hook’s location; attached Items follow their own targeting rules."],
  ["Separate action location from clash location", "At a table, an available Vanquish action can target a Hero anywhere in your realm, using Allies at that Hero’s location. This trainer limits targets to Hook’s location or a neighboring Hero reachable by a Boarding Party."],
  ["Watch other players’ turns", "Printed Cunning and Obsession use opponents’ turns and their printed triggers. This solo trainer rewrites those triggers for your own turn."],
  ["Race people, not a meter", "The rival track is a solo practice clock. In a human game, watch each opponent’s objective and decide when to interfere."],
  ["Keep Peter’s destination in mind", "Only defeating Peter at the Jolly Roger wins. This trainer ends the voyage if you defeat him elsewhere; the table game does not impose that instant loss."],
] as const;
