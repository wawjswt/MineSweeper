import test from "node:test";
import assert from "node:assert/strict";
import {
  canMove2048,
  create2048Game,
  moveBoard2048,
  spawnTile2048,
} from "../src/2048-game.js";
import { create2048UI } from "../src/2048-ui.js";
import { createWebMergeSound } from "../src/platform/web/sound.js";

const EMPTY_BOARD = Array(16).fill(0);

test("slides tiles left and merges each tile at most once per move", () => {
  const board = [2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const result = moveBoard2048(board, "left");

  assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
  assert.equal(result.scoreDelta, 8);
  assert.equal(result.moved, true);
  assert.deepEqual(board.slice(0, 4), [2, 2, 2, 2]);
});

test("reports tile source and destination cells for move animations", () => {
  const merge = moveBoard2048([2, 0, 2, 0, ...EMPTY_BOARD.slice(4)], "left");
  assert.deepEqual(merge.transitions, [
    { from: 0, to: 0, value: 2, merged: true },
    { from: 2, to: 0, value: 2, merged: true },
  ]);

  const slide = moveBoard2048([2, 0, 0, 0, ...EMPTY_BOARD.slice(4)], "right");
  assert.deepEqual(slide.transitions, [
    { from: 0, to: 3, value: 2, merged: false },
  ]);
});

test("moves tiles in all four directions without changing a blocked board", () => {
  const board = [
    2, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 2,
  ];

  assert.deepEqual(moveBoard2048(board, "right").board.slice(0, 4), [0, 0, 0, 2]);
  assert.deepEqual(moveBoard2048(board, "down").board.slice(12), [2, 0, 0, 2]);
  assert.deepEqual(moveBoard2048(board, "up").board.slice(0, 4), [2, 0, 0, 2]);

  const blocked = [
    2, 4, 8, 16,
    32, 64, 128, 256,
    512, 1024, 2048, 4096,
    8192, 16384, 32768, 65536,
  ];
  const result = moveBoard2048(blocked, "left");
  assert.equal(result.moved, false);
  assert.deepEqual(result.board, blocked);
  assert.equal(canMove2048(blocked), false);
});

test("spawns a 2 or 4 into one empty cell and leaves occupied cells intact", () => {
  const board = [...EMPTY_BOARD];
  board[0] = 8;
  let rngCall = 0;
  const result = spawnTile2048(board, () => (rngCall++ === 0 ? 0 : 0.95));

  assert.equal(result.board[0], 8);
  assert.equal(result.board.filter((value) => value !== 0).length, 2);
  assert.equal(result.board.includes(4), true);
  assert.equal(result.index > 0, true);
  assert.deepEqual(board, [8, ...EMPTY_BOARD.slice(1)]);
});

test("successful moves update score and spawn exactly one new tile", () => {
  const board = [2, 2, ...EMPTY_BOARD.slice(2)];
  const game = create2048Game({ initialBoard: board, rng: () => 0 });

  const state = game.move("left");

  assert.equal(state.score, 4);
  assert.equal(state.board.filter((value) => value !== 0).length, 2);
  assert.equal(state.board[0], 4);
  assert.equal(state.status, "playing");
});

test("reaching 2048 pauses at the win state until the player continues", () => {
  const board = [1024, 1024, ...EMPTY_BOARD.slice(2)];
  const game = create2048Game({ initialBoard: board, rng: () => 0 });

  const won = game.move("left");
  assert.equal(won.status, "won");
  assert.equal(won.won, true);

  const continued = game.continueAfterWin();
  assert.equal(continued.status, "playing");
  assert.equal(continued.won, true);
});

test("a full board with no legal merges starts in the game-over state", () => {
  const board = [
    2, 4, 2, 4,
    4, 2, 4, 2,
    2, 4, 2, 4,
    4, 2, 4, 2,
  ];
  const game = create2048Game({ initialBoard: board, rng: () => 0 });

  assert.equal(game.getState().status, "over");
  assert.equal(game.move("left").status, "over");
  assert.equal(game.getState().score, 0);
});

test("starting a new game does not force focus onto the board", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const createElement = () => {
    const listeners = new Map();
    return {
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
      appendChild(child) {
        this.children.push(child);
      },
      children: [],
      classList: { toggle() {} },
      dataset: {},
      focusCalls: 0,
      focus() {
        this.focusCalls += 1;
      },
      listeners,
      replaceChildren() {
        this.children = [];
      },
      setAttribute() {},
      textContent: "",
    };
  };
  const elements = {
    root: createElement(),
    board: createElement(),
    score: createElement(),
    best: createElement(),
    status: createElement(),
    overlay: createElement(),
    overlayTitle: createElement(),
    overlayText: createElement(),
    continueButton: createElement(),
    newButton: createElement(),
    overlayNewButton: createElement(),
    upButton: createElement(),
    downButton: createElement(),
    leftButton: createElement(),
    rightButton: createElement(),
  };

  globalThis.document = { createElement };
  globalThis.window = { addEventListener() {} };
  try {
    const game = create2048Game({
      initialBoard: [0, 2, ...EMPTY_BOARD.slice(2)],
      rng: () => 0,
    });
    create2048UI(elements, {
      game,
      storage: { getItem: () => null, setItem() {} },
      reducedMotion: true,
    });
    elements.newButton.listeners.get("click")();
    assert.equal(elements.board.focusCalls, 0);
    elements.leftButton.listeners.get("click")();
    assert.equal(game.getState().board[0], 2);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("plays one injected sound for a move with one or more merges", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const createElement = () => {
    const listeners = new Map();
    return {
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
      appendChild(child) {
        this.children.push(child);
      },
      children: [],
      classList: { toggle() {} },
      dataset: {},
      listeners,
      replaceChildren() {
        this.children = [];
      },
      setAttribute() {},
      style: { setProperty() {} },
      textContent: "",
    };
  };
  const elements = {
    root: createElement(),
    board: createElement(),
    score: createElement(),
    best: createElement(),
    status: createElement(),
    overlay: createElement(),
    overlayTitle: createElement(),
    overlayText: createElement(),
    continueButton: createElement(),
    newButton: createElement(),
    overlayNewButton: createElement(),
    upButton: createElement(),
    downButton: createElement(),
    leftButton: createElement(),
    rightButton: createElement(),
  };
  const sound = {
    mergeCalls: 0,
    playMerge() {
      this.mergeCalls += 1;
    },
  };

  globalThis.document = { createElement };
  globalThis.window = { addEventListener() {} };
  try {
    const game = create2048Game({
      initialBoard: [2, 2, 2, 2, ...EMPTY_BOARD.slice(4)],
      rng: () => 0,
    });
    const ui = create2048UI(elements, {
      game,
      sound,
      storage: { getItem: () => null, setItem() {} },
      reducedMotion: true,
    });

    ui.move("left");
    assert.equal(sound.mergeCalls, 1);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("does not play merge sound for a move without a merge", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const createElement = () => {
    const listeners = new Map();
    return {
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
      appendChild(child) {
        this.children.push(child);
      },
      children: [],
      classList: { toggle() {} },
      dataset: {},
      listeners,
      replaceChildren() {
        this.children = [];
      },
      setAttribute() {},
      style: { setProperty() {} },
      textContent: "",
    };
  };
  const elements = {
    root: createElement(),
    board: createElement(),
    score: createElement(),
    best: createElement(),
    status: createElement(),
    overlay: createElement(),
    overlayTitle: createElement(),
    overlayText: createElement(),
    continueButton: createElement(),
    newButton: createElement(),
    overlayNewButton: createElement(),
    upButton: createElement(),
    downButton: createElement(),
    leftButton: createElement(),
    rightButton: createElement(),
  };
  const sound = {
    mergeCalls: 0,
    playMerge() {
      this.mergeCalls += 1;
    },
  };

  globalThis.document = { createElement };
  globalThis.window = { addEventListener() {} };
  try {
    const game = create2048Game({
      initialBoard: [0, 2, ...EMPTY_BOARD.slice(2)],
      rng: () => 0,
    });
    const ui = create2048UI(elements, {
      game,
      sound,
      storage: { getItem: () => null, setItem() {} },
      reducedMotion: true,
    });

    ui.move("left");
    assert.equal(sound.mergeCalls, 0);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("web merge sound creates the audio context lazily and reuses it", () => {
  let contextCreations = 0;
  const calls = [];
  const audioContext = {
    currentTime: 1,
    destination: {},
    createGain() {
      return {
        connect() {},
        gain: {
          setValueAtTime(...args) { calls.push(["gain.set", ...args]); },
          exponentialRampToValueAtTime(...args) { calls.push(["gain.ramp", ...args]); },
        },
      };
    },
    createOscillator() {
      return {
        connect() {},
        frequency: {
          setValueAtTime(...args) { calls.push(["frequency.set", ...args]); },
          exponentialRampToValueAtTime(...args) { calls.push(["frequency.ramp", ...args]); },
        },
        start(...args) { calls.push(["start", ...args]); },
        stop(...args) { calls.push(["stop", ...args]); },
      };
    },
  };
  const sound = createWebMergeSound({
    createAudioContext: () => {
      contextCreations += 1;
      return audioContext;
    },
  });

  assert.equal(contextCreations, 0);
  assert.equal(sound.playMerge(), true);
  assert.equal(sound.playMerge(), true);
  assert.equal(contextCreations, 1);
  assert.equal(calls.filter(([type]) => type === "start").length, 2);
});

test("web merge sound quietly skips unsupported audio environments", () => {
  const sound = createWebMergeSound({ createAudioContext: () => null });

  assert.equal(sound.playMerge(), false);
});
