# Rules fidelity audit — Hook Practice (Never Land Duel)

Personal unofficial practice tool. This document **paraphrases** table mechanics so someone who already owns the published game can compare the engine and teaching copy to Captain Hook in the base game. It does **not** reproduce published card text, villain-guide wording, or rulebook prose.

**Scope:** latest `main` at audit time (`7b56748`, merge of PR #18), plus this docs-only commit. No new villains, multiplayer, art, or large refactors.

**How to read the grades**

| Grade | Meaning |
| --- | --- |
| Faithful | Same motion as a typical table reading |
| Adapted | Solo/practice change, fine for learning *if labeled* |
| Mis-teaches | A player who only uses this tool will do the wrong thing at a real table |

---

## Executive summary

**This is a good objective-chain trainer and a mediocre table-rules tutor.**

The voyage it teaches — play the Map, open the locked hideout, find Peter (he always lands at the hideout, even while locked), walk him west along the four-stop realm, clash him only on the ship — matches Hook’s published objective. Realm layout, printed action rows, costs, copy counts (30 / 15), Power, hand refill to four, Hero coverage of the **top printed row**, equal-Strength Vanquish, Taunt-before-others, Lost Boys needing two Allies, Smee / John / Michael / Wendy math, Cutlass attach, Map-as-Item-payment, and Boarding Party adjacency are in good shape.

What it is *not* is a substitute for sitting across from another villain. The computer always Fates you. Your own Fate action fishes **your** Fate deck (now labeled practice self-Fate). Cunning and Obsession fire on **your** turn with rewritten triggers. Tick Tock empties the hand only when the captain walks onto the crocodile. Easy Fate plays a revealed Peter.

For someone who already knows the table game and wants reps on Map → tree → walk → ship clash, fidelity is high enough to be useful tonight. For a first-time Hook player who will sit down at a real table tomorrow, the Must list below is the curriculum gap.

**Bottom line:** keep shipping this as a practice aid; do not treat a clean voyage here as proof the player will execute Hook legally in a two-player game.

---

## Intentional practice divergences (OK for teaching)

These are already called out in `RULES_NOTES.md`, `README.md`, and/or `LEGAL.md`, or are inherent to a one-board tool. They are acceptable *if the player reads them as practice rules*.

### Solo Fate adversary

There is no second villain board. After you end the turn and refill to four, the computer always performs **one** Fate action (`startComputerFate` in `src/engine/game.ts`). Easy picks at random among legal cards in the pair (`chooseFateCard` in `src/engine/fateAi.ts`). Normal scores the pair (Peter first, then Headache on useful Items, Tick Tock, blockers).

At a table, the other player takes a **full turn** and may skip Fate entirely. The computer is a pressure generator, not an opponent.

### Your Fate action hunts Peter

Player Fate draws from Hook’s own Fate deck (`startPlayerFate`). Hunt cards (Worthy Opponent, Give Them a Scare, Obsession) also do. That is how this tool lets you practice “find Peter” without a second human.

At a table, the Fate **action** is aimed at another villain’s Fate deck. Hook finds Peter when **someone Fates Hook**, or when Hook’s own hunt cards flip his Fate deck. See Must #2.

### Conditions rewritten for one board

Printed Cunning / Obsession wait for **another player’s turn** and look at **that player’s** board (a strong Ally ashore; a strong Hero just defeated). In solo play those triggers almost never happen, so the engine offers them during **your** action phase (`canPlayCunning`, `canPlayObsession`, `handleCard` in `src/engine/game.ts`):

- **Cunning** — if a Hero of Strength 4+ is in *this* realm and you hold an Ally, play Cunning without using Play a Card, then play that Ally for free.
- **Obsession** — if Peter is not yet revealed, play Obsession without using Play a Card, then reveal Fate until a Hero and play or discard that Hero.

Playing a Condition from hand without spending Play a Card is actually close to the published Condition timing (they are not “install and wait” realm cards). The **trigger rewrite** is the adaptation. See Must #3 for teaching-copy errors around this.

### Extra Item actions are never covered

Cannon, Hook’s Case, and Ingenious Device add an extra action at their location (`availableActions`). Heroes cover only the printed **top** row. Each matching Item adds one extra. That matches the usual table reading of Item extras (they are not the covered top spaces).

### Off-ship Peter is an instant loss

Vanquishing Peter anywhere except the Jolly Roger ends the duel as a loss (`finishVanquish`), after a confirm gate (`vanquishConfirmLoss`). A table game would discard him to the Fate pile and leave the objective unfinished; he can return after a reshuffle. The trap is documented and the confirm copy says it is practice-only.

### Give Them a Scare looks; it does not reveal

Peeking the top two Fate cards does not force Peter onto the hideout (`scarePeek`). You may discard both to the Fate discard (they can return on reshuffle) or put them back in either order. There is no separate remove-from-game pile. Documented in `RULES_NOTES.md`.

### Map payment and permanent unlock

Playing the Map unlocks Hangman’s Tree forever (`hangmansUnlocked`), even if the Map later leaves. While the Map sits in the realm, another paid Item may spend the Map instead of Power (`payWithMap` / `discardMap`). The Map itself still costs Power.

### First turn, refill, recycling

Captain starts at the Jolly Roger, 0 Power, four cards, and must move (`createGame`). End of turn draws back to four, then Fate (`endTurn` → `refillHand` → `startComputerFate`). Empty villain / Fate decks reshuffle their discards. No turn clock; Resign is the concede.

### Easy vs Normal (practice AI, not a table opponent)

| | Easy | Normal |
| --- | --- | --- |
| Card from the pair | Random among “legal” cards; **always** plays Peter if present | Heuristic; **always** plays Peter if present |
| Hero seating | Random unlocked stop | Prefers covering rich actions; Tick Tock likes the lagoon / ship |
| Attach | Random Hero | Prefers Peter, else strongest |
| Headache | Random; skipped if the *location-item* shore is empty and the other card can play | Targets Device → Map → Cannon → Case |

Easy **plays Peter** when he is one of the two revealed cards (`tests/fateEasy.test.ts`). Fixed in the fidelity Must PR.

### Already listed as not modeled

`RULES_NOTES.md`: other villains, Activate, licensed art / verbatim text, every FAQ edge (attach timing, simultaneous Conditions, printing differences). Attached Items cannot be moved alone; moving the host carries them — that *is* modeled.

---

## Must gaps (mis-teach real table play)

**Fixed in this PR** (fidelity Must: Tick Tock, Easy Peter, teaching copy). The four items below are the original audit findings; each now notes the repair.

### 1. Tick Tock fires when the crocodile arrives, not only when the captain walks — **fixed**

**Table (and this tool’s own card line):** the hand empties if the captain **moves to** the crocodile’s place. Seating Tick Tock on the captain, or sliding the crocodile onto the captain, does **not** snap.

**Now:** `checkTickTock` snaps only when `moved === "captain"`. Fate seating and Move a Hero / Starkey slides do not empty the hand. Snap note, Coach, Strategy brief, and `RULES_NOTES.md` match. `tests/tickTockMove.test.ts` encodes the table triggers.

### 2. Taking Fate is taught as Hook’s way to find Peter — **fixed (copy)**

Coach, Strategy brief, help, and the player Fate overlay now say hunt cards + being Fated are how Hook finds Peter at a table. The player Fate action is labeled **practice self-Fate**.

### 3. Teaching copy says Cunning / Obsession are not printed two-player cards — **fixed**

Help and `RULES_NOTES.md` now say they **are** printed Conditions; only the **triggers** are rewritten for solo (strong Hero here / Peter not yet revealed, on your turn).

### 4. Easy Fate may bury a revealed Peter — **fixed**

Easy and Normal both play a revealed Peter to Hangman’s Tree and discard the other card (`chooseFateCard`, `tests/fateEasy.test.ts`). README no longer presents burying Peter as Easy’s charm.

---

## Should gaps (rough edges / partial rules)

### Splitting Headache only sees loose location Items — **fixed in this PR**

`allLocationItems` now includes `attachments`. Headache can strip Cutlass and Fate attachments; discarded Fate Items go to the Fate discard.

### Fate attachments on Peter while the hideout is still locked — **fixed in this PR (Pixie Dust)**

Pixie Dust does not attach to Peter while Hangman’s Tree is still locked (`canAttachFateItem`). Taunt may still cling.

### Distant Boarding Party joining an adjacent clash — **fixed**

Vanquish names a Hero at the captain’s place, or a neighboring unlocked Hero a Boarding Party can reach (`canVanquishAt`, `vanquishAllyPoolAt`, `boardingPartyJoinsClash`). Same-location Allies plus a neighboring Boarding Party still mix when the party stands with the captain or with the Hero.

The far-side case is no longer legal: captain on the ship, Hero at Skull Rock, Boarding Party only at the lagoon. That party is adjacent to the Hero but not to the captain, so it does not carry the captain’s Vanquish across. A party next door to a Hero who is standing with the captain still joins.

### Obsession can discard a just-revealed Peter — **fixed**

A revealed Peter must be played to Hangman’s Tree, the same path Worthy Opponent and a Fate reveal already use (`forceObsessionPeter`). The discard choice is not offered, and a discard input still seats him. Other Heroes may be played or discarded to the Fate discard. Coach, the button, the prompt, and the log say **Discard** and that the Hero can return when Fate reshuffles. They do not say the Hero leaves the realm.

### Off-ship loss and “always Fate” are documented but still habit-forming

Covered above as intentional. They stay on the Should list because Coach / Brief treat them as the rules of the evening, not as a sidebar. A “table mode” toggle later would help; not tonight.

### Help / Brief under-label the Fate-on-self adaptation — **fixed in this PR**

The player Fate overlay is titled **Practice self-Fate** and says the printed Fate action hits another villain.

---

## Nice / out of scope

- Other villains, multi-board, Activate, licensed art, LLM coach
- First-printing vs later-printing flavor and renamed hideout
- Simultaneous Conditions, odd attach timing, “find this Ally/Hero and replay them” discard-attachments FAQ
- A separate remove-from-game pile for Scare
- Unused `defeatedHeroStrengthsThisTurn` (looks like a leftover toward a more printed Obsession)
- Opponent psychology beyond “always Fate” (when a human would refuse to Fate Hook)
- Shipping every Must tonight

---

## Scope checklist (what the code actually does)

### 1. Objective / win

Win is immediate when Peter is vanquished at the Jolly Roger (`finishVanquish`). The Map’s job is unlocking the hideout, not remaining in play at victory. Peter off-ship → practice loss. Resign → loss. Faithful objective; adapted failure.

### 2. Realm layout, locked Tree, Map unlock

Left to right: Jolly Roger, Skull Rock, Mermaid Lagoon, Hangman’s Tree (`LOCATION_IDS`, `REALM` in `src/engine/realm.ts`). Printed rows match the usual Hook board (ship Gain 1 / Discard over Vanquish / Play; Skull Gain 1 / Play over Fate / Discard; Lagoon Play / Move Ally-Item over Gain 3 / Play; Tree Fate / Gain 2 over Move a Hero / Play). Tree starts locked. Map play sets `hangmansUnlocked`. Locked: no captain move, no play, no piece step in or out; Peter may still be **placed** there on reveal (`revealPeter`, `tests/locked.test.ts`, `tests/objective.test.ts`).

### 3. Turn structure

Required move to a different unlocked stop (`phase === "move"`, `legalMoveLocations`). Actions only after the move (`actionsAreLive`; PR #18 keeps current-stop actions inert during the move). Each uncovered action once, any order. Heroes cover top printed row (`coveringHero`). End turn → refill to 4 → computer Fate → acknowledge → next move. Faithful skeleton; Fate timing is the solo shortcut.

### 4. Vanquish

Same-location Hero, or neighboring unlocked Hero a Boarding Party can reach from the captain’s place or the Hero’s place. A Boarding Party on the Hero’s far side does not join (`boardingPartyJoinsClash`). Allies at the Hero’s place contribute; Boarding Party may join from here or next door when that next door is the captain or the Hero (`vanquishAllyPoolAt`). Equal Strength is legal (`total >= heroStrength`, PR #17 / `tests/hourPlaytest.test.ts`). Taunt globally blocks non-Taunt targets (`anyTauntInRealm`). Lost Boys need two Allies even if Strength is already met. Remote Allies sitting with a distant Hero do **not** unlock that Hero (`tests/vanquishLocality.test.ts`).

### 5. Fate

Draw two, play one, discard the other. Peter in the pair is forced (player + Normal). Other Heroes sit on an unlocked stop. Items attach to a Hero or fizzle. Headache discards a **location** Item or fizzles. Tick Tock / Tinker Bell on-play as above. Easy vs Normal as in the table. Player Fate is self-Fate (Must #2).

### 6. Ally / Item attach and moves

Cutlass attaches to any Ally already ashore; cancel returns it to hand (`tests/cutlass.test.ts`). Location Items (Cannon, Case, Device, Map) and Allies from Play a Card sit where the captain stands (`legalPlayLocations`). Fate, Worthy Opponent, and Obsession still seat a non-Peter Hero on any unlocked stop. Move Ally/Item and Move a Hero are one unlocked step; attachments travel with the host; attached Items are not independently movable (`movableAlliesAndItems` omits `attachments`). Starkey: Hero at *his* stop, one step. Aye Aye: Ally one step, +2 until the turn’s Fate / next turn clears `tempStrength`.

### 7. Conditions

Solo adaptations as above. Cunning refuses if no Ally is in hand (PR #17). They never use a Play a Card slot (`playableHandCards` filters `type === "condition"`).

### 8. Power, Discard, Gain, Hook’s Case extras

Costs in `src/engine/cards.ts` match the usual Hook list (Map 4, Brute 3, most extras / Case / Cannon / Device / Starkey / Smee / Boarding Party 2, Cutlass / Scare / Aye Aye / Swashbuckler 1, Worthy / Conditions 0). Discard may select none and still spends the action. Gain uses the printed amount. Each Case at the current stop adds a never-covered Gain 1.

### 9. Already documented simplifications

See `RULES_NOTES.md` (solo Fate, Conditions, extras never covered, off-ship loss, Scare peek, Vanquish locality, reveal vs play, Map payment, first turn, recycling, not modeled). This audit’s Must list is mostly **undocumented** extra divergences or **mislabeled** documented ones.

---

## Evidence (file / function)

| Topic | Where |
| --- | --- |
| Realm + action labels | `src/engine/realm.ts` — `REALM`, `actionLabel` |
| Card costs, copies, paraphrased lines | `src/engine/cards.ts` — `CARDS`, `villainCardIds`, `fateCardIds` |
| Unlock, cover, playable, Vanquish pool, Taunt, Strength | `src/engine/queries.ts` — `isUnlocked`, `coveringHero`, `availableActions`, `heroStrength`, `allyStrength`, `canVanquishAt`, `vanquishableHeroes`, `vanquishAllyPoolAt`, `playableHandCards`, `canPlayCunning`, `canPlayObsession`, `promptText` |
| Turn / Fate / Vanquish / Tick Tock / Map / Conditions | `src/engine/game.ts` — `createGame`, `applyInput`, `handleAction`, `handleLocation`, `handleCard`, `startComputerFate`, `startPlayerFate`, `revealPeter`, `finishVanquish`, `checkTickTock`, `snapTickTockHand`, `afterPaymentPlay` |
| Easy / Normal heuristics | `src/engine/fateAi.ts` — `chooseFateCard`, `chooseHeroLocation`, `chooseAttachTarget`, `chooseHeadacheItem`, `explainFateChoice` |
| Teaching rail | `src/engine/strategyBrief.ts` — `objectiveLines`, `whereYouAre`, `thisMoment`; `src/engine/coach.ts` — `advise`; `src/ui/app.ts` — `helpView` |
| Documented solo rules | `RULES_NOTES.md`, `README.md`, `LEGAL.md` |
| Objective / lock / clash / Tick Tock / Easy Peter / Headache / Cutlass | `tests/objective.test.ts`, `tests/locked.test.ts`, `tests/vanquishLocality.test.ts`, `tests/hourPlaytest.test.ts`, `tests/tickTockMove.test.ts`, `tests/fateEasy.test.ts`, `tests/headacheSoftlock.test.ts`, `tests/cutlass.test.ts`, `tests/decks.test.ts` |

---

## Recommended next PR order

Docs-first tonight on purpose. When you want engine work, this order repairs **teaching damage** before adding features.

1. **Copy honesty (small, no rules change)**  
   Fix `helpView` so Cunning / Obsession are “printed Conditions with solo triggers,” not “not printed.” Add a Tick Tock / Easy-Peter / self-Fate paragraph to `RULES_NOTES.md` that matches what the engine already does. Relabel “Your Fate action” as practice self-Fate. Relabel Obsession’s button from Banish to Discard.

2. **Tick Tock trigger alignment**  
   Snap only when the captain moves onto the crocodile. Keep the existing tests as the spec for the *old* behavior, then invert them. Update Brief / snap note / Coach warnings. Highest table-fidelity win per line of code.

3. **Headache sees attachments**  
   Include Cutlass (and, if you want table-maximal, Fate attachments) in the Headache target pool so “no Item ashore” is honest.

4. **Locked-hideout attach**  
   Block the +2 Fate Item (and decide on Taunt) on Peter while the tree is still locked.

5. **Optional “table habits” mode**  
   Do not ship by default: Fate action disabled or clearly marked unusable for finding Peter; Easy no longer allowed to bury a revealed Peter; off-ship Peter discards instead of ending the duel. Behind a toggle so the current trainer stays.

6. **Not next**  
   Other villains, multiplayer, LLM coach, art, large reducer refactors, Boarding Party edge-case tightening unless a playtest hits it.

---

## Tests

`npm test` (Vitest 3.2.7) on this branch: **26 files, 150 tests, all passed** (~4.4s).

Audited engine is `main` `7b56748` (merge of PR #18). This PR is docs-only on `cursor/hook-fidelity-audit-f6d6`; the branch tip SHA is in the PR description.

No engine or UI behavior was changed in this PR.
