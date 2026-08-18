const DIFFICULTIES = {
  easy: { name: "简单", rows: 7, cols: 7, mines: 7 },
  normal: { name: "普通", rows: 9, cols: 9, mines: 10 },
  hard: { name: "困难", rows: 16, cols: 16, mines: 40 },
  extreme: { name: "极致", rows: 16, cols: 30, mines: 99 },
};

const HEX_DIFFICULTIES = {
  easy: { name: "简单", rows: 8, cols: 8, mines: 10 },
  normal: { name: "普通", rows: 11, cols: 11, mines: 18 },
  hard: { name: "困难", rows: 14, cols: 14, mines: 35 },
  extreme: { name: "极致", rows: 18, cols: 18, mines: 70 },
};

const RING_DIFFICULTIES = {
  easy: { name: "简单", rows: 6, cols: 24, mines: 14 },
  normal: { name: "普通", rows: 7, cols: 30, mines: 24 },
  hard: { name: "困难", rows: 8, cols: 36, mines: 38 },
  extreme: { name: "极致", rows: 9, cols: 42, mines: 56 },
};

const MODES = {
  classic: { label: "经典扫雷" },
  hex: { label: "Hex 扫雷" },
  ring: { label: "环形棋盘" },
};

const CUSTOM_DIFFICULTY_CONFIG = {
  classic: { rowLabel: "行", colLabel: "列", row: [5, 30], col: [5, 40], defaults: [9, 9, 10] },
  hex: { rowLabel: "行", colLabel: "列", row: [5, 22], col: [5, 22], defaults: [11, 11, 18] },
  ring: { rowLabel: "圈数", colLabel: "每圈格", row: [3, 10], col: [12, 48], defaults: [7, 30, 24] },
};

const BOARD_METRICS = {
  classic: { cellSize: 34, gap: 4 },
  hex: { cellW: 42, cellH: 48, xStep: 32, yStep: 36 },
  ring: { innerRadius: 72, radialStep: 26, ringGap: 3 },
};

const THEMES = {
  dark: {
    page: ["#101b2d", "#09111d"], panel: "rgba(14, 21, 36, 0.82)", panelBorder: "rgba(255,255,255,0.08)",
    text: "#e6edf7", muted: "#93a4bf", accent: "#6dd3ff", accent2: "#8bf5c9", danger: "#ff6b6b", win: "#f6d365",
    cellUp: "linear-gradient(180deg, #24344d 0%, #172336 100%)", cellDown: "linear-gradient(180deg, #111a27 0%, #0b121d 100%)",
    cellBorder: "rgba(255,255,255,0.14)", cellInset: "rgba(0,0,0,0.45)", controlBg: "#0f1725", controlText: "#e6edf7", controlBorder: "rgba(255,255,255,0.08)",
  },
  light: {
    page: ["#edf2f9", "#dfe8f4"], panel: "rgba(255,255,255,0.82)", panelBorder: "rgba(32,52,82,0.1)",
    text: "#18273a", muted: "#60718b", accent: "#3182f6", accent2: "#06b6d4", danger: "#d92d20", win: "#b7791f",
    cellUp: "linear-gradient(180deg, #ffffff 0%, #dce7f5 100%)", cellDown: "linear-gradient(180deg, #eef4fb 0%, #d8e3f0 100%)",
    cellBorder: "rgba(35,56,88,0.14)", cellInset: "rgba(80,104,138,0.18)", controlBg: "#ffffff", controlText: "#18273a", controlBorder: "rgba(35,56,88,0.12)",
  },
  pink: {
    page: ["#3a1830", "#25111e"], panel: "rgba(41,17,31,0.82)", panelBorder: "rgba(255,192,221,0.13)",
    text: "#fff0f8", muted: "#d7a9c0", accent: "#ff77b7", accent2: "#ffb3d9", danger: "#ff6b8b", win: "#ffd166",
    cellUp: "linear-gradient(180deg, #5b2748 0%, #34192a 100%)", cellDown: "linear-gradient(180deg, #2d1524 0%, #1d0f19 100%)",
    cellBorder: "rgba(255,209,230,0.16)", cellInset: "rgba(0,0,0,0.5)", controlBg: "#442035", controlText: "#fff0f8", controlBorder: "rgba(255,209,230,0.16)",
  },
  sky: {
    page: ["#0d2438", "#07131f"], panel: "rgba(10,25,41,0.82)", panelBorder: "rgba(160,224,255,0.12)",
    text: "#ebf8ff", muted: "#9cbdd4", accent: "#58c7ff", accent2: "#87f0ff", danger: "#ff7f7f", win: "#7be0ff",
    cellUp: "linear-gradient(180deg, #203d58 0%, #16293e 100%)", cellDown: "linear-gradient(180deg, #0e2134 0%, #091724 100%)",
    cellBorder: "rgba(180,229,255,0.16)", cellInset: "rgba(0,0,0,0.42)", controlBg: "#10263b", controlText: "#ebf8ff", controlBorder: "rgba(180,229,255,0.16)",
  },
};

