import {
  advise,
  applyInput,
  availableActions,
  cardName,
  def,
  findCard,
  HEADACHE_NO_ITEM_BANNER,
  HEADACHE_NO_ITEM_NOTE,
  fateEmptyLine,
  fateShowStillInPlay,
  highlightSet,
  isNoItemFateDiscard,
  promptText,
  REALM,
  selectedSet,
  strategyBrief,
  explainSelection,
  IDLE_MOVE_REASON,
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
  cutlassAttachScene,
  dragHeroScene,
  easyFizzleScene,
  fateSpentScene,
  obsessionDecideScene,
  payNoMapScene,
  peterSoftConfirmScene,
  tickTockOntoCaptainScene,
  tickTockReportScene,
  vanquishClashScene,
  vanquishLocalScene,
} from "../engine/scenes";
import { resolveBoardClick } from "./clicks";
import { dropTargets, inputsForDrop, isDraggableCard } from "./drag";
import { CAPTAIN_TOKEN, CREST, TITLE_SCENE, locationDecor } from "./decor";
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
  opts: {
    size?: "mini" | "hand" | "reveal";
    legal: boolean;
    selected: boolean;
    dimmed?: boolean;
    coached?: boolean;
    inspectable?: boolean;
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
  return `<button type="button" class="card ${d.type} ${size} ${opts.legal ? "is-legal" : ""} ${opts.selected ? "is-selected" : ""} ${opts.dimmed ? "is-dimmed" : ""} ${opts.coached ? "is-coached" : ""} ${inspectable ? "is-inspectable" : ""} ${draggable ? "is-draggable" : ""} ${spentObsession ? "is-spent" : ""}" data-card="${card.instanceId}" ${spentObsession ? 'data-spent="obsession"' : ""} title="${esc(d.name)} — ${esc(cardText)}" aria-label="${esc(d.name)}. ${esc(cardText)}">
    ${opts.legal && opts.size === "hand" && (state.pending?.kind === "playChooseCard" || state.pending?.kind === "cunningAlly") ? `<span class="playable-tag">Playable</span>` : ""}
    ${spentObsession ? `<span class="spent-tag">Spent</span>` : ""}
    ${typeBar}
    <h3>${esc(d.name)}</h3>
    <p class="text">${esc(cardText)}</p>
    ${attachNote}
    ${d.type === "hero" || d.type === "ally" ? `<div class="str" title="Strength">${str}</div>` : ""}
  </button>`;
}

function abilityReadout(title: string, text: string): string {
  if (!text) return "";
  return `<div class="ability-readout">
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
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
        const legalAct = showLegalActs && !locked && hi.has(`act:${a.key}`);
        const coachAct = legalAct && coached.has(`act:${a.key}`);
        return `<button class="action ${a.covered ? "is-covered" : ""} ${a.used ? "is-used" : ""} ${legalAct ? "is-legal" : ""} ${coachAct ? "is-coached" : ""}" data-act="${a.key}" ${a.covered || a.used || !showLegalActs || locked ? "disabled" : ""}>${esc(a.label)}</button>`;
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
              inspectable: true,
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
        <h2>${esc(meta.name)} ${locked ? `<span class="lock-badge">LOCKED</span>` : ""}</h2>
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
    <div class="loc-body">
      ${locked ? `<div class="lock-veil" aria-hidden="true"></div>` : ""}
      ${actBtns(top)}
      ${zone("Heroes", cards("Clear — top actions are open.", loc.heroes))}
      ${zone("Allies", cards("No crew stationed.", loc.allies))}
      ${zone("Items", cards("No gear here.", loc.items))}
      ${actBtns(bottom)}
      ${extras.length ? `<div class="row">${extras.map((a) => `<button class="action ${!locked && hi.has(`act:${a.key}`) ? "is-legal" : ""} ${!locked && coached.has(`act:${a.key}`) ? "is-coached" : ""} ${a.used ? "is-used" : ""}" data-act="${a.key}" ${locked ? "disabled" : ""}>${esc(a.label)}</button>`).join("")}</div>` : ""}
    </div>
  </section>`;
}

