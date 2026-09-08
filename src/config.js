export const DIFFICULTIES = {
  easy: { name: "简单", rows: 7, cols: 7, mines: 7 },
  normal: { name: "普通", rows: 9, cols: 9, mines: 10 },
  hard: { name: "困难", rows: 16, cols: 16, mines: 40 },
  extreme: { name: "极致", rows: 16, cols: 30, mines: 99 },
};

export const SUDOKU_DIFFICULTIES = {
  easy: { name: "基础", rows: 9, cols: 9, mines: 9 },
  normal: { name: "进阶", rows: 11, cols: 11, mines: 11 },
  hard: { name: "困难", rows: 13, cols: 13, mines: 13 },
  extreme: { name: "挑战", rows: 15, cols: 15, mines: 15 },
  expert: { name: "宗师", rows: 19, cols: 19, mines: 19 },
};

export const HEX_DIFFICULTIES = {
  easy: { name: "简单", rows: 8, cols: 8, mines: 10 },
  normal: { name: "普通", rows: 11, cols: 11, mines: 18 },
  hard: { name: "困难", rows: 14, cols: 14, mines: 35 },
  extreme: { name: "极致", rows: 18, cols: 18, mines: 70 },
};

export const RING_DIFFICULTIES = {
  easy: { name: "简单", rows: 6, cols: 24, mines: 14 },
  normal: { name: "普通", rows: 7, cols: 30, mines: 24 },
  hard: { name: "困难", rows: 8, cols: 36, mines: 38 },
  extreme: { name: "极致", rows: 9, cols: 42, mines: 56 },
};

export const MODES = {
  classic: { label: "经典扫雷" },
  offset: { label: "偏移扫雷" },
  sudoku: { label: "数独扫雷" },
  hex: { label: "Hex 扫雷" },
  ring: { label: "环形棋盘" },
};

export const CUSTOM_DIFFICULTY_CONFIG = {
  classic: { rowLabel: "行", colLabel: "列", row: [5, 30], col: [5, 40], defaults: [9, 9, 10] },
  offset: { rowLabel: "行", colLabel: "列", row: [5, 30], col: [5, 40], defaults: [9, 9, 10] },
  sudoku: { rowLabel: "行", colLabel: "列", row: [5, 5], col: [5, 5], defaults: [5, 5, 5] },
  hex: { rowLabel: "行", colLabel: "列", row: [5, 22], col: [5, 22], defaults: [11, 11, 18] },
  ring: { rowLabel: "圈数", colLabel: "每圈格", row: [3, 10], col: [12, 48], defaults: [7, 30, 24] },
};

export const BOARD_METRICS = {
  classic: { cellSize: 34, gap: 4 },
  hex: { cellW: 42, cellH: 48, xStep: 32, yStep: 36 },
  ring: { innerRadius: 72, radialStep: 26, ringGap: 3 },
};

export const THEMES = {
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
