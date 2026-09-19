# Rules notes — Never Land Duel v1

This practice tool aims for a playable Hook-style objective, not FAQ-perfect parity. Card text is **paraphrased** so the repo does not reproduce published flavor or rulebook wording. See `LEGAL.md`.

## Intentional simplifications

### Solo Fate adversary
There is no second villain board. After you end your turn and refill to four cards, the computer always performs **one Fate action** against you (Easy: random legal play; Normal: heuristic). Your own Fate actions still let you hunt Peter Pan.

### Conditions (Cunning, Obsession)
In a two-player game those cards wait for an opponent’s turn. In solo play they would almost never trigger, so they are adapted:

- **Cunning** — During your action phase, if a Hero of Strength 4+ is in the realm, you may play Cunning without using a Play a Card action, then play an Ally from hand for free.
- **Obsession** — During your action phase, if Peter Pan has not yet been revealed, you may play Obsession without using a Play a Card action, then reveal Fate cards until a Hero and play or banish that Hero.

### Extra Item actions
Cannon, Hook’s Case, and Ingenious Device grant extra actions at their location. Those extras are **never covered** by Heroes (only the printed top row is covered). Each matching Item adds one extra action.

### Peter Pan vanquished off-ship
If Peter is vanquished anywhere other than the Jolly Roger, the duel is an immediate **loss**. A table game might simply discard him and leave the objective unfinished; the explicit loss keeps this practice tool honest.

### Give Them a Scare
This card **looks** at the top two Fate cards. Looking does not count as revealing, so Peter Pan is not forced onto Hangman’s Tree by a peek. You may banish both cards or return them in either order.

### Reveal vs play
Whenever Peter Pan is *revealed* (Fate action, Worthy Opponent, Obsession), he is placed at Hangman’s Tree even if locked, and the other cards from that reveal are discarded. Player-chosen Fate plays of other Heroes go to unlocked locations only.

### Map cost substitution
If the Never Land Map is in the realm, playing another Item offers a choice: pay Power, or discard the Map instead of paying. Unlocking the tree is permanent even if the Map later leaves play.

### First turn
The captain starts at the Jolly Roger with 0 Power and a 4-card hand, then must move to a different unlocked location.

### Deck recycling
Empty villain or Fate decks reshuffle their discard piles. There is no turn limit. Resign is the explicit concede.

### Not modeled
- Multi-villain boards, Activate actions, and other villains
- Licensed art, logos, proprietary game fonts, or verbatim published card text
- Every FAQ edge case (for example, unusual attach timing, simultaneous Conditions, or differences between printings)
- Attached Items cannot be moved on their own; moving an Ally or Hero carries attachments. That *is* modeled.

If a card’s source wording was ambiguous, the engine prefers the playable reading documented here.
