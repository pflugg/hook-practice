import {
  applyInput,
  availableActions,
  cardName,
  def,
  highlightSet,
  objectiveSteps,
  promptText,
  REALM,
  selectedSet,
  titleState,
  type CardInstance,
  type Difficulty,
  type GameState,
  type Input,
  type LocationId,
} from "../engine";
import { LOCATION_IDS } from "../engine/types";
import { allyStrength, attachmentsOn, heroStrength } from "../engine/queries";
import "./styles.css";

const CREST = `<svg class="crest" viewBox="0 0 92 92" aria-hidden="true">
  <circle cx="46" cy="46" r="44" fill="#1b1408" stroke="#e8c36a" stroke-width="3"/>
  <circle cx="46" cy="46" r="36" fill="none" stroke="#e8c36a" stroke-width="1.2" opacity=".55"/>
  <path d="M30 30c14-10 34-6 38 12-10 1-17 8-18 16 1 11 10 18 10 18s-22 1-30-14c-5-8-4-22 0-32z" fill="#e8c36a"/>
  <path d="M61 55c9 3 16 12 13 21-9-1-17-8-20-16 2-2 4-4 7-5z" fill="#d45a58"/>
  <circle cx="34" cy="34" r="3" fill="#1b1408"/>
</svg>`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

function typeLabel(t: string): string {
  return t[0].toUpperCase() + t.slice(1);
}

function renderCard(
  state: GameState,
  card: CardInstance,
  opts: { size?: "mini" | "hand"; legal: boolean; selected: boolean },
): string {
  const d = def(card.defId);
  const size = opts.size === "hand" ? "hand-card" : opts.size === "mini" ? "mini" : "";
  const str = d.type === "hero" ? heroStrength(state, card) : d.type === "ally" ? allyStrength(state, card) : 0;
  const attached = attachmentsOn(state, card.instanceId);
  const attachNote = attached.length ? `<p class="text">+ ${attached.map((a) => esc(def(a.defId).name)).join(", ")}</p>` : "";
  return `<button class="card ${d.type} ${size} ${opts.legal ? "is-legal" : ""} ${opts.selected ? "is-selected" : ""}" data-card="${card.instanceId}" title="${esc(d.name)} — ${esc(d.text)}">
    <div class="meta"><span class="badge">${typeLabel(d.type)}</span><span>${d.deck === "villain" ? d.cost : ""}</span></div>
    <h3>${esc(d.name)}</h3>
    <p class="text">${esc(d.text)}</p>
    ${attachNote}
    ${d.type === "hero" || d.type === "ally" ? `<div class="str">${str}</div>` : ""}
  </button>`;
}

function zone(title: string, body: string): string {
  return `<div class="zone"><h3>${title}</h3>${body}</div>`;
}

