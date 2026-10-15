import {
  advise,
  actionsAreLive,
  applyInput,
  availableActions,
  cardName,
  def,
  findCard,
  HEADACHE_NO_ITEM_BANNER,
  HEADACHE_NO_ITEM_NOTE,
  emptyHandCopy,
  fateEmptyLine,
  fateShowStillInPlay,
  highlightSet,
  isNoItemFateDiscard,
  resignBlocked,
  promptText,
  REALM,
  selectedSet,
  strategyBrief,
  endgameRecap,
  explainSelection,
  IDLE_MOVE_REASON,
  liveMoveReason,
  titleState,
  type CardInstance,
  type CoachAdvice,
  type Difficulty,
  type GameState,
  type Input,
  type LocationId,
  type StrategyBrief,
  type MoveReason,
} from "../engine";
import { advanceLesson, lessonOpening, lessonView, type LessonStep, type LessonView } from "../engine/lesson";
import { coachPlan, type PlanStage } from "../engine/coachPlan";
import { RIVAL_LOSE_REASON, rivalGoal } from "../engine/rival";
import { motionReduced, travelDelta, type Box } from "./motion";
import { armSound, cueFromTransition, playCue, rivalInWarningBand, setSoundMuted, soundMuted } from "./sound";
import { LOCATION_IDS } from "../engine/types";
import {
  allAllies,
  allLocationItems,
  allyStrength,
  attachmentsOn,
  heroStrength,
  mapInRealm,
  vanquishClashMath,
} from "../engine/queries";
import {
  bounceLoopScene,
  cutlassAttachScene,
  dragHeroScene,
  easyFizzleScene,
  fateSpentScene,
  lagoonCoverScene,
  mapReserveScene,
  nearWinScene,
  rivalLossScene,
  obsessionDecideScene,
  tauntDigScene,
  payNoMapScene,
  peterSoftConfirmScene,
  tickTockOntoCaptainScene,
  tickTockReportScene,
  hourEqualVanquishScene,
  victoryScene,
  rivalDefeatScene,
  hourPlaytestMoveScene,
  hourPlaytestTauntScene,
  hourPlaytestWhyScene,
  vanquishClashScene,
  vanquishLocalScene,
  worthySeatScene,
} from "../engine/scenes";
import { resolveBoardClick } from "./clicks";
import { parseDifficulty, parseLocationId } from "./parse";
import { dropTargets, inputsForDrop, isDraggableCard } from "./drag";
import { CAPTAIN_TOKEN, CREST, locationDecor, MAP_COAST, MAP_COMPASS, TITLE_SCENE, TOPBAR_MAP, TREASURE_MAP } from "./decor";
import "./styles.css";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

const NO_EXPANDED: ReadonlySet<string> = new Set();

const SHORE_SHORT: Record<LocationId, string> = {
  jollyRoger: "Ship",
  skullRock: "Skull",
  mermaidLagoon: "Lagoon",
  hangmansTree: "Tree",
};

function soundToggle(): string {
  const on = !soundMuted();
  return `<button type="button" class="ctrl ${on ? "is-on" : ""}" data-sound-toggle aria-pressed="${on ? "true" : "false"}">${on ? "Sound on" : "Sound off"}</button>`;
}

function typeLabel(t: string): string {
  const head = t[0];
  if (!head) return t;
  return head.toUpperCase() + t.slice(1);
}

function renderCard(
  state: GameState,
  card: CardInstance,
  opts: {
    size?: "mini" | "hand" | "reveal";
    legal: boolean;
    selected: boolean;
    dimmed?: boolean;
    coached?: boolean;
    inspectable?: boolean;
    expandable?: boolean;
    expanded?: boolean;
    handRule?: boolean;
  },
): string {
  const d = def(card.defId);
  const size = opts.size === "hand" ? "hand-card" : opts.size === "mini" ? "mini" : opts.size === "reveal" ? "reveal" : "";
  const str = d.type === "hero" ? heroStrength(state, card) : d.type === "ally" ? allyStrength(state, card) : 0;
  const attached = attachmentsOn(state, card.instanceId);
  const attachNote = attached.length ? `<p class="text">+ ${attached.map((a) => esc(def(a.defId).name)).join(", ")}</p>` : "";
  const inspectable = Boolean(opts.inspectable && !opts.legal && opts.size !== "reveal");
  const draggable = isDraggableCard(state, card.instanceId);
  const spentObsession = d.id === "obsession" && state.peterPanRevealed;
  const costMark = d.deck === "villain" ? String(d.cost) : "Fate";
  const typeBar =
    opts.size === "hand"
      ? `<div class="type-bar" data-type="${d.type}"><span class="type-name">${esc(d.type.toUpperCase())}</span><span class="type-dot" aria-hidden="true">·</span><span class="type-cost" title="Power cost">${esc(costMark)}</span></div>`
      : `<div class="meta">
      <span class="badge">${typeLabel(d.type)}</span>
      ${d.deck === "villain" ? `<span class="cost" title="Power cost">${d.cost}</span>` : `<span class="fate-mark">Fate</span>`}
    </div>`;
  const cardText = spentObsession
    ? "Peter is already in the realm. This hunt is spent — discard it if you want the slot."
    : d.text;
  return `<button type="button" class="card ${d.type} ${size} ${opts.legal ? "is-legal" : ""} ${opts.selected ? "is-selected" : ""} ${opts.dimmed ? "is-dimmed" : ""} ${opts.coached ? "is-coached" : ""} ${inspectable ? "is-inspectable" : ""} ${draggable ? "is-draggable" : ""} ${spentObsession ? "is-spent" : ""} ${opts.expanded ? "is-expanded" : ""}" data-card="${card.instanceId}" ${spentObsession ? 'data-spent="obsession"' : ""} title="${esc(d.name)} — ${esc(cardText)}" aria-label="${esc(d.name)}. ${esc(cardText)}">
    ${opts.legal && opts.size === "hand" && (state.pending?.kind === "playChooseCard" || state.pending?.kind === "cunningAlly") ? `<span class="playable-tag">Playable</span>` : ""}
    ${spentObsession ? `<span class="spent-tag">Spent</span>` : ""}
    ${typeBar}
    <h3>${esc(d.name)}</h3>
    <p class="text">${esc(cardText)}</p>
    ${opts.handRule ? `<span class="hand-rule" data-hand-rule="${card.instanceId}">Rule</span>` : ""}
    ${opts.expandable ? `<span class="rule-toggle" data-rule-toggle="${card.instanceId}">${opts.expanded ? "Less" : "More"}</span>` : ""}
    ${attachNote}
    ${d.type === "hero" || d.type === "ally" ? `<div class="str" title="Strength" aria-label="Strength ${str}">${str}</div>` : ""}
  </button>`;
}

function abilityReadout(title: string, text: string): string {
  if (!text) return "";
  return `<div class="ability-readout">
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
  </div>`;
}

function rivalMeter(state: GameState): string {
  const goal = rivalGoal(state.coachOn, state.difficulty);
  const shown = Math.min(goal, Math.max(0, state.rivalProgress));
  const pct = Math.round((shown / goal) * 100);
  const full = shown >= goal;
  const close = full || rivalInWarningBand(state);
  return `<div class="rival-meter${full ? " is-full" : ""}${close ? " is-close" : ""}" data-rival-meter role="meter" aria-label="Rival villain progress" aria-valuemin="0" aria-valuenow="${shown}" aria-valuemax="${goal}" title="If the rival reaches ${goal} before you vanquish Peter Pan at the Jolly Roger, you lose.">
    <span>Rival</span>
    <span class="rival-track" aria-hidden="true"><i style="width:${pct}%"></i><span class="rival-token" style="left:${pct}%"></span></span>
    <b>${shown} / ${goal}</b>
  </div>`;
}

function clashMeter(
  math: ReturnType<typeof vanquishClashMath>,
): string {
  if (!math) return "";
  const boys = math.lostBoys ? ` · Allies ${math.selectedAllies}/2` : "";
  const status = math.ready ? "ready" : "short";
  return `<div class="clash-meter ${math.ready ? "is-ready" : "is-short"}" role="status" data-clash-meter>
    <b>Strength ${math.selected} / ${math.need} — ${status}</b>
    <span class="clash-hero">${esc(math.heroName)}${boys}</span>
  </div>`;
}

function noItemDiscardBanner(): string {
  return `<aside class="fate-discard-banner" data-no-item-discard role="status">
    <p>${esc(HEADACHE_NO_ITEM_BANNER)}</p>
  </aside>`;
}

function zone(title: string, body: string, kind: string): string {
  return `<div class="zone zone-${kind}"><h3>${title}</h3>${body}</div>`;
}

function cardDimmed(state: GameState, card: CardInstance, hi: Set<string>): boolean {
  const kind = state.pending?.kind;
  if (kind === "vanquishAllies" && def(card.defId).type === "ally" && !hi.has(`card:${card.instanceId}`)) return true;
  if (kind === "vanquishHero" && def(card.defId).type === "hero" && !hi.has(`card:${card.instanceId}`)) return true;
  if (kind && ["playChooseCard", "discardSelect", "cunningAlly"].includes(kind) && !hi.has(`card:${card.instanceId}`)) {
    return true;
  }
  return false;
}

function shouldRefuseCard(state: GameState, id: string): boolean {
  const card = findCard(state, id);
  if (!card) return false;
  const kind = state.pending?.kind;
  if (card.defId === "cutlass" && allAllies(state).length === 0) {
    if (!state.pending && state.phase === "actions" && state.hand.some((c) => c.instanceId === id)) return true;
    if (kind === "playChooseCard") return true;
  }
  return kind === "vanquishHero" || kind === "vanquishAllies";
}

