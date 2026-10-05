# Never Land Duel (Hook Practice)

A browser practice tool for the **captain’s objective chain**. You play the captain. A computer adversary applies Fate pressure after every turn.

This is an unofficial personal practice aid with original UI and paraphrased mechanical descriptions. See [LEGAL.md](LEGAL.md).

## Requirements

- Node.js 20+
- macOS, Linux, or Windows

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Test

```bash
npm test
```

Unit tests cover the objective chain: unlocking Hangman’s Tree, Peter Pan’s forced reveal placement, moving a Hero to the Jolly Roger, the vanquish win/loss check, and locked-location restrictions.

## Build

```bash
npm run build
npm run preview
```

If a host (including the Mac Muscle preview on **:4173**) is serving the production `dist/` folder, rebuild after pulling and restart that static server:

```bash
npm run build
# restart the process that serves dist/ on :4173
# example: npx serve dist -l 4173
```

## How to play

**Win** by completing this chain:

1. Play **Never Land Map** to unlock Hangman’s Tree.
2. Reveal **Peter Pan** from Fate (he always lands at Hangman’s Tree, even if it is still locked).
3. Unlock the tree, then move him along the realm to the **Jolly Roger**.
4. **Vanquish** him there with Allies whose combined Strength meets his.

**Each of your turns**

1. Move the captain to a different unlocked location (required).
2. Use any uncovered actions at that location, once each, in any order.
3. End the turn. Draw back up to 4 cards.
4. The computer performs one Fate action against you.

Heroes cover the **top** actions at their location. Gold outlines mark legal clicks. A louder gold CTA marks the Coach’s suggested action when Coach is on. The prompt bar always says what the rules need next. The top bar always shows **Power** (loudest), **Turn**, and **Hand / Deck / Discard**. Hand cards wear a colored **TYPE · COST** bar and keep their teaching text; Hangman’s Tree stays under a lock veil until the Never Land Map opens it.

**Difficulty**

- **Easy** — Fate picks randomly among legal plays in the drawn pair. If Peter is one of the two revealed cards, he is played to Hangman’s Tree and the other card is discarded — same as Normal and a table Fate aimed at Hook.
- **Normal** (default) — Fate prefers Peter Pan, blocks useful actions, parks Tick Tock on rich locations, and spends Splitting Headache on your best Items (including attached Cutlass / Fate Items).

## First voyage

**Tutorial** on the title screen starts a short staged lesson, not a random deal. Coach, the Strategy brief, and Why this move turn on. Each beat asks for one action:

1. Move to Skull Rock.
2. Gain 1 Power. The Never Land Map is already in hand and costs 4.
3. Play the Map and pay with the **Pay 4 Power** button. Hangman’s Tree opens.
4. End the turn and acknowledge Fate. That deck reveals Peter Pan at the tree.
5. Walk Peter one neighboring shore, from the tree to Mermaid Lagoon.
6. Practice the clash. The lesson places him on the Jolly Roger with two Pirate Brutes (Strength 8 against 8). Equal Strength wins.

Then **Begin a normal voyage** deals a shuffled game. **Not now** returns to the title. Set Sail still starts that shuffled game directly. The lesson does not change the rules; the ship placement in the last beat is a setup so the clash can be practiced without the long walk.

## Coach mode

A heuristic advisor (not an LLM) sits beside the prompt and names the next concrete click — *Move to Skull Rock*, *Take Gain 3*, *Play Never Land Map to Mermaid Lagoon* — plus one or two sentences on why that step serves Hook’s chain: play the Map, unlock Hangman’s Tree, reveal Peter, walk him to the Jolly Roger, vanquish him there.

- **Set Sail** uses the title **Coach on/off** toggle (defaults on for a new session) and skips the lesson.
- During play, the top-bar **Coach** chip or the panel’s **Hide coach** button turns it off without ending the game. The choice persists for the browser tab.
- Coach lives in the **right teaching rail** with Why this move and the Strategy brief (Coach on top, then Why, then the voyage brief). Each pane keeps the full *do* line and *why* paragraph at readable size and scrolls on its own, so one pane never buries another. The rail sits beside the board — it never covers Gain / Play / Move buttons.
- Coach only *highlights* a recommended legal target more strongly — the suggested action uses a gold CTA; every other legal option stays clickable.
- It covers the full loop: required move, actions (Gain / Discard / Play / Fate / Vanquish / Move), card and payment choices, Fate acknowledge, and win/loss awareness. It warns about Tick Tock and Heroes covering key actions.

## Strategy brief

A persistent right-rail pane (default on, especially from **Tutorial**) teaches the voyage instead of only the next click. Coach stays the short “do this” panel; the brief is the longer briefing and updates every render from a pure `strategyBrief(state)` helper. The three teaching panes stack Coach → Why this move → Strategy brief in one parchment/gold rail and each has its own scroll.

