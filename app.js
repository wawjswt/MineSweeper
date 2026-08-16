const DIFFICULTIES = {
  easy: { name: "简单", rows: 7, cols: 7, mines: 7 },
  normal: { name: "普通", rows: 9, cols: 9, mines: 10 },
  hard: { name: "困难", rows: 16, cols: 16, mines: 40 },
  extreme: { name: "极致", rows: 16, cols: 30, mines: 99 },
};

const boardEl = document.getElementById("board");
const resetButton = document.getElementById("resetButton");
const difficultySelect = document.getElementById("difficultySelect");
const themeSelect = document.getElementById("themeSelect");
const bgUpload = document.getElementById("bgUpload");
const bgOpacity = document.getElementById("bgOpacity");
const clearBgButton = document.getElementById("clearBgButton");
const mineCountEl = document.getElementById("mineCount");
const timerEl = document.getElementById("timer");
const statusTextEl = document.getElementById("statusText");
const pageBackdropEl = document.getElementById("pageBackdrop");

let difficultyKey = difficultySelect.value;
let state = null;
let timerId = null;
let longPressTimer = null;
let activePointerId = null;
let themeKey = localStorage.getItem("minesweeper-theme") || themeSelect.value;
let backgroundUrl = localStorage.getItem("minesweeper-background") || "";
let backgroundOpacity = localStorage.getItem("minesweeper-background-opacity") || "0.45";

const THEMES = {
  dark: {
    page: ["#101b2d", "#09111d"],
    panel: "rgba(14, 21, 36, 0.82)",
    panelBorder: "rgba(255,255,255,0.08)",
    text: "#e6edf7",
    muted: "#93a4bf",
    accent: "#6dd3ff",
    accent2: "#8bf5c9",
    danger: "#ff6b6b",
    win: "#f6d365",
    cellUp: "linear-gradient(180deg, #24344d 0%, #172336 100%)",
    cellDown: "linear-gradient(180deg, #111a27 0%, #0b121d 100%)",
    cellBorder: "rgba(255,255,255,0.14)",
    cellInset: "rgba(0,0,0,0.45)",
    controlBg: "#0f1725",
    controlText: "#e6edf7",
    controlBorder: "rgba(255,255,255,0.08)",
  },
  light: {
    page: ["#edf2f9", "#dfe8f4"],
    panel: "rgba(255,255,255,0.82)",
    panelBorder: "rgba(32,52,82,0.1)",
    text: "#18273a",
    muted: "#60718b",
    accent: "#3182f6",
    accent2: "#06b6d4",
    danger: "#d92d20",
    win: "#b7791f",
    cellUp: "linear-gradient(180deg, #ffffff 0%, #dce7f5 100%)",
    cellDown: "linear-gradient(180deg, #eef4fb 0%, #d8e3f0 100%)",
    cellBorder: "rgba(35,56,88,0.14)",
    cellInset: "rgba(80,104,138,0.18)",
    controlBg: "#ffffff",
    controlText: "#18273a",
    controlBorder: "rgba(35,56,88,0.12)",
  },
  pink: {
    page: ["#3a1830", "#25111e"],
    panel: "rgba(41,17,31,0.82)",
    panelBorder: "rgba(255,192,221,0.13)",
    text: "#fff0f8",
    muted: "#d7a9c0",
    accent: "#ff77b7",
    accent2: "#ffb3d9",
    danger: "#ff6b8b",
    win: "#ffd166",
    cellUp: "linear-gradient(180deg, #5b2748 0%, #34192a 100%)",
    cellDown: "linear-gradient(180deg, #2d1524 0%, #1d0f19 100%)",
    cellBorder: "rgba(255,209,230,0.16)",
    cellInset: "rgba(0,0,0,0.5)",
    controlBg: "#442035",
    controlText: "#fff0f8",
    controlBorder: "rgba(255,209,230,0.16)",
  },
  sky: {
    page: ["#0d2438", "#07131f"],
    panel: "rgba(10,25,41,0.82)",
    panelBorder: "rgba(160,224,255,0.12)",
    text: "#ebf8ff",
    muted: "#9cbdd4",
    accent: "#58c7ff",
    accent2: "#87f0ff",
    danger: "#ff7f7f",
    win: "#7be0ff",
    cellUp: "linear-gradient(180deg, #203d58 0%, #16293e 100%)",
    cellDown: "linear-gradient(180deg, #0e2134 0%, #091724 100%)",
    cellBorder: "rgba(180,229,255,0.16)",
    cellInset: "rgba(0,0,0,0.42)",
    controlBg: "#10263b",
    controlText: "#ebf8ff",
    controlBorder: "rgba(180,229,255,0.16)",
  },
};

