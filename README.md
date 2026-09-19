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

Heroes cover the **top** actions at their location. Gold outlines mark legal clicks. A stronger teal outline marks the Coach’s suggested target when Coach is on. The prompt bar always says what the rules need next.

**Difficulty**

- **Easy** — Fate picks randomly among legal plays.
- **Normal** (default) — Fate prefers Peter Pan, blocks useful actions, parks Tick Tock on rich locations, and spends Splitting Headache on your best Items.

## Coach mode

A heuristic advisor (not an LLM) sits beside the prompt and names the next concrete click — *Move to Skull Rock*, *Take Gain 3*, *Play Never Land Map to Mermaid Lagoon* — plus one or two sentences on why that step serves Hook’s chain: play the Map, unlock Hangman’s Tree, reveal Peter, walk him to the Jolly Roger, vanquish him there.

- **Tutorial** on the title screen starts a game with Coach on.
- **Set Sail** uses the title **Coach on/off** toggle (defaults on for a new session).
- During play, the top-bar **Coach** chip or the panel’s **Hide coach** button turns it off without ending the game. The choice persists for the browser tab.
- Coach only *highlights* a recommended legal target more strongly. Every other legal option stays clickable.
- It covers the full loop: required move, actions (Gain / Discard / Play / Fate / Vanquish / Move), card and payment choices, Fate acknowledge, and win/loss awareness. It warns about Tick Tock and Heroes covering key actions.

## Strategy brief

A persistent sidebar (default on, especially from **Tutorial**) teaches the voyage instead of only the next click. Coach stays the short “do this” panel; the brief is the longer briefing and updates every render from a pure `strategyBrief(state)` helper.

- **Objective progress** — Map unlock, Peter found, walk to the ship, clash ready — each with a plain-English status.
- **Where you are** — location, Power, hand pressure, whether the tree is locked, Tick Tock and covering Heroes.
- **What this moment is** — a phase-aware paragraph (required move, action stretch, targeting, Fate acknowledge) explaining what the rules are asking and why that beat exists.
- **What we’re setting up for** — two to four sentences tying the current options to the mid/late game (Power engine, digging for the Map, escort, Ally stack at the Jolly Roger).

Hide it with the top-bar **Brief** chip or **Hide brief**. On narrower windows it becomes a scrollable strip above the four-location board so the realm stays full width.

## Practice tips

- Discard often until the Map appears. Hangman’s Tree stays locked without it, so Peter cannot leave.
- Worthy Opponent and Give Them a Scare let you hunt Fate without waiting on a Fate action.
- Build Strength at the Jolly Roger *before* walking Peter across. Two Pirate Brutes, or Smee plus help, will finish an unbuffed Peter (Strength 8).
- Mr. Starkey and Ingenious Device are the fast escort. Splitting Headache loves those Items.
- Do not vanquish Peter anywhere except the Jolly Roger — that loses the duel.
- Tick Tock discards your whole hand if you step onto his location.

## Project layout

- `src/engine/` — pure rules engine (cards, realm, queries, Fate AI, heuristic Coach, strategy brief, reducer)
- `src/ui/` — original CSS/SVG interface
- `tests/` — Vitest coverage for the objective chain
- `RULES_NOTES.md` — intentional simplifications versus a full table game
- `LEGAL.md` — unofficial-practice disclaimer

## Controls

| Click | When |
| --- | --- |
| A glowing location | Move, or drop a card there |
| A glowing action | Perform that action |
| A glowing card | Play, attach, vanquish, or move it |
| A non-glowing hand or board card | Inspect — full paraphrased text in a modal |
| End turn | Draw, then face Fate |
| Continue on a Fate report | Required. The reveal stays until you acknowledge; it does not auto-dismiss |
| Resign | Concede and review the result |

Fate intervening (and similar reveal moments) use a larger unclamped card face plus a **What it does** readout of the complete paraphrased ability. Hover titles are not the only way to read Tick Tock. If the engine already seated the card or wiped the hand, the modal still waits on Continue before the next move or action stretch.

## Legal

Unofficial personal practice tool. Not affiliated with, endorsed by, or associated with Disney or Ravensburger. Original code and CSS/SVG only; card abilities are paraphrased play effects, not published flavor text. Not for sale or redistribution as a substitute product. You should already own or know the published game — this is a practice aid only. Full statement: [LEGAL.md](LEGAL.md).
