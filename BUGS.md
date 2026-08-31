# Bugs found while debugging

Each entry records a real defect found by playing full games (Easy, Medium, Hard) in the
browser, plus headless model simulations, and the fix that shipped for it.

## 1. Placed ships could not be repositioned while another ship was selected

- **Symptom:** On the placement screen, clicking a ship already on the board sometimes did
  nothing. It only returned to the tray when no other tray ship was selected, so a player who
  had clicked the Destroyer in the tray could not pick the Carrier back up.
- **Root cause:** `handlePlacementClick()` checked the tray selection first and only looked for
  an occupying ship inside that branch, so the "occupied cell" case was unreachable whenever a
  different ship was selected.
- **Fix:** The occupancy check now runs first: any click on an occupied cell removes that ship,
  restores its orientation and selects it in the tray (commit `9e6a708`).

## 2. Game over locked the player out of the final boards and history

- **Symptom:** When a game ended, the result modal covered the screen and its backdrop swallowed
  clicks on the `Move History` button, so the full log and final boards could not be reviewed.
- **Root cause:** The game-over modal was rendered over the battle screen with a click-blocking
  backdrop, but it exposed only a `Play Again` action.
- **Fix:** Added a `Move History` button inside the game-over modal plus a close control and
  backdrop dismissal, so the finished boards and log stay reviewable (commit `84a06a4`).

## 3. Boards overflowed the viewport at short window heights

- **Symptom:** At 1280x600 and other short viewports the battle screen produced a page scrollbar;
  on very large displays the cells grew until the feed panel was pushed off-screen.
- **Root cause:** Cell sizing used unbounded viewport units and the screen bodies did not clip
  their own overflow, so the boards could exceed the space the flex layout gave them.
- **Fix:** Cell sizes are `clamp(min, min(vh, vw), max)` per board and the placement/battle bodies
  set `overflow: hidden`, keeping scrolling inside the feed and modal panels only (commit
  `8beedc4`). Verified with zero overflow at 1024x768, 1280x600, 1280x720, 1366x768, 1440x900,
  1600x900, 1920x1080 and 2560x1440.

## 4. Battle screen columns were visually unbalanced

- **Symptom:** The player board sat against the left edge with a large gap before the enemy board.
- **Root cause:** The battle grid used `minmax(0, auto)` columns, which stretched the board
  columns instead of hugging their content.
- **Fix:** Switched to `max-content` board columns with `justify-items: center`.

## 5. Favicon request 404'd on every load

- **Symptom:** The console logged `Failed to load resource: 404` for `/favicon.ico` on load —
  noise that hid real errors while debugging.
- **Root cause:** No icon was declared, so the browser requested the default absolute path (which
  would also break under the GitHub Pages subpath).
- **Fix:** Added `favicon.svg` and a relative `<link rel="icon">` (commit `6ceb598`).

## Invariants verified after the fixes

- 600 simulated games (200 per difficulty): the AI never repeated a shot, never fired out of
  bounds, and always returned to hunt mode after sinking a ship. Average shots to clear a fleet:
  Easy 94.3, Medium 66.8, Hard 46.9 — the intended difficulty ordering.
- Placement fuzzing: no ship was ever placed overlapping or off-grid, including rotations anchored
  on the last row/column.
- Full browser games at each difficulty: turn order stayed strictly player→AI (10 rapid clicks
  produced exactly one player shot and one AI reply), repeat clicks on a fired cell were rejected
  without consuming a turn, the winner was announced only when the last ship sank, and the live
  feed and Move History modal contained identical entries (110 and 114 entries in the recorded
  runs).
