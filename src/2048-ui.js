import { create2048Game } from "./core/games/2048/engine.js";
import { createWebStorage } from "./platform/web/storage.js";

const KEY_TO_DIRECTION_2048 = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
};

const STATUS_LABEL_2048 = {
  playing: "进行中",
  won: "已达成",
  over: "已结束",
};

const MOVE_ANIMATION_MS_2048 = 180;

function readBestScore2048(storage) {
  try {
    const score = Number(storage?.getItem("2048-best-score"));
    return Number.isFinite(score) && score > 0 ? score : 0;
  } catch (_error) {
    return 0;
  }
}

function saveBestScore2048(storage, score) {
  try {
    storage?.setItem("2048-best-score", String(score));
  } catch (_error) {
    // Persistence is best-effort; private browsing may disable localStorage.
  }
}

function getCellLabel2048(value, index) {
  const row = Math.floor(index / 4) + 1;
  const column = (index % 4) + 1;
  return value ? `第${row}行第${column}列，${value}` : `第${row}行第${column}列，空`;
}

function setStyleProperty2048(element, property, value) {
  if (element.style?.setProperty) {
    element.style.setProperty(property, value);
  } else if (element.style) {
    element.style[property] = value;
  }
}

function setTileGridPosition2048(tile, index) {
  if (!tile.style) return;
  const column = (index % 4) + 1;
  const row = Math.floor(index / 4) + 1;
  tile.style.gridColumnStart = String(column);
  tile.style.gridRowStart = String(row);
}

function getGapExpression2048(delta) {
  if (delta === 0) return "0px";
  const percentage = `${delta * 100}%`;
  const gapTerms = Array.from({ length: Math.abs(delta) }, () => "var(--game2048-gap)");
  const operator = delta > 0 ? " + " : " - ";
  return `calc(${percentage}${operator}${gapTerms.join(operator)})`;
}

function setTileMovement2048(tile, from, to) {
  const fromColumn = from % 4;
  const fromRow = Math.floor(from / 4);
  const toColumn = to % 4;
  const toRow = Math.floor(to / 4);
  setStyleProperty2048(tile, "--game2048-move-x", getGapExpression2048(toColumn - fromColumn));
  setStyleProperty2048(tile, "--game2048-move-y", getGapExpression2048(toRow - fromRow));
}