function titleView(
  difficulty: Difficulty,
  coachEnabled: boolean,
  briefEnabled: boolean,
  reasonsEnabled: boolean,
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
      <div class="diff coach-diff">
        <button type="button" data-coach-toggle class="${coachEnabled ? "is-on" : ""}">${coachEnabled ? "Coach on" : "Coach off"}</button>
        <button type="button" data-brief-toggle class="${briefEnabled ? "is-on" : ""}">${briefEnabled ? "Strategy brief on" : "Strategy brief off"}</button>
        <button type="button" data-reasons-toggle class="${reasonsEnabled ? "is-on" : ""}">${reasonsEnabled ? "Move reasons on" : "Move reasons off"}</button>
      </div>
      <p class="coach-lede">Coach names the next click. The Strategy brief, Coach, and <b>Why this move</b> stack in the right teaching rail — each pane scrolls on its own. Move reasons names what you picked, why it helps the chain, and what to watch. Tutorial starts all three on. Hide any during play.</p>
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
    <p><b>Coach:</b> names the next legal click and why it helps. Other legal options stay clickable. It lives in the right teaching rail with the Strategy brief and Why this move — each pane scrolls independently.</p>
    <p><b>Strategy brief:</b> a persistent right-rail pane that teaches the voyage — objective progress, the current board, what this phase is for, and what the turn is setting up. Distinct from Coach.</p>
    <p><b>Move reasons:</b> a “Why this move” pane in that same right-hand stack. After each legal click it names what you just chose, why it helps the Map → tree → Peter → ship chain, and what to watch (Fate, covered actions, Tick Tock). Distinct from Coach (next suggestion) and the brief (voyage status). Tutorial starts all three on. Below about 1100px the three panes tab under the board so type stays at the desktop floor.</p>
    <p><b>Card text:</b> Fate reveal modals show the full paraphrased ability and stay until Continue. Click a hand or board mini that is not a legal target to inspect it. The <b>Across the table</b> strip keeps the last revealed Fate play visible while that card is still on the table — never the face-down deck.</p>
    <p><b>Solo Conditions:</b> Cunning and Obsession are practice-only. Cunning is ready only when a Strength 4+ Hero is already ashore — then you may slip an Ally in for free. Obsession hunts Fate for a Hero while Peter is hidden. Neither is a printed two-player Condition. A grey Condition is not ready yet.</p>
    <p><b>Drag:</b> When a card can move or be played onto a place, grab it and slide onto a glowing location (or Ally, for the Cutlass). Drop outside to cancel the slide; clicking still works.</p>
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
    const heading =
      p.resume === "nextTurn"
        ? "Fate intervening"
        : p.played?.defId === "tickTock" && !p.markAction
          ? "Tick Tock snaps"
          : "Read this card";
    const eyebrow = p.resume === "nextTurn" ? "Across the table" : "Before you continue";
    const emptyShore = isNoItemFateDiscard(p.note);
    return `<div class="overlay fate-in"><div class="modal wood fate">
      <p class="eyebrow">${eyebrow}</p>
      <h2>${heading}</h2>
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
      <div class="actions-row"><button type="button" class="btn primary${coachClass(coached, "btn:ack")}" data-ack>Continue</button></div>
    </div></div>`;
  }
  if (p?.kind === "scarePeek") {
    return `<div class="overlay"><div class="modal">
      <h2>Give Them a Scare</h2>
      <p>Discard both to the Fate discard (they can return when Fate reshuffles), or return them with the first button’s card on top.</p>
      <div class="modal-cards">${p.cards
        .map((c) => renderCard(state, c, { size: "reveal", legal: true, selected: false }))
        .join("")}</div>
      <div class="actions-row">
        <button class="btn${coachClass(coached, "btn:scare-discard")}" data-scare-discard>Discard both</button>
        <button class="btn${coachClass(coached, `btn:scare-order:${p.cards[0].instanceId},${p.cards[1]?.instanceId ?? p.cards[0].instanceId}`)}" data-scare-order="${p.cards[0].instanceId},${p.cards[1]?.instanceId ?? p.cards[0].instanceId}">${esc(cardName(p.cards[0]))} on top</button>
        ${p.cards[1] ? `<button class="btn${coachClass(coached, `btn:scare-order:${p.cards[1].instanceId},${p.cards[0].instanceId}`)}" data-scare-order="${p.cards[1].instanceId},${p.cards[0].instanceId}">${esc(cardName(p.cards[1]))} on top</button>` : ""}
      </div>
    </div></div>`;
  }
  if (p?.kind === "fateChooseItem") {
    const items = allLocationItems(state);
    if (items.length === 0) {
      const d = def("splittingHeadache");
      const ability = `${d.name}: ${d.text}`;
      return `<div class="overlay fate-in"><div class="modal wood fate">
      <p class="eyebrow">Across the table</p>
      <h2>Fate intervening</h2>
      ${noItemDiscardBanner()}
      <p>${esc(HEADACHE_NO_ITEM_NOTE)}</p>
      ${abilityReadout("What it does", ability)}
      <div class="actions-row"><button type="button" class="btn primary${coachClass(coached, "btn:ack")}" data-ack>Continue</button></div>
    </div></div>`;
    }
  }
  if (p?.kind === "fateChooseCard") {
    return `<div class="overlay"><div class="modal">
      <h2>Your Fate action</h2>
      <p>Play one card; the other is discarded. Read the full text before you choose.</p>
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
    const mapOut = mapInRealm(state) && card?.defId !== "neverLandMap";
    return `<div class="overlay"><div class="modal">
      <h2>Pay the cost</h2>
      <p>${esc(name)} costs <b>${cost} Power</b>. You have <b>${state.power} Power</b>.</p>
      <p>${
        mapOut
          ? "The Never Land Map is in the realm and can cover this cost instead of Power."
          : `Pay ${cost} Power to play ${esc(name)}.`
      }</p>
      <div class="pay-meter" role="status">Pay ${cost} · you have ${state.power} · ${Math.max(0, state.power - cost)} left${mapOut ? " · Map available" : ""}</div>
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:pay-power")}" data-pay-power ${canPay ? "" : "disabled"}>Pay ${cost} Power</button>
        ${
          mapOut
            ? `<button class="btn${coachClass(coached, "btn:pay-map")}" data-pay-map>Discard the Map</button>`
            : ""
        }
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
    const hero = state.heldCard;
    return `<div class="overlay"><div class="modal">
      <h2>Obsession</h2>
      <p>A Hero was found. Play them into the realm, or banish them?</p>
      ${
        hero
          ? `<div class="modal-cards">${renderCard(state, hero, { size: "reveal", legal: false, selected: true })}</div>`
          : ""
      }
      <div class="actions-row">
        <button class="btn primary${coachClass(coached, "btn:play-hero")}" data-play-hero>Play the Hero</button>
        <button class="btn${coachClass(coached, "btn:banish-hero")}" data-banish-hero>Banish</button>
      </div>
    </div></div>`;
  }
  if (p?.kind === "worthyLocation" || p?.kind === "obsessionLocation") {
    const hero = state.heldCard ?? findCard(state, p.heroId);
    const title = p.kind === "worthyLocation" ? "Worthy Opponent" : "Obsession";
    return `<div class="overlay pass-through"><div class="modal wood">
      <p class="eyebrow">${esc(title)}</p>
      <h2>Seat this Hero</h2>
      <p>Click a glowing unlocked location. Peter still lands at Hangman’s Tree if he is the find.</p>
      ${
        hero
          ? `<div class="modal-cards">${renderCard(state, hero, { size: "reveal", legal: false, selected: true })}</div>`
          : ""
      }
    </div></div>`;
  }
  if (p?.kind === "vanquishConfirmLoss") {
    const hero = findCard(state, p.heroId) ?? state.heldCard;
    return `<div class="overlay"><div class="modal wood lose">
      <h2>This loses the practice duel</h2>
      <p>Peter is not on the Jolly Roger. Vanquishing him here is the intentional-loss trap. Continue only if you mean to practice that failure.</p>
      ${
        hero
          ? `<div class="modal-cards">${renderCard(state, hero, { size: "reveal", legal: false, selected: true })}</div>`
          : ""
      }
      <div class="actions-row">
        <button class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel>Cancel</button>
        <button class="btn${coachClass(coached, "btn:confirm")}" data-confirm>Continue anyway</button>
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

function fateRail(state: GameState): string {
  const show = state.lastFateShow;
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
      ${ability ? `<p class="fate-ability">${esc(ability)}</p>` : ""}
      <p class="fate-fine">Revealed this Fate only. The rest of the Fate deck stays face down, as at a real table.</p>
    </div>
    <div class="fate-rail-cards">${drawn
      .map((c) => {
        const focus = played?.instanceId === c.instanceId;
        return `<div class="${focus ? "is-focus" : "is-aside"}">${renderCard(state, c, { size: focus ? "hand" : "mini", legal: false, selected: focus })}</div>`;
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
      </div>
    </aside>`;
  }
  return `<aside class="fate-rail is-empty" aria-label="Fate adversary">
      <div class="fate-rail-copy">
        <p class="fate-kicker">Across the table</p>
        <h2>Fate adversary</h2>
        <p>This strip is the practice stand-in for another player Fating you. Only cards that were just revealed or seated appear here — never the face-down Fate deck.</p>
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
  return `<div class="overlay inspect-in"><div class="modal wood inspect">
    <p class="eyebrow">Inspect</p>
    <h2>${esc(d.name)}</h2>
    ${abilityReadout("What it does", `${d.name}: ${d.text}`)}
    <div class="modal-cards">${renderCard(state, card, { size: "reveal", legal: false, selected: true })}</div>
    <div class="actions-row"><button type="button" class="btn primary" data-inspect-close>Close</button></div>
  </div></div>`;
}

export type TeachTab = "brief" | "coach" | "reasons";

function resolveTeachTab(
  requested: TeachTab,
  briefOn: boolean,
  coachOn: boolean,
  reasonsOn: boolean,
): TeachTab {
  if (requested === "brief" && briefOn) return "brief";
  if (requested === "coach" && coachOn) return "coach";
  if (requested === "reasons" && reasonsOn) return "reasons";
  if (briefOn) return "brief";
  if (coachOn) return "coach";
  return "reasons";
}

function teachTabBar(briefOn: boolean, coachOn: boolean, reasonsOn: boolean, active: TeachTab): string {
  const tabs: { id: TeachTab; label: string }[] = [];
  if (briefOn) tabs.push({ id: "brief", label: "Brief" });
  if (coachOn) tabs.push({ id: "coach", label: "Coach" });
  if (reasonsOn) tabs.push({ id: "reasons", label: "Why this move" });
  if (tabs.length < 2) return "";
  return `<div class="teach-tabs" role="tablist" aria-label="Teaching panes">
    ${tabs
      .map(
        (tab) =>
          `<button type="button" role="tab" class="teach-tab${tab.id === active ? " is-on" : ""}" data-teach-tab="${tab.id}" aria-selected="${tab.id === active ? "true" : "false"}">${esc(tab.label)}</button>`,
      )
      .join("")}
  </div>`;
}

function teachRailHtml(brief: string, coach: string, reasons: string, active: TeachTab): string {
  if (!brief && !coach && !reasons) return "";
  return `<aside class="teach-rail" data-teach-rail data-active-tab="${active}" aria-label="Teaching">
    ${teachTabBar(Boolean(brief), Boolean(coach), Boolean(reasons), active)}
    ${brief}${coach}${reasons}
  </aside>`;
}

function coachPanel(advice: CoachAdvice): string {
  return `<section class="teach-pane coach-panel" data-teach-pane="coach" aria-live="polite">
    <header class="teach-pane-head">
      <p class="coach-kicker">Coach</p>
      <button type="button" class="btn ghost coach-hide" data-coach-toggle>Hide coach</button>
    </header>
    <div class="coach-copy">
      <p class="coach-do">${esc(advice.do)}</p>
      <p class="coach-why">${esc(advice.why)}</p>
      ${advice.warning ? `<p class="coach-warn">${esc(advice.warning)}</p>` : ""}
    </div>
  </section>`;
}

function strategySidebar(brief: StrategyBrief): string {
  return `<section class="teach-pane strategy-brief" data-teach-pane="brief" aria-label="Strategy brief">
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
  </section>`;
}

function reasonDock(reason: MoveReason): string {
  return `<section class="teach-pane reason-dock${reason.soft ? " is-soft" : ""}" data-teach-pane="reasons" data-reason-dock aria-label="Why this move">
    <header class="teach-pane-head">
      <div>
        <p class="reason-kicker">Why this move</p>
        <h2>Post-selection</h2>
      </div>
      <button type="button" class="btn ghost reason-hide" data-reasons-toggle>Hide</button>
    </header>
    <section class="reason-block">
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
    <p class="reason-foot">Not Coach (next click) and not the Strategy brief (voyage status). This pane stays in the right teaching rail so it never covers legal board actions. Scroll it on its own — Coach and the brief keep their own overflow.</p>
  </section>`;
}

function playView(
  state: GameState,
  coachEnabled: boolean,
  briefEnabled: boolean,
  reasonsEnabled: boolean,
  reason: MoveReason | null,
  teachTab: TeachTab = "brief",
): string {
  const hi = highlightSet(state);
  const sel = selectedSet(state);
  const advice = coachEnabled ? advise(state) : null;
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
      !["scarePeek", "fateChooseCard", "fateReport"].includes(state.pending.kind))
  ) {
    if (!promptButtons.some((b) => b.includes("data-cancel"))) {
      promptButtons.push(`<button class="btn ghost${coachClass(coached, "btn:cancel")}" data-cancel>Cancel</button>`);
    }
  }
  if (state.pending?.kind === "tinkerDiscard") {
    promptButtons.push(`<button class="btn ghost${coachClass(coached, "btn:skip-cond")}" data-skip-cond>Skip discard</button>`);
  }

  const briefHtml = briefEnabled ? strategySidebar(strategyBrief(state)) : "";
  const coachHtml = advice ? coachPanel(advice) : "";
  const reasonHtml = reasonsEnabled && reason ? reasonDock(reason) : "";
  const teachOn = Boolean(briefHtml || coachHtml || reasonHtml);
  const activeTab = resolveTeachTab(teachTab, Boolean(briefHtml), Boolean(coachHtml), Boolean(reasonHtml));
  const placeLabel = state.phase === "move" && !state.pending ? "Move here" : "Choose this place";
  const placeButtons = LOCATION_IDS.filter((id) => hi.has(`loc:${id}`)).map(
    (id) =>
      `<button type="button" class="btn primary prompt-place${coachClass(coached, `loc:${id}`)}" data-move="${id}">${placeLabel}: ${esc(REALM[id].name)}</button>`,
  );
  const fateEmpty = fateEmptyLine(state);
  const fateLogTitle = fateEmpty
    ? `Log · Fate 0 · empty`
    : `Log · Fate ${state.fateDeck.length}`;

  return `<div class="sky play-sky" aria-hidden="true"><div class="stars"></div><div class="fog fog-a"></div></div>
  <div class="grain"></div>
  <div class="play ${coachEnabled ? "has-coach" : ""} ${briefEnabled ? "has-brief" : ""} ${reasonsEnabled ? "has-reasons" : ""} ${teachOn ? "has-teach" : ""}">
    <div class="play-main" data-play-main>
    <header class="topbar" data-topbar-map>
      <div class="brand">${CREST}<div><h1>Never Land Duel</h1><small>Hook Practice</small></div></div>
      <div class="meters">
        <div class="hud-core" aria-label="Voyage meters">
          <div class="power is-loud" title="Power"><span>Power</span><b>${state.power}</b></div>
          <div class="chip chip-stat" title="Turn">Turn ${state.turn}</div>
          <div class="chip chip-stat chip-piles" title="Hand, deck, and discard">Hand ${state.hand.length} · Deck ${state.villainDeck.length} · Discard ${state.villainDiscard.length}</div>
        </div>
        <div class="hud-toggles">
          <div class="chip">${state.difficulty === "easy" ? "Easy Fate" : "Normal Fate"}</div>
          <button type="button" class="chip ${coachEnabled ? "is-on" : ""}" data-coach-toggle>${coachEnabled ? "Coach on" : "Coach off"}</button>
          <button type="button" class="chip ${briefEnabled ? "is-on" : ""}" data-brief-toggle>${briefEnabled ? "Brief on" : "Brief off"}</button>
          <button type="button" class="chip ${reasonsEnabled ? "is-on" : ""}" data-reasons-toggle>${reasonsEnabled ? "Reasons on" : "Reasons off"}</button>
          <button class="chip" data-help>Help</button>
          <button class="chip" data-resign>Resign</button>
        </div>
      </div>
    </header>
    <div class="prompt${clash ? " is-clash" : ""}" data-prompt>${clashMeter(clash)}<p>${esc(promptText(state))}</p><div class="prompt-actions">${promptButtons.join("")}${placeButtons.join("")}</div></div>
    <div class="stage">
      ${fateRail(state)}
      <div class="board-wrap"><div class="board">${LOCATION_IDS.map((id) => renderLocation(state, id, hi, sel, coached)).join("")}</div></div>
    </div>
    <footer class="dock">
      <section class="hand ${state.pending?.kind === "playChooseCard" || state.pending?.kind === "discardSelect" ? "is-picking" : ""}">
        <h2>Hand</h2>
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
                      inspectable: true,
                    }),
                  )
                  .join("")
              : `<p class="empty">Your hand is empty. End the turn to draw back up — unless Tick Tock just snapped it away.</p>`
          }
        </div>
      </section>
      <aside class="log">
        <h2>${esc(fateLogTitle)}</h2>
        <ol>${state.log.map((e) => `<li class="${e.tone}">${esc(e.text)}</li>`).join("")}</ol>
      </aside>
    </footer>
    </div>
    ${teachRailHtml(briefHtml, coachHtml, reasonHtml, activeTab)}
  </div>
  ${overlayFor(state, hi, sel, coached)}`;
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
    teachTab?: TeachTab;
  } = {},
): string {
  const coachEnabled = flags.coachEnabled ?? true;
  const briefEnabled = flags.briefEnabled ?? true;
  const reasonsEnabled = flags.reasonsEnabled ?? true;
  const reason = reasonsEnabled ? (flags.reason ?? IDLE_MOVE_REASON) : null;
  const teachTab = flags.teachTab ?? "brief";
  return playView(state, coachEnabled, briefEnabled, reasonsEnabled, reason, teachTab);
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
    if (import.meta.env.DEV) {
      const scene = new URLSearchParams(window.location.search).get("scene");
      if (scene === "cutlass") return cutlassAttachScene();
      if (scene === "ticktock") return tickTockReportScene();
      if (scene === "crocmove") return tickTockOntoCaptainScene();
      if (scene === "peterloss") return peterSoftConfirmScene();
      if (scene === "drag") return dragHeroScene();
      if (scene === "clash") return vanquishClashScene();
      if (scene === "obsession") return obsessionDecideScene();
      if (scene === "vanquish") return vanquishLocalScene();
      if (scene === "pay") return payNoMapScene();
      if (scene === "fatepick") return easyFizzleScene();
      if (scene === "fatespent") return fateSpentScene();
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
  let reasonsEnabled = readFlag("nld-reasons");
  let lastReason: MoveReason = IDLE_MOVE_REASON;
  let teachTab: TeachTab = "brief";
  let inspectId: string | null = null;
  let suppressClick = false;

  const bindCardDrag = () => {
    root.querySelectorAll<HTMLElement>(".card.is-draggable").forEach((cardEl) => {
      cardEl.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
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
            const id = (node as HTMLElement).dataset.loc;
            node.classList.toggle("is-drop-target", Boolean(id && targets.locations.includes(id as LocationId)));
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
          const locationId = hit?.closest<HTMLElement>("[data-loc]")?.dataset.loc as LocationId | undefined;
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

  const activeTeachTab = () => resolveTeachTab(teachTab, briefEnabled, coachEnabled, reasonsEnabled);

  const paneScroll: Record<TeachTab, number> = { brief: 0, coach: 0, reasons: 0 };
  let pageScrollX = 0;
  let pageScrollY = 0;
  let mainScroll = 0;

  const captureScroll = () => {
    pageScrollX = window.scrollX;
    pageScrollY = window.scrollY;
    const main = root.querySelector<HTMLElement>("[data-play-main]");
    if (main) mainScroll = main.scrollTop;
    root.querySelectorAll<HTMLElement>("[data-teach-pane]").forEach((pane) => {
      const key = pane.dataset.teachPane as TeachTab | undefined;
      if (key && key in paneScroll) paneScroll[key] = pane.scrollTop;
    });
  };

  const restoreScroll = () => {
    root.querySelectorAll<HTMLElement>("[data-teach-pane]").forEach((pane) => {
      const key = pane.dataset.teachPane as TeachTab | undefined;
      if (key && key in paneScroll) pane.scrollTop = paneScroll[key];
    });
    const main = root.querySelector<HTMLElement>("[data-play-main]");
    if (main) main.scrollTop = mainScroll;
    window.scrollTo(pageScrollX, pageScrollY);
  };

  const render = () => {
    captureScroll();
    const inspect = inspectId ? inspectOverlay(state, inspectId) : "";
    const reason = reasonsEnabled ? lastReason : null;
    const tab = activeTeachTab();
    if (state.screen === "title") root.innerHTML = titleView(difficulty, coachEnabled, briefEnabled, reasonsEnabled);
    else if (state.screen === "help") {
      root.innerHTML =
        (state.phase === "title"
          ? titleView(difficulty, coachEnabled, briefEnabled, reasonsEnabled)
          : playView(state, coachEnabled, briefEnabled, reasonsEnabled, reason, tab)) +
        helpView(state.phase !== "title") +
        inspect;
    } else root.innerHTML = playView(state, coachEnabled, briefEnabled, reasonsEnabled, reason, tab) + inspect;
    bindCardDrag();
    restoreScroll();
    requestAnimationFrame(restoreScroll);
  };

  const dispatch = (input: Input) => {
    inspectId = null;
    const before = state;
    state = applyInput(state, input);
    const explained = explainSelection(before, input, state);
    if (explained) lastReason = explained;
    render();
  };

  root.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const t = event.target as HTMLElement;
    const tabBtn = t.closest<HTMLElement>("[data-teach-tab]");
    if (tabBtn?.dataset.teachTab) {
      event.preventDefault();
      pageScrollX = window.scrollX;
      pageScrollY = window.scrollY;
      teachTab = tabBtn.dataset.teachTab as TeachTab;
      render();
      window.scrollTo(pageScrollX, pageScrollY);
      requestAnimationFrame(() => window.scrollTo(pageScrollX, pageScrollY));
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
    if (t.closest("[data-banish-hero]")) return dispatch({ type: "playOrDiscardHero", play: false });

    const cardEl = t.closest<HTMLElement>("[data-card]");
    if (cardEl && !t.closest(".overlay")) {
      const id = cardEl.dataset.card;
      const legal = Boolean(id && highlightSet(state).has(`card:${id}`));
      if (id && !legal) {
        inspectId = id;
        render();
        return;
      }
    }

    const boardInput = resolveBoardClick(t, state);
    if (boardInput) dispatch(boardInput);
  });

  render();
}