function makeState() {
  const { rows, cols, mines } = DIFFICULTIES[difficultyKey];
  return {
    rows,
    cols,
    mines,
    started: false,
    ended: false,
    win: false,
    timer: 0,
    board: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, questioned: false, count: 0 })),
    ),
  };
}

function inBounds(r, c) { return r >= 0 && r < state.rows && c >= 0 && c < state.cols; }
function neighbors(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc)) out.push([nr, nc]);
  }
  return out;
}

function layMines(safeRow, safeCol) {
  const forbidden = new Set([`${safeRow},${safeCol}`]);
  for (const [r, c] of neighbors(safeRow, safeCol)) forbidden.add(`${r},${c}`);
  const spots = [];
  for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) if (!forbidden.has(`${r},${c}`)) spots.push([r, c]);
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  for (let i = 0; i < state.mines; i++) {
    const [r, c] = spots[i];
    state.board[r][c].mine = true;
  }
  for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) {
    state.board[r][c].count = neighbors(r, c).reduce((sum, [nr, nc]) => sum + (state.board[nr][nc].mine ? 1 : 0), 0);
  }
}

function startTimer() { if (!timerId) timerId = setInterval(() => { if (state.started && !state.ended) { state.timer = Math.min(999, state.timer + 1); renderHud(); } }, 1000); }
function stopTimer() { clearInterval(timerId); timerId = null; }

function floodReveal(row, col) {
  const q = [[row, col]];
  while (q.length) {
    const [r, c] = q.shift();
    const cell = state.board[r][c];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.count !== 0 || cell.mine) continue;
    for (const [nr, nc] of neighbors(r, c)) {
      const next = state.board[nr][nc];
      if (!next.revealed && !next.flagged && !next.mine) q.push([nr, nc]);
    }
  }
}

function revealAllMines(exploded) {
  for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) {
    const cell = state.board[r][c];
    if (cell.mine) cell.revealed = true;
    if (exploded && exploded[0] === r && exploded[1] === c) cell.exploded = true;
  }
}

function renderHud() {
  mineCountEl.textContent = String(state.mines - state.board.flat().filter((c) => c.flagged).length);
  timerEl.textContent = String(state.timer).padStart(1, "0");
}

function cellText(cell) {
  if (!cell.revealed) return cell.flagged ? "🚩" : cell.questioned ? "❓" : "";
  if (cell.mine) return "💣";
  return cell.count ? String(cell.count) : "";
}