function renderLocation(
  state: GameState,
  id: LocationId,
  hi: Set<string>,
  sel: Set<string>,
  coached: Set<string>,
  expanded: ReadonlySet<string>,
): string {
  const meta = REALM[id];
  const loc = state.locations[id];
  const locked = id === "hangmansTree" && !state.hangmansUnlocked;
  const current = state.villainLocation === id;
  const legal = hi.has(`loc:${id}`);
  const actions = availableActions({ ...state, villainLocation: id }).filter((a) => {
    if (id !== state.villainLocation) {
      return REALM[id].actions.some((p) => p.key === a.key);
    }
    return true;
  });
  const printed = actions.filter((a) => a.row !== "extra");
  const extras = id === state.villainLocation ? actions.filter((a) => a.row === "extra") : [];
  const top = printed.filter((a) => a.row === "top");
  const bottom = printed.filter((a) => a.row === "bottom");
  const showLegalActs = actionsAreLive(state) && state.villainLocation === id;

  const actBtn = (a: (typeof printed)[number]) => {
    const legalAct = showLegalActs && !locked && hi.has(`act:${a.key}`);
    const coachAct = legalAct && coached.has(`act:${a.key}`);
    const inert = a.covered || a.used || !legalAct;
    return `<button class="action ${a.covered ? "is-covered" : ""} ${a.used ? "is-used" : ""} ${legalAct ? "is-legal" : "is-inert"} ${coachAct ? "is-coached" : ""}" data-act="${a.key}" ${inert ? "disabled" : ""}>${esc(a.label)}</button>`;
  };
  const extraBtns = extras
    .map((a) => {
      const extraLegal = showLegalActs && !locked && hi.has(`act:${a.key}`);
      const extraInert = locked || a.used || !extraLegal;
      return `<button class="action ${extraLegal ? "is-legal" : "is-inert"} ${extraLegal && coached.has(`act:${a.key}`) ? "is-coached" : ""} ${a.used ? "is-used" : ""}" data-act="${a.key}" ${extraInert ? "disabled" : ""}>${esc(a.label)}</button>`;
    })
    .join("");

  const cards = (empty: string, arr: CardInstance[]) =>
    arr.length
      ? `<div class="zone-cards">${arr
          .map((c) => {
            const host = renderCard(state, c, {
              size: "mini",
              legal: hi.has(`card:${c.instanceId}`),
              selected: sel.has(c.instanceId),
              dimmed: cardDimmed(state, c, hi),
              coached: coached.has(`card:${c.instanceId}`),
              inspectable: true,
              expandable: true,
              expanded: expanded.has(c.instanceId),
            });
            const extras = attachmentsOn(state, c.instanceId)
              .filter((a) => hi.has(`card:${a.instanceId}`))
              .map((a) =>
                renderCard(state, a, {
                  size: "mini",
                  legal: true,
                  selected: sel.has(a.instanceId),
                  coached: coached.has(`card:${a.instanceId}`),
                  inspectable: true,
                  expandable: true,
                  expanded: expanded.has(a.instanceId),
                }),
              )
              .join("");
            return host + extras;
          })
          .join("")}</div>`
      : `<p class="empty">${empty}</p>`;

  const moveLabel = state.phase === "move" ? "Move here" : "Choose this place";
  const coachLoc = legal && coached.has(`loc:${id}`);
  return `<section class="location ${id} ${current ? "is-current" : ""} ${legal ? "is-legal" : ""} ${coachLoc ? "is-coached" : ""} ${locked ? "is-locked" : ""}" data-loc="${id}">
    <div class="loc-vignette" aria-hidden="true"></div>
    ${locked ? `<div class="lock-veil" aria-hidden="true"></div>` : ""}
    <div class="loc-head">
      <div class="loc-art-slot" aria-hidden="true">${locationDecor(id)}</div>
      <div class="loc-title">
        <div class="loc-name">
          <h2><span class="shore-number" aria-label="Shore ${LOCATION_IDS.indexOf(id) + 1}">${LOCATION_IDS.indexOf(id) + 1}</span> ${esc(meta.name)} ${locked ? `<span class="lock-badge">LOCKED</span>` : ""}</h2>
          <p>${esc(meta.subtitle)}</p>
          ${locked ? `<p class="lock-need">Need: Never Land Map</p>` : ""}
        </div>
        ${
          current
            ? `<div class="captain-token" title="You — the captain">
                ${CAPTAIN_TOKEN}
                <span class="you-tag">You</span>
              </div>`
            : ""
        }
      </div>
    </div>
    <div class="location-choice">${legal ? `<button type="button" class="drop-hint" data-move="${id}">${moveLabel}</button>` : `<span>${current ? "Captain here" : locked ? "Closed until the Map" : "Actions on arrival"}</span>`}</div>
    <div class="row row-top">${top.map(actBtn).join("")}</div>
    ${zone("Heroes", cards("Clear — top actions are open.", loc.heroes), "heroes")}
    ${zone("Allies", cards("No crew stationed.", loc.allies), "allies")}
    ${zone("Items", cards("No gear here.", loc.items), "items")}
    <div class="row row-bottom">${bottom.map(actBtn).join("")}${extraBtns}</div>
  </section>`;
}

function titleView(
  difficulty: Difficulty,
  coachEnabled: boolean,
  briefEnabled: boolean,
  reasonsEnabled: boolean,
  sceneWarning: string | null = null,
): string {
  return `<div class="sky" aria-hidden="true">
    <div class="stars"></div>
    <div class="stars dim"></div>
    <div class="fog fog-a"></div>
    <div class="fog fog-b"></div>
    <div class="lantern-glow"></div>
    ${TITLE_SCENE}
  </div>
  <div class="grain"></div>
  <main class="title-screen">
    <section class="title-card">
      <div class="foil-frame" aria-hidden="true"></div>
      ${CREST}
      <p class="eyebrow">A solo practice duel</p>
      <h1 class="wordmark">Never Land Duel</h1>
      <p class="subtitle">Hook Practice</p>
      <p class="lede">Command the captain against a computer Fate adversary. Unlock Hangman’s Tree, reveal Peter Pan, walk him to the Jolly Roger, and vanquish him there.</p>
      <div class="objective-row">
        <div class="obj-pip"><b>I</b><span>Play the Never Land Map</span></div>
        <div class="obj-pip"><b>II</b><span>Reveal Peter at the Tree</span></div>
        <div class="obj-pip"><b>III</b><span>Move him to the ship</span></div>
        <div class="obj-pip"><b>IV</b><span>Vanquish him there</span></div>
      </div>
      <div class="diff">
        <button data-diff="easy" class="${difficulty === "easy" ? "is-on" : ""}">Easy — random Fate</button>
        <button data-diff="normal" class="${difficulty === "normal" ? "is-on" : ""}">Normal — heuristic Fate</button>
      </div>
      <div class="ctrl-row">
        <button type="button" class="ctrl ${coachEnabled ? "is-on" : ""}" data-coach-toggle>${coachEnabled ? "Coach on" : "Coach off"}</button>
        <button type="button" class="ctrl ${briefEnabled ? "is-on" : ""}" data-brief-toggle>${briefEnabled ? "Brief on" : "Brief off"}</button>
        <button type="button" class="ctrl ${reasonsEnabled ? "is-on" : ""}" data-reasons-toggle>${reasonsEnabled ? "Reasons on" : "Reasons off"}</button>
        ${soundToggle()}
        <button type="button" class="ctrl" data-help>How to play</button>
      </div>
      <p class="coach-lede">Coach names the next click. Coach, <b>Why this move</b>, and the Strategy brief flow together as one teaching panel in the right-hand rail — one scroll, clear section headers. Move reasons names what you picked, why it helps the chain, and what to watch. Tutorial starts all three on. Hide any during play.</p>
      <div class="actions-row title-starts">
        <button class="btn primary" data-start>Set Sail</button>
        <button class="btn" data-tutorial>Tutorial</button>
      </div>
      <p class="fine title-tutorial-note">Tutorial is a short first voyage: one action at a time, with a guaranteed Map, then a normal shuffled voyage. Set Sail skips the lesson.</p>
      ${sceneWarning ? `<p class="fine" data-scene-warning>${esc(sceneWarning)}</p>` : ""}
      <p class="fine">Unofficial personal practice tool. Not affiliated with, endorsed by, or associated with Disney or Ravensburger.</p>
    </section>
  </main>`;
}

export function helpView(fromPlay: boolean): string {
  return `<div class="overlay" data-overlay="blocking"><div class="modal wood" ${namedDialog("help-title")}>
    <h2 id="help-title">How to play</h2>
    <p>Each turn you <b>must move</b> to a different unlocked location, then may use each uncovered action there once. Heroes cover the top row. End the turn to refill to 4 cards; the computer then Fates you.</p>
    <p><b>Win</b> by vanquishing Peter Pan at the Jolly Roger after unlocking Hangman’s Tree with the Never Land Map. Vanquishing him anywhere else loses the duel.</p>
    <p><b>Coach:</b> names the next legal click and why it helps. Other legal options stay clickable. It is the top section of the right-hand teaching panel, above the Strategy brief and Why this move.</p>
    <p><b>Strategy brief:</b> a section of that teaching panel that teaches the voyage — objective progress, the current board, what this phase is for, and what the turn is setting up. Distinct from Coach.</p>
    <p><b>Move reasons:</b> a “Why this move” section in that same panel, between Coach and the brief. After each legal click it names what you just chose, why it helps the Map → tree → Peter → ship chain, and what to watch (Fate, covered actions, Tick Tock). Distinct from Coach (next suggestion) and the brief (voyage status). Tutorial starts all three on and teaches move, Gain, the Map, Fate, one escort step, and the ship clash before a normal voyage. The whole panel is one flowing document with section headers and a single scroll; below about 1100px it drops under the board so type stays at the desktop floor.</p>
    <p><b>Card text:</b> Fate reveal modals show the full paraphrased ability and stay until Continue. Click a hand or board mini that is not a legal target to inspect it. The <b>Across the table</b> strip keeps the last revealed Fate play visible while that card is still on the table — never the face-down deck.</p>
    <p><b>Finding Peter:</b> At a table, Hook finds Peter with hunt cards (Worthy Opponent, Give Them a Scare, Obsession) and by being Fated. Your Fate action there hits another villain. This solo tool always Fates you after each turn, and your Fate action is a <b>practice self-Fate</b> — it flips Hook’s own Fate deck so you can practice the find without a second player.</p>
    <p><b>Rival villain:</b> A track in the top bar fills after each of your turns. Normal adds more than Easy. Pixie Dust adds the most when the computer plays it. Taunt adds a smaller step. Splitting Headache adds nothing in a regular game. If the track fills before you vanquish Peter Pan at the Jolly Roger, you lose. Your own Fate action does not move the rival. With the Coach off, Easy runs to 74 and Normal runs to 154. With the Coach on, the track runs to 222, Normal adds 1, and those three Fate cards each add 1.</p>
    <p><b>Printed Conditions:</b> Cunning and Obsession <b>are</b> printed two-player Conditions. At a table they wait for another player’s turn (a strong Ally in another realm; another player defeating a strong Hero). This tool rewrites those triggers so they can fire on your turn: Cunning if a Strength 4+ Hero is already ashore and you hold an Ally; Obsession if Peter is still hidden. A grey Condition is not ready yet.</p>
    <p><b>Sound:</b> quiet cues for a card play, a move, a vanquish, the computer’s Fate, the rival nearing the end of the track, a win, and a loss. Nothing plays until you click, press a key, or drag a card. The Sound button remembers your choice on this browser.</p>
    <p><b>Drag:</b> When a card can move or be played onto a place, grab it and slide onto a glowing location (or Ally, for the Cutlass). Drop outside to cancel the slide; clicking still works.</p>
    <p><b>Play a Card:</b> An Ally or Item lands where the captain stands. It does not travel to another shore. Walk crew toward the ship afterward. Fate may still seat a Hero on any unlocked place.</p>
    <p><b>Practice tips:</b> Discard aggressively for the Map. Hunt cards (Worthy Opponent, Give Them a Scare) are how Hook finds Peter at a table — plus being Fated. Station strength at the ship before walking Peter across. Beware Tick Tock (hand empties only if the captain moves onto him) and Splitting Headache.</p>
    <div class="actions-row"><button class="btn primary" data-close-help data-initial-focus>${fromPlay ? "Return to the realm" : "Back"}</button></div>
  </div></div>`;
}

