# How a voyage is represented

Never Land Duel keeps the rules in plain data so the browser can render them without owning them. A player click becomes an `Input`. `applyInput` returns the next `GameState`. The UI in `src/ui/app.ts` draws that state and sends the next input back.

## The state

`GameState` in `src/engine/types.ts` is the voyage. It holds the captain's location, Power, hand, both decks, the four shores, and the phase. The phase is a union: `title`, `move`, `actions`, `resolving`, `fateAdversary`, or `over`. A shore is locked or occupied by listing cards on that location, not by a second flag per card.

`Pending` is a discriminated union keyed by `kind`. Choosing a card, paying for it, confirming a loss, and reading a Fate report are different variants. The UI asks `pending.kind` and then uses the fields that variant carries.

`Input` is the same kind of union for clicks. `selectLocation`, `selectAction`, `selectCard`, `endTurn`, `acknowledgeFate`, and `payWithPower` are separate variants. The reducer in `src/engine/game.ts` is the only writer of the next state.

## Who decides

`src/engine/queries.ts` answers questions about a state. It lists legal moves, playable cards, and whether a clash has enough Strength. It does not change the state.

`src/engine/fateAi.ts` chooses the computer's Fate card and where a Hero sits. Easy picks at random among the legal pair, except that a revealed Peter Pan is always played. Normal scores the pair. Both paths go through the same reducer, so the computer cannot play a card the rules reject.

`src/engine/coach.ts` returns a sentence and a list of highlight keys. Those keys are supposed to be a subset of `highlightSet` from the reducer. Coach does not apply the click.

`src/ui/clicks.ts` turns a DOM event into an `Input`. Dataset strings stop at `src/ui/parse.ts`, which returns a `LocationId`, a `Difficulty`, or a teach-pane name, or null.

## What is intentionally not here

`RULES_NOTES.md` records the solo adaptations. There is no second villain board. The Fate action in this app draws from Hook's own Fate deck so the practice loop can find Peter. Vanquishing Peter away from the Jolly Roger loses the practice duel. Those are product rules, not missing engine branches.
