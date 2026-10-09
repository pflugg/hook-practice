# Agent notes

This file lists mistakes that showed up more than once, and the check that stops the next copy.

| Mistake | What enforces it |
| --- | --- |
| Dataset strings cast to `LocationId`, `Difficulty`, or `TeachTab` | `parseLocationId`, `parseDifficulty`, and `parseTeachTab` in `src/ui/parse.ts`. ESLint `no-restricted-syntax` fails on those casts anywhere else under `src/ui/`. |
| Coach names a board click that is not legal | `tests/coachLegal.test.ts` follows Coach through dealt games and checks each board highlight against `highlightSet`. |
| Indexed reads treated as present | `noUncheckedIndexedAccess` in `tsconfig.json`. |
| Required-move clicks on the current shore | `tests/movePhaseActions.test.ts` and `tests/clicks.test.ts`. |
| Coach tells the captain to play a card Power cannot pay | `tests/coach.test.ts`. |