export function create2048UI(elements, options = {}) {
  const game = options.game || create2048Game();
  const storage = options.storage || createWebStorage();
  const isActive = options.isActive || (() => true);
  let bestScore = readBestScore2048(storage);
  let touchStart = null;
  let tileLayer = null;
  let animationFrameId = null;
  let animationFrameKind = null;
  let animationTimer = null;
  let animationToken = 0;
  let isAnimating = false;

  function updateBestScore(state) {
    if (state.score <= bestScore) return;
    bestScore = state.score;
    saveBestScore2048(storage, bestScore);
  }

  function ensureTileLayer() {
    if (tileLayer) return tileLayer;
    tileLayer = document.createElement("div");
    tileLayer.className = "game2048-tiles";
    tileLayer.setAttribute("aria-hidden", "true");
    elements.board.appendChild(tileLayer);
    return tileLayer;
  }

  function createTile(value, index, extraClass = "") {
    const tile = document.createElement("span");
    tile.className = `game2048-tile${extraClass ? ` ${extraClass}` : ""}`;
    tile.dataset.value = String(value);
    tile.textContent = String(value);
    tile.setAttribute("aria-hidden", "true");
    setTileGridPosition2048(tile, index);
    return tile;
  }

  function renderGrid(state) {
    const nextChildren = [];
    state.board.forEach((value, index) => {
      const cell = document.createElement("div");
      cell.className = "game2048-cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", getCellLabel2048(value, index));
      nextChildren.push(cell);
    });

    elements.board.replaceChildren();
    nextChildren.forEach((cell) => elements.board.appendChild(cell));
    ensureTileLayer();
    elements.board.appendChild(tileLayer);
  }

  function renderTiles(state, effects = {}) {
    const mergedIndexes = effects.mergedIndexes || new Set();
    const spawnedIndex = effects.spawnedIndex ?? -1;
    tileLayer.replaceChildren();
    state.board.forEach((value, index) => {
      if (!value) return;
      const classes = [
        mergedIndexes.has(index) ? "is-merged" : "",
        spawnedIndex === index ? "is-spawned" : "",
      ].filter(Boolean).join(" ");
      tileLayer.appendChild(createTile(value, index, classes));
    });
  }

  function renderStaticBoard(state, effects = {}) {
    renderGrid(state);
    renderTiles(state, effects);
  }

  function renderOverlay(state, hidden = false) {
    const ended = state.status === "won" || state.status === "over";
    elements.overlay.hidden = hidden || !ended;
    elements.continueButton.hidden = state.status !== "won";
    elements.overlayTitle.textContent = state.status === "won" ? "你得到 2048 了！" : "棋盘已满";
    elements.overlayText.textContent = state.status === "won"
      ? "继续合并，挑战更高分。"
      : "这局结束了，重新开始再试一次。";
  }

  function renderHud(state) {
    updateBestScore(state);
    elements.score.textContent = String(state.score);
    elements.best.textContent = String(bestScore);
    elements.status.textContent = STATUS_LABEL_2048[state.status] || STATUS_LABEL_2048.playing;
    elements.root.classList.toggle("is-won", state.status === "won");
    elements.root.classList.toggle("is-over", state.status === "over");
  }

  function cancelAnimation() {
    animationToken += 1;
    if (animationFrameId !== null) {
      if (animationFrameKind === "raf" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(animationFrameId);
      } else {
        clearTimeout(animationFrameId);
      }
    }
    if (animationTimer !== null) clearTimeout(animationTimer);
    animationFrameId = null;
    animationFrameKind = null;
    animationTimer = null;
    isAnimating = false;
    elements.root.classList.toggle("is-animating", false);
    elements.board.setAttribute("aria-busy", "false");
  }

  function scheduleFrame(callback) {
    if (typeof window.requestAnimationFrame === "function") {
      animationFrameKind = "raf";
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        animationFrameKind = null;
        callback();
      });
      return;
    }
    animationFrameKind = "timeout";
    animationFrameId = setTimeout(() => {
      animationFrameId = null;
      animationFrameKind = null;
      callback();
    }, 0);
  }

  function shouldAnimate() {
    if (options.reducedMotion === true) return false;
    return !(typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function finishMoveAnimation(state, token) {
    if (token !== animationToken) return;
    animationTimer = null;
    isAnimating = false;
    elements.root.classList.toggle("is-animating", false);
    elements.board.setAttribute("aria-busy", "false");
    const transitions = state.lastMove?.transitions || [];
    const mergedIndexes = new Set(
      transitions.filter((transition) => transition.merged).map((transition) => transition.to),
    );
    renderStaticBoard(state, {
      mergedIndexes,
      spawnedIndex: state.lastMove?.spawned?.index,
    });
    renderOverlay(state);
  }

  function animateMove(state) {
    const transitions = state.lastMove?.transitions || [];
    if (!transitions.length || !shouldAnimate()) {
      renderStaticBoard(state, {
        spawnedIndex: shouldAnimate() ? state.lastMove?.spawned?.index : -1,
      });
      renderOverlay(state);
      return;
    }

    renderGrid(state);
    tileLayer.replaceChildren();
    isAnimating = true;
    const token = animationToken;
    elements.root.classList.toggle("is-animating", true);
    elements.board.setAttribute("aria-busy", "true");

    transitions.forEach((transition) => {
      const tile = createTile(transition.value, transition.from, "is-motion-tile");
      tileLayer.appendChild(tile);
      setTileMovement2048(tile, transition.from, transition.to);
    });

    scheduleFrame(() => {
      if (token !== animationToken) return;
      Array.from(tileLayer.children).forEach((tile) => tile.classList.add("is-moving"));
      animationTimer = setTimeout(() => finishMoveAnimation(state, token), MOVE_ANIMATION_MS_2048);
    });
  }

  function render() {
    cancelAnimation();
    const state = game.getState();
    renderHud(state);
    renderStaticBoard(state);
    renderOverlay(state);
  }

  function move(direction) {
    if (isAnimating) return game.getState();
    const state = game.move(direction);
    renderHud(state);
    if (state.lastMove) {
      renderOverlay(state, true);
      animateMove(state);
    } else {
      renderStaticBoard(state);
      renderOverlay(state);
    }
    return state;
  }

  function reset() {
    cancelAnimation();
    const state = game.reset();
    renderHud(state);
    renderStaticBoard(state);
    renderOverlay(state);
  }

  function continueAfterWin() {
    cancelAnimation();
    const state = game.continueAfterWin();
    renderHud(state);
    renderStaticBoard(state);
    renderOverlay(state);
  }

  function handleKeydown(event) {
    if (!isActive()) return;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = KEY_TO_DIRECTION_2048[event.key];
    if (direction) {
      event.preventDefault();
      move(direction);
      return;
    }
    if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      reset();
    }
  }

  function handleTouchStart(event) {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchStart = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event) {
    if (!touchStart) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
    move(direction);
  }

  const directionButtons = [
    ["up", elements.upButton],
    ["down", elements.downButton],
    ["left", elements.leftButton],
    ["right", elements.rightButton],
  ];

  window.addEventListener("keydown", handleKeydown);
  elements.board.addEventListener("touchstart", handleTouchStart, { passive: true });
  elements.board.addEventListener("touchend", handleTouchEnd, { passive: true });
  elements.newButton.addEventListener("click", reset);
  elements.overlayNewButton.addEventListener("click", reset);
  elements.continueButton.addEventListener("click", continueAfterWin);
  directionButtons.forEach(([direction, button]) => {
    button?.addEventListener("click", () => move(direction));
  });
  render();

  return {
    getState: () => game.getState(),
    move,
    reset,
    render,
  };
}
