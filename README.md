# Animalia v1.5 — Guided Tutorial

One flat grassy map, one 70-pixel grass block, and two guided lessons. All five older maps remain in their original archives, not this project. No countdown or hazards.

## Play

Extract the source ZIP into a new folder and open `index.html`, or open the standalone `Animalia_Guided_Tutorial_Play.html` directly in a browser.

1. Click Next on the welcome panel.
2. Walk left for 2 seconds (A), right for 2 seconds (D), and land after jumping at both glowing markers (W). The first marker is on the ground, the second on the block. Walking time counts actual grounded movement, and each marker counts once. Hold W for a higher jump.
3. After all tasks, the game temporarily locks movement and performs a 5.4-second camera reveal: golden acorn, hamster hole, then back to the player. Both objects are hidden until their reveal.
4. Collect the golden acorn and carry it to the hamster hole. A completion panel and confetti appear; Next returns you to unlimited free practice. Press R to redo the tutorial.

## Controls

A/D or Left/Right: walk. W: jump (Space and Up no longer jump). Shift: roll. Tab: Shaman mode; 1–4 select magic and click to place. 1–0: hamster emotes in Hamster mode. /: chat; Enter sends and Esc cancels. R: restart. Esc: pause. F1: movement lab. F2: debug. Mobile movement and W jump buttons remain available. E is retained for future vine maps. Chat and mode changes are temporarily disabled during the welcome and camera reveal; normal play restores them.

## Level and implementation

`levels/tutorial-01.json` defines an 1800 × 540 map with the original grass block and a longer floor so two-second walks fit comfortably. `jumpTargets` describes the two landing areas; `acorn` and `hole` define the delayed quest. `src/tutorial.js` implements the fixed-step tutorial state and camera interpolation. `src/main.js` integrates the state, objective collision, effects and camera; `src/ui.js` renders task progress. The existing character art, physics, backgrounds, chat, emotes, Shaman objects, and tuning values remain available. Tutorial completion does not award adventure medals or timed records.

## GitHub Pages

1. Create a repository on GitHub.
2. Upload the extracted source contents (`index.html`, `style.css`, `src`, `assets`, `levels`, `offline.js`, etc.) to its root.
3. In Settings → Pages, select Deploy from a branch, `main`, `/ (root)`, and Save.
4. Open the published URL GitHub displays.

No build step is needed for the supplied project. After editing code or JSON, run `python build-offline.py` to regenerate the offline bundle; run `python build-standalone.py Animalia_Guided_Tutorial_Play.html` to regenerate a single-file version.

## Tests

Run `npm test` with Node.js (no dependencies). Both Classic and Snappy movement presets complete the tutorial, including the two marked landings, reveal sequence, acorn and home. Existing physics and asset tests also run. Optional: install Python Playwright and Chromium, then run `python browser-test.py /path/to/Animalia_Guided_Tutorial_Play.html`. This uses an instrumented in-memory copy with fixed-step advancement; the shipped game has no test hooks. Mobile-sized layout was checked, but real phone performance and touch playtesting remain unverified.
