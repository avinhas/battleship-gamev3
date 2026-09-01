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
## Board/panel layout clips on mobile viewports
- What I did: opened the live GitHub Pages link on an iPhone (Safari), went through placement into Battle
- What I expected: all boards/panels fully visible within the no-scroll layout
- What happened instead: on Placement, "Your Waters" is clipped — columns 1 and 9–10 are outside the viewport. On Battle, "Your Waters" and the Live Feed are both clipped to slivers at opposite edges; only Enemy Waters renders fully
- Severity: High — this is a standard phone width, not an edge case, and it hides your own board state and the move feed entirely during play
- Root cause: matches Devin's earlier analysis — battle/placement layouts use non-shrinking max-content grid tracks with no fallback, so any viewport narrower than the combined content width gets clipped instead of compressed
- Fix: the fallback already scoped earlier (overflow:auto safety net + minmax(0, max-content) tracks), explicitly re-verified at mobile widths, not just short desktop windows
- Status: Fixed — see entry 6.

## 6. Boards and side panels were clipped on mobile-portrait viewports

- **Symptom:** At ~390px (iPhone / Chrome) the Placement screen cut off board columns 1 and 9–10,
  and the Battle screen showed only the enemy board — the player board and the Live Feed were
  sliced off at both edges.
- **Root cause:** `styles.css` had no media queries. The side panels kept fixed pixel floors
  (`minmax(240px, 22vw)` for the placement tray, `minmax(220px, 20vw)` for the feed), the boards
  kept an 18px cell floor, and both `html, body` and `.placement-body`/`.battle-body` clip with
  `overflow: hidden`, so anything wider than the viewport was cut instead of wrapped.
- **Fix:** Board grid tracks became `minmax(0, max-content)` so they compress on any narrow
  window, and a `@media (max-width: 640px)` breakpoint stacks both screens in one column (battle
  order: enemy board, player board, feed), drops the pixel floors on the side panels, and pins
  the cells at 32px for the placement/enemy boards and 14px for the reference player board.
  The battle screen scrolls vertically at this breakpoint — a deliberate mobile-only exception to
  the no-scroll rule, since the stacked content is taller than a phone viewport. Desktop layout is
  untouched. Browser verification at 360px then showed the 32px cell still overflowing by 6px
  (11 × 32 + 20 gaps = 372px), so a second breakpoint below 380px drops the cell to 29px and the
  screen padding to 4px — 347px total, inside a 360px viewport.

## 7. A throwing AI turn soft-locked the game

- **Symptom:** If the AI turn ever failed, the board stopped accepting shots entirely and only a
  page reload recovered the game.
- **Root cause:** `handlePlayerShot()` set `state.busy = true` before scheduling `handleEnemyTurn`,
  and `handleEnemyTurn()` cleared the flag only on its normal exit path with no error handling, so
  a throw left `busy` stuck at `true` and every later click returned early.
- **Fix:** `handleEnemyTurn()` now clears `state.busy` in a `finally` block whenever the turn ends
  without a game over, so an unexpected error can no longer wedge the turn loop. The flag still
  stays set during the AI's "aiming" delay.

## 8. Placement previews never appeared on touch devices

- **Symptom:** On a phone, selecting a ship and tapping the board placed it immediately with no
  green/red footprint feedback — players placed ships blind and had to pick them up to retry.
- **Root cause:** The placement preview was wired only to `mouseover`/`mouseleave`, events touch
  devices do not fire; the `click` handler alone ran on the first tap.
- **Fix:** A non-passive `touchstart` handler drives a two-step interaction: the first tap on a
  cell previews the footprint (valid/invalid) and the second tap on the same cell commits it.
  The handler calls `preventDefault()` so the synthesised mouse events cannot place blind, and the
  Rotate button and `R` key still re-render the pending preview. The desktop hover→click flow is
  unchanged.

## 9. No automated coverage of the pure game model

- **Symptom:** Every rule regression — placement validation, sink/win detection, AI shot legality —
  could only be caught by playing the game by hand, so the invariants recorded above were verified
  once and never again.
- **Root cause:** `board.js`, `game.js` and `ai.js` are DOM-free and trivially testable, but the
  repository had no test runner and no test files at all.
- **Fix:** Added a dependency-free `package.json` (`npm test` → `node --test`) and `test/` suites
  covering placement validity and repositioning, hit/sunk/win resolution and duplicate shots, and
  AI legality across simulated games at every difficulty (never out of bounds, never a repeat,
  adjacency after a hit, hunt mode restored after a sink, easy never targeting). The test tooling
  is dev-only: the site still deploys as plain static files with no build step.

## 10. Modals were unreachable and inescapable by keyboard

- **Symptom:** Opening `Move History`, `How to Play` or the game-over dialog left focus behind on
  the battle screen: a keyboard or screen-reader user had to tab through the whole page to reach
  the dialog, could tab straight out of it into the boards underneath, and after closing landed at
  the top of the document instead of on the button they had used.
- **Root cause:** `openModal()`/`closeModal()` only flipped the `hidden` attribute. Nothing moved
  focus into the dialog, nothing constrained it while open, and the opener was never recorded.
- **Fix:** `openModal()` stores `document.activeElement`, then focuses the first control in the
  `.modal-box` (falling back to the heading); a `Tab`/`Shift+Tab` handler cycles focus inside the
  topmost open dialog; `closeModal()`/`closeAllModals()` restore focus to the opener. This is
  generic for all three modals, including the history → game-over hand-off.

## 11. Every shot rebuilt both boards from scratch

