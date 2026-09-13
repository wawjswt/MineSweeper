import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createRogueGame,
  getRogueCoreStatus,
} from "../src/core/games/rogue/index.js";
import { createRogueGame as createCanonicalRogueGame } from "../src/core/games/rogue/game.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rogueCoreRoot = path.join(projectRoot, "src", "core", "games", "rogue");

test("Rogue exposes a canonical core game and keeps the first reveal safe", () => {
  assert.equal(createRogueGame, createCanonicalRogueGame);
  assert.deepEqual(getRogueCoreStatus(), {
    game: "rogue",
    status: "extracted",
    uiSource: "src/rogue-ui.js",
  });

  const game = createRogueGame({ rng: () => 0.25 });
  const before = game.getState();
  assert.equal(before.status, "ready");
  assert.equal(game.selectContract(before.contractOptions[0].id), "continue");
  assert.equal(game.reveal(0, 0), "continue");
  const after = game.getState();
  assert.equal(after.status, "playing");
  assert.equal(after.level.started, true);
  assert.equal(after.level.board[0][0].mine, false);
});

test("Rogue core files remain independent from browser globals", () => {
  const files = fs.readdirSync(rogueCoreRoot)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(rogueCoreRoot, name));
  assert.ok(files.length >= 7);
  const forbidden = /\b(?:document|window|localStorage|wx|Canvas|setInterval|setTimeout|requestAnimationFrame)\b/;
  for (const file of files) {
    assert.doesNotMatch(
      fs.readFileSync(file, "utf8"),
      forbidden,
      `${path.relative(projectRoot, file)} imports a platform global`,
    );
  }
});

test("application composition root owns domain registration", () => {
  const source = fs.readFileSync(path.join(projectRoot, "src", "app.js"), "utf8");
  assert.match(source, /createGameRegistry/);
  assert.match(source, /gameRegistry\.register\("sweep"/);
  assert.match(source, /gameRegistry\.register\("rogue"/);
  assert.match(source, /gameRegistry\.register\("2048"/);
});
