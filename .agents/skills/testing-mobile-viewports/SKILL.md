---
name: testing-mobile-viewports
description: Test the static Battleship game (and similar static sites) at true phone viewports on this VM using Chrome DevTools Protocol device emulation, including native taps, per-viewport measurements and screenshots.
---

# Testing mobile/responsive CSS at true phone viewports

## Serving the app
No build step. From the repo root:

```bash
python3 -m http.server 8000   # http://localhost:8000/index.html
```

For "before" comparisons against pre-PR CSS, check out the old file into a temp dir and serve it on
another port (e.g. `git show <base>:styles.css` + `python3 -m http.server 8001`).

## Why plain window resizing is not enough
The Chrome window on this VM has a hard minimum content width (~500 CSS px), so `@media (max-width: 640px)`
rules can be reached but a true 390 px viewport cannot, and `(pointer: coarse)` never matches — so
`@media (pointer: coarse)` rules (44 px touch targets etc.) silently do not apply. Use CDP emulation.

## CDP emulation harness
Chrome is launched with remote debugging (`127.0.0.1:29229` in this environment). A small persistent
driver that keeps one WebSocket open and reads commands from a FIFO works well
(`/home/ubuntu/cdp_driver.py`, input `/tmp/cdp_in`, output `/tmp/cdp_out`); it supports
`Runtime.evaluate`, `Page.captureScreenshot` and arbitrary CDP methods.

Per viewport, send:

```json
{"method":"Emulation.setDeviceMetricsOverride","params":{"width":390,"height":844,"deviceScaleFactor":1,"mobile":true,"scale":1}}
{"method":"Emulation.setTouchEmulationEnabled","params":{"enabled":true,"maxTouchPoints":1}}
{"method":"Emulation.setEmitTouchEventsForMouse","params":{"enabled":true,"configuration":"mobile"}}
```

Verify it took effect with `matchMedia('(pointer: coarse)').matches` (true only with emulation on) and
`innerWidth/innerHeight`. For a desktop regression pass, disable both touch overrides and set
`mobile:false` — then assert `(pointer: coarse) === false`.

## Native taps against an emulated viewport
Emulated viewports are rendered scaled inside the real window, so CSS coordinates must be mapped to
screen coordinates before using computer-use clicks (prefer real taps over dispatching synthetic events).
On this VM the mapping was `screen_x ≈ css_x * 0.64`, `screen_y ≈ 57 + css_y * 0.64` and held for both
390x844 and 1440x900 emulation. Always re-calibrate by measuring one known element
(`getBoundingClientRect()`) and comparing with a screenshot. Helper scripts `/home/ubuntu/tap.sh`
(selector → screen coords) and `/home/ubuntu/fire.sh` (board cell aria-label → screen coords) implement
this; board cells are `button[aria-label="E5"]` inside `#placement-board` / `#enemy-board`.

## Measurements worth scripting per viewport
- horizontal overflow: `documentElement.scrollWidth === clientWidth`, plus list every element with
  `scrollWidth > clientWidth + 1`
- `#app` height === `innerHeight` (confirms `100dvh` applied)
- which containers scroll: elements with `scrollHeight > clientHeight` (expect only `#screen-*`,
  the live feed and modal bodies)
- button geometry: heights equal + `>= 44` under coarse pointer, icon button square
- **hit testing, not just rects**: `document.elementFromPoint(cx, cy)` at each control's centre. Sticky
  footers can visually sit on top of a control whose rect is still "inside the viewport" — this is how
  the sticky `#btn-ready` was found covering `#btn-back-setup` on the placement screen. Any change that
  adds `position: sticky` should be checked this way at every viewport, including landscape.
- landscape phones (e.g. 844x390) are wider than the 640 px breakpoint, so portrait mobile rules do NOT
  apply to them; check landscape screens separately for padding/scrolling/clipping (the setup screen may
  be missed by such rules entirely, leaving its footer overlapping content with `overflow-y: visible`).

## Fast full game
Fleet editor: Destroyer = 2, all other counts 0 → "2 ships · 4 cells". After the AI's final shot, do NOT
queue further clicks: the game-over modal's backdrop covers the viewport, so a stray click closes it and
invalidates focus/modal assertions.

## Devin Secrets Needed
None — the app is static and unauthenticated.
