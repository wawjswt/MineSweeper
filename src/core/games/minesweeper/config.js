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