- **Symptom:** Each shot visibly flickered, and a cell focused with the keyboard lost focus as soon
  as the AI replied, so grid navigation could not survive a single turn.
- **Root cause:** `renderBoard()` started with `container.innerHTML = ''` and recreated all 121
  nodes, and `renderBattle()` called it for both boards after every shot — 242 nodes per turn,
  discarding the focused element with them.
- **Fix:** The grid is built once (`buildGrid()`); later renders patch only what changed, toggling
  `ship`/`miss`/`hit`/`sunk`/`fired` and the cell glyph in place. `data-row`/`data-col`,
  `aria-label` and the `interactive` toggle are unchanged, and the placement screen clears its
  preview explicitly now that rendering no longer wipes it.

## 12. The AI mixed hits from two ships when inferring orientation

- **Symptom:** With two unsunk ships hit in the same area, the AI extended along an axis that no
  single ship occupied and wasted shots. Never illegal — the bounds and already-shot guards held —
  just slow.
- **Root cause:** `queueNeighbours()` derived `alignedRow`/`alignedCol` from *all* `activeHits`, so
  hits from two adjacent ships were treated as one line.
- **Fix:** Open hits are grouped into orthogonally connected clusters and orientation is inferred
  per cluster, with the cluster containing the most recent hit worked first. Over 200 simulated
  games this cut Medium from ~67 shots to ~64; Hard is unchanged at ~46.

## 13. iOS Safari clipped the bottom of every screen and squashed the header buttons

- **Symptom:** On an iPhone the bottom of the battle screen (the newest live-feed entries) and the
  `Ready` button sat behind Safari's toolbar, the mute button rendered as a cramped sliver next to
  its neighbours, taps needed a second attempt, and in landscape the last board row fell outside the
  screen entirely.
- **Root cause:** The app was `100vh` tall, which iOS resolves against the toolbar-less viewport;
  button padding was expressed in `vh`/`vw`, so on a phone `.btn` came out ~31px tall and `.btn-icon`
  37x31px — under the 44px touch target — and the height-derived cell size (`min(6vh, 4vw)`) had no
  landscape fallback.
- **Fix:** `#app` uses `100dvh` (with the `100vh` fallback) and the mobile screens pad by
  `env(safe-area-inset-*)`; coarse pointers get 44px-minimum buttons with square icon buttons and
  `touch-action: manipulation`; the screen header sticks to the top and `Ready` to the bottom of the
  scrolling column; a landscape phone query derives the cell size from `100dvh`. Typography lost its
  unclamped `vh` sizes so short viewports stay readable.

## 14. The sticky Ready button covered Back, and landscape setup overlapped its own footer

- **Symptom:** On a phone the pinned `Ready` button sat on top of `Back` on the placement screen —
  `elementFromPoint()` at the centre of `Back` returned `btn-ready`, so `Back` could not be tapped
  until the column was scrolled. On a landscape phone the setup card's `Start Game` footer landed on
  top of `Randomize Fleet`/`Standard Fleet` and nothing could be scrolled into view.
- **Root cause:** A `position: sticky` element is lifted out of its flow position and over whatever
  precedes it, and the column reserved no room for it. `#screen-setup` centres its card with flex and
  caps it at `96vh`; once the card overflows a 390px-tall viewport the overflowing part of a centred
  flex item is unreachable, and the card's own footer overlapped the panel above it.
- **Fix:** `Ready` moved out of the fleet panel into a `.placement-footer` at the end of the
  placement screen: on phones the screen itself no longer scrolls, `.placement-body` does, so the
  button stays visible as a footer without ever being lifted over the controls above it (a pinned
  `fixed`/`sticky` bar covers whatever happens to sit under it at any scroll offset). In landscape
  `#screen-setup` scrolls, starts its content at the top-left (`margin: auto` still centres it when
  it fits) and `.setup-card` drops its `max-height`.

## 15. iOS Chrome hid the placement screen title and the Ready button

- **Symptom:** On mobile iOS Chrome the placement screen showed neither its `Place Your Fleet`
  title nor the `Ready` button: both fell outside the visible area with no way to reach them, so
  the fleet could not be confirmed at all.
- **Root cause:** `#app` is `100dvh` with `overflow: hidden`, and iOS Chrome's dual top/bottom
  toolbars leave a visible area shorter than the height `dvh`/`vh` resolves to, so the top and
  bottom strips of the app box sit behind browser chrome. The mobile block forced
  `#screen-placement { overflow-y: hidden; }`, overriding the base `overflow-y: auto`, so anything
  in those strips was clipped and unreachable instead of scrollable.
- **Fix:** The mobile `overflow-y: hidden` override is gone, so the placement screen scrolls again,
  and `.placement-footer` is `position: sticky; bottom: 0` with `env(safe-area-inset-bottom)`
  padding to pair with the already-sticky `.screen-header` at `top: 0`. Title and `Ready` stay at
  the edges of whatever height the browser actually exposes while the fleet controls scroll in
  between. `#screen-setup` gets the same treatment the landscape query already used
  (`overflow-y: auto`, `align-items: flex-start`, `.setup-card` without `max-height`) so a tall
  setup card cannot clip the `Battleship` title in portrait either, with `.setup-footer` sticky at
  `bottom: 0` so `Start Game` stays on screen instead of falling below the fold.
- **Tradeoff:** This reintroduces vertical scrolling on the placement screen — a deliberate
  exception to the app's no-scroll rule, consistent with the battle screen already making it.
  Chasing exact viewport units instead leaves controls unreachable on browsers we cannot test,
  and unreachable controls are worse than a scrollbar.