function renderLocation(state: GameState, id: LocationId, hi: Set<string>, sel: Set<string>): string {
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
        return `<button class="action ${a.covered ? "is-covered" : ""} ${a.used ? "is-used" : ""} ${legalAct ? "is-legal" : ""}" data-act="${a.key}" ${a.covered || a.used || !showLegalActs ? "disabled" : ""}>${esc(a.label)}</button>`;
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
            }),
          )
          .join("")}</div>`
      : `<p class="empty">${empty}</p>`;

  return `<section class="location ${id} ${current ? "is-current" : ""} ${legal ? "is-legal" : ""} ${locked ? "is-locked" : ""}" data-loc="${id}">
    ${legal ? `<div class="drop-hint">Choose this place</div>` : ""}
    <div class="loc-head">
      <div>
        <h2>${esc(meta.name)} ${locked ? `<span class="lock-badge">Locked</span>` : ""}</h2>
        <p>${esc(meta.subtitle)}${locked ? " — play the Never Land Map to open the path" : ""}</p>
      </div>
      ${current ? `<div class="hook-token" title="Captain">${CREST.replace('class="crest"', 'width="28" height="28"')}</div>` : ""}
    </div>
    ${actBtns(top)}
    ${zone("Heroes", cards("Clear — top actions are open.", loc.heroes))}
    ${zone("Allies", cards("No crew stationed.", loc.allies))}
    ${zone("Items", cards("No gear here.", loc.items))}
    ${actBtns(bottom)}
    ${extras.length ? `<div class="row">${extras.map((a) => `<button class="action ${hi.has(`act:${a.key}`) ? "is-legal" : ""} ${a.used ? "is-used" : ""}" data-act="${a.key}">${esc(a.label)}</button>`).join("")}</div>` : ""}
  </section>`;
}

function titleView(difficulty: Difficulty): string {
  return `<div class="stars"></div><div class="grain"></div>
  <main class="title-screen">
    <section class="title-card">
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
      <div class="actions-row">
        <button class="btn primary" data-start>Set Sail</button>
        <button class="btn ghost" data-help>How to play</button>
      </div>
      <p class="fine">Original UI and paraphrased abilities. Personal practice tool — not an official product.</p>
    </section>
  </main>`;
}

function helpView(fromPlay: boolean): string {
  return `<div class="overlay"><div class="modal">
    <h2>How to play</h2>
    <p>Each turn you <b>must move</b> to a different unlocked location, then may use each uncovered action there once. Heroes cover the top row. End the turn to refill to 4 cards; the computer then Fates you.</p>
    <p><b>Win</b> by vanquishing Peter Pan at the Jolly Roger after unlocking Hangman’s Tree with the Never Land Map. Vanquishing him anywhere else loses the duel.</p>
    <p><b>Practice tips:</b> Discard aggressively for the Map. Fish Fate with Worthy Opponent and Give Them a Scare. Station strength at the ship before walking Peter across. Beware Tick Tock and Splitting Headache.</p>
    <div class="actions-row"><button class="btn primary" data-close-help>${fromPlay ? "Return to the realm" : "Back"}</button></div>
  </div></div>`;
}

function overlayFor(state: GameState, hi: Set<string>, sel: Set<string>): string {
  const p = state.pending;
  if (state.phase === "over") {
    return `<div class="overlay"><div class="modal ${state.won ? "win" : "lose"}">
      <h2>${state.won ? "The ship is yours" : "The tide turns"}</h2>
      <p>${esc(state.won ? "Peter Pan is vanquished at the Jolly Roger. The objective chain is complete." : state.loseReason)}</p>
      <div class="actions-row">
        <button class="btn primary" data-again>Play again</button>
        <button class="btn ghost" data-home>Return to title</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "fateReport") {
    return `<div class="overlay"><div class="modal">
      <h2>Fate intervening</h2>
      <p>${esc(p.note)}</p>
      <div class="modal-cards">${p.drawn
        .map((c) => renderCard(state, c, { size: "hand", legal: p.played?.instanceId === c.instanceId, selected: false }))
        .join("")}</div>
      <div class="actions-row"><button class="btn primary" data-ack>Continue</button></div>
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
        <button class="btn" data-scare-discard>Banish both</button>
        <button class="btn" data-scare-order="${p.cards[0].instanceId},${p.cards[1]?.instanceId ?? p.cards[0].instanceId}">${esc(cardName(p.cards[0]))} on top</button>
        ${p.cards[1] ? `<button class="btn" data-scare-order="${p.cards[1].instanceId},${p.cards[0].instanceId}">${esc(cardName(p.cards[1]))} on top</button>` : ""}
      </div>
    </div></div>`;
  }
  if (p?.kind === "fateChooseCard") {
    return `<div class="overlay"><div class="modal">
      <h2>Your Fate action</h2>
      <p>Play one card; the other is discarded.</p>
      <div class="modal-cards">${p.cards
        .map((c) => renderCard(state, c, { size: "hand", legal: hi.has(`card:${c.instanceId}`), selected: sel.has(c.instanceId) }))
        .join("")}</div>
    </div></div>`;
  }
  if (p?.kind === "playChoosePayment") {
    return `<div class="overlay"><div class="modal">
      <h2>Pay the cost</h2>
      <p>Spend Power, or discard the Never Land Map to cover this Item.</p>
      <div class="actions-row">
        <button class="btn primary" data-pay-power>Pay Power</button>
        <button class="btn" data-pay-map>Discard the Map</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "conditionOffer") {
    return `<div class="overlay"><div class="modal">
      <h2>A Condition is ready</h2>
      <p>${esc(p.reason)}</p>
      <div class="actions-row">
        <button class="btn primary" data-accept-cond>Play it</button>
        <button class="btn ghost" data-skip-cond>Not now</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "obsessionDecide") {
    return `<div class="overlay"><div class="modal">
      <h2>Obsession</h2>
      <p>A Hero was found. Play them into the realm, or banish them?</p>
      <div class="actions-row">
        <button class="btn primary" data-play-hero>Play the Hero</button>
        <button class="btn" data-banish-hero>Banish</button>
      </div>
    </div></div>`;
  }
  return "";
}

function playView(state: GameState): string {
  const hi = highlightSet(state);
  const sel = selectedSet(state);
  const steps = objectiveSteps(state);
  const promptButtons: string[] = [];
  if (state.phase === "actions" && !state.pending) {
    promptButtons.push(`<button class="btn primary" data-end>End turn</button>`);
  }
  if (state.pending && ["discardSelect", "vanquishAllies"].includes(state.pending.kind)) {
    promptButtons.push(`<button class="btn primary" data-confirm>Confirm</button>`);
  }
  if (
    state.phase === "resolving" &&
    state.pending &&
    !["scarePeek", "fateChooseCard", "fateReport"].includes(state.pending.kind)
  ) {
    promptButtons.push(`<button class="btn ghost" data-cancel>Cancel</button>`);
  }
  if (state.pending?.kind === "tinkerDiscard") {
    promptButtons.push(`<button class="btn ghost" data-skip-cond>Skip discard</button>`);
  }

  return `<div class="stars"></div><div class="grain"></div>
  <div class="play">
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
        <button class="chip" data-help>Help</button>
        <button class="chip" data-resign>Resign</button>
      </div>
    </header>
    <div class="prompt"><p>${esc(promptText(state))}</p><div class="prompt-actions">${promptButtons.join("")}</div></div>
    <div class="board-wrap"><div class="board">${LOCATION_IDS.map((id) => renderLocation(state, id, hi, sel)).join("")}</div></div>
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
  ${overlayFor(state, hi, sel)}`;
}

export function mount(root: HTMLElement): void {
  let state: GameState = titleState();
  let difficulty: Difficulty = "normal";

  const render = () => {
    if (state.screen === "title") root.innerHTML = titleView(difficulty);
    else if (state.screen === "help") {
      root.innerHTML = (state.phase === "title" ? titleView(difficulty) : playView(state)) + helpView(state.phase !== "title");
    } else root.innerHTML = playView(state);
  };

  const dispatch = (input: Input) => {
    state = applyInput(state, input);
    render();
  };

  root.addEventListener("click", (event) => {
    const t = event.target as HTMLElement;
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

    const card = t.closest<HTMLElement>("[data-card]");
    if (card) return dispatch({ type: "selectCard", instanceId: card.dataset.card! });
    const act = t.closest<HTMLElement>("[data-act]");
    if (act && !act.hasAttribute("disabled")) return dispatch({ type: "selectAction", actionKey: act.dataset.act! });
    const loc = t.closest<HTMLElement>("[data-loc]");
    if (loc) return dispatch({ type: "selectLocation", locationId: loc.dataset.loc as LocationId });
  });

  render();
}
