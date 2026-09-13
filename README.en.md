# MineSweeper · Puzzle Arcade

[中文](README.md) | [English](README.en.md)

A native Web puzzle arcade centered on Minesweeper, with Sudoku, Link-Link, and 2048 included in the same project.

The project runs directly in a browser, supports ES Modules over HTTP, and also provides a self-contained bundle for the `file:` protocol. Its game rules are being separated into platform-agnostic core modules so the project can later move to WeChat Mini Program without duplicating the rules.

## Games

- **Minesweeper**: easy, normal, hard, extreme, and custom boards; classic, offset, Sudoku Minesweeper, Hex, ring-board, and tactical modes.
- **Deduction-friendly generation**: supported modes can use either standard random generation or a generator that attempts to keep the board solvable through deterministic deductions.
- **Sudoku**: generates unique puzzles at runtime and includes candidates, hints, move history, digit statistics, and local persistence.
- **Link-Link**: classic 2D, fixed levels, timed challenge, and 3D board modes, with path validation, reshuffling, and collapse flows.
- **2048**: keyboard controls, on-screen direction buttons, score and best-score tracking, and the option to continue after reaching 2048.
- **Themes and backgrounds**: dark, light, pink, and sky themes, plus a custom background image with adjustable opacity.
- **Keyboard and accessibility support**: keyboard interactions, focus management, and labelled game boards are built into the Web UI.

## Quick start

### Open directly

No dependency installation is required. Open [`index.html`](index.html) from the project root in a browser.

### Run through a local HTTP server

HTTP mode uses the `src/app.js` ES Module entry and more closely matches a deployed environment:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

### Build the file-protocol bundle

To regenerate the bundle used when loading the page through `file:`:

```bash
npm run build:file
```

The generated file is `dist/file-bundle.js`.

### WeChat Mini Program development build

The repository now includes a native Mini Program shell in [`miniprogram/`](miniprogram/). Its development runtime registers 2048, classic Minesweeper, standard Sudoku, 2D Link-Link, and Rogue. Each game reuses the sessions in `src/application/` and rules in `src/core/`; WXML does not duplicate game logic.

Import the `miniprogram/` directory from the project root into WeChat DevTools. During development it can run without a real AppID. After changing shared source code, run:

```bash
npm run build:miniprogram
```

This regenerates `miniprogram/generated/runtime.js`; commit the generated file together with its source. Before release, run:

```bash
npm run check:miniprogram
```

The quality command builds the Mini Program runtime, checks platform boundaries and the generated bundle, then runs the full `npm test` suite. A real AppID, DevTools configuration, device performance checks, and the final release package still need to be completed in WeChat DevTools.

## Development and tests

The project uses native JavaScript, HTML, and CSS. It does not depend on React, Vue, Taro, or uni-app. Install Node.js, then run:

```bash
npm test
```

The test command first builds the file-protocol bundle, then runs core-rule, platform-boundary, Web-adapter, gameplay-flow, and compatibility-entry tests.

## Project structure

```text
.
├── index.html                 # Web page entry
├── src/
│   ├── app.js                 # Web composition root
│   ├── application/           # Game registration and action dispatch
│   ├── core/                  # Browser-independent game cores
│   │   ├── games/2048/
│   │   ├── games/lianliankan/
│   │   ├── games/minesweeper/
│   │   ├── games/rogue/
│   │   └── games/sudoku/
│   ├── platform/web/          # Web storage, clock, and other capabilities
│   ├── platform/wechat/        # WeChat storage, clock, random, and media ports
│   ├── adapters/web/           # Web adapter notes and boundaries
│   └── adapters/miniprogram/   # Mini Program runtime and WXML view models
├── miniprogram/                # Native Mini Program pages and components
├── assets/                    # Rogue guide illustrations and other assets
├── tests/                     # Node core and compatibility-flow tests
├── tools/                     # Build tools
└── dist/file-bundle.js        # File-protocol-compatible bundle
```

The core handles serializable state, rules, and action results. It does not directly access `window`, `document`, `localStorage`, or Mini Program APIs. Platform capabilities and UI are connected through adapters, while legacy `src/*.js` paths remain as compatibility entries during the migration.

## Current status

- [x] Web multi-game page and unified entry
- [x] Core extraction for Minesweeper, 2048, Sudoku, Link-Link, and Rogue
- [x] Application-level game registration and action dispatch boundary
- [x] File-protocol bundle build and tests
- [x] WeChat Mini Program platform adapters, runtime, and five game sessions
- [x] Development slices for WXML/WXSS pages and components
- [ ] Mini Program device and performance validation

The Mini Program work is still a development build: 3D Link-Link, background-media integration, accounts/cloud development/leaderboards/payments, the production AppID, and release configuration are intentionally deferred. Without WeChat DevTools, automated Node checks cannot replace page smoke tests or real-device touch validation.

The next Mini Program phase will add WeChat platform capabilities and WXML/WXSS adapters while reusing `src/core/` and `src/application/`. Game rules will not be copied into page code.

## Contribution guidelines

Keep new game rules and core logic independent from the browser environment, and add tests for new boundaries. Code that depends on Web DOM, Canvas, browser storage, or browser timers belongs in a Web adapter or platform module.
