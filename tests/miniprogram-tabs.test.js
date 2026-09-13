import test from "node:test";
import assert from "node:assert/strict";
import { toGameTabViewModel } from "../src/adapters/miniprogram/view-models/game-tabs.js";

test("game tab view model reflects registered games and active selection", () => {
  let active = "2048";
  const runtime = {
    listGames: () => ["2048", "sweep", "sudoku"],
    currentGame: () => active,
    select: (name) => {
      active = name;
      return { ok: true, game: name };
    },
  };
  assert.deepEqual(toGameTabViewModel(runtime), {
    tabs: [
      { name: "2048", active: true, disabled: false },
      { name: "sweep", active: false, disabled: false },
      { name: "sudoku", active: false, disabled: false },
    ],
    loading: false,
  });
  assert.deepEqual(runtime.select("sudoku"), { ok: true, game: "sudoku" });
  assert.equal(toGameTabViewModel(runtime).tabs[2].active, true);
});