- **Objective progress** — Map unlock, Peter found, walk to the ship, clash ready — each with a plain-English status.
- **Where you are** — location, Power, hand pressure, whether the tree is locked, Tick Tock and covering Heroes.
- **What this moment is** — a phase-aware paragraph (required move, action stretch, targeting, Fate acknowledge) explaining what the rules are asking and why that beat exists.
- **What we’re setting up for** — two to four sentences tying the current options to the mid/late game (Power engine, digging for the Map, escort, Ally stack at the Jolly Roger).

Hide it with the top-bar **Brief** chip or **Hide brief**. On a laptop the four location columns squish (about 180px minimum). Below about 1100px the three teaching panes tab under the board so type stays at the desktop floor. On a phone the next Coach line sits above the board, and the four shores stay in order inside a sideways scroller.

## Move reasons

A **Why this move** pane in the right teaching rail (default on, especially from **Tutorial**) explains the choice you just made. Tutorial is no longer a random voyage with the panels switched on; it is the staged first voyage above. It is not Coach (the next suggested click) and not the Strategy brief (voyage status). After each legal location, action, card, confirm, or Fate Continue it names:

- **What you chose** — the place, action, or card in plain language
- **Why it helps the plan** — how that click serves Map → unlock Hangman’s Tree → find Peter → walk to the Jolly Roger → vanquish there
- **What it sets up** — Fate pressure, covered top rows, Power, Tick Tock, the next gate

Cancel softens the panel (nothing committed). Acknowledging computer Fate explains why that card hurts — or, for Peter, why the find actually helps — and what to do about it. The pane stays in the right teaching rail and scrolls independently of Coach and the brief, so it never overlays legal board actions. Hide it with the **Reasons** chip or **Hide**. The choice persists for the browser tab (`nld-reasons`).

## Captain pawn

The current location shows an original SVG captain figure (hat, coat, hook) and a tiny **You** label. It is a generic pawn, not a character likeness. The app crest in the header stays as the brand mark.

## Fate adversary

When the computer Fates you, the intervening modal still shows the drawn cards large with full paraphrased text until **Continue**. After that, an **Across the table** strip keeps the last revealed/seated Fate play visible — Heroes and effects that hit the realm — so it feels like seeing what the other player just did. The face-down Fate deck is never shown.

## Drag-and-slide

While a Play, Move a Hero, Move Ally/Item, Aye Aye, or Cutlass attach is open, grab a legal card and slide it onto a highlighted location (or onto an Ally for the Cutlass). The card lifts and follows the pointer. Drop outside to cancel the slide. Click-to-select still works.

## Practice tips

- Discard often until the Map appears. Hangman’s Tree stays locked without it, so Peter cannot leave.
- Worthy Opponent and Give Them a Scare are hunt cards — at a table those (plus being Fated) are how Hook finds Peter. Your Fate action here is practice self-Fate, not the printed Fate-another-villain action.
- Build Strength at the Jolly Roger *before* walking Peter across. Two Pirate Brutes, or Smee plus help, will finish an unbuffed Peter (Strength 8).
- Mr. Starkey and Ingenious Device are the fast escort. Splitting Headache loves those Items.
- Do not vanquish Peter anywhere except the Jolly Roger — that loses the duel.
- Tick Tock discards your whole hand only if the captain **moves onto** his location. Seating or sliding the crocodile onto the captain does not snap.

## Project layout

- `src/engine/` — pure rules engine (cards, realm, queries, Fate AI, heuristic Coach, strategy brief, post-selection move reasons, reducer)
- `src/ui/` — original CSS/SVG interface
- `tests/` — Vitest coverage for the objective chain
- `RULES_NOTES.md` — intentional simplifications versus a full table game
- `FIDELITY_AUDIT.md` — engine + teaching-copy compared to table Hook (base game)
- `LEGAL.md` — unofficial-practice disclaimer

## Controls

| Click | When |
| --- | --- |
| A glowing location | Move, or drop a card there |
| A glowing action | Perform that action |
| A glowing card | Play, attach, vanquish, or move it — or drag it onto a glowing place |
| A non-glowing hand or board card | Inspect — full paraphrased text in a modal |
| End turn | Draw, then face Fate |
| Continue on a Fate report | Required. The reveal stays until you acknowledge; it does not auto-dismiss |
| Why this move (right rail) | Updates after each legal click under Coach; Reasons chip hides it |
| Resign | Concede and review the result |

Fate intervening (and similar reveal moments) use a larger unclamped card face plus a **What it does** readout of the complete paraphrased ability. Hover titles are not the only way to read Tick Tock. If the engine already seated the card or wiped the hand, the modal still waits on Continue before the next move or action stretch.

## Legal

Unofficial personal practice tool. Not affiliated with, endorsed by, or associated with Disney or Ravensburger. Original code and CSS/SVG only; card abilities are paraphrased play effects, not published flavor text. Not for sale or redistribution as a substitute product. You should already own or know the published game — this is a practice aid only. Full statement: [LEGAL.md](LEGAL.md).
