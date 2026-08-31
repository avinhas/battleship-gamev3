# Battleship

A client-side, single-player Battleship game against an AI opponent. No build step, no
dependencies — plain HTML, CSS and ES modules, served straight from GitHub Pages.

**Play:** https://avinhas.github.io/battleship-gamev3/

## The game

Three screens on one page, toggled without navigation:

1. **Setup** — pick a difficulty (Easy / Medium / Hard), edit the fleet composition (defaults to
   the standard Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2), randomize a fleet,
   or read How to Play.
2. **Manual placement** — click a ship in the tray, then click a board cell to drop its anchor.
   The hover preview is green when the placement is legal and red when it is not. Rotate,
   randomize the remaining ships, clear the board, and reposition anything already placed by
   clicking it. `Ready` unlocks once the whole fleet is on the board.
3. **Battle** — your waters on the left, the larger enemy grid in the middle, a live move feed on
   the right. Every player shot is answered by the AI. `Move History` opens the full chronological
   log; game over offers a review of the final boards and `Play Again`.

Everything fits inside the viewport — the page never scrolls; only the feed and modals do. Below
640px the screens stack into a single column (battle order: enemy board, your board, feed) and the
battle screen scrolls vertically, the one deliberate exception to the no-scroll rule.

### Difficulty

| Level  | Behaviour                                                                |
| ------ | ------------------------------------------------------------------------ |
| Easy   | Uniformly random unshot cells                                            |
| Medium | Hunt/target — random until a hit, then works adjacent cells and extends along the discovered axis |
| Hard   | Hunt/target plus parity hunting and a probability-density map of every legal placement of the ships still afloat |

Measured over 200 simulated games each: Easy clears a fleet in ~94 shots, Medium ~67, Hard ~47.

### Controls

- **Click** a tray ship, then **click** a cell to place it. On touch screens the first tap on a
  cell previews the footprint and a second tap on the same cell places the ship.
- **R** or the `Rotate` button toggles horizontal/vertical.
- **Click** a placed ship to pick it back up.
- **Click** an enemy cell to fire.
- **Esc** closes any modal.

## Running locally

Because the app uses ES modules, open it through a web server rather than `file://`:

```bash
git clone https://github.com/avinhas/battleship-gamev3.git
cd battleship-gamev3
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## Tests

The rules modules are DOM-free, so they run under Node's built-in test runner. There are no
dependencies to install and the site itself still has no build step — the tooling is dev-only.

```bash
npm test
```

## Layout of the source

| Path                        | Responsibility                                                    |
| --------------------------- | ----------------------------------------------------------------- |
| `index.html`                | All three screens plus modals, as toggled sections                 |
| `styles.css`                | Viewport-locked layout and board sizing                            |
| `src/board.js`              | Grid, ships, placement validation, random placement, shot resolution |
| `src/game.js`               | Match state, turn flow, move log, win detection                    |
| `src/ai.js`                 | Difficulty-scaled opponent                                         |
| `src/ui.js`                 | Rendering and event wiring — the only module that touches the DOM  |

`board.js`, `game.js` and `ai.js` contain no DOM access, so the rules can be simulated headlessly.
All asset and module paths are relative so the site works under the `/battleship-gamev3/` Pages
subpath.

## Spec-driven workflow

[`SPEC.md`](SPEC.md) was written and committed before any code: it fixes the grid, fleet, placement
and attack rules, the AI behaviour per difficulty, the turn flow and the three-screen UI contract.
Each subsequent commit implements one slice of that spec — scaffold, model, setup screen, placement
screen, battle screen, layout, AI — followed by a debugging pass of full games at every difficulty.
[`BUGS.md`](BUGS.md) records each defect found there as symptom → root cause → fix.

Deployment runs from [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which publishes
the repository root to GitHub Pages on every push to `main`.
