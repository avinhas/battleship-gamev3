# Battleship — Specification

A client-side, static single-player Battleship game (human vs AI) that runs entirely in the
browser and is deployable to GitHub Pages under the subpath `/battleship-gamev3/`.
No build step, no backend, no external dependencies. All asset paths are relative.

## 1. Core concepts

### 1.1 Grid

- Each player owns a **10x10** grid, rows `A`–`J` (index 0–9) and columns `1`–`10` (index 0–9).
- A cell is addressed internally as `{row, col}` with `0 <= row, col <= 9` and displayed as
  e.g. `B4` (row `B`, column `4`).
- Cell state on a board: `empty`, `ship`, `miss`, `hit`.

### 1.2 Fleet composition

The fleet is chosen on the setup screen. The available ship types are:

| Ship        | Length | Default count |
| ----------- | ------ | ------------- |
| Carrier     | 5      | 1             |
| Battleship  | 4      | 1             |
| Cruiser     | 3      | 1             |
| Submarine   | 3      | 1             |
| Destroyer   | 2      | 1             |

- The default ("standard") fleet is exactly one of each — 5 ships, 17 cells.
- The player may change the count of each ship type from `0` to `4`.
- A composition is **valid** when it contains at least 1 ship, at most 10 ships, and the total
  occupied cells are at most 30 (so random placement always terminates on a 100-cell grid).
- Both the player and the AI use the **same** composition.
- **Randomize Fleet** picks a valid random composition (1–3 of some ship types) on the setup screen.

### 1.3 Difficulty

| Level  | AI behaviour |
| ------ | ------------ |
| Easy   | Uniformly random shot among cells not yet fired at. |
| Medium | Hunt/target: random hunting until a hit, then queue the orthogonally-adjacent cells of that hit and fire them until the ship sinks; on sink, drop the queue and return to hunting. Along a confirmed axis (2+ hits in a line) it extends that line first. |
| Hard   | Medium's target mode plus smarter hunting: parity filtering (only cells where `(row + col) % 2 === 0` while the smallest afloat ship has length >= 2) combined with a probability-density heatmap — every legal placement of every afloat enemy ship is enumerated over the known board state and the cell with the highest placement count is fired at. |

## 2. Placement rules

`canPlace(board, length, row, col, orientation)` returns true only when:

1. **In bounds** — the whole ship fits: for `horizontal`, `col + length <= 10`; for `vertical`,
   `row + length <= 10`.
2. **No overlap** — none of the covered cells is already occupied by another ship.
3. **Orientation** — only `horizontal` (extending right/east) or `vertical` (extending down/south).

`placeShip(board, ship, row, col, orientation)` places when `canPlace` is true and throws/returns
`false` otherwise. The clicked cell is always the ship's **anchor/origin** (its top-most or
left-most cell).

`randomPlaceFleet(board, composition)` places every ship of the composition at random valid
positions, retrying on conflict; used both for the AI's board and for the player's
"Randomize Placement" button.

## 3. Attack mechanics

`fire(board, row, col)` resolves a shot:

- Firing at an already-fired cell is rejected (`{result: 'invalid'}`) and does not consume a turn.
- Cell without a ship → `{result: 'miss'}`, cell marked `miss`.
- Cell with a ship → `{result: 'hit', ship}`, cell marked `hit`.
- If every cell of that ship is hit → `{result: 'sunk', ship}`.
- If every ship on the board is sunk → the response additionally carries `gameOver: true`.

## 4. Turn flow

1. The player fires at one enemy cell. An invalid target (already fired, or the game is over)
   is ignored and the turn is not consumed.
2. The result is rendered and appended to the log.
3. If the player's shot ended the game → game-over state, AI does not move.
4. Otherwise the AI fires once at the player's board after a short delay (input is locked while
   the AI is thinking); the result is rendered and logged.
5. If the AI's shot ended the game → game-over state.
6. Control returns to the player.

