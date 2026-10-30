# Submission verification — October 30, 2026

Status: verification completed; the game, video, and optional Luna service are deployed and checked on the production URL.

## Completed checks

- Fresh `npm ci --offline` completed from the lockfile.
- TypeScript checking and ESLint passed.
- All 382 Vitest tests in 61 files passed, with zero skipped, including the 24 real-browser checks that previously required a manual Chrome path on macOS.
- The learning matrix completed all six tutorial lessons, a shuffled voyage, and all 12 drill combinations at each of six viewport sizes.
- A plain static build was served from `/review/neverland-duel/`, without a development-server fallback. The tutorial, guided combat drill, optional tutor dialog, static AI fallback, video metadata, caption file, and return link passed in Chrome and Firefox at 1440×1000, 390×844, 320×568, 844×390, and 1280×568. Optional Google Fonts were blocked during this check.
- The first 2,000 seeded full voyages completed with no crashes, stalls, invariant failures, or missing/illegal Coach recommendations. These were engine simulations, separate from browser playtesting.
- A final 1,000-voyage tutor-policy rerun completed: 840 wins and 160 rival losses, with no crashes, stalls, invariant failures, or missing/illegal Coach recommendations. This reused the tutor seed range to check the revised gameplay.
- Two endurance phases recorded 103,028 mixed simulated voyages and scripted cases, with 33,040,601 engine inputs across about 95 minutes of simulation time and no Must, Should, or Nice findings. This coverage includes intentionally resigned games and staged scenes; it is not a count of 103,028 complete non-resigned voyages.
- The original MP4 played from start to finish in the browser without errors. The final cut was re-rendered to hold the closing message clearly; its duration remains 48 seconds at 1280×720 and 30 fps, with H.264 video and no audio stream by design.
- All six lessons were also played to completion in native Safari, including Map payment, Fate acknowledgment, Hero movement, and the equal-Strength ship clash.
- A coached Normal voyage was played through the in-app browser, switching from desktop to a 390×844 phone layout. It ended in Victory on turn 36: 12 Ally Strength against Peter’s 11. The voyage used 292 actual UI clicks, after the 17-click tutorial.
- The saved OpenAI key was accepted, and the account had access to GPT-6 Luna. A bounded live evaluation passed 12 of 12 game-rule, hidden-information, false-premise, unrelated-question, and secret-request cases after improving the Wendy modifier explanation. This is a targeted evaluation, not a guarantee of relevance for every possible question.
- The actual Ask Coach dialog returned a Luna-selected engine explanation through the local server. Automated checks cover unsupported IDs, malformed output, stale positions, focus and Escape behavior, caching, quotas, service failures, and both streamed and Vercel-preparsed request bodies.
- Production was deployed from GitHub and checked at 1440×1000 and 390×844. Both live walkthroughs completed the tutorial and a guided drill, obtained a real Luna answer, checked the 48-second video and six caption cues, and followed the return link. The browser did not send an API authorization header or call OpenAI directly.
- Public JavaScript, CSS, HTML, MP4, and VTT files matched the local build byte for byte. The saved API key was absent from those public artifacts; private environment, server-source, and runtime-ledger paths returned 404. GET requests to the tutor endpoint returned 405.
- GitHub CI passed for the deployed gameplay commit: [run 53](https://github.com/pflugg/hook-practice/actions/runs/41073246832).

## Fixes made during this pass

1. Coach now collects an available free Gain before ending near the rival deadline. A regression check confirms that this does not advance the rival, and a separate check preserves priority for a winning ship clash.
2. Long instruction headers scroll away on narrow and very short windows, keeping Gain, Vanquish, and other required controls reachable. The production check covers the small-phone and landscape cases that reproduced the obstruction.
3. Relative asset paths preserve the map and bundled code when the game is hosted in a project subfolder.
4. Production builds include the video, captions, transcript, and project notes. The title screen opens the video preview; the preview returns to the game.
5. Browser detection is shared across tests, verification scripts, and video rendering. The stress-test script now uses the actual project directory and recognizes a named Hero held during an Obsession reveal.
6. The README, detailed playing guide, and submission copy use the current controls and describe the actual prototype scope.
7. Tinker Bell's Fate explanation now distinguishes covering an empty shore from actually dismissing a named Ally at that shore. Regression checks cover both outcomes.
8. Optional Luna selects only current engine-prepared facts and uses a shared 200-attempt quota. Vercel credentials are server-only Secrets; the connected Upstash database uses the Free plan with eviction disabled.
9. Tutor replies scroll into view on compact screens. Test concurrency is capped at two workers: an overloaded concurrent local rerun timed out; after stopping the endurance worker and bounding concurrency, all 382 tests passed without changing assertions or timeouts.

## Reproduce

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run verify:submission
```

For the larger learning matrix and seeded simulations, see the commands in [README.md](../README.md).

Machine-readable reports and screenshots live under the gitignored `verification-evidence/` directory. [verification-summary.json](verification-summary.json) preserves compact counts and live checks with the source and static release archives. The archive manifest records the final source commit and SHA-256 hashes.

These checks establish software behavior in the environments tested. They do not establish measured learning outcomes, comprehensive tabletop fidelity, legal clearance, or submission acceptance. See [SUBMISSION.md](SUBMISSION.md) and [LEGAL.md](../LEGAL.md) for the corresponding scope.
