import {
  advise,
  applyInput,
  availableActions,
  cardName,
  def,
  findCard,
  highlightSet,
  objectiveSteps,
  promptText,
  REALM,
  selectedSet,
  strategyBrief,
  titleState,
  type CardInstance,
  type CoachAdvice,
  type Difficulty,
  type GameState,
  type Input,
  type LocationId,
  type StrategyBrief,
} from "../engine";
import { LOCATION_IDS } from "../engine/types";
import { allAllies, allyStrength, attachmentsOn, heroStrength } from "../engine/queries";
import { cutlassAttachScene } from "../engine/scenes";
import { resolveBoardClick } from "./clicks";
import { CREST, TITLE_SCENE, locationDecor } from "./decor";
import "./styles.css";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

function typeLabel(t: string): string {
  return t[0].toUpperCase() + t.slice(1);
}

function renderCard(
  state: GameState,
  card: CardInstance,
  opts: { size?: "mini" | "hand"; legal: boolean; selected: boolean; dimmed?: boolean; coached?: boolean },
): string {
  const d = def(card.defId);
  const size = opts.size === "hand" ? "hand-card" : opts.size === "mini" ? "mini" : "";
  const str = d.type === "hero" ? heroStrength(state, card) : d.type === "ally" ? allyStrength(state, card) : 0;
  const attached = attachmentsOn(state, card.instanceId);
  const attachNote = attached.length ? `<p class="text">+ ${attached.map((a) => esc(def(a.defId).name)).join(", ")}</p>` : "";
  return `<button class="card ${d.type} ${size} ${opts.legal ? "is-legal" : ""} ${opts.selected ? "is-selected" : ""} ${opts.dimmed ? "is-dimmed" : ""} ${opts.coached ? "is-coached" : ""}" data-card="${card.instanceId}" title="${esc(d.name)} — ${esc(d.text)}">
    ${opts.legal && opts.size === "hand" && (state.pending?.kind === "playChooseCard" || state.pending?.kind === "cunningAlly") ? `<span class="playable-tag">Playable</span>` : ""}
    <div class="meta">
      <span class="badge">${typeLabel(d.type)}</span>
      ${d.deck === "villain" ? `<span class="cost" title="Power cost">${d.cost}</span>` : `<span class="fate-mark">Fate</span>`}
    </div>
    <h3>${esc(d.name)}</h3>
    <p class="text">${esc(d.text)}</p>
    ${attachNote}
    ${d.type === "hero" || d.type === "ally" ? `<div class="str" title="Strength">${str}</div>` : ""}
  </button>`;
}

function zone(title: string, body: string): string {
  return `<div class="zone"><h3>${title}</h3>${body}</div>`;
}

function renderLocation(state: GameState, id: LocationId, hi: Set<string>, sel: Set<string>, coached: Set<string>): string {
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
  const showLegalActs = state.villainLocation === id;

  const actBtns = (list: typeof printed) =>
    `<div class="row">${list
      .map((a) => {
        const legalAct = showLegalActs && hi.has(`act:${a.key}`);
        const coachAct = legalAct && coached.has(`act:${a.key}`);
        return `<button class="action ${a.covered ? "is-covered" : ""} ${a.used ? "is-used" : ""} ${legalAct ? "is-legal" : ""} ${coachAct ? "is-coached" : ""}" data-act="${a.key}" ${a.covered || a.used || !showLegalActs ? "disabled" : ""}>${esc(a.label)}</button>`;
      })
      .join("")}</div>`;

  const cards = (empty: string, arr: CardInstance[]) =>
    arr.length
      ? `<div class="zone-cards">${arr
          .map((c) =>
            renderCard(state, c, {
              size: "mini",
              legal: hi.has(`card:${c.instanceId}`),
              selected: sel.has(c.instanceId),
              coached: coached.has(`card:${c.instanceId}`),
            }),
          )
          .join("")}</div>`
      : `<p class="empty">${empty}</p>`;

  const moveLabel = state.phase === "move" ? "Move here" : "Choose this place";
  const coachLoc = legal && coached.has(`loc:${id}`);
  return `<section class="location ${id} ${current ? "is-current" : ""} ${legal ? "is-legal" : ""} ${coachLoc ? "is-coached" : ""} ${locked ? "is-locked" : ""}" data-loc="${id}">
    <div class="loc-atmos" aria-hidden="true">${locationDecor(id)}</div>
    <div class="loc-vignette" aria-hidden="true"></div>
    ${legal ? `<button type="button" class="drop-hint" data-move="${id}">${moveLabel}</button>` : ""}
    <div class="loc-head">
      <div>
        <h2>${esc(meta.name)} ${locked ? `<span class="lock-badge">Locked</span>` : ""}</h2>
        <p>${esc(meta.subtitle)}${locked ? " — play the Never Land Map to open the path" : ""}</p>
      </div>
      ${current ? `<div class="hook-token" title="Captain">${CREST.replace('class="crest"', 'class="token-crest"')}</div>` : ""}
    </div>
    ${actBtns(top)}
    ${zone("Heroes", cards("Clear — top actions are open.", loc.heroes))}
    ${zone("Allies", cards("No crew stationed.", loc.allies))}
    ${zone("Items", cards("No gear here.", loc.items))}
    ${actBtns(bottom)}
    ${extras.length ? `<div class="row">${extras.map((a) => `<button class="action ${hi.has(`act:${a.key}`) ? "is-legal" : ""} ${coached.has(`act:${a.key}`) ? "is-coached" : ""} ${a.used ? "is-used" : ""}" data-act="${a.key}">${esc(a.label)}</button>`).join("")}</div>` : ""}
  </section>`;
}