**Win condition:** the side that has sunk *all* of the opponent's ships wins. This is checked
after each individual shot.

## 5. UI flow — three screens, one page

All three screens are `<section>`s inside `index.html`; exactly one is visible at a time
(toggled with an `.active` class). There are no separate HTML files and no page navigation.

### Screen 1 — Setup (shown on load)

- Difficulty selector: Easy / Medium / Hard (Medium default).
- Fleet composition editor: one row per ship type with the length shown and `−` / `+` count
  steppers; a live summary of total ships and total cells; invalid compositions disable
  "Start Game".
- **Randomize Fleet** — fills the composition with a valid random selection.
- **Reset to Standard** — restores the default fleet.
- **How to Play** — collapsible section/modal explaining the rules and controls.
- **Start Game** — validates the composition and advances to Screen 2.

### Screen 2 — Manual ship placement

- The player's 10x10 board plus a tray listing every ship instance of the chosen composition,
  marked *placed* or *remaining*.
- **Click-to-place**: click a tray ship to select it (highlighted), then click a board cell to
  drop it with that cell as anchor.
- **Rotate**: a visible button *and* the `R` keyboard shortcut toggle horizontal/vertical for the
  currently selected ship.
- **Preview**: hovering the board (or keyboard-focusing a cell) highlights the cells the ship
  would occupy, green when valid and red when invalid.
- **Live validation**: out-of-bounds or overlapping placements are refused; the ship stays
  selected and a message explains why.
- **Repositioning**: clicking an already-placed ship (on the board or in the tray) returns it to
  the tray and selects it again.
- **Randomize Placement** — auto-places all remaining ships validly.
- **Clear Board** — returns every placed ship to the tray.
- **Back** — returns to Screen 1.
- **Ready / Play** — disabled until all ships are placed; generates the AI board (random valid
  placement of the same composition), builds the battle state, and advances to Screen 3.

### Screen 3 — Battle

- Both boards rendered side by side: **enemy board larger** and interactive (the target), the
  player's own waters smaller and read-only, showing their ships and the enemy's shots.
- Clicking an enemy cell fires: immediate hit/miss/sunk feedback on the cell and in a status
  line; then the AI takes its turn.
- **Live feed** panel appending each move in real time
  (`You fired at B4 — Hit!`, `Enemy fired at C7 — Miss`), newest entry auto-scrolled into view.
  The panel scrolls internally; the page never scrolls.
- **Move History** button opens a modal with the full chronological log and a close button
  (closable via button, backdrop click, or `Escape`).
- Per-side scoreboard showing ships remaining / sunk.
- **Game over**: a modal/banner announcing the winner with **Play Again**, which resets state and
  returns to Screen 1.

## 6. Layout constraints (no scrolling)

- `html, body` are `100%` height with `overflow: hidden`; the app root is `100vw x 100vh`.
- Screens use flexbox/grid; boards are sized from a CSS custom property computed from viewport
  units (`min(vw, vh)`-derived cell size) so the larger enemy board, the smaller player board,
  the live feed and all controls fit simultaneously at common desktop resolutions
  (1280x720 and up).
- Only inner panels (live feed, history modal body, how-to-play body) scroll internally.

## 7. Code structure

```
index.html      single page with the three <section> screens and the modals
styles.css      layout + theme, viewport-fitted sizing
src/board.js    pure model: grid, ships, canPlace/placeShip/randomPlaceFleet/fire
src/game.js     game state: composition, boards, turn flow, log, win detection
src/ai.js       difficulty strategies (easy/medium/hard) returning the next shot
src/ui.js       DOM rendering, screen switching, event wiring (entry point)
```

- `board.js`, `game.js` and `ai.js` contain **no DOM code** and are directly testable.
- Modules are native ES modules loaded with relative paths (`<script type="module" src="src/ui.js">`)
  so the site works from the GitHub Pages subpath.