function render() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 34px)`;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.board[r][c];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.dataset.row = String(r);
      btn.dataset.col = String(c);
      btn.textContent = cellText(cell);
      if (cell.revealed) btn.classList.add("revealed");
      if (cell.flagged) btn.classList.add("flagged");
      if (cell.questioned) btn.classList.add("questioned");
      if (cell.mine && cell.revealed) btn.classList.add("mine");
      if (cell.exploded) btn.classList.add("exploded");
      if (cell.revealed && cell.count > 0) btn.classList.add(`num-${cell.count}`);
      btn.addEventListener("click", () => cell.revealed ? chord(r, c) : reveal(r, c));
      btn.addEventListener("contextmenu", (e) => { e.preventDefault(); cycleMark(r, c); });
      btn.addEventListener("pointerdown", (e) => {
        if (state.ended || e.pointerType === "mouse") return;
        activePointerId = e.pointerId;
        longPressTimer = setTimeout(() => { cycleMark(r, c); longPressTimer = null; }, 450);
      });
      btn.addEventListener("pointerup", (e) => {
        if (activePointerId !== e.pointerId) return;
        activePointerId = null;
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });
      btn.addEventListener("pointerleave", () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
      btn.addEventListener("pointercancel", () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
      boardEl.appendChild(btn);
    }
  }
  renderHud();
}

function finishWin() {
  state.ended = true;
  state.win = true;
  stopTimer();
  for (const row of state.board) for (const cell of row) if (cell.mine) cell.flagged = true;
  resetButton.textContent = "😎";
  statusTextEl.textContent = "胜利";
  render();
}

function checkWin() { if (state.board.flat().every((cell) => cell.mine || cell.revealed)) finishWin(); }

function reveal(row, col) {
  if (state.ended) return;
  if (!state.started) { state.started = true; statusTextEl.textContent = "进行中"; layMines(row, col); startTimer(); }
  const cell = state.board[row][col];
  if (cell.revealed || cell.flagged) return;
  if (cell.mine) {
    cell.revealed = true;
    state.ended = true;
    stopTimer();
    revealAllMines([row, col]);
    resetButton.textContent = "😵";
    statusTextEl.textContent = "失败";
    render();
    return;
  }
  floodReveal(row, col);
  checkWin();
  render();
}

function chord(row, col) {
  if (state.ended) return;
  const cell = state.board[row][col];
  if (!cell.revealed || !cell.count) return;
  const flagged = neighbors(row, col).reduce((sum, [nr, nc]) => sum + (state.board[nr][nc].flagged ? 1 : 0), 0);
  if (flagged !== cell.count) return;
  for (const [nr, nc] of neighbors(row, col)) {
    const next = state.board[nr][nc];
    if (!next.revealed && !next.flagged) reveal(nr, nc);
  }
}

function cycleMark(row, col) {
  if (state.ended) return;
  const cell = state.board[row][col];
  if (cell.revealed) return;
  if (!cell.flagged && !cell.questioned) cell.flagged = true;
  else if (cell.flagged) { cell.flagged = false; cell.questioned = true; }
  else cell.questioned = false;
  render();
}

function resetGame() {
  stopTimer();
  state = makeState();
  resetButton.textContent = "😊";
  statusTextEl.textContent = "待开始";
  timerEl.textContent = "0";
  render();
}

function applyTheme(key) {
  themeKey = key;
  localStorage.setItem("minesweeper-theme", key);
  const t = THEMES[key];
  document.documentElement.dataset.theme = key;
  document.documentElement.style.setProperty("--bg0", t.page[1]);
  document.documentElement.style.setProperty("--bg1", t.page[0]);
  document.documentElement.style.setProperty("--panel", t.panel);
  document.documentElement.style.setProperty("--panel-border", t.panelBorder);
  document.documentElement.style.setProperty("--text", t.text);
  document.documentElement.style.setProperty("--muted", t.muted);
  document.documentElement.style.setProperty("--accent", t.accent);
  document.documentElement.style.setProperty("--accent2", t.accent2);
  document.documentElement.style.setProperty("--danger", t.danger);
  document.documentElement.style.setProperty("--win", t.win);
  document.documentElement.style.setProperty("--cell-up", t.cellUp);
  document.documentElement.style.setProperty("--cell-down", t.cellDown);
  document.documentElement.style.setProperty("--cell-border", t.cellBorder);
  document.documentElement.style.setProperty("--cell-inset", t.cellInset);
  document.documentElement.style.setProperty("--control-bg", t.controlBg);
  document.documentElement.style.setProperty("--control-text", t.controlText);
  document.documentElement.style.setProperty("--control-border", t.controlBorder);
}

function applyBackgroundOpacity(value) {
  backgroundOpacity = value;
  localStorage.setItem("minesweeper-background-opacity", value);
  document.documentElement.style.setProperty("--bg-opacity", value);
}

function applyBackground(url) {
  backgroundUrl = url;
  try { if (url) localStorage.setItem("minesweeper-background", url); else localStorage.removeItem("minesweeper-background"); } catch {}
  pageBackdropEl.style.backgroundImage = url ? `url("${url}")` : "none";
  pageBackdropEl.style.backgroundSize = "cover";
  pageBackdropEl.style.backgroundPosition = "center";
  pageBackdropEl.style.backgroundRepeat = "no-repeat";
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
  img.src = dataUrl;
  await ready;
  const maxSide = 1920;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("no ctx");
  c.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

difficultySelect.addEventListener("change", (e) => { difficultyKey = e.target.value; resetGame(); });
themeSelect.value = themeKey;
themeSelect.addEventListener("change", (e) => applyTheme(e.target.value));
bgOpacity.value = backgroundOpacity;
applyBackgroundOpacity(backgroundOpacity);
bgUpload.addEventListener("change", async () => {
  const file = bgUpload.files && bgUpload.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  const raw = await loadImageSource(file);
  applyBackground(await compressImageDataUrl(raw));
});
clearBgButton.addEventListener("click", () => { bgUpload.value = ""; applyBackground(""); });
bgOpacity.addEventListener("input", (e) => applyBackgroundOpacity(e.target.value));
resetButton.addEventListener("click", resetGame);
window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r") resetGame(); });

function init() {
  applyTheme(themeKey);
  applyBackground(backgroundUrl);
  applyBackgroundOpacity(backgroundOpacity);
  resetGame();
}

init();
