const ROGUE_SECTOR_COUNT = 3;
const MIN_SECTOR_WIDTH = 2;
const MIN_BOARD_COLS = ROGUE_SECTOR_COUNT * MIN_SECTOR_WIDTH;
const SECTOR_LABELS = ["A区", "B区", "C区"];

function randomIndex(rng, length) {
  const value = Number(typeof rng === "function" ? rng() : 0);
  const normalized = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 0.999999999)
    : 0;
  return Math.floor(normalized * length);
}

function validateSectors(sectors) {
  if (!Array.isArray(sectors)) throw new TypeError("sectors 必须是数组。");
}

export function createRogueSectors({ cols, rng = Math.random } = {}) {
  if (!Number.isInteger(cols) || cols < MIN_BOARD_COLS) {
    throw new RangeError(`createRogueSectors 的 cols 必须是至少 ${MIN_BOARD_COLS} 列的整数。`);
  }

  const widths = Array.from({ length: ROGUE_SECTOR_COUNT }, () => MIN_SECTOR_WIDTH);
  for (let extra = cols - MIN_BOARD_COLS; extra > 0; extra -= 1) {
    widths[randomIndex(rng, ROGUE_SECTOR_COUNT)] += 1;
  }

  let startCol = 0;
  return widths.map((width, id) => {
    const sector = {
      id,
      label: SECTOR_LABELS[id],
      startCol,
      endColExclusive: startCol + width,
      safeCells: 0,
      revealedSafeCells: 0,
      secured: false,
    };
    startCol += width;
    return sector;
  });
}

export function getRogueSectorForColumn(sectors, col) {
  validateSectors(sectors);
  if (!Number.isInteger(col) || col < 0) return null;
  return sectors.find((sector) => (
    Number.isInteger(sector?.startCol)
      && Number.isInteger(sector?.endColExclusive)
      && col >= sector.startCol
      && col < sector.endColExclusive
  )) || null;
}

export function getRogueSectorId(sectors, col) {
  return getRogueSectorForColumn(sectors, col)?.id ?? null;
}

export function assignRogueSectorIds(board, sectors) {
  if (!Array.isArray(board)) throw new TypeError("board 必须是数组。");
  validateSectors(sectors);
  return board.map((row) => row.map((cell, col) => ({
    ...cell,
    sectorId: getRogueSectorId(sectors, col),
  })));
}

export function calculateRogueSectorStats({ board, sectors } = {}) {
  if (!Array.isArray(board)) throw new TypeError("board 必须是数组。");
  validateSectors(sectors);
  return sectors.map((sector) => {
    let safeCells = 0;
    let revealedSafeCells = 0;
    for (const row of board) {
      for (let col = sector.startCol; col < sector.endColExclusive; col += 1) {
        const cell = row?.[col];
        if (!cell || cell.mine) continue;
        safeCells += 1;
        if (cell.revealed) revealedSafeCells += 1;
      }
    }
    return {
      ...sector,
      safeCells,
      revealedSafeCells,
      secured: revealedSafeCells >= safeCells,
    };
  });
}