const elements = {
  boardEl: document.getElementById("board"),
  resetButton: document.getElementById("resetButton"),
  difficultySelect: document.getElementById("difficultySelect"),
  modeSelect: document.getElementById("modeSelect"),
  customRows: document.getElementById("customRows"),
  customCols: document.getElementById("customCols"),
  customMines: document.getElementById("customMines"),
  customRowsLabel: document.getElementById("customRowsLabel"),
  customColsLabel: document.getElementById("customColsLabel"),
  customMinesLabel: document.getElementById("customMinesLabel"),
  applyCustomDifficultyButton: document.getElementById("applyCustomDifficultyButton"),
  themeSelect: document.getElementById("themeSelect"),
  bgUpload: document.getElementById("bgUpload"),
  bgOpacity: document.getElementById("bgOpacity"),
  clearBgButton: document.getElementById("clearBgButton"),
  mineCountEl: document.getElementById("mineCount"),
  mineMetaEl: document.getElementById("mineMeta"),
  timerEl: document.getElementById("timer"),
  statusTextEl: document.getElementById("statusText"),
  bestTimeEl: document.getElementById("bestTime"),
  pageBackdropEl: document.getElementById("pageBackdrop"),
};

const storage = {
  themeKey: localStorage.getItem("minesweeper-theme") || elements.themeSelect.value,
  backgroundUrl: localStorage.getItem("minesweeper-background") || "",
  backgroundOpacity: localStorage.getItem("minesweeper-background-opacity") || "0.45",
  modeKey: localStorage.getItem("minesweeper-mode") || elements.modeSelect.value,
  customRows: Number(localStorage.getItem("minesweeper-custom-rows") || 9),
  customCols: Number(localStorage.getItem("minesweeper-custom-cols") || 9),
  customMines: Number(localStorage.getItem("minesweeper-custom-mines") || 10),
};

let difficultyKey = elements.difficultySelect.value;
let modeKey = elements.modeSelect.value;
let state = null;
let timerId = null;
let timerStartAt = null;
let longPressTimer = null;
let activePointerId = null;

function saveThemeKey(themeKey) { localStorage.setItem("minesweeper-theme", themeKey); }
function saveBackgroundUrl(backgroundUrl) { try { if (backgroundUrl) localStorage.setItem("minesweeper-background", backgroundUrl); else localStorage.removeItem("minesweeper-background"); } catch {} }
function saveBackgroundOpacity(backgroundOpacity) { localStorage.setItem("minesweeper-background-opacity", backgroundOpacity); }
function saveModeKey(value) { localStorage.setItem("minesweeper-mode", value); }
function getDifficultyRecordKey() {
  const prefix = modeKey === "hex" ? "hex" : modeKey === "ring" ? "ring" : "classic";
  if (difficultyKey === "custom") return `minesweeper-best-${prefix}-custom-${storage.customRows}x${storage.customCols}-${storage.customMines}`;
  return `minesweeper-best-${prefix}-${difficultyKey}`;
}
function loadBestTime() {
  const value = Number(localStorage.getItem(getDifficultyRecordKey()));
  return Number.isFinite(value) && value > 0 ? value : null;
}
function saveBestTime(seconds) {
  localStorage.setItem(getDifficultyRecordKey(), seconds.toFixed(3));
}

