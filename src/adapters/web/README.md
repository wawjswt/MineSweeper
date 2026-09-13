# Web adapters

The Web adapter owns DOM lookup, event binding, browser timers, browser storage, image loading, CSS state, and Canvas rendering.

Current platform seams:

- `src/platform/web/storage.js` wraps `localStorage`.
- `src/platform/web/clock.js` wraps browser time and timers.
- `src/2048-ui.js` renders the core at `src/core/games/2048/engine.js`.
- `src/ui.js` renders the Minesweeper core; `src/app.js` remains the composition root.

Legacy UI controllers that still need pure-logic extraction:

- `src/sudoku-game.js`: classic Sudoku generator, state machine, persistence, keyboard handling, and DOM rendering are still in one IIFE. The Sudoku minesweeper generator is already available from `src/core/games/sudoku`.
- `src/lianliankan-game.js`: 2D path rules, level flow, timers, DOM animation, and 3D Canvas rendering are still in one IIFE. Level data and column-collapse rules are available from `src/core/games/lianliankan`.
- `src/rogue-ui.js`: the game engine is reachable through `src/core/games/rogue`; this bridge remains until the pure Rogue files move under the core directory.
- `src/game-tabs.js`: browser-only page navigation remains a Web adapter and must not be imported by core or a future miniprogram page.

Future extraction order is Sudoku state/actions, Link-Link path/flow, Rogue pure file move, then replacement of this Web adapter with WXML/WXSS pages and components.
