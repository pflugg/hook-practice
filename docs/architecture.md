# How a voyage is represented

Neverland Duel keeps the rules in plain data so the browser can render them without owning them. A player click becomes an `Input`. `applyInput` returns the next `GameState`. The UI in `src/ui/app.ts` draws that state and sends the next input back.

## The state

`GameState` in `src/engine/types.ts` is the voyage. It holds the captain's location, Power, hand, both decks, the four shores, and the phase. The phase is a union: `title`, `move`, `actions`, `resolving`, `fateAdversary`, or `over`. Hangman's Tree is locked until `hangmansUnlocked` is true. Cards on that shore do not open it.

`Pending` is a discriminated union keyed by `kind`. Choosing a card, paying for it, confirming a loss, and reading a Fate report are different variants. The UI asks `pending.kind` and then uses the fields that variant carries.

`Input` is the same kind of union for clicks. `selectLocation`, `selectAction`, `selectCard`, `endTurn`, `acknowledgeFate`, and `payWithPower` are separate variants. `applyInput` in `src/engine/game.ts` is the reducer for those clicks. The tutorial also installs a staged state with `lessonOpening` and `advanceLesson` before the next click.

## Who decides

`src/engine/queries.ts` answers questions about a state. It lists legal moves, playable cards, and whether a clash has enough Strength. It does not change the state.

`src/engine/fateAi.ts` chooses the computer's Fate card and where a Hero sits. Easy picks at random among the legal pair, except that a revealed Peter Pan is always played. Normal scores the pair. Both paths go through the same reducer, so the computer cannot play a card the rules reject.

`src/engine/coach.ts` returns a sentence and highlight keys. Board keys (`loc:`, `act:`, `card:`) are kept only when `highlightSet` contains them. `btn:` keys name prompt buttons and are not in that set. Coach does not apply the click.

`src/ui/clicks.ts` turns a DOM event into an `Input`. Dataset strings stop at `src/ui/parse.ts`, which returns a `LocationId`, a `Difficulty`, or a teach-pane name, or null.

## What is intentionally not here

`RULES_NOTES.md` records the solo adaptations. There is no second villain board. The Fate action in this app draws from Hook's own Fate deck so the practice loop can find Peter. Vanquishing Peter away from the Jolly Roger loses the practice duel. Those are product rules, not missing engine branches.

## Optional question answering

`src/engine/tutor.ts` creates public facts from the current state, including exact current Strength and visible modifiers. It omits decks, seed, RNG, and logs. `src/ui/tutor.ts` sends these facts only when a learner asks. It owns a separate dialog and has no reducer or dispatch access.

The server in `server/tutor.mjs` pins GPT-6 Luna and requests structured output containing only an answerable flag and one to three offered fact IDs. Both server and browser validate the selection. The browser displays its own original fact text, not model prose, and checks that the position has not changed. A failed request returns local next-step guidance.

Local Vite development and preview use the same HTTP handler with a locked disk quota. Vercel routes `/api/tutor` to `api/tutor.js`, where the key stays in server environment variables. `server/shared-budget.mjs` reserves each uncached request with an atomic Upstash Redis operation: 200 lifetime requests and 20 per minute across function instances. Missing credentials or an unavailable quota stop OpenAI calls. See [Vercel deployment](vercel.md).