function loadImageSource(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取失败"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function compressImageDataUrl(dataUrl) {
  const img = new Image();
  const ready = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error("无法解码")); });
  img.src = dataUrl; await ready;
  const maxSide = 1920; const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale)); const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const c = canvas.getContext("2d"); if (!c) throw new Error("no ctx");
  c.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function makeState() {
  const { rows, cols, mines } = getDifficultySpec();
  return { rows, cols, mines, started: false, ended: false, win: false, timer: 0, board: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, questioned: false, count: 0 }))) };
}
function isHexMode() { return modeKey === "hex"; }
function isRingMode() { return modeKey === "ring"; }
function getCustomDifficultyConfig() { return CUSTOM_DIFFICULTY_CONFIG[modeKey] || CUSTOM_DIFFICULTY_CONFIG.classic; }
function getCustomStorageKey(field) { return `minesweeper-custom-${modeKey}-${field}`; }
function readCustomStorageValue(field, fallback) {
  const modeValue = localStorage.getItem(getCustomStorageKey(field));
  const legacyValue = modeKey === "classic" ? localStorage.getItem(`minesweeper-custom-${field}`) : null;
  const value = modeValue ?? legacyValue;
  return value === null ? fallback : Number(value);
}
function getCustomFormValues() {
  const config = getCustomDifficultyConfig();
  const [defaultRows, defaultCols, defaultMines] = config.defaults;
  const rows = clampInt(Number(elements.customRows.value), config.row[0], config.row[1], defaultRows);
  const cols = clampInt(Number(elements.customCols.value), config.col[0], config.col[1], defaultCols);
  const maxMines = Math.max(1, rows * cols - 9);
  const mines = clampInt(Number(elements.customMines.value), 1, maxMines, Math.min(defaultMines, maxMines));
  return { rows, cols, mines, maxMines };
}
function syncCustomDifficultyForm() {
  const config = getCustomDifficultyConfig();
  const [defaultRows, defaultCols, defaultMines] = config.defaults;
  const rows = clampInt(readCustomStorageValue("rows", defaultRows), config.row[0], config.row[1], defaultRows);
  const cols = clampInt(readCustomStorageValue("cols", defaultCols), config.col[0], config.col[1], defaultCols);
  const maxMines = Math.max(1, rows * cols - 9);
  const mines = clampInt(readCustomStorageValue("mines", defaultMines), 1, maxMines, Math.min(defaultMines, maxMines));
  elements.customRowsLabel.textContent = config.rowLabel;
  elements.customColsLabel.textContent = config.colLabel;
  elements.customMinesLabel.textContent = "雷";
  elements.customRows.min = String(config.row[0]);
  elements.customRows.max = String(config.row[1]);
  elements.customCols.min = String(config.col[0]);
  elements.customCols.max = String(config.col[1]);
  elements.customMines.max = String(maxMines);
  elements.customRows.setAttribute("aria-label", `自定义${config.rowLabel}`);
  elements.customCols.setAttribute("aria-label", `自定义${config.colLabel}`);
  elements.customRows.value = String(rows);
  elements.customCols.value = String(cols);
  elements.customMines.value = String(mines);
  elements.applyCustomDifficultyButton.textContent = `应用${MODES[modeKey].label}自定义`;
  storage.customRows = rows;
  storage.customCols = cols;
  storage.customMines = mines;
}
function getDifficultySpec() {
  if (difficultyKey === "custom") {
    const { rows, cols, mines } = getCustomFormValues();
    return { rows, cols, mines };
  }
  if (isHexMode()) {
    return HEX_DIFFICULTIES[difficultyKey] || HEX_DIFFICULTIES.normal;
  }
  if (isRingMode()) {
    return RING_DIFFICULTIES[difficultyKey] || RING_DIFFICULTIES.normal;
  }
  return DIFFICULTIES[difficultyKey];
}
function getDifficultyCatalog() {
  if (isHexMode()) return HEX_DIFFICULTIES;
  if (isRingMode()) return RING_DIFFICULTIES;
  return DIFFICULTIES;
}
function formatDifficultyLabel(spec) {
  if (isRingMode()) return `${spec.name} ${spec.rows}圈 × ${spec.cols}格 · ${spec.mines}雷`;
  return `${spec.name} ${spec.rows}×${spec.cols} · ${spec.mines}雷`;
}
function refreshDifficultyOptions() {
  const catalog = getDifficultyCatalog();
  elements.difficultySelect.replaceChildren();
  for (const key of ["easy", "normal", "hard", "extreme"]) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = formatDifficultyLabel(catalog[key]);
    elements.difficultySelect.appendChild(option);
  }
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "自定义";
  elements.difficultySelect.appendChild(customOption);
  elements.difficultySelect.value = difficultyKey;
}
function getModeMetrics() {
  return isHexMode() ? BOARD_METRICS.hex : BOARD_METRICS.classic;
}
function clampInt(value, min, max, fallback) {
  const n = Number.isFinite(value) ? Math.floor(value) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function inBounds(r, c) { return r >= 0 && r < state.rows && c >= 0 && c < state.cols; }
function qoffsetToCube(col, row) {
  const q = col;
  const r = row - Math.floor((col - (col & 1)) / 2);
  const s = -q - r;
  return { q, r, s };
}
function cubeToQoffset(q, r, s) {
  const col = q;
  const row = r + Math.floor((q - (q & 1)) / 2);
  return [row, col];
}
function hexDirections() {
  return [
    { q: 1, r: -1, s: 0 },
    { q: 1, r: 0, s: -1 },
    { q: 0, r: 1, s: -1 },
    { q: -1, r: 1, s: 0 },
    { q: -1, r: 0, s: 1 },
    { q: 0, r: -1, s: 1 },
  ];
}
function sectorClipPath(outerRatio, innerRatio, angleStart, angleEnd, steps = 4) {
  const points = [];
  const cx = 50;
  const cy = 50;
  const scale = 50;
  const addArc = (radius, from, to) => {
    const span = to - from;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = from + span * t;
      points.push([cx + Math.cos(a) * scale * radius, cy + Math.sin(a) * scale * radius]);
    }
  };
  addArc(outerRatio, angleStart, angleEnd);
  // The inner arc must travel back from the end angle to the start angle.
  // Reversing the interpolation here made the polygon self-intersect.
  addArc(innerRatio, angleEnd, angleStart);
  return `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ")})`;
}
function neighbors(r, c) {
  const out = [];
  if (!isHexMode()) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      let nr = r + dr;
      let nc = c + dc;
      if (isRingMode()) {
        if (nr < 0 || nr >= state.rows) continue;
        nc = (nc + state.cols) % state.cols;
        if (nr === r && nc === c) continue;
        out.push([nr, nc]);
        continue;
      }
      if (inBounds(nr, nc)) out.push([nr, nc]);
    }
    return out;
  }
  const cube = qoffsetToCube(c, r);
  for (const dir of hexDirections()) {
    const nq = cube.q + dir.q;
    const nr = cube.r + dir.r;
    const ns = cube.s + dir.s;
    const [row, col] = cubeToQoffset(nq, nr, ns);
    if (inBounds(row, col)) out.push([row, col]);
  }
  return out;
}
function layMines(safeRow, safeCol) {
  const forbidden = new Set([`${safeRow},${safeCol}`]); for (const [r, c] of neighbors(safeRow, safeCol)) forbidden.add(`${r},${c}`);
  const spots = []; for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) if (!forbidden.has(`${r},${c}`)) spots.push([r, c]);
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  for (let i = 0; i < state.mines; i++) { const [r, c] = spots[i]; state.board[r][c].mine = true; }
  for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) state.board[r][c].count = neighbors(r, c).reduce((sum, [nr, nc]) => sum + (state.board[nr][nc].mine ? 1 : 0), 0);
}
function floodReveal(row, col) { const q = [[row, col]]; while (q.length) { const [r, c] = q.shift(); const cell = state.board[r][c]; if (cell.revealed || cell.flagged) continue; cell.revealed = true; if (cell.count !== 0 || cell.mine) continue; for (const [nr, nc] of neighbors(r, c)) { const next = state.board[nr][nc]; if (!next.revealed && !next.flagged && !next.mine) q.push([nr, nc]); } } }
function revealAllMines(exploded) { for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) { const cell = state.board[r][c]; if (cell.mine) cell.revealed = true; if (exploded && exploded[0] === r && exploded[1] === c) cell.exploded = true; } }
function checkWin() { if (state.board.flat().every((cell) => cell.mine || cell.revealed)) { state.ended = true; state.win = true; stopTimer(); for (const row of state.board) for (const cell of row) if (cell.mine) cell.flagged = true; return true; } return false; }
function startTimer(onTick) {
  if (timerId) return;
  timerStartAt = performance.now();
  timerId = setInterval(() => {
    if (state.started && !state.ended && timerStartAt !== null) {
      state.timer = (performance.now() - timerStartAt) / 1000;
      onTick();
    }
  }, 100);
}
function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  timerStartAt = null;
}
function reveal(row, col, onTick) {
  if (state.ended) return;
  if (!state.started) { state.started = true; layMines(row, col); startTimer(onTick); }
  const cell = state.board[row][col];
  if (cell.revealed || cell.flagged) return;
  if (cell.mine) { cell.revealed = true; state.ended = true; stopTimer(); revealAllMines([row, col]); return "lose"; }
  floodReveal(row, col); if (checkWin()) return "win"; return "continue";
}
function chord(row, col, onTick) {
  if (state.ended) return;
  const cell = state.board[row][col]; if (!cell.revealed || !cell.count) return;
  const flagged = neighbors(row, col).reduce((sum, [nr, nc]) => sum + (state.board[nr][nc].flagged ? 1 : 0), 0);
  if (flagged !== cell.count) return;
  for (const [nr, nc] of neighbors(row, col)) { const next = state.board[nr][nc]; if (!next.revealed && !next.flagged) { const result = reveal(nr, nc, onTick); if (result === "lose") return "lose"; } }
  if (checkWin()) return "win"; return "continue";
}
function cycleMark(row, col) { if (state.ended) return; const cell = state.board[row][col]; if (cell.revealed) return; if (!cell.flagged && !cell.questioned) cell.flagged = true; else if (cell.flagged) { cell.flagged = false; cell.questioned = true; } else cell.questioned = false; }
function renderHud() {
  const flagged = state.board.flat().filter((c) => c.flagged).length;
  const remaining = Math.max(0, state.mines - flagged);
  elements.mineCountEl.textContent = String(remaining);
  if (elements.mineMetaEl) {
    elements.mineMetaEl.textContent = `已标记 ${flagged} / 总雷数 ${state.mines}`;
  }
  elements.timerEl.textContent = state.started ? state.timer.toFixed(3) : "0.000";
}
function renderBestTime() {
  const best = loadBestTime();
  elements.bestTimeEl.textContent = best === null ? "--" : best.toFixed(3);
}
function cellText(cell) { if (!cell.revealed) return cell.flagged ? "🚩" : cell.questioned ? "❓" : ""; if (cell.mine) return "💣"; return cell.count ? String(cell.count) : ""; }
function render() {
  elements.boardEl.innerHTML = "";
  elements.boardEl.classList.toggle("hex-mode", isHexMode());
  elements.boardEl.classList.toggle("ring-mode", isRingMode());
  if (isRingMode()) {
    const { innerRadius, radialStep, ringGap } = BOARD_METRICS.ring;
    const outerRadius = innerRadius + (state.rows - 1) * radialStep;
    const size = outerRadius * 2 + radialStep * 2 + ringGap * 2 + 18;
    elements.boardEl.style.gridTemplateColumns = "none";
    elements.boardEl.style.width = `${size}px`;
    elements.boardEl.style.height = `${size}px`;
    elements.boardEl.style.position = "relative";
  } else if (isHexMode()) {
    const { cellW, cellH, xStep, yStep } = getModeMetrics();
    elements.boardEl.style.gridTemplateColumns = "none";
    elements.boardEl.style.width = `${(state.cols - 1) * xStep + cellW}px`;
    elements.boardEl.style.height = `${(state.rows - 1) * yStep + cellH + yStep / 2}px`;
    elements.boardEl.style.position = "relative";
  } else {
    elements.boardEl.style.gridTemplateColumns = `repeat(${state.cols}, ${BOARD_METRICS.classic.cellSize}px)`;
    elements.boardEl.style.width = "";
    elements.boardEl.style.height = "";
    elements.boardEl.style.position = "";
  }
  for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) {
    const cell = state.board[r][c]; const btn = document.createElement("button"); btn.type = "button"; btn.className = "cell";
    const label = document.createElement("span"); label.className = "cell-label"; label.textContent = cellText(cell); btn.append(label);
    if (cell.revealed) btn.classList.add("revealed"); if (cell.flagged) btn.classList.add("flagged"); if (cell.questioned) btn.classList.add("questioned"); if (cell.mine && cell.revealed) btn.classList.add("mine"); if (cell.exploded) btn.classList.add("exploded"); if (cell.revealed && cell.count > 0) btn.classList.add(`num-${cell.count}`);
    if (isHexMode()) {
      const { cellW, cellH, xStep, yStep } = getModeMetrics();
      btn.classList.add("hex-cell");
      btn.style.position = "absolute";
      btn.style.left = `${c * xStep}px`;
      btn.style.top = `${r * yStep + (c % 2 ? yStep / 2 : 0)}px`;
      btn.style.width = `${cellW}px`;
      btn.style.height = `${cellH}px`;
    } else if (isRingMode()) {
      const { innerRadius, radialStep, ringGap } = BOARD_METRICS.ring;
      const boardRadius = innerRadius + state.rows * radialStep + ringGap;
      const boardCenter = boardRadius + 9;
      const bandStart = innerRadius + r * radialStep;
      const bandEnd = bandStart + radialStep;
      const radialPad = Math.min(4, radialStep * 0.14);
      const angleStep = (Math.PI * 2) / state.cols;
      const anglePad = angleStep * 0.14;
      const angleStart = ((c / state.cols) * Math.PI * 2) - Math.PI / 2 + anglePad;
      const angleEnd = (((c + 1) / state.cols) * Math.PI * 2) - Math.PI / 2 - anglePad;
      const angleMiddle = (angleStart + angleEnd) / 2;
      const labelRadius = (bandStart + bandEnd) / 2;
      const x = boardCenter - bandEnd;
      const y = boardCenter - bandEnd;
      const boxSize = bandEnd * 2;
      btn.classList.add("ring-cell");
      btn.style.position = "absolute";
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
      btn.style.width = `${boxSize}px`;
      btn.style.height = `${boxSize}px`;
      btn.style.borderRadius = "0";
      btn.style.clipPath = sectorClipPath((bandEnd - radialPad) / bandEnd, Math.max(0.12, (bandStart + radialPad) / bandEnd), angleStart, angleEnd);
      label.style.left = `${boxSize / 2 + Math.cos(angleMiddle) * labelRadius}px`;
      label.style.top = `${boxSize / 2 + Math.sin(angleMiddle) * labelRadius}px`;
    }
    btn.addEventListener("click", () => {
      const result = cell.revealed ? chord(r, c, renderHud) : reveal(r, c, renderHud);
      syncGame(result);
    });
    btn.addEventListener("contextmenu", (e) => { e.preventDefault(); cycleMark(r, c); syncGame("continue"); });
    btn.addEventListener("pointerdown", (e) => { if (state.ended || e.pointerType === "mouse") return; activePointerId = e.pointerId; longPressTimer = setTimeout(() => { cycleMark(r, c); longPressTimer = null; syncGame("continue"); }, 450); });
    btn.addEventListener("pointerup", (e) => { if (activePointerId !== e.pointerId) return; activePointerId = null; if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
    btn.addEventListener("pointerleave", () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
    btn.addEventListener("pointercancel", () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
    elements.boardEl.appendChild(btn);
  }
  renderHud();
}
function setStatus(text) { elements.statusTextEl.textContent = text; }
function setResetEmoji(text) { elements.resetButton.textContent = text; }
function applyTheme(themeKey) {
  const theme = THEMES[themeKey];
  document.documentElement.dataset.theme = themeKey;
  document.documentElement.style.setProperty("--bg0", theme.page[1]);
  document.documentElement.style.setProperty("--bg1", theme.page[0]);
  document.documentElement.style.setProperty("--panel", theme.panel);
  document.documentElement.style.setProperty("--panel-border", theme.panelBorder);
  document.documentElement.style.setProperty("--text", theme.text);
  document.documentElement.style.setProperty("--muted", theme.muted);
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--accent2", theme.accent2);
  document.documentElement.style.setProperty("--danger", theme.danger);
  document.documentElement.style.setProperty("--win", theme.win);
  document.documentElement.style.setProperty("--cell-up", theme.cellUp);
  document.documentElement.style.setProperty("--cell-down", theme.cellDown);
  document.documentElement.style.setProperty("--cell-border", theme.cellBorder);
  document.documentElement.style.setProperty("--cell-inset", theme.cellInset);
  document.documentElement.style.setProperty("--control-bg", theme.controlBg);
  document.documentElement.style.setProperty("--control-text", theme.controlText);
  document.documentElement.style.setProperty("--control-border", theme.controlBorder);
}
function applyBackground(url) { elements.pageBackdropEl.style.backgroundImage = url ? `url("${url}")` : "none"; elements.pageBackdropEl.style.backgroundSize = "cover"; elements.pageBackdropEl.style.backgroundPosition = "center"; elements.pageBackdropEl.style.backgroundRepeat = "no-repeat"; }
function applyBackgroundOpacity(value) { document.documentElement.style.setProperty("--bg-opacity", value); }
function setDifficulty(value) { elements.difficultySelect.value = value; difficultyKey = value; }
function setMode(value) { elements.modeSelect.value = value; modeKey = value; }
function bindHandlers() {
  elements.resetButton.addEventListener("click", resetGame);
  elements.boardEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
  elements.difficultySelect.addEventListener("change", (e) => {
    setDifficulty(e.target.value);
    renderBestTime();
    resetGame();
  });
  elements.modeSelect.addEventListener("change", (e) => {
    setMode(e.target.value);
    storage.modeKey = modeKey;
    saveModeKey(modeKey);
    syncCustomDifficultyForm();
    refreshDifficultyOptions();
    renderBestTime();
    resetGame();
  });
  elements.applyCustomDifficultyButton.addEventListener("click", () => {
    const { rows, cols, mines } = getCustomFormValues();
    elements.customRows.value = String(rows);
    elements.customCols.value = String(cols);
    elements.customMines.value = String(mines);
    storage.customRows = rows;
    storage.customCols = cols;
    storage.customMines = mines;
    localStorage.setItem(getCustomStorageKey("rows"), String(rows));
    localStorage.setItem(getCustomStorageKey("cols"), String(cols));
    localStorage.setItem(getCustomStorageKey("mines"), String(mines));
    setDifficulty("custom");
    renderBestTime();
    resetGame();
  });
  elements.themeSelect.addEventListener("change", (e) => { storage.themeKey = e.target.value; saveThemeKey(e.target.value); applyTheme(e.target.value); });
  elements.bgUpload.addEventListener("change", async () => { const file = elements.bgUpload.files && elements.bgUpload.files[0]; if (!file || !file.type.startsWith("image/")) return; const raw = await loadImageSource(file); const url = await compressImageDataUrl(raw); storage.backgroundUrl = url; saveBackgroundUrl(url); applyBackground(url); });
  elements.clearBgButton.addEventListener("click", () => { elements.bgUpload.value = ""; storage.backgroundUrl = ""; saveBackgroundUrl(""); applyBackground(""); });
  elements.bgOpacity.addEventListener("input", (e) => { storage.backgroundOpacity = e.target.value; saveBackgroundOpacity(e.target.value); applyBackgroundOpacity(e.target.value); });
  window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r") resetGame(); });
}
function resetTransientInputState() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } activePointerId = null; }
function syncGame(status) {
  if (status === "win") {
    const currentBest = loadBestTime();
    if (currentBest === null || state.timer < currentBest) saveBestTime(state.timer);
    renderBestTime();
    setResetEmoji("😎");
    setStatus("胜利");
  } else if (status === "lose") {
    setResetEmoji("😵");
    setStatus("失败");
  } else if (!state.started) {
    setResetEmoji("😊");
    setStatus("待开始");
  } else {
    setResetEmoji("😊");
    setStatus("进行中");
  }
  render();
}
function resetGame() { stopTimer(); resetTransientInputState(); state = makeState(); setResetEmoji("😊"); setStatus("待开始"); render(); }

function init() {
  setDifficulty(difficultyKey);
  applyTheme(storage.themeKey);
  applyBackground(storage.backgroundUrl);
  applyBackgroundOpacity(storage.backgroundOpacity);
  elements.bgOpacity.value = storage.backgroundOpacity;
  elements.themeSelect.value = storage.themeKey;
  elements.difficultySelect.value = difficultyKey;
  elements.modeSelect.value = storage.modeKey;
  setMode(storage.modeKey);
  syncCustomDifficultyForm();
  refreshDifficultyOptions();
  bindHandlers();
  resetGame();
  renderBestTime();
}

init();
