# Never Land Duel (Hook Practice)

A browser practice tool for the **captain’s objective chain**. You play the captain. A computer adversary applies Fate pressure after every turn.

This is an unofficial personal practice aid with original UI and paraphrased mechanical descriptions. See [LEGAL.md](LEGAL.md).

## Learn, practise, then play

Start with **Tutorial** for six guided lessons. Every hint is on, there are no plan questions, and Coach names one legal click at a time. The lesson notes connect the board facts to the rule and explain what to watch next. **Play a full voyage with hints** keeps Coach, reasons, and strategy notes on for the first shuffled game.

The three **Practice drills** each progress from a core skill to a strategy twist: equal Strength → Wendy’s boost and saving crew; one escort step → chaining printed and Item actions for two moves; a ready ship clash → strengthening the crew after Pixie Dust. Each topic offers two explicit modes:

- **Follow along** starts immediately with every hint, a current legal next click, and an explanation. A beginner never has to answer a plan question to get this help.
- **Choose a plan** lets the player inspect the board and hand, then choose among three plans. Feedback names the relevant numbers or route. Hints become available after an attempt; a matching plan unlocks the actions. **Show me every step** switches to full guidance at any time before play.

Completing the actual action opens a reflection about the skill, the first plan attempt, and optional hints used. Guided runs are identified as guided practice. Players can repeat a setup, try the strategy twist, or return to the core skill. Guided and plan-choice modes progress separately during the mounted session; entering and abandoning a setup does not advance that mode. A different setup changes the board and starts fresh; plan choices shuffle once per setup and remain stable during feedback. The Wendy setup also explains when a legal clash spent more crew than necessary. No score claims that the learner has mastered the whole game.