function coachClass(coached: Set<string>, key: string): string {
  return coached.has(key) ? " is-coached" : "";
}

function namedDialog(titleId: string, modal = true): string {
  return `role="dialog" aria-modal="${modal ? "true" : "false"}" aria-labelledby="${titleId}" data-dialog="${titleId}"`;
}

function overlayFor(
  state: GameState,
  hi: Set<string>,
  sel: Set<string>,
  coached: Set<string>,
  lessonActive = false,
): string {
  const p = state.pending;
  if (state.phase === "over") {
    const recap = endgameRecap(state);
    const lessonHandoff = lessonActive
      ? `<section class="recap-block" data-lesson-handoff>
        <h3>First voyage</h3>
        <p>${
          state.won
            ? "You practiced one action at a time: move, Gain, the Map, Fate, one escort step, and an equal-Strength clash. Peter’s last shore in that clash was set up for the lesson. A normal voyage shuffles both decks and does not skip the walk."
            : "The first voyage stopped early. Replay it, begin a shuffled voyage, or return to the title."
        }</p>
      </section>`
      : "";
    const lessonActions = lessonActive
      ? `<button type="button" class="btn primary" data-lesson-sail data-initial-focus>Begin a normal voyage</button>
        <button type="button" class="btn" data-again>Replay the first voyage</button>
        <button type="button" class="btn ghost" data-home>Not now</button>`
      : `<button type="button" class="btn primary${coachClass(coached, "btn:again")}" data-again data-initial-focus>Play again</button>
        <button type="button" class="btn ghost" data-home>Return to title</button>`;
    return `<div class="overlay" data-overlay="blocking"><div class="modal wood endgame ${state.won ? "win celebrate" : "lose"}" data-recap ${namedDialog("recap-title")}>
      <p class="eyebrow">${state.won ? "Captain Hook wins" : "Voyage recap"}</p>
      <p class="outcome-mark" data-outcome>${state.won ? "Victory" : "Defeat"}</p>
      <h2 id="recap-title">${esc(recap.headline)}</h2>
      ${state.loseReason === RIVAL_LOSE_REASON ? rivalMeter(state) : ""}
      <p class="recap-lead">${esc(recap.lead)}</p>
      <section class="recap-block" data-recap-steps>
        <h3>The objective</h3>
        <p>${esc(recap.steps)}</p>
      </section>
      <section class="recap-block" data-recap-clash>
        <h3>${state.won ? "Why the clash was legal" : "Why that clash did not win"}</h3>
        <p>${esc(recap.clash)}</p>
      </section>
      <section class="recap-block" data-recap-fate>
        <h3>What Fate did</h3>
        <p>${esc(recap.fate)}</p>
      </section>
      ${lessonHandoff}
      <div class="actions-row">
        ${lessonActions}
      </div>
    </div></div>`;
  }
  if (p?.kind === "fateReport") {
    const heading =
      p.resume === "nextTurn"
        ? "Fate intervening"
        : p.played?.defId === "tickTock" && !p.markAction
          ? "Tick Tock snaps"
          : "Read this card";
    const eyebrow = p.resume === "nextTurn" ? "Across the table" : "Before you continue";
    const emptyShore = isNoItemFateDiscard(p.note);
    return `<div class="overlay fate-in" data-overlay="blocking"><div class="modal wood fate" ${namedDialog("fate-title")}>
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="fate-title">${heading}</h2>
      ${emptyShore ? noItemDiscardBanner() : ""}
      <p>${esc(p.note)}</p>
      ${p.choiceReason ? `<p class="fate-choice-why" data-fate-choice>${esc(p.choiceReason)}</p>` : ""}
      ${abilityReadout("What it does", p.abilityText)}
      <div class="modal-cards">${p.drawn
        .map((c) => {
          const focus = p.played?.instanceId === c.instanceId;
          return `<div class="${focus ? "is-focus" : "is-aside"}">${renderCard(state, c, { size: "reveal", legal: false, selected: focus })}</div>`;
        })
        .join("")}</div>
      <div class="actions-row"><button type="button" class="btn primary${coachClass(coached, "btn:ack")}" data-ack data-initial-focus>Continue</button></div>
    </div></div>`;
  }
  if (p?.kind === "scarePeek") {
    const [topA, topB] = p.cards;
    const solo = topB ? undefined : topA;
    const orderButtons =
      topA && topB
        ? `<button class="btn${coachClass(coached, `btn:scare-order:${topA.instanceId},${topB.instanceId}`)}" data-scare-order="${topA.instanceId},${topB.instanceId}">${esc(cardName(topA))} on top</button>
        <button class="btn${coachClass(coached, `btn:scare-order:${topB.instanceId},${topA.instanceId}`)}" data-scare-order="${topB.instanceId},${topA.instanceId}">${esc(cardName(topB))} on top</button>`
        : solo
          ? `<button class="btn${coachClass(coached, `btn:scare-order:${solo.instanceId},${solo.instanceId}`)}" data-scare-order="${solo.instanceId},${solo.instanceId}">Put ${esc(cardName(solo))} back on top</button>`
          : "";
    return `<div class="overlay" data-overlay="blocking"><div class="modal" ${namedDialog("scare-title")}>
      <h2 id="scare-title">Give Them a Scare</h2>
      <p>${
        solo
          ? "Only one Fate card was left. Discard it to the Fate discard (it can return when Fate reshuffles), or put it back on top."
          : "Discard both to the Fate discard (they can return when Fate reshuffles), or return them with the first button’s card on top."
      }</p>
      <div class="modal-cards">${p.cards
        .map((c) => renderCard(state, c, { size: "reveal", legal: true, selected: false }))
        .join("")}</div>
      <div class="actions-row">
        <button class="btn${coachClass(coached, "btn:scare-discard")}" data-scare-discard data-initial-focus>${solo ? "Discard it" : "Discard both"}</button>
        ${orderButtons}
      </div>
    </div></div>`;
  }
  if (p?.kind === "fateChooseItem") {
    const items = allLocationItems(state);
    if (items.length === 0) {
      const d = def("splittingHeadache");
      const ability = `${d.name}: ${d.text}`;
      return `<div class="overlay fate-in" data-overlay="blocking"><div class="modal wood fate" ${namedDialog("fate-title")}>
      <p class="eyebrow">Across the table</p>
      <h2 id="fate-title">Fate intervening</h2>
      ${noItemDiscardBanner()}
      <p>${esc(HEADACHE_NO_ITEM_NOTE)}</p>
      ${abilityReadout("What it does", ability)}
      <div class="actions-row"><button type="button" class="btn primary${coachClass(coached, "btn:ack")}" data-ack data-initial-focus>Continue</button></div>
    </div></div>`;
    }
  }
  if (p?.kind === "fateChooseCard") {
    return `<div class="overlay" data-overlay="blocking"><div class="modal" ${namedDialog("self-fate-title")}>
      <h2 id="self-fate-title">Practice self-Fate</h2>
      <p>This is a solo adaptation: you are flipping Hook’s own Fate deck. At a table the Fate action hits another villain; Hook finds Peter with hunt cards and by being Fated. Play one card; the other is discarded. Read the full text before you choose.</p>
      <div class="modal-cards">${p.cards
        .map((c) => renderCard(state, c, { size: "reveal", legal: hi.has(`card:${c.instanceId}`), selected: sel.has(c.instanceId), coached: coached.has(`card:${c.instanceId}`) }))
        .join("")}</div>
    </div></div>`;
  }
  if (p?.kind === "playChoosePayment") {
    const card = findCard(state, p.cardId);
    const cost = card ? def(card.defId).cost : 0;
    const name = card ? cardName(card) : "this card";
    const canPay = state.power >= cost;
    const mapOut = Boolean(
      card && def(card.defId).type === "item" && card.defId !== "neverLandMap" && mapInRealm(state),
    );
    return `<div class="overlay" data-overlay="blocking"><div class="modal" ${namedDialog("pay-title")}>
      <h2 id="pay-title">Pay the cost</h2>
      <p>${esc(name)} costs <b>${cost} Power</b>. You have <b>${state.power} Power</b>.</p>
      <p>${
        mapOut
          ? "The Never Land Map is in the realm and can cover this Item instead of Power."
          : `Pay ${cost} Power to play ${esc(name)}.`
      }</p>
      <div class="pay-meter" role="status">Pay ${cost} · you have ${state.power} · ${Math.max(0, state.power - cost)} left${mapOut ? " · Map available" : ""}</div>
      <div class="actions-row">
        <button type="button" class="btn primary${coachClass(coached, "btn:pay-power")}" data-pay-power ${canPay ? "data-initial-focus" : "disabled"}>Pay ${cost} Power</button>
        ${
          mapOut
            ? `<button type="button" class="btn${coachClass(coached, "btn:pay-map")}" data-pay-map>Discard the Map</button>`
            : ""
        }
        <button type="button" class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel ${canPay ? "" : "data-initial-focus"}>Cancel</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "conditionOffer") {
    return `<div class="overlay" data-overlay="blocking"><div class="modal" ${namedDialog("condition-title")}>
      <h2 id="condition-title">A Condition is ready</h2>
      <p>${esc(p.reason)}</p>
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:accept-cond")}" data-accept-cond data-initial-focus>Play it</button>
        <button class="btn ghost${coachClass(coached, "btn:skip-cond")}" data-skip-cond>Not now</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "obsessionDecide") {
    const hero = state.heldCard;
    const peter = hero?.defId === "peterPan";
    return `<div class="overlay" data-overlay="blocking"><div class="modal" ${namedDialog("obsession-title")}>
      <h2 id="obsession-title">Obsession</h2>
      <p>${
        peter
          ? "Peter Pan was revealed. He must be played to Hangman’s Tree. He cannot be discarded."
          : "A Hero was found. Play them into the realm, or discard them to the Fate discard? A discarded Hero can return when Fate reshuffles."
      }</p>
      ${
        hero
          ? `<div class="modal-cards">${renderCard(state, hero, { size: "reveal", legal: false, selected: true })}</div>`
          : ""
      }
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:play-hero")}" data-play-hero data-initial-focus>${peter ? "Play Peter Pan" : "Play the Hero"}</button>
        ${
          peter
            ? ""
            : `<button class="btn${coachClass(coached, "btn:discard-hero")}" data-discard-hero>Discard</button>`
        }
      </div>
    </div></div>`;
  }
  if (p?.kind === "worthyLocation" || p?.kind === "obsessionLocation") {
    const hero = state.heldCard ?? findCard(state, p.heroId);
    const title = p.kind === "worthyLocation" ? "Worthy Opponent" : "Obsession";
    return `<div class="overlay pass-through"><div class="modal wood placement-picker" data-placement-picker data-dialog="seat-hero-title" role="dialog" aria-modal="false" aria-labelledby="seat-hero-title">
      <p class="eyebrow">${esc(title)}</p>
      <h2 id="seat-hero-title">Seat this Hero</h2>
      <p>Choose an unlocked shore below, or use a highlighted place on the board. Peter always lands at Hangman’s Tree when revealed.</p>
      <div class="placement-layout">
      ${hero ? `<div class="modal-cards">${renderCard(state, hero, { size: "reveal", legal: false, selected: true })}</div>` : ""}
      <div class="placement-choices" aria-label="Legal destinations">${LOCATION_IDS.filter((id) => hi.has(`loc:${id}`)).map((id, index) =>
        `<button type="button" class="btn primary${coachClass(coached, `loc:${id}`)}" data-move="${id}" ${index === 0 ? "data-initial-focus" : ""}>Choose this place: ${esc(REALM[id].name)}</button>`
      ).join("")}</div>
      </div>
    </div></div>`;
  }
  if (p?.kind === "vanquishConfirmLoss") {
    const hero = findCard(state, p.heroId) ?? state.heldCard;
    return `<div class="overlay" data-overlay="blocking"><div class="modal wood lose" ${namedDialog("loss-title")}>
      <h2 id="loss-title">This loses the practice duel</h2>
      <p>Peter is not on the Jolly Roger. Vanquishing him here is the intentional-loss trap. Continue only if you mean to practice that failure.</p>
      ${
        hero
          ? `<div class="modal-cards">${renderCard(state, hero, { size: "reveal", legal: false, selected: true })}</div>`
          : ""
      }
      <div class="actions-row">
        <button class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel data-initial-focus>Cancel</button>
        <button class="btn${coachClass(coached, "btn:confirm")}" data-confirm>Continue anyway</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "playChooseAllyAttach") {
    const item = findCard(state, p.cardId);
    const itemName = item ? cardName(item) : "Cutlass";
    const allies = allAllies(state);
    return `<div class="overlay pass-through"><div class="modal wood attach-picker" ${namedDialog("attach-title", false)}>
      <p class="eyebrow">Arm an Ally</p>
      <h2 id="attach-title">Strap ${esc(itemName)}</h2>
      <p>Choose any Ally in the realm. You can also click that Ally’s card on the board. Cancel returns to Play a Card.</p>
      ${
        allies.length
          ? `<ul class="attach-list">${allies
              .map((a) => {
                const strapClass = coachClass(coached, `btn:attach:${a.ally.instanceId}`) || coachClass(coached, `card:${a.ally.instanceId}`);
                return `<li>
                <div class="attach-meta">
                  <strong>${esc(cardName(a.ally))}</strong>
                  <span>Strength ${allyStrength(state, a.ally)} · ${esc(REALM[a.location].name)}</span>
                </div>
                <button type="button" class="btn primary${strapClass}" data-card="${a.ally.instanceId}" ${a === allies[0] ? "data-initial-focus" : ""}>Strap ${esc(itemName)} to ${esc(cardName(a.ally))}</button>
              </li>`;
              })
              .join("")}</ul>`
          : `<p class="empty">No Allies are ashore. Cancel and play a crew member first.</p>`
      }
      <div class="actions-row"><button class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel ${allies.length ? "" : "data-initial-focus"}>Cancel</button></div>
    </div></div>`;
  }
  return "";
}

function fateRail(state: GameState): string {
  const show = state.lastFateShow;
  const empty = fateEmptyLine(state);
  const live =
    state.pending?.kind === "fateReport" && state.pending.resume === "nextTurn" ? state.pending : null;
  const active = live ?? (fateShowStillInPlay(state, show) ? show : null);
  if (active) {
    const drawn = active.drawn ?? [];
    const played = active.played;
    const note = active.note ?? "";
    const ability = active.abilityText ?? "";
    return `<aside class="fate-rail" aria-label="Fate adversary">
    <div class="fate-rail-copy">
      <p class="fate-kicker">Across the table</p>
      <h2>Fate adversary</h2>
      <p>${esc(note || "Last revealed Fate play.")}</p>
      ${empty ? `<p>${esc(empty)}</p>` : ""}
      ${ability ? `<p class="fate-ability">${esc(ability)}</p>` : ""}
      <p class="fate-fine">Revealed this Fate only. The rest of the Fate deck stays face down, as at a real table.</p>
    </div>
    <div class="fate-rail-cards">${drawn
      .map((c) => {
        const focus = played?.instanceId === c.instanceId;
        return `<div class="${focus ? "is-focus" : "is-aside"}">${renderCard(state, c, { size: "mini", legal: false, selected: false })}</div>`;
      })
      .join("")}</div>
  </aside>`;
  }
  if (show && !live) {
    return `<aside class="fate-rail is-spent" aria-label="Fate adversary">
      <div class="fate-rail-copy">
        <p class="fate-kicker">Across the table</p>
        <h2>That Fate is over</h2>
        <p>That was last Fate; it is over. The card is no longer on the table.</p>
        ${empty ? `<p>${esc(empty)}</p>` : ""}
      </div>
    </aside>`;
  }
  return `<aside class="fate-rail is-empty${empty ? " is-deck-empty" : ""}" aria-label="Fate adversary">
      <div class="fate-rail-copy">
        <p class="fate-kicker">Across the table</p>
        <h2>${empty ? "Fate deck empty" : "Fate adversary"}</h2>
        <p>${esc(
          empty ||
            "This strip is the practice stand-in for another player Fating you. Only cards that were just revealed or seated appear here — never the face-down Fate deck.",
        )}</p>
      </div>
    </aside>`;
}

function inspectOverlay(state: GameState, instanceId: string): string {
  const fromPending =
    state.pending && "drawn" in state.pending
      ? state.pending.drawn.find((c) => c.instanceId === instanceId)
      : state.pending && "cards" in state.pending
        ? state.pending.cards.find((c) => c.instanceId === instanceId)
        : undefined;
  const card = findCard(state, instanceId) ?? fromPending ?? state.heldCard;
  if (!card || card.instanceId !== instanceId) return "";
  const d = def(card.defId);
  return `<div class="overlay inspect-in" data-overlay="blocking"><div class="modal wood inspect" ${namedDialog("inspect-title")}>
    <p class="eyebrow">Inspect</p>
    <h2 id="inspect-title">${esc(d.name)}</h2>
    ${abilityReadout("What it does", `${d.name}: ${d.text}`)}
    <div class="modal-cards">${renderCard(state, card, { size: "reveal", legal: false, selected: true })}</div>
    <div class="actions-row"><button type="button" class="btn primary" data-inspect-close data-initial-focus>Close</button></div>
  </div></div>`;
}

function teachRailHtml(brief: string, coach: string, reasons: string): string {
  if (!brief && !coach && !reasons) return "";
  return `<aside class="teach-rail" data-teach-rail aria-label="Teaching">
    ${coach}${reasons}${brief}
  </aside>`;
}

const STAGE_LINE: Record<PlanStage["id"], string> = {
  hideout: "Hideout is the step in front of you: open Hangman’s Tree with the Never Land Map.",
  crew: "Crew is the step in front of you: Allies on the board are the Strength for the clash.",
  peter: "Peter is the step in front of you: he has to enter the realm before the walk to the ship.",
  ship: "Ship is the step in front of you: walk Peter onto the Jolly Roger.",
  clash: "Clash is the step in front of you: vanquish Peter on the Jolly Roger.",
};

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function repeatsClick(sentence: string, click: string): boolean {
  if (sentence === click) return true;
  if (click.length > 0 && sentence.includes(click)) return true;
  return /\bclick\b/i.test(sentence);
}

function stageLine(stages: PlanStage[]): string {
  const current = stages.find((stage) => stage.mark === "now") ?? stages.find((stage) => stage.mark === "later");
  return current ? STAGE_LINE[current.id] : STAGE_LINE.clash;
}

export function planPanelCopy(state: GameState, advice: CoachAdvice): string[] {
  const plan = coachPlan(state, advice);
  const click = advice.do.trim();
  const kept: string[] = [];
  for (const line of plan.lines) {
    const parts = splitSentences(line).filter((sentence) => !repeatsClick(sentence, click));
    if (parts.length === 0) continue;
    const text = parts.join(" ");
    if (kept.includes(text)) continue;
    kept.push(text);
  }
  return kept.length > 0 ? kept : [stageLine(plan.stages)];
}

function coachPanel(state: GameState, advice: CoachAdvice): string {
  const plan = coachPlan(state, advice);
  const lines = planPanelCopy(state, advice);
  const why = lines[0] ?? stageLine(plan.stages);
  const rest = lines.slice(1);
  return `<section class="teach-pane coach-panel" data-teach-pane="coach" data-coach-plan aria-live="polite">
    <header class="teach-pane-head">
      <div class="pane-titles">
        <p class="coach-kicker">Coach</p>
        <h2 class="pane-title">Next move</h2>
      </div>
      <button type="button" class="btn ghost pane-hide coach-hide" data-coach-toggle>Hide</button>
    </header>
    <p class="coach-do" title="${esc(advice.do)}">${esc(advice.do)}</p>
    <div class="plan-panel">
      <p class="coach-kicker">Why / Plan</p>
      <ol class="plan-stages" aria-label="Plan">${plan.stages
        .map(
          (stage) =>
            `<li class="is-${stage.mark}" data-plan-stage="${stage.id}" data-plan-mark="${stage.mark}">${esc(stage.label)}</li>`,
        )
        .join("")}</ol>
      <div class="plan-lines">
        <p class="coach-why">${esc(why ?? advice.why)}</p>
        ${rest.map((line) => `<p class="plan-line">${esc(line)}</p>`).join("")}
      </div>
    </div>
  </section>`;
}

function strategySidebar(brief: StrategyBrief): string {
  return `<section class="teach-pane strategy-brief" data-teach-pane="brief" aria-label="Strategy brief">
    <header class="teach-pane-head brief-head">
      <div class="pane-titles">
        <p class="brief-kicker">Strategy brief</p>
        <h2 class="pane-title">How the voyage stands</h2>
      </div>
      <button type="button" class="btn ghost pane-hide brief-hide" data-brief-toggle>Hide</button>
    </header>
    <section class="brief-block">
      <h3>Objective progress</h3>
      <ol class="brief-objectives">
        ${brief.objective
          .map(
            (line) => `<li class="${line.done ? "is-done" : ""}${line.current ? " is-current" : ""}">
          <div class="brief-obj-title"><span class="brief-pip"></span><strong>${esc(line.label)}</strong></div>
          ${line.done ? "" : `<p>${esc(line.status)}</p>`}
        </li>`,
          )
          .join("")}
      </ol>
    </section>
    <section class="brief-block">
      <h3>Where you are</h3>
      <p>${esc(brief.where)}</p>
    </section>
    <section class="brief-block">
      <h3>What this moment is</h3>
      <p>${esc(brief.moment)}</p>
    </section>
    <section class="brief-block">
      <h3>What we’re setting up for</h3>
      <p>${esc(brief.setup)}</p>
    </section>
  </section>`;
}

function reasonDock(reason: MoveReason): string {
  // Before any move is made the panel has nothing to explain, so it collapses to
  // one compact line instead of three idle blocks that would push the brief off
  // the first screen. The full three-part readout returns the moment a move exists
  // (live "action stretch" guidance is soft but still carries real content, so it
  // is matched on the genuine placeholder text, not the soft flag).
  const idle = reason.chose === IDLE_MOVE_REASON.chose;
  const body = idle
    ? `<p class="reason-idle">Click a glowing location, action, or card. This panel then names what you chose, why it helps the plan, and what it sets up.</p>`
    : `<section class="reason-block">
      <h3>What you chose</h3>
      <p>${esc(reason.chose)}</p>
    </section>
    <section class="reason-block">
      <h3>Why it helps the plan</h3>
      <p>${esc(reason.why)}</p>
    </section>
    <section class="reason-block">
      <h3>What it sets up</h3>
      <p>${esc(reason.next)}</p>
    </section>
    <p class="reason-foot">Not Coach (next click) and not the Strategy brief (voyage status). It rides in the same teaching panel, below Next move and above the brief, so it never covers legal board actions.</p>`;
  return `<section class="teach-pane reason-dock${reason.soft ? " is-soft" : ""}${idle ? " is-idle" : ""}" data-teach-pane="reasons" data-reason-dock aria-label="Why this move">
    <header class="teach-pane-head">
      <div class="pane-titles">
        <p class="reason-kicker">Reasons</p>
        <h2 class="pane-title">Why this move</h2>
      </div>
      <button type="button" class="btn ghost pane-hide reason-hide" data-reasons-toggle>Hide</button>
    </header>
    ${body}
  </section>`;
}

function playView(
  state: GameState,
  coachEnabled: boolean,
  briefEnabled: boolean,
  reasonsEnabled: boolean,
  reason: MoveReason | null,
  sceneId: string | null = null,
  lesson: LessonView | null = null,
  expanded: ReadonlySet<string> = NO_EXPANDED,
  handRuleId: string | null = null,
): string {
  const hi = highlightSet(state);
  const sel = selectedSet(state);
  const settled = state.phase === "over" || state.won || state.lost;
  const advice = settled ? null : lesson && coachEnabled ? lesson.advice : coachEnabled ? advise(state) : null;
  const coached = new Set(advice?.highlights ?? []);
  const promptButtons: string[] = [];
  if (state.phase === "actions" && !state.pending) {
    promptButtons.push(`<button class="btn primary${coachClass(coached, "btn:end")}" data-end>End turn</button>`);
  }
  const clash = vanquishClashMath(state);
  if (state.pending?.kind === "discardSelect") {
    promptButtons.push(`<button class="btn primary${coachClass(coached, "btn:confirm")}" data-confirm>Confirm</button>`);
  }
  if (state.pending?.kind === "vanquishAllies") {
    promptButtons.push(
      `<button class="btn primary${coachClass(coached, "btn:confirm")}" data-confirm ${clash?.ready ? "" : "disabled"}>Confirm</button>`,
    );
  }
  const canCancelPlay =
    state.pending &&
    ["playChooseCard", "playChooseLocation", "playChooseAllyAttach"].includes(state.pending.kind);
  if (
    canCancelPlay ||
    (state.phase === "resolving" &&
      state.pending &&
      ![
        "scarePeek",
        "fateChooseCard",
        "fateChooseLocation",
        "fateChooseAttach",
        "fateReport",
        "worthyLocation",
        "obsessionDecide",
        "obsessionLocation",
        "ayeAyeAlly",
        "ayeAyeDest",
      ].includes(state.pending.kind))
  ) {
    if (!promptButtons.some((b) => b.includes("data-cancel"))) {
      promptButtons.push(`<button class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel>Cancel</button>`);
    }
  }
  if (state.pending?.kind === "tinkerDiscard") {
    promptButtons.push(`<button class="btn ghost${coachClass(coached, "btn:skip-cond")}" data-skip-cond>Skip discard</button>`);
  }

  const briefHtml = briefEnabled && !settled ? strategySidebar(strategyBrief(state)) : "";
  const coachHtml = advice ? coachPanel(state, advice) : "";
  const reasonHtml = reasonsEnabled && reason && !settled ? reasonDock(reason) : "";
  const teachOn = Boolean(briefHtml || coachHtml || reasonHtml);
  const placeLabel = state.phase === "move" && !state.pending ? "Move here" : "Choose this place";
  const placementInPanel = state.pending?.kind === "worthyLocation" || state.pending?.kind === "obsessionLocation";
  const placeButtons = placementInPanel ? [] : LOCATION_IDS.filter((id) => hi.has(`loc:${id}`)).map(
    (id) =>
      `<button type="button" class="btn primary prompt-place${coachClass(coached, `loc:${id}`)}" data-move="${id}">${placeLabel}: ${esc(REALM[id].name)}</button>`,
  );
  const fateEmpty = fateEmptyLine(state);
  const fateLogTitle = fateEmpty
    ? `Log · Fate 0 · empty`
    : `Log · Fate ${state.fateDeck.length}`;
  const fateShow = state.lastFateShow;
  const fateLive = state.pending?.kind === "fateReport" && state.pending.resume === "nextTurn";
  const fateOnTable = fateLive || fateShowStillInPlay(state, fateShow);
  const fateLogNote = fateOnTable
    ? ""
    : fateShow
      ? "That Fate is over. The card is no longer on the table."
      : "No Fate card is across the table yet.";

  return `<div class="sky play-sky" aria-hidden="true"><div class="stars"></div><div class="fog fog-a"></div></div>
  <div class="grain"></div>
  ${advice ? `<div class="quick-coach"><span>Next click</span><p>${esc(advice.do)}</p></div>` : ""}
  <div class="play ${coachEnabled ? "has-coach" : ""} ${briefEnabled ? "has-brief" : ""} ${reasonsEnabled ? "has-reasons" : ""} ${teachOn ? "has-teach" : ""}">
    <div class="play-main" data-play-main>
    <div class="play-chrome">
    <header class="topbar" data-topbar-map>
      <div class="brand">${CREST}<div><h1>Never Land Duel</h1><small>Hook Practice</small></div></div>
      ${TOPBAR_MAP}
      <div class="meters">
        <div class="hud-core" aria-label="Voyage meters">
          <div class="power is-loud" title="Power"><span>Power</span><b>${state.power}</b></div>
          <div class="chip chip-stat" title="Turn">Turn ${state.turn}</div>
          ${rivalMeter(state)}
        </div>
        <div class="hud-toggles">
          ${sceneId ? `<div class="chip" data-scene-chip>Scene: ${esc(sceneId)}</div>` : ""}
          <div class="chip">${state.difficulty === "easy" ? "Easy Fate" : "Normal Fate"}</div>
          <button type="button" class="ctrl ${coachEnabled ? "is-on" : ""}" data-coach-toggle>${coachEnabled ? "Coach on" : "Coach off"}</button>
          <details class="hud-menu">
            <summary class="ctrl" aria-label="More controls">Menu</summary>
            <div class="hud-menu-panel">
              <div class="chip chip-stat chip-piles" title="Hand, deck, and discard">Hand ${state.hand.length} · Deck ${state.villainDeck.length} · Discard ${state.villainDiscard.length}</div>
              <button type="button" class="ctrl ${briefEnabled ? "is-on" : ""}" data-brief-toggle>${briefEnabled ? "Brief on" : "Brief off"}</button>
              <button type="button" class="ctrl ${reasonsEnabled ? "is-on" : ""}" data-reasons-toggle>${reasonsEnabled ? "Reasons on" : "Reasons off"}</button>
              ${soundToggle()}
              <button type="button" class="ctrl" data-help>Help</button>
              <button type="button" class="ctrl" data-resign ${resignBlocked(state) ? "disabled" : ""}>Resign</button>
            </div>
          </details>
        </div>
      </div>
    </header>
    <div class="prompt${clash ? " is-clash" : ""}" data-prompt>${clashMeter(clash)}<p title="${esc(promptText(state))}">${esc(promptText(state))}</p><ol class="voyage-progress" aria-label="Objective progress">${[
      { label: "Map", done: state.hangmansUnlocked },
      { label: "Peter", done: state.peterPanRevealed },
      { label: "Escort", done: state.peterPanLocation === "jollyRoger" || state.won },
      { label: "Clash", done: state.won },
    ].map((step, i) => `<li class="${step.done ? "is-done" : ""}"><span aria-hidden="true">${step.done ? "✓" : i + 1}</span>${step.label}</li>`).join("")}</ol><div class="prompt-actions">${promptButtons.join("")}${placeButtons.join("")}</div></div>
    ${
      lesson && !settled
        ? `<section class="lesson-banner" data-lesson-banner aria-live="polite"><strong>Lesson ${lesson.index} of ${lesson.total} · ${esc(lesson.title)}</strong><p>${esc(lesson.advice.do)}</p></section>`
        : ""
    }
    </div>
    <div class="play-scroll" data-play-scroll>
    <div class="stage">
      ${fateRail(state)}
      <p class="shore-scroll-hint">One shore at a time. Swipe, tap a shore, or focus the chart and use the arrow keys. Shores stay in order 1 → 2 → 3 → 4.</p>
      <nav class="shore-tabs" aria-label="Shores">${LOCATION_IDS.map((id, i) => `<button type="button" class="shore-tab${state.villainLocation === id ? " is-here" : ""}" data-shore-tab="${id}" aria-label="${esc(REALM[id].name)}">${i + 1} ${SHORE_SHORT[id]}</button>`).join("")}</nav>
      <div class="board-wrap realm-sheet" data-realm-map role="region" aria-label="Never Land shores, ordered from Jolly Roger to Hangman's Tree" tabindex="0"><div class="board">${TREASURE_MAP}${MAP_COMPASS}${LOCATION_IDS.map((id) => renderLocation(state, id, hi, sel, coached, expanded)).join("")}${MAP_COAST}</div></div>
    </div>
    <footer class="dock">
      <section class="hand ${state.pending?.kind === "playChooseCard" || state.pending?.kind === "discardSelect" ? "is-picking" : ""}">
        <h2>Hand</h2>
        <div class="hand-row">
          ${
            state.hand.length
              ? state.hand
                  .map((c) => {
                    const cardText = def(c.defId).text;
                    const open = handRuleId === c.instanceId;
                    const button = renderCard(state, c, {
                      size: "hand",
                      legal: hi.has(`card:${c.instanceId}`),
                      selected: sel.has(c.instanceId),
                      dimmed: cardDimmed(state, c, hi),
                      coached: coached.has(`card:${c.instanceId}`),
                      inspectable: true,
                      handRule: cardText.length > 80,
                    });
                    const pop = open
                      ? `<div class="hand-popover" data-hand-popover role="note"><p class="hand-popover-title">${esc(def(c.defId).name)}</p><p>${esc(cardText)}</p><span class="hand-rule-close" data-hand-rule-close>Close</span></div>`
                      : "";
                    return `<div class="hand-slot${open ? " is-open" : ""}">${button}${pop}</div>`;
                  })
                  .join("")
              : `<p class="empty">${esc(emptyHandCopy(state))}</p>`
          }
        </div>
      </section>
      <aside class="log">
        <h2>${esc(fateLogTitle)}</h2>
        <ol>${fateLogNote ? `<li class="info">${esc(fateLogNote)}</li>` : ""}${state.log.map((e) => `<li class="${e.tone}">${esc(e.text)}</li>`).join("")}</ol>
      </aside>
    </footer>
    </div>
    </div>
    ${teachRailHtml(briefHtml, coachHtml, reasonHtml)}
  </div>
  ${overlayFor(state, hi, sel, coached, Boolean(lesson))}`;
}

export function renderOverlay(state: GameState): string {
  return overlayFor(state, highlightSet(state), selectedSet(state), new Set());
}

export function renderPlay(
  state: GameState,
  flags: {
    coachEnabled?: boolean;
    briefEnabled?: boolean;
    reasonsEnabled?: boolean;
    reason?: MoveReason | null;
    lesson?: LessonView | null;
    expandedIds?: ReadonlySet<string>;
    handRuleId?: string | null;
  } = {},
): string {
  const coachEnabled = flags.coachEnabled ?? true;
  const briefEnabled = flags.briefEnabled ?? true;
  const reasonsEnabled = flags.reasonsEnabled ?? true;
  const reason = reasonsEnabled ? (flags.reason ?? IDLE_MOVE_REASON) : null;
  return playView(
    state,
    coachEnabled,
    briefEnabled,
    reasonsEnabled,
    reason,
    null,
    flags.lesson ?? null,
    flags.expandedIds ?? NO_EXPANDED,
    flags.handRuleId ?? null,
  );
}

function readFlag(key: string, fallback = true): boolean {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    sessionStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* sessionStorage can be unavailable */
  }
}

const SCENE_LOADERS: Record<string, () => GameState> = {
  cutlass: cutlassAttachScene,
  ticktock: tickTockReportScene,
  crocmove: tickTockOntoCaptainScene,
  peterloss: peterSoftConfirmScene,
  drag: dragHeroScene,
  clash: vanquishClashScene,
  obsession: obsessionDecideScene,
  vanquish: vanquishLocalScene,
  pay: payNoMapScene,
  fatepick: easyFizzleScene,
  fatespent: fateSpentScene,
  lagoon: lagoonCoverScene,
  hourtaunt: hourPlaytestTauntScene,
  hourmove: hourPlaytestMoveScene,
  hourwhy: hourPlaytestWhyScene,
  hourequal: hourEqualVanquishScene,
  nearwin: nearWinScene,
  victory: victoryScene,
  defeat: rivalDefeatScene,
  rivalloss: rivalLossScene,
  mapreserve: mapReserveScene,
  worthy: worthySeatScene,
  bounceloop: bounceLoopScene,
  tauntdig: tauntDigScene,
};

let activeSceneId: string | null = null;
let warnedSceneId: string | null = null;

function readSceneParam(): string | null {
  try {
    const scene = new URLSearchParams(window.location.search).get("scene");
    const id = scene?.trim() ?? "";
    return id.length ? id : null;
  } catch {
    return null;
  }
}

function unknownSceneWarning(): string | null {
  if (!import.meta.env.DEV) return null;
  const id = readSceneParam();
  if (!id || SCENE_LOADERS[id]) return null;
  return `Unknown scene “${id}”. No fixture matches this link. Set Sail starts a fresh voyage.`;
}

function noteUnknownScene(): void {
  if (!import.meta.env.DEV) return;
  const id = readSceneParam();
  if (!id || SCENE_LOADERS[id] || warnedSceneId === id) return;
  warnedSceneId = id;
  console.warn(`Unknown scene "${id}". No fixture matches ?scene=${id}.`);
}

/** Known `?scene=` fixtures. Sets the play-screen chip when one loads. */
function stagedScene(): GameState | null {
  const id = readSceneParam();
  if (!id) return null;
  const load = SCENE_LOADERS[id];
  if (!load) return null;
  activeSceneId = id;
  return load();
}

function boxOf(el: HTMLElement): Box {
  const rect = el.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function snapshotMovers(root: HTMLElement): Map<string, Box> {
  const map = new Map<string, Box>();
  if (motionReduced()) return map;
  const captain = root.querySelector<HTMLElement>(".captain-token");
  if (captain) map.set("captain", boxOf(captain));
  root.querySelectorAll<HTMLElement>("[data-realm-map] [data-card]").forEach((el) => {
    const id = el.dataset.card;
    if (id) map.set(id, boxOf(el));
  });
  return map;
}

function playTravel(root: HTMLElement, prev: Map<string, Box>): void {
  if (prev.size === 0 || motionReduced()) return;
  const fly = (el: HTMLElement, key: string) => {
    const before = prev.get(key);
    if (!before) return;
    const next = boxOf(el);
    const delta = travelDelta(before, next);
    if (!delta) return;
    const shore = el.closest<HTMLElement>(".location");
    if (shore) shore.style.overflow = "visible";
    el.classList.add("is-traveling");
    el.style.position = "relative";
    el.style.zIndex = "40";
    el.getAnimations().forEach((anim) => anim.cancel());
    el.style.transition = "none";
    el.style.transform = `translate(${delta.dx}px, ${delta.dy}px)`;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      el.style.position = "";
      el.style.zIndex = "";
      el.style.transition = "";
      el.style.transform = "";
      el.classList.remove("is-traveling");
      if (shore) shore.style.overflow = "";
    };
    void el.offsetWidth;
    requestAnimationFrame(() => {
      if (settled) return;
      el.style.transition = "transform 280ms ease";
      el.style.transform = "translate(0px, 0px)";
    });
    el.addEventListener("transitionend", settle, { once: true });
    window.setTimeout(settle, 360);
  };
  const captain = root.querySelector<HTMLElement>(".captain-token");
  if (captain) fly(captain, "captain");
  root.querySelectorAll<HTMLElement>("[data-realm-map] [data-card]").forEach((el) => {
    const id = el.dataset.card;
    if (id) fly(el, id);
  });
}

function bootState(): GameState {
  noteUnknownScene();
  const staged = stagedScene();
  if (staged) return staged;
  activeSceneId = null;
  return titleState();
}

export function mount(root: HTMLElement): void {
  let state: GameState = bootState();
  let difficulty: Difficulty = "normal";
  let coachEnabled = readFlag("nld-coach");
  let briefEnabled = readFlag("nld-brief", false);
  let reasonsEnabled = readFlag("nld-reasons", false);
  let lastReason: MoveReason = IDLE_MOVE_REASON;
  let inspectId: string | null = null;
  let lesson: LessonStep | null = null;
  let suppressClick = false;
  const expandedCards = new Set<string>();
  let handRuleId: string | null = null;

  const bindCardDrag = () => {
    root.querySelectorAll<HTMLElement>(".card.is-draggable").forEach((cardEl) => {
      cardEl.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest("[data-rule-toggle], [data-hand-rule]")) return;
        armSound();
        const fromId = cardEl.dataset.card;
        if (!fromId || !isDraggableCard(state, fromId)) return;
        cardEl.setPointerCapture?.(event.pointerId);
        const startX = event.clientX;
        const startY = event.clientY;
        let ghost: HTMLElement | null = null;
        let started = false;
        const targets = dropTargets(state, fromId);

        const paintZones = (overLoc?: string, overCard?: string) => {
          root.querySelectorAll("[data-loc]").forEach((node) => {
            const id = node instanceof HTMLElement ? parseLocationId(node.dataset.loc) : null;
            node.classList.toggle("is-drop-target", Boolean(id && targets.locations.includes(id)));
            node.classList.toggle("is-drop-over", id === overLoc);
          });
          root.querySelectorAll("[data-card]").forEach((node) => {
            const id = (node as HTMLElement).dataset.card;
            node.classList.toggle("is-drop-target", Boolean(id && targets.cards.includes(id)));
            node.classList.toggle("is-drop-over", id === overCard && id !== fromId);
          });
        };

        const hitFromPoint = (x: number, y: number) => {
          if (ghost) ghost.style.pointerEvents = "none";
          return document.elementFromPoint(x, y) as HTMLElement | null;
        };

        const move = (ev: PointerEvent) => {
          if (!started && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
          if (!started) {
            started = true;
            suppressClick = true;
            ghost = cardEl.cloneNode(true) as HTMLElement;
            ghost.classList.add("is-drag-ghost");
            ghost.style.width = `${cardEl.getBoundingClientRect().width}px`;
            document.body.appendChild(ghost);
            cardEl.classList.add("is-drag-source");
            paintZones();
          }
          if (ghost) {
            ghost.style.left = `${ev.clientX - 36}px`;
            ghost.style.top = `${ev.clientY - 28}px`;
          }
          const hit = hitFromPoint(ev.clientX, ev.clientY);
          paintZones(hit?.closest<HTMLElement>("[data-loc]")?.dataset.loc, hit?.closest<HTMLElement>("[data-card]")?.dataset.card);
        };

        const up = (ev: PointerEvent) => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          const hit = started ? hitFromPoint(ev.clientX, ev.clientY) : null;
          ghost?.remove();
          cardEl.classList.remove("is-drag-source");
          root.querySelectorAll(".is-drop-target, .is-drop-over").forEach((node) => {
            node.classList.remove("is-drop-target", "is-drop-over");
          });
          if (!started) return;
          const locationId = parseLocationId(hit?.closest<HTMLElement>("[data-loc]")?.dataset.loc) ?? undefined;
          const cardId = hit?.closest<HTMLElement>("[data-card]")?.dataset.card;
          const dest = {
            locationId: locationId && targets.locations.includes(locationId) ? locationId : undefined,
            cardId: cardId && cardId !== fromId && targets.cards.includes(cardId) ? cardId : undefined,
          };
          for (const input of inputsForDrop(state, fromId, dest)) dispatch(input);
          queueMicrotask(() => {
            suppressClick = false;
          });
        };

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    });
  };

  let pageScrollX = 0;
  let pageScrollY = 0;
  let rootScroll = 0;
  let mainScroll = 0;
  let realmScroll = 0;
  let handScroll = 0;
  let railScroll = 0;
  let lastTeachSig = "";

  const captureScroll = () => {
    pageScrollX = window.scrollX;
    pageScrollY = window.scrollY;
    rootScroll = root.scrollTop;
    const scroller = root.querySelector<HTMLElement>("[data-play-scroll]") ?? root.querySelector<HTMLElement>("[data-play-main]");
    if (scroller) mainScroll = scroller.scrollTop;
    realmScroll = root.querySelector<HTMLElement>("[data-realm-map]")?.scrollLeft ?? 0;
    handScroll = root.querySelector<HTMLElement>(".hand-row")?.scrollLeft ?? 0;
    railScroll = root.querySelector<HTMLElement>("[data-teach-rail]")?.scrollTop ?? 0;
  };

  const restoreScroll = () => {
    const rail = root.querySelector<HTMLElement>("[data-teach-rail]");
    if (rail) rail.scrollTop = railScroll;
    const scroller = root.querySelector<HTMLElement>("[data-play-scroll]") ?? root.querySelector<HTMLElement>("[data-play-main]");
    if (scroller) scroller.scrollTop = mainScroll;
    const realm = root.querySelector<HTMLElement>("[data-realm-map]");
    if (realm) realm.scrollLeft = realmScroll;
    const hand = root.querySelector<HTMLElement>(".hand-row");
    if (hand) hand.scrollLeft = handScroll;
    window.scrollTo(pageScrollX, pageScrollY);
    root.scrollTop = rootScroll;
  };

  const pinNextClick = () => {
    const play = root.querySelector<HTMLElement>(".play");
    const bar = root.querySelector<HTMLElement>(".quick-coach");
    if (!play) return;
    const narrow = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1100px)").matches;
    play.style.paddingTop = narrow && bar ? `${bar.offsetHeight}px` : "";
  };

  const bringHighlightIntoView = () => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 1100px)") : null;
    if (!media?.matches) return;
    if (root.querySelector(".overlay:not(.pass-through)")) return;
    const realm = root.querySelector<HTMLElement>("[data-realm-map]");
    const nested = root.querySelector<HTMLElement>(".location.is-coached, .location .is-coached");
    const fromBoard = nested?.closest<HTMLElement>(".location") ?? null;
    const prompted = parseLocationId(root.querySelector<HTMLElement>("[data-move].is-coached")?.dataset.move);
    const loc = fromBoard ?? (prompted ? root.querySelector<HTMLElement>(`[data-loc="${prompted}"]`) : null);
    if (!loc || !realm || !realm.contains(loc) || realm.clientWidth <= 0) return;
    const locRect = loc.getBoundingClientRect();
    const realmRect = realm.getBoundingClientRect();
    if (locRect.width <= 0) return;
    if (locRect.left >= realmRect.left && locRect.right <= realmRect.right) return;
    const phoneShore = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 760px)").matches;
    const inset = phoneShore ? 0 : (realm.clientWidth - locRect.width) / 2;
    const left = realm.scrollLeft + (locRect.left - realmRect.left) - inset;
    realm.scrollLeft = Math.max(0, left);
  };

  // On the wide board the shore zones scroll (overflow:auto) when they hold more
  // mini cards than fit. A re-render resets every zone to the top, so a coached
  // card below the fold can sit hidden. Bring it back into its zone's view, clear
  // of the sticky zone label, so the highlighted card is never covered.
  const bringCoachedCardIntoView = () => {
    const desktop = typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1101px)").matches;
    if (!desktop) return;
    const topInset = 14;
    root.querySelectorAll<HTMLElement>(".location .zone").forEach((zone) => {
      const card = zone.querySelector<HTMLElement>(".card.is-coached");
      if (!card) return;
      const zr = zone.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      if (cr.height <= 0 || zr.height <= 0) return;
      if (cr.top >= zr.top + topInset && cr.bottom <= zr.bottom) return;
      if (cr.top < zr.top + topInset) zone.scrollTop += cr.top - zr.top - topInset;
      else if (cr.bottom > zr.bottom) zone.scrollTop += cr.bottom - zr.bottom + 2;
    });
  };

  const markShown = (forced?: LocationId) => {
    const realm = root.querySelector<HTMLElement>("[data-realm-map]");
    if (!realm || realm.clientWidth <= 0) return;
    const mid = realm.getBoundingClientRect().left + realm.clientWidth / 2;
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    for (const loc of realm.querySelectorAll<HTMLElement>(".location")) {
      const rect = loc.getBoundingClientRect();
      if (rect.width <= 0) continue;
      const dist = Math.abs(rect.left + rect.width / 2 - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = loc;
      }
    }
    const shown = forced ?? (best ? parseLocationId(best.dataset.loc) : null);
    realm.querySelectorAll<HTMLElement>(".location").forEach((loc) => {
      loc.classList.toggle("is-shown", shown !== null && loc.dataset.loc === shown);
    });
    root.querySelectorAll<HTMLElement>("[data-shore-tab]").forEach((tab) => {
      const on = shown !== null && tab.dataset.shoreTab === shown;
      tab.classList.toggle("is-shown", on);
      if (on) tab.setAttribute("aria-current", "true");
      else tab.removeAttribute("aria-current");
    });
  };

  const showShore = (id: LocationId) => {
    const realm = root.querySelector<HTMLElement>("[data-realm-map]");
    const loc = root.querySelector<HTMLElement>(`[data-loc="${id}"]`);
    if (!realm || !loc || realm.clientWidth <= 0) return;
    const locRect = loc.getBoundingClientRect();
    const realmRect = realm.getBoundingClientRect();
    const left = realm.scrollLeft + (locRect.left - realmRect.left);
    realm.scrollTo({ left: Math.max(0, left), behavior: motionReduced() ? "auto" : "smooth" });
    markShown(id);
  };

  const focusSignature = (el: Element | null): string | null => {
    const node = el instanceof HTMLElement ? el.closest("button") : null;
    if (!(node instanceof HTMLButtonElement)) return null;
    const data = Object.entries(node.dataset)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value ?? ""}`)
      .join("|");
    return `${data}|${node.className}`;
  };
  let savedFocus: string | null = null;
  let focusBeforeDialog: string | null = null;

  const topDialog = () => {
    const dialogs = [...root.querySelectorAll<HTMLElement>("[role=dialog]")];
    return dialogs[dialogs.length - 1] ?? null;
  };

  const restoreFocus = () => {
    const blocking = root.querySelector<HTMLElement>(".overlay:not(.pass-through)");
    const dialog = topDialog();
    const play = root.querySelector<HTMLElement>(".play");
    if (play && blocking) play.setAttribute("inert", "");
    else play?.removeAttribute("inert");
    if (inspectId) {
      root.querySelectorAll<HTMLButtonElement>("[data-resign]").forEach((btn) => btn.setAttribute("disabled", ""));
    }
    const buttons = [...root.querySelectorAll<HTMLButtonElement>("button")];
    if (dialog) {
      if (savedFocus) {
        const match = buttons.find((btn) => focusSignature(btn) === savedFocus);
        if (match && dialog.contains(match)) {
          match.focus({ preventScroll: true });
          return;
        }
      }
      const initial =
        dialog.querySelector<HTMLButtonElement>("[data-initial-focus]:not([disabled])") ??
        dialog.querySelector<HTMLButtonElement>("button:not([disabled])");
      initial?.focus({ preventScroll: true });
      return;
    }
    const restore = focusBeforeDialog ?? savedFocus;
    if (restore) {
      const match = buttons.find((btn) => focusSignature(btn) === restore);
      match?.focus({ preventScroll: true });
    }
  };

  const render = () => {
    state.coachOn = coachEnabled;
    const hadDialog = Boolean(root.querySelector("[role=dialog]"));
    const priorFocus = focusSignature(document.activeElement);
    savedFocus = priorFocus;
    if (!hadDialog) focusBeforeDialog = priorFocus;
    captureScroll();
    const movers = snapshotMovers(root);
    const inspect = inspectId ? inspectOverlay(state, inspectId) : "";
    const reason = reasonsEnabled ? lastReason : null;
    const sceneWarning = unknownSceneWarning();
    const lessonBeat = lesson ? lessonView(state, lesson) : null;
    if (state.screen === "title") root.innerHTML = titleView(difficulty, coachEnabled, briefEnabled, reasonsEnabled, sceneWarning);
    else if (state.screen === "help") {
      root.innerHTML =
        (state.phase === "title"
          ? titleView(difficulty, coachEnabled, briefEnabled, reasonsEnabled, sceneWarning)
          : playView(state, coachEnabled, briefEnabled, reasonsEnabled, reason, activeSceneId, lessonBeat, expandedCards, handRuleId)) +
        helpView(state.phase !== "title") +
        inspect;
    } else root.innerHTML = playView(state, coachEnabled, briefEnabled, reasonsEnabled, reason, activeSceneId, lessonBeat, expandedCards, handRuleId) + inspect;
    // When the teaching context changes (turn, phase, move, or the Coach line
    // itself), default to bringing the Coach back into view at the top of the
    // rail rather than keeping a scroll position that now hides the next move.
    const coachText = root.querySelector<HTMLElement>("[data-teach-rail] .coach-do")?.textContent?.trim() ?? "";
    const teachSig = `${state.turn}|${state.phase}|${state.villainLocation}|${state.usedActions.join(",")}|${coachText}`;
    if (teachSig !== lastTeachSig) {
      railScroll = 0;
      lastTeachSig = teachSig;
    }
    bindCardDrag();
    root.querySelector<HTMLElement>("[data-realm-map]")?.addEventListener("scroll", () => markShown(), { passive: true });
    restoreScroll();
    bringHighlightIntoView();
    bringCoachedCardIntoView();
    pinNextClick();
    markShown();
    restoreFocus();
    requestAnimationFrame(() => {
      restoreScroll();
      bringHighlightIntoView();
      bringCoachedCardIntoView();
      pinNextClick();
      markShown();
      playTravel(root, movers);
    });
  };

  const dispatch = (input: Input) => {
    inspectId = null;
    handRuleId = null;
    const before = state;
    state.coachOn = coachEnabled;
    state = applyInput(state, input);
    state.coachOn = coachEnabled;
    if (lesson) {
      const advanced = advanceLesson(lesson, before, state);
      const jumped = advanced.state !== state;
      lesson = advanced.step;
      state = advanced.state;
      if (jumped) {
        lastReason = {
          chose: "The lesson moves to the ship clash.",
          why: "You walked Peter one neighboring shore. This beat places him on the Jolly Roger with Strength 8 against two Pirate Brutes so the clash can be practiced. A normal voyage does not skip the rest of the walk.",
          next: "Click Vanquish, then Peter Pan, then both Pirate Brutes, then Confirm.",
        };
        render();
        return;
      }
    }
    const cue = cueFromTransition(before, state);
    if (cue) playCue(cue);
    const explained = explainSelection(before, input, state);
    if (explained) lastReason = explained;
    lastReason = liveMoveReason(state, lastReason);
    render();
  };

  root.addEventListener("click", (event) => {
    armSound();
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const t = event.target as HTMLElement;
    const handRule = t.closest<HTMLElement>("[data-hand-rule]");
    if (handRule?.dataset.handRule) {
      event.preventDefault();
      event.stopPropagation();
      handRuleId = handRuleId === handRule.dataset.handRule ? null : handRule.dataset.handRule;
      render();
      return;
    }
    if (t.closest("[data-hand-rule-close]")) {
      event.preventDefault();
      handRuleId = null;
      render();
      return;
    }
    const rule = t.closest<HTMLElement>("[data-rule-toggle]");
    if (rule?.dataset.ruleToggle) {
      event.preventDefault();
      event.stopPropagation();
      const id = rule.dataset.ruleToggle;
      if (expandedCards.has(id)) expandedCards.delete(id);
      else expandedCards.add(id);
      render();
      return;
    }
    const shore = t.closest<HTMLElement>("[data-shore-tab]");
    if (shore?.dataset.shoreTab) {
      event.preventDefault();
      const id = parseLocationId(shore.dataset.shoreTab);
      if (id) showShore(id);
      return;
    }
    if (t.closest("[data-sound-toggle]")) {
      const muted = !soundMuted();
      setSoundMuted(muted);
      if (!muted) playCue("move");
      render();
      return;
    }
    if (t.closest("[data-coach-toggle]")) {
      coachEnabled = !coachEnabled;
      writeFlag("nld-coach", coachEnabled);
      render();
      return;
    }
    if (t.closest("[data-brief-toggle]")) {
      briefEnabled = !briefEnabled;
      writeFlag("nld-brief", briefEnabled);
      render();
      return;
    }
    if (t.closest("[data-reasons-toggle]")) {
      reasonsEnabled = !reasonsEnabled;
      writeFlag("nld-reasons", reasonsEnabled);
      render();
      return;
    }
    const tutorial = t.closest<HTMLElement>("[data-tutorial]");
    if (tutorial) {
      coachEnabled = true;
      briefEnabled = true;
      reasonsEnabled = true;
      writeFlag("nld-coach", true);
      writeFlag("nld-brief", true);
      writeFlag("nld-reasons", true);
      activeSceneId = null;
      lesson = "move";
      inspectId = null;
      state = lessonOpening();
      lastReason = IDLE_MOVE_REASON;
      render();
      return;
    }
    const start = t.closest<HTMLElement>("[data-start]");
    if (start) {
      lesson = null;
      const staged = stagedScene();
      if (staged) {
        state = staged;
        lastReason = IDLE_MOVE_REASON;
        render();
        return;
      }
      activeSceneId = null;
      return dispatch({ type: "start", difficulty });
    }
    const diff = t.closest<HTMLElement>("[data-diff]");
    if (diff) {
      const nextDifficulty = parseDifficulty(diff.dataset.diff);
      if (!nextDifficulty) return;
      difficulty = nextDifficulty;
      render();
      return;
    }
    if (t.closest("[data-help]")) return dispatch({ type: "openHelp" });
    if (t.closest("[data-close-help]")) return dispatch({ type: "closeHelp" });
    if (t.closest("[data-resign]")) {
      const btn = t.closest("button");
      if (btn?.hasAttribute("disabled") || resignBlocked(state) || inspectId) return;
      return dispatch({ type: "resign" });
    }
    if (t.closest("[data-lesson-sail]")) {
      const sailDifficulty = state.difficulty;
      lesson = null;
      activeSceneId = null;
      inspectId = null;
      state = applyInput(state, { type: "start", difficulty: sailDifficulty });
      lastReason = IDLE_MOVE_REASON;
      render();
      return;
    }
    if (t.closest("[data-home]") || t.closest("[data-again]")) {
      difficulty = t.closest("[data-again]") ? state.difficulty : difficulty;
      if (t.closest("[data-again]")) {
        if (lesson) {
          lesson = "move";
          inspectId = null;
          state = lessonOpening();
          lastReason = IDLE_MOVE_REASON;
          render();
          return;
        }
        const staged = stagedScene();
        if (staged) {
          state = staged;
          lastReason = IDLE_MOVE_REASON;
          render();
          return;
        }
        activeSceneId = null;
        return dispatch({ type: "start", difficulty: state.difficulty });
      }
      lesson = null;
      activeSceneId = null;
      return dispatch({ type: "newGame" });
    }
    if (t.closest("[data-end]")) return dispatch({ type: "endTurn" });
    if (t.closest("[data-confirm]")) return dispatch({ type: "confirm" });
    if (t.closest("[data-cancel]")) return dispatch({ type: "cancel" });
    if (t.closest("[data-inspect-close]")) {
      inspectId = null;
      render();
      return;
    }
    if (t.closest("[data-ack]")) return dispatch({ type: "acknowledgeFate" });
    if (t.closest("[data-scare-discard]")) return dispatch({ type: "scareDiscardBoth" });
    const order = t.closest<HTMLElement>("[data-scare-order]");
    if (order) {
      const [a, b] = order.dataset.scareOrder!.split(",") as [string, string];
      return dispatch({ type: "scareReturn", order: [a, b] });
    }
    if (t.closest("[data-pay-map]")) return dispatch({ type: "payWithMap" });
    if (t.closest("[data-pay-power]")) return dispatch({ type: "payWithPower" });
    if (t.closest("[data-accept-cond]")) return dispatch({ type: "acceptCondition" });
    if (t.closest("[data-skip-cond]")) return dispatch({ type: "skipCondition" });
    if (t.closest("[data-play-hero]")) return dispatch({ type: "playOrDiscardHero", play: true });
    if (t.closest("[data-discard-hero]")) return dispatch({ type: "playOrDiscardHero", play: false });

    const cardEl = t.closest<HTMLElement>("[data-card]");
    if (cardEl && !t.closest(".overlay")) {
      const id = cardEl.dataset.card;
      const legal = Boolean(id && highlightSet(state).has(`card:${id}`));
      if (id && !legal) {
        if (shouldRefuseCard(state, id)) {
          dispatch({ type: "selectCard", instanceId: id });
          return;
        }
        inspectId = id;
        render();
        return;
      }
    }

    const boardInput = resolveBoardClick(t, state);
    if (boardInput) dispatch(boardInput);
  });

  root.addEventListener("keydown", (event) => {
    armSound();
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && event.target instanceof HTMLElement) {
      const realm = event.target.closest<HTMLElement>("[data-realm-map]");
      if (realm && event.target === realm) {
        const phoneShore = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 760px)").matches;
        if (phoneShore) {
          const shown = parseLocationId(realm.querySelector<HTMLElement>(".location.is-shown")?.dataset.loc);
          const here = shown ?? state.villainLocation;
          const idx = LOCATION_IDS.indexOf(here);
          const next = event.key === "ArrowRight" ? Math.min(LOCATION_IDS.length - 1, idx + 1) : Math.max(0, idx - 1);
          const id = LOCATION_IDS[next];
          if (id) showShore(id);
        } else realm.scrollBy({ left: event.key === "ArrowRight" ? 280 : -280 });
        event.preventDefault();
      }
    }
    if (event.key !== "Escape") return;
    if (inspectId) {
      event.preventDefault();
      inspectId = null;
      render();
      return;
    }
    if (state.screen === "help") {
      event.preventDefault();
      dispatch({ type: "closeHelp" });
      return;
    }
    if (state.phase === "over") {
      event.preventDefault();
      lesson = null;
      activeSceneId = null;
      dispatch({ type: "newGame" });
      return;
    }
    const kind = state.pending?.kind;
    const cancellable =
      kind === "playChooseCard" ||
      kind === "playChooseLocation" ||
      kind === "playChooseAllyAttach" ||
      kind === "playChoosePayment" ||
      kind === "conditionOffer" ||
      kind === "vanquishHero" ||
      kind === "vanquishAllies" ||
      kind === "vanquishConfirmLoss" ||
      kind === "discardSelect" ||
      kind === "movePieceSelect" ||
      kind === "movePieceDest" ||
      kind === "moveHeroSelect" ||
      kind === "moveHeroDest" ||
      kind === "cunningAlly" ||
      kind === "cunningLocation";
    if (!cancellable) return;
    event.preventDefault();
    dispatch({ type: "cancel" });
  });

  render();
}
