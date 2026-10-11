# Rules notes — Never Land Duel v1

This practice tool aims for a playable Hook-style objective, not FAQ-perfect parity. Card text is **paraphrased** so the repo does not reproduce published flavor or rulebook wording. See `LEGAL.md`.

## Intentional simplifications

### Solo Fate adversary
There is no second villain board. After you end your turn and refill to four cards, the computer always performs **one Fate action** against you (Easy: random legal play among the pair, except Peter; Normal: heuristic). That pressure stands in for another player choosing to Fate you.

At a table, Hook finds Peter when **someone Fates Hook**, or when Hook’s own hunt cards (Worthy Opponent, Give Them a Scare, Obsession) flip his Fate deck. Hook’s printed Fate **action** is aimed at another villain.

### Practice self-Fate
Your Fate action in this tool draws from Hook’s own Fate deck so you can practice the “find Peter” motion without a second human. The overlay labels that as **practice self-Fate**. It is not how the printed Fate action works at a table.

### Tick Tock
The hand empties only when the **captain moves onto** Tick Tock’s place. Seating the crocodile on the captain (Fate) or sliding him onto the captain (Move a Hero / Starkey) does **not** discard the hand. Those plays are a cover / Strength problem, not a snap.

### Easy Fate and Peter
When Peter is one of the two revealed Fate cards, Easy and Normal both play him to Hangman’s Tree and discard the other card — same as the published reveal rule and the player Fate path. Easy does not bury a revealed Peter.

### Conditions (Cunning, Obsession)
Cunning and Obsession **are printed two-player Conditions**. At a table they wait for **another player’s turn** and look at **that player’s** board:

- Printed **Cunning** watches for a strong Ally in another realm.
- Printed **Obsession** watches for another player defeating a strong Hero.

Those triggers almost never happen in solo play, so this tool **rewrites the triggers** (not the cards) so they can fire during your action phase:

- **Cunning** — During your action phase, if a Hero of Strength 4+ is in this realm and you hold an Ally, you may play Cunning without using a Play a Card action, then play that Ally for free at the captain’s current location. Accepting writes a log line. Cancel before you accept leaves the Condition in hand (Escape does the same as Not now). After Accept, Cancel during the place choice returns to the Ally choice. Cancel during the Ally choice declines the free crew: Cunning stays in the discard and does not return to hand. Coach and Why this move say that outright.
- **Obsession** — During your action phase, if Peter Pan has not yet been revealed, you may play Obsession without using a Play a Card action, then reveal Fate cards until a Hero. A revealed Peter must be played to Hangman’s Tree (same as Worthy Opponent and a Fate reveal). Any other Hero may be played to an unlocked place, or discarded to the Fate discard. A discarded Hero can return when Fate reshuffles. This is not remove-from-game.

Playing a Condition from hand without spending Play a Card is close to published Condition timing. The trigger rewrite is the adaptation.

### Extra Item actions
Cannon, Hook’s Case, and Ingenious Device grant extra actions at their location. Those extras are **never covered** by Heroes (only the printed top row is covered). Each matching Item adds one extra action.

### Peter Pan vanquished off-ship
If Peter is vanquished anywhere other than the Jolly Roger, the duel is an immediate **loss**. A table game might simply discard him and leave the objective unfinished; the explicit loss keeps this practice tool honest.

### Give Them a Scare
This card **looks** at the top two Fate cards. Looking does not count as revealing, so Peter Pan is not forced onto Hangman’s Tree by a peek. You may discard both cards to the Fate discard or return them in either order. Discarded peek cards can return when Fate reshuffles — this tool does not use a separate remove-from-game pile.

### Play a Card locality
Playing an Ally or Item puts it at the captain’s current location. It does not fly to another unlocked shore. Walk crew toward the ship afterward with Move Ally/Item. Fate, Worthy Opponent, and Obsession may still seat a non-Peter Hero on any unlocked place. Peter’s reveal placement is unchanged.

### Vanquish locality
Vanquish names a Hero at the captain’s current location. Allies at that place contribute Strength. **Boarding Party** may also join when it stands with the captain and the Hero is one unlocked step away, or when it stands with that Hero (including a clash the captain starts next door). A Boarding Party on the Hero’s far side does not reach — captain on the ship, Hero at Skull Rock, party at the lagoon is not a legal clash. Crew sitting with a distant Hero cannot be spent while the captain stands elsewhere.

### Reveal vs play
Whenever Peter Pan is *revealed* (Fate action, Worthy Opponent, Obsession), he is placed at Hangman’s Tree even if locked, and the other cards from that reveal are discarded. Obsession cannot discard a just-found Peter. Player-chosen Fate plays of other Heroes go to unlocked locations only.

### Map cost substitution
If the Never Land Map is in the realm, playing another Item offers a choice: pay Power, or discard the Map instead of paying. Unlocking the tree is permanent even if the Map later leaves play.

### First turn
The captain starts at the Jolly Roger with 0 Power and a 4-card hand, then must move to a different unlocked location.

### Deck recycling
Empty villain or Fate decks reshuffle their discard piles. Resign is the explicit concede. The rival clock below can end the voyage before Hook wins. There is no separate turn cap.

### Splitting Headache and attachments
Headache can discard an Item in the realm, including Items attached to a character (Cutlass, Fate attachments). Discarded Fate attachments return to the Fate discard.

### Fate attachments while the hideout is locked
A common table clarification: the +2 Fate Item (Pixie Dust) does not attach to Peter while he sits on the still-locked hideout. Taunt may still cling.

### Rival villain clock
This clock is a practice rule. It is not a printed Villainous rule, and it is not a second villain board.

The rival starts at 0. The goal is 154. The rival advances after your turn ends and the computer's Fate play is finished. Easy adds 1. Normal adds 2. When the computer plays Taunt, Splitting Headache, or Pixie Dust, that card adds 1 more. Other Fate cards add nothing. Your own Fate action does not move the rival. An empty Fate deck still advances by the difficulty step.

While the Coach is on, the goal is 222 and Normal adds 1 instead of 2. Easy stays at 1. The Fate card pushes stay the same. Turning the Coach off returns the goal to 154 and Normal to 2 on the next tick. The top bar shows whichever goal is active.

If the rival reaches 154 before you vanquish Peter Pan at the Jolly Roger, you lose. A clash that wins on the current turn still wins, because the clock moves only after the turn ends. The top bar shows the track. The loss screen names the rival and the missed ship objective.

The Coach reads that same track. When 16 difficulty-steps or fewer remain (16 on Easy, 32 on Normal), the Coach adds one plain sentence: the rival’s count, the goal 154, and that Peter must be finished at the Jolly Roger. A second Never Land Map is not part of the plan once the tree is open. Ship Allies are kept for Peter, not spent on other Heroes, and a payable Ally is played on the ship rather than on a discard shore. If Tick Tock or a taunted Hero is blocking that clash, the Coach slides that Hero toward the crew instead of pacing between Gain shores.

### Not modeled
- Multi-villain boards, Activate actions, and other villains
- Licensed art, logos, proprietary game fonts, or verbatim published card text
- Every FAQ edge case (for example, unusual attach timing, simultaneous Conditions, or differences between printings)
- Attached Items cannot be moved on their own; moving an Ally or Hero carries attachments. That *is* modeled.

If a card’s source wording was ambiguous, the engine prefers the playable reading documented here.
