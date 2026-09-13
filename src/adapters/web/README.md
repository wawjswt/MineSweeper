# Web adapters

The Web adapter owns DOM lookup, event binding, browser timers, browser storage, image loading, CSS state, and Canvas rendering.

Current platform seams:

- `src/platform/web/storage.js` wraps `localStorage`.
- `src/platform/web/clock.js` wraps browser time and timers.
- `src/2048-ui.js` renders the core at `src/core/games/2048/engine.js`.
- `src/ui.js` renders the Minesweeper core; `src/app.js` remains the composition root.
- `src/sudoku-game.js` adapts the Sudoku core at `src/core/games/sudoku`.
- `src/lianliankan-game.js` adapts the Link-Link 2D/3D core at `src/core/games/lianliankan`.
- `src/rogue-ui.js` renders the Rogue core at `src/core/games/rogue`.
- `src/application/game-registry.js` provides the platform-neutral game registration and action boundary.

The page has one business entry:

- `src/app.js` imports the Web controllers for HTTP ESM loading.
- `dist/file-bundle.js` contains the same dependency graph for the `file:` entry.
- `src/game-tabs.js` remains a browser-only page navigation adapter and must not be imported by core or a future miniprogram page.
- The old `src/rogue-*.js` and `src/lianliankan-levels.js` paths remain thin compatibility entries for existing consumers.

The next extraction target is `platform/wechat` plus WXML/WXSS pages and components. Those adapters should consume the canonical core/application interfaces instead of copying game rules.
