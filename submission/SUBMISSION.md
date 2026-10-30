# Neverland Duel

**Practice privately. Join the table with confidence.**

## Submission description

New board games can be intimidating when everyone else already knows the rules. Neverland Duel gives newcomers a private place to learn one move at a time, ask why, and repeat a tricky decision before game night.

The prototype teaches Captain Hook’s objective in Disney Villainous through six guided lessons, three practice topics with core and strategy-twist setups, and a shuffled solo voyage. Beginners can follow every hint immediately. When ready, they can choose a plan, receive feedback grounded in the board’s numbers, and try the action themselves.

Coach suggests a legal next click. Why this move explains the learner’s choice. The Strategy brief connects the moment to the objective. Local heuristics and a deterministic rules engine power the experience; no account or API key is required to play. Optional Ask Coach uses GPT-6 Luna to select relevant engine-verified facts in response to a question. It cannot write new rules or change the game, and local guidance remains available if the service is unavailable.

The goal is confidence before joining a human table. An explicit table-habits checklist explains the solo adaptations. This is an independent educational prototype, not an official digital edition or a replacement for the published game.

## Files to use

| Item | File or location |
| --- | --- |
| Playable static build | The complete `dist/` directory, generated with `npm ci` and `npm run build` |
| Introduction video | `submission/neverland-duel.mp4` — 48 seconds, 720p, H.264, 30 fps |
| Video preview | `submission/explainer.html`, also included in `dist/` |
| Captions | `submission/neverland-duel.vtt` and `.srt` |
| Transcript | `submission/transcript.txt` |
| Setup and project overview | `README.md` |
| Vercel with optional Luna | Source project plus `docs/vercel.md`; deploy `api/` and `server/` as well as the frontend |
| Rules adaptations | `RULES_NOTES.md` and the in-app table-habits checklist |
| Rights statement | `LEGAL.md` |

The video is silent by design, with teaching points on screen. Its illustrations are simplified original diagrams, not interface footage. The preview links directly back to the playable game. The title screen links to the preview.

## Suggested demonstration

1. Start with **Tutorial**. Move to Skull Rock, Gain 1, and pay 4 for the Map. Show how the explanation connects the immediate move to the unlock.
2. Finish the remaining lessons. Acknowledge Fate, escort Peter one step, and complete the staged 8-against-8 ship clash. The completion screen explains the staged setup.
3. Return to the title and open **Make the numbers work → Follow along**. Complete the core setup, then choose **Try the strategy twist**. Show how Wendy changes the Strength calculation and why the Brute preserves an Ally.
4. Open **Before you play with people** to show how the practice relates to the human game.

For the shortest overview, play the 48-second video before the live demonstration.

## Scope to state accurately

- The current teaching content covers Captain Hook’s objective, not all board games or all Villainous characters.
- Fate and next-move Coach are local heuristics. Optional Ask Coach uses Luna only after a learner asks a question; displayed answers contain engine-prepared facts. Computer Fate and the rival clock are solo teaching adaptations.
- Completing a practice setup is not proof of mastery; no learning-outcome study is claimed.
- Refreshing resets the current game. There is no saved voyage, multiplayer, or cloud account.
- The working name and educational purpose do not establish legal clearance. Keep the non-affiliation statement and rights notes with the submission.

## Final handoff

The [live game](https://hook-practice-ten.vercel.app/) and [video preview](https://hook-practice-ten.vercel.app/submission/explainer.html) are deployed from [the GitHub source](https://github.com/pflugg/hook-practice). The production walkthrough checked the tutorial, practice drill, real Luna answer, video, captions, and return link at desktop and phone sizes. The OpenAI key and free Upstash quota credentials are server-only Production secrets. [Vercel setup](../docs/vercel.md) explains the configuration.

A static-only deployment of `dist/` supports the complete game with local Coach. The entrant/team details and event’s final form still need to be supplied at the submission destination. Confirm that reviewers can access any repository link you provide. No submission acceptance is claimed here.

Build and test evidence is recorded in [QA.md](QA.md). For the exact source and playable archives, use the files in the local `release/` directory produced at handoff.