The **Before you play with people** checklist on the title and Help screens explains six solo differences that matter at a human table: self-Fate, local-only card placement, the trainer’s restricted Vanquish target range, rewritten Conditions, the rival clock, and the off-ship Peter loss. This is Captain Hook objective practice, not certification of all Villainous rules. The [published base-game instructions](https://www.ravensburger.org/spielanleitungen/ecm/Spielanleitungen/26295%20anl%202050897.pdf?ossl=pds_text_Spielanleitung) support the action, current-Strength, adjacent-movement, and discard explanations; compare them with the cards in your own edition. In particular, published Vanquish can target a Hero anywhere in the realm using Allies at that Hero’s location; the trainer limits the range around Hook. No engine rules are changed by the learning modes.

The play screen grows vertically on short windows. The Fate summary has its own grid row outside the board and expands to review revealed cards. Location rows align across the desktop board, while card text and the hand can grow. Desktop teaching remains in the right rail; phone guidance stays with the turn controls.

For a short hackathon demonstration: begin with **Tutorial** to show the welcoming, fully guided path. Continue with hints for one normal turn. Then show the two modes of **Make the numbers work**, including the changed Wendy setup and its explanation. Open the table-habits checklist to explain how the practice transfers to a human game.

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

Unit tests cover the objective chain. They also deal a voyage, require the opening move, end the turn, and check that the computer opens a Fate report. `tests/coachLegal.test.ts` follows Coach through dealt games and checks that each board highlight is a legal target.

## Check

```bash
npm run typecheck
npm run lint
```

`npm run build` runs the typecheck and then the Vite build. GitHub Actions runs typecheck, lint, and tests.

## Verify

```bash
npm run verify
```

This starts the Vite dev server, opens the title screen, chooses **Tutorial**, moves the captain to Skull Rock, and writes screenshots plus `verification-evidence/tutorial-move/proof.json`. Cleanup stops that server and leaves the proof in place. The recipe for other paths is in `.cursor/skills/verify-hook-practice/`.

For the full learning and layout matrix, run `node scripts/verify.mjs launch`, `node scripts/verify.mjs doctor`, then `node scripts/verify-learning.mjs`. The matrix drives all six lessons, a complete shuffled voyage (win or loss), and all three drills at 1301×692, 1280×720, 1280×800, 1440×900, 1024×768, and 390×844. It asserts 380px minimum shore height, readable teaching, full hand text, aligned content without overlap, visible map, and 44px phone targets. Screenshots and JSON proof are saved in `verification-evidence/learning/`. Use `CHROME_PATH` if Chrome is installed outside the usual macOS/Linux paths. Run `node scripts/verify.mjs cleanup` afterward.

## Soak

```bash
npm run soak
```

This plays 200 dealt games, seeds 1 through 200, alternating Easy and Normal Fate. The captain follows the hammer policy and a ship-closing line. Computer Fate answers each End turn. A game counts only when Peter is vanquished. The summary JSON lands in `/tmp/hook-soak/summary.json`.

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
- Coach lives in the **right teaching rail** with Why this move and the Strategy brief (Coach on top, then Why, then the voyage brief). Each pane keeps the full *do* line and *why* paragraph at readable size; the whole rail scrolls as one document with clear section headers. The rail sits beside the board — it never covers Gain / Play / Move buttons.
- Coach only *highlights* a recommended legal target more strongly — the suggested action uses a gold CTA; every other legal option stays clickable.
- It covers the full loop: required move, actions (Gain / Discard / Play / Fate / Vanquish / Move), card and payment choices, Fate acknowledge, and win/loss awareness. It warns about Tick Tock and Heroes covering key actions.

## Strategy brief

A persistent right-rail pane (default on, especially from **Tutorial**) teaches the voyage instead of only the next click. Coach stays the short “do this” panel; the brief is the longer briefing and updates every render from a pure `strategyBrief(state)` helper. The three teaching panes stack Coach → Why this move → Strategy brief in one dark teal rail with a single scroll.

- **Objective progress** — Map unlock, Peter found, walk to the ship, clash ready — each with a plain-English status.
- **Where you are** — location, Power, hand pressure, whether the tree is locked, Tick Tock and covering Heroes.
- **What this moment is** — a phase-aware paragraph (required move, action stretch, targeting, Fate acknowledge) explaining what the rules are asking and why that beat exists.
- **What we’re setting up for** — two to four sentences tying the current options to the mid/late game (Power engine, digging for the Map, escort, Ally stack at the Jolly Roger).

Hide it with **Brief** in the Menu or the panel’s **Hide** button. Desktop shores retain their full content height and the page scrolls. Below about 1100px the teaching rail follows the board as one document. On a phone the next Coach line stays with the turn controls, and the four shores remain in order inside a sideways scroller.

## Move reasons

A **Why this move** pane in the right teaching rail (default on, especially from **Tutorial**) explains the choice you just made. Tutorial is no longer a random voyage with the panels switched on; it is the staged first voyage above. It is not Coach (the next suggested click) and not the Strategy brief (voyage status). After each legal location, action, card, confirm, or Fate Continue it names:

- **What you chose** — the place, action, or card in plain language
- **Why it helps the plan** — how that click serves Map → unlock Hangman’s Tree → find Peter → walk to the Jolly Roger → vanquish there
- **What it sets up** — Fate pressure, covered top rows, Power, Tick Tock, the next gate

Cancel softens the panel (nothing committed). Acknowledging computer Fate explains why that card hurts — or, for Peter, why the find actually helps — and what to do about it. The pane stays in the right teaching rail and shares its single scroll with Coach and the brief, so it never overlays legal board actions. Hide it with the **Reasons** chip or **Hide**. The choice persists for the browser tab (`nld-reasons`).

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

## Code map

`src/engine/game.ts` is the reducer. `src/engine/queries.ts` reads a state. `src/engine/fateAi.ts` chooses the computer Fate play. `src/ui/app.ts` renders. The explanation of that split is in [docs/architecture.md](docs/architecture.md).

- `tests/` holds Vitest checks for the rules and the rendered board.
- `RULES_NOTES.md` records intentional simplifications versus a full table game.
- `FIDELITY_AUDIT.md` compares the engine and the teaching copy with table Hook.
- `LEGAL.md` is the unofficial-practice disclaimer.
- `AGENTS.md` lists recurring mistakes and the check that blocks each one.

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