function titleView(difficulty: Difficulty, coachEnabled: boolean, briefEnabled: boolean): string {
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
      <div class="diff coach-diff">
        <button type="button" data-coach-toggle class="${coachEnabled ? "is-on" : ""}">${coachEnabled ? "Coach on" : "Coach off"}</button>
        <button type="button" data-brief-toggle class="${briefEnabled ? "is-on" : ""}">${briefEnabled ? "Strategy brief on" : "Strategy brief off"}</button>
      </div>
      <p class="coach-lede">Coach names the next click. The Strategy brief is a longer sidebar: where you are, what this moment is, and what it sets up on the win chain. Tutorial starts both on. You can hide either during play.</p>
      <div class="actions-row">
        <button class="btn primary" data-tutorial>Tutorial</button>
        <button class="btn" data-start>Set Sail</button>
        <button class="btn ghost" data-help>How to play</button>
      </div>
      <p class="fine">Unofficial personal practice tool. Not affiliated with, endorsed by, or associated with Disney or Ravensburger.</p>
    </section>
  </main>`;
}

function helpView(fromPlay: boolean): string {
  return `<div class="overlay"><div class="modal wood">
    <h2>How to play</h2>
    <p>Each turn you <b>must move</b> to a different unlocked location, then may use each uncovered action there once. Heroes cover the top row. End the turn to refill to 4 cards; the computer then Fates you.</p>
    <p><b>Win</b> by vanquishing Peter Pan at the Jolly Roger after unlocking Hangman’s Tree with the Never Land Map. Vanquishing him anywhere else loses the duel.</p>
    <p><b>Coach:</b> names the next legal click and why it helps. Other legal options stay clickable.</p>
    <p><b>Strategy brief:</b> a persistent sidebar that teaches the voyage — objective progress, the current board, what this phase is for, and what the turn is setting up. Distinct from Coach. Tutorial starts both on; hide either from the top bar.</p>
    <p><b>Practice tips:</b> Discard aggressively for the Map. Fish Fate with Worthy Opponent and Give Them a Scare. Station strength at the ship before walking Peter across. Beware Tick Tock and Splitting Headache.</p>
    <div class="actions-row"><button class="btn primary" data-close-help>${fromPlay ? "Return to the realm" : "Back"}</button></div>
  </div></div>`;
}

function coachClass(coached: Set<string>, key: string): string {
  return coached.has(key) ? " is-coached" : "";
}

function overlayFor(state: GameState, hi: Set<string>, sel: Set<string>, coached: Set<string>): string {
  const p = state.pending;
  if (state.phase === "over") {
    return `<div class="overlay"><div class="modal wood ${state.won ? "win celebrate" : "lose"}">
      <h2>${state.won ? "The ship is yours" : "The tide turns"}</h2>
      <p>${esc(state.won ? "Peter Pan is vanquished at the Jolly Roger. The objective chain is complete." : state.loseReason)}</p>
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:again")}" data-again>Play again</button>
        <button class="btn ghost" data-home>Return to title</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "fateReport") {
    return `<div class="overlay fate-in"><div class="modal wood fate">
      <p class="eyebrow">Across the table</p>
      <h2>Fate intervening</h2>
      <p>${esc(p.note)}</p>
      <div class="modal-cards">${p.drawn
        .map((c) => {
          const focus = p.played?.instanceId === c.instanceId;
          return `<div class="${focus ? "is-focus" : "is-aside"}">${renderCard(state, c, { size: "hand", legal: false, selected: focus })}</div>`;
        })
        .join("")}</div>
      <div class="actions-row"><button class="btn primary${coachClass(coached, "btn:ack")}" data-ack>Continue</button></div>
    </div></div>`;
  }
  if (p?.kind === "scarePeek") {
    return `<div class="overlay"><div class="modal">
      <h2>Give Them a Scare</h2>
      <p>Banish both, or return them with the first button’s card on top.</p>
      <div class="modal-cards">${p.cards
        .map((c) => renderCard(state, c, { size: "hand", legal: true, selected: false }))
        .join("")}</div>
      <div class="actions-row">
        <button class="btn${coachClass(coached, "btn:scare-discard")}" data-scare-discard>Banish both</button>
        <button class="btn${coachClass(coached, `btn:scare-order:${p.cards[0].instanceId},${p.cards[1]?.instanceId ?? p.cards[0].instanceId}`)}" data-scare-order="${p.cards[0].instanceId},${p.cards[1]?.instanceId ?? p.cards[0].instanceId}">${esc(cardName(p.cards[0]))} on top</button>
        ${p.cards[1] ? `<button class="btn${coachClass(coached, `btn:scare-order:${p.cards[1].instanceId},${p.cards[0].instanceId}`)}" data-scare-order="${p.cards[1].instanceId},${p.cards[0].instanceId}">${esc(cardName(p.cards[1]))} on top</button>` : ""}
      </div>
    </div></div>`;
  }
  if (p?.kind === "fateChooseCard") {
    return `<div class="overlay"><div class="modal">
      <h2>Your Fate action</h2>
      <p>Play one card; the other is discarded.</p>
      <div class="modal-cards">${p.cards
        .map((c) => renderCard(state, c, { size: "hand", legal: hi.has(`card:${c.instanceId}`), selected: sel.has(c.instanceId), coached: coached.has(`card:${c.instanceId}`) }))
        .join("")}</div>
    </div></div>`;
  }
  if (p?.kind === "playChoosePayment") {
    return `<div class="overlay"><div class="modal">
      <h2>Pay the cost</h2>
      <p>Spend Power, or discard the Never Land Map to cover this Item.</p>
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:pay-power")}" data-pay-power>Pay Power</button>
        <button class="btn${coachClass(coached, "btn:pay-map")}" data-pay-map>Discard the Map</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "conditionOffer") {
    return `<div class="overlay"><div class="modal">
      <h2>A Condition is ready</h2>
      <p>${esc(p.reason)}</p>
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:accept-cond")}" data-accept-cond>Play it</button>
        <button class="btn ghost${coachClass(coached, "btn:skip-cond")}" data-skip-cond>Not now</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "obsessionDecide") {
    return `<div class="overlay"><div class="modal">
      <h2>Obsession</h2>
      <p>A Hero was found. Play them into the realm, or banish them?</p>
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:play-hero")}" data-play-hero>Play the Hero</button>
        <button class="btn${coachClass(coached, "btn:banish-hero")}" data-banish-hero>Banish</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "playChooseAllyAttach") {
    const item = findCard(state, p.cardId);
    const itemName = item ? cardName(item) : "Cutlass";
    const allies = allAllies(state);
    return `<div class="overlay pass-through"><div class="modal wood attach-picker">
      <p class="eyebrow">Arm an Ally</p>
      <h2>Strap ${esc(itemName)}</h2>
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
                <button type="button" class="btn primary${strapClass}" data-card="${a.ally.instanceId}">Strap ${esc(itemName)} to ${esc(cardName(a.ally))}</button>
              </li>`;
              })
              .join("")}</ul>`
          : `<p class="empty">No Allies are ashore. Cancel and play a crew member first.</p>`
      }
      <div class="actions-row"><button class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel>Cancel</button></div>
    </div></div>`;
  }
  return "";
}

function coachPanel(advice: CoachAdvice): string {
  return `<aside class="coach-panel" aria-live="polite">
    <div class="coach-copy">
      <p class="coach-kicker">Coach</p>
      <p class="coach-do">${esc(advice.do)}</p>
      <p class="coach-why">${esc(advice.why)}</p>
      ${advice.warning ? `<p class="coach-warn">${esc(advice.warning)}</p>` : ""}
    </div>
    <button type="button" class="btn ghost coach-hide" data-coach-toggle>Hide coach</button>
  </aside>`;
}

function strategySidebar(brief: StrategyBrief): string {
  return `<aside class="strategy-brief" aria-label="Strategy brief">
    <header class="brief-head">
      <div>
        <p class="brief-kicker">Strategy brief</p>
        <h2>How the voyage stands</h2>
      </div>
      <button type="button" class="btn ghost brief-hide" data-brief-toggle>Hide brief</button>
    </header>
    <section class="brief-block">
      <h3>Objective progress</h3>
      <ol class="brief-objectives">
        ${brief.objective
          .map(
            (line) => `<li class="${line.done ? "is-done" : ""}">
          <div class="brief-obj-title"><span class="brief-pip"></span><strong>${esc(line.label)}</strong></div>
          <p>${esc(line.status)}</p>
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
  </aside>`;
}

function playView(state: GameState, coachEnabled: boolean, briefEnabled: boolean): string {
  const hi = highlightSet(state);
  const sel = selectedSet(state);
  const advice = coachEnabled ? advise(state) : null;
  const coached = new Set(advice?.highlights ?? []);
  const steps = objectiveSteps(state);
  const promptButtons: string[] = [];
  if (state.phase === "actions" && !state.pending) {
    promptButtons.push(`<button class="btn primary${coachClass(coached, "btn:end")}" data-end>End turn</button>`);
  }
  if (state.pending && ["discardSelect", "vanquishAllies"].includes(state.pending.kind)) {
    promptButtons.push(`<button class="btn primary${coachClass(coached, "btn:confirm")}" data-confirm>Confirm</button>`);
  }
  const canCancelPlay =
    state.pending &&
    ["playChooseCard", "playChooseLocation", "playChooseAllyAttach"].includes(state.pending.kind);
  if (
    canCancelPlay ||
    (state.phase === "resolving" &&
      state.pending &&
      !["scarePeek", "fateChooseCard", "fateReport"].includes(state.pending.kind))
  ) {
    if (!promptButtons.some((b) => b.includes("data-cancel"))) {
      promptButtons.push(`<button class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel>Cancel</button>`);
    }
  }
  if (state.pending?.kind === "tinkerDiscard") {
    promptButtons.push(`<button class="btn ghost${coachClass(coached, "btn:skip-cond")}" data-skip-cond>Skip discard</button>`);
  }

  const brief = briefEnabled ? strategyBrief(state) : null;

  return `<div class="sky play-sky" aria-hidden="true"><div class="stars"></div><div class="fog fog-a"></div></div>
  <div class="grain"></div>
  <div class="play ${coachEnabled ? "has-coach" : ""} ${briefEnabled ? "has-brief" : ""}">
    <header class="topbar">
      <div class="brand">${CREST}<div><h1>Never Land Duel</h1><small>Hook Practice</small></div></div>
      <div class="stepper">
        <div class="step ${steps.map ? "is-done" : ""}"><span class="dot"></span>Map</div>
        <div class="step ${steps.peter ? "is-done" : ""}"><span class="dot"></span>Peter revealed</div>
        <div class="step ${steps.atRoger ? "is-done" : ""}"><span class="dot"></span>At the Roger</div>
        <div class="step ${steps.win ? "is-done" : ""}"><span class="dot"></span>Vanquished</div>
      </div>
      <div class="meters">
        <div class="power"><span>Power</span><b>${state.power}</b></div>
        <div class="chip">Turn ${state.turn}</div>
        <div class="chip">${state.difficulty === "easy" ? "Easy Fate" : "Normal Fate"}</div>
        <button type="button" class="chip ${coachEnabled ? "is-on" : ""}" data-coach-toggle>${coachEnabled ? "Coach on" : "Coach off"}</button>
        <button type="button" class="chip ${briefEnabled ? "is-on" : ""}" data-brief-toggle>${briefEnabled ? "Brief on" : "Brief off"}</button>
        <button class="chip" data-help>Help</button>
        <button class="chip" data-resign>Resign</button>
      </div>
    </header>
    <div class="prompt-stack">
      <div class="prompt"><p>${esc(promptText(state))}</p><div class="prompt-actions">${promptButtons.join("")}</div></div>
      ${advice ? coachPanel(advice) : ""}
    </div>
    <div class="board-wrap"><div class="board">${LOCATION_IDS.map((id) => renderLocation(state, id, hi, sel, coached)).join("")}</div></div>
    ${brief ? strategySidebar(brief) : ""}
    <footer class="dock">
      <section class="hand ${state.pending?.kind === "playChooseCard" || state.pending?.kind === "discardSelect" ? "is-picking" : ""}">
        <h2>Hand · ${state.hand.length} · Deck ${state.villainDeck.length} · Discard ${state.villainDiscard.length}</h2>
        <div class="hand-row">
          ${
            state.hand.length
              ? state.hand
                  .map((c) =>
                    renderCard(state, c, {
                      size: "hand",
                      legal: hi.has(`card:${c.instanceId}`),
                      selected: sel.has(c.instanceId),
                      dimmed: Boolean(state.pending && ["playChooseCard", "discardSelect", "cunningAlly"].includes(state.pending.kind) && !hi.has(`card:${c.instanceId}`)),
                      coached: coached.has(`card:${c.instanceId}`),
                    }),
                  )
                  .join("")
              : `<p class="empty">Your hand is empty. End the turn to draw back up — unless Tick Tock just snapped it away.</p>`
          }
        </div>
      </section>
      <aside class="log">
        <h2>Log · Fate ${state.fateDeck.length}</h2>
        <ol>${state.log.map((e) => `<li class="${e.tone}">${esc(e.text)}</li>`).join("")}</ol>
      </aside>
    </footer>
  </div>
  ${overlayFor(state, hi, sel, coached)}`;
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

function bootState(): GameState {
  try {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("scene") === "cutlass") {
      return cutlassAttachScene();
    }
  } catch {
    /* ignore */
  }
  return titleState();
}

export function mount(root: HTMLElement): void {
  let state: GameState = bootState();
  let difficulty: Difficulty = "normal";
  let coachEnabled = readFlag("nld-coach");
  let briefEnabled = readFlag("nld-brief");

  const render = () => {
    if (state.screen === "title") root.innerHTML = titleView(difficulty, coachEnabled, briefEnabled);
    else if (state.screen === "help") {
      root.innerHTML =
        (state.phase === "title" ? titleView(difficulty, coachEnabled, briefEnabled) : playView(state, coachEnabled, briefEnabled)) +
        helpView(state.phase !== "title");
    } else root.innerHTML = playView(state, coachEnabled, briefEnabled);
  };

  const dispatch = (input: Input) => {
    state = applyInput(state, input);
    render();
  };

  root.addEventListener("click", (event) => {
    const t = event.target as HTMLElement;
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
    const tutorial = t.closest<HTMLElement>("[data-tutorial]");
    if (tutorial) {
      coachEnabled = true;
      briefEnabled = true;
      writeFlag("nld-coach", true);
      writeFlag("nld-brief", true);
      return dispatch({ type: "start", difficulty });
    }
    const start = t.closest<HTMLElement>("[data-start]");
    if (start) return dispatch({ type: "start", difficulty });
    const diff = t.closest<HTMLElement>("[data-diff]");
    if (diff) {
      difficulty = diff.dataset.diff as Difficulty;
      render();
      return;
    }
    if (t.closest("[data-help]")) return dispatch({ type: "openHelp" });
    if (t.closest("[data-close-help]")) return dispatch({ type: "closeHelp" });
    if (t.closest("[data-resign]")) return dispatch({ type: "resign" });
    if (t.closest("[data-home]") || t.closest("[data-again]")) {
      difficulty = t.closest("[data-again]") ? state.difficulty : difficulty;
      if (t.closest("[data-again]")) return dispatch({ type: "start", difficulty: state.difficulty });
      return dispatch({ type: "newGame" });
    }
    if (t.closest("[data-end]")) return dispatch({ type: "endTurn" });
    if (t.closest("[data-confirm]")) return dispatch({ type: "confirm" });
    if (t.closest("[data-cancel]")) return dispatch({ type: "cancel" });
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
    if (t.closest("[data-banish-hero]")) return dispatch({ type: "playOrDiscardHero", play: false });

    const boardInput = resolveBoardClick(t, state);
    if (boardInput) dispatch(boardInput);
  });

  render();
}
