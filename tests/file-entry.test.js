import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(projectRoot, "src", "app.js"), "utf8");

test("index selects a file-compatible runtime for double-click and ESM for servers", () => {
  assert.match(indexHtml, /data-file-entry=["']\.\/dist\/file-bundle\.js["']/);
  assert.match(indexHtml, /data-module-entry=["']\.\/src\/app\.js["']/);
  assert.match(indexHtml, /location\.protocol\s*===\s*["']file:["']/);
});

test("file-compatible runtime is a self-contained classic script", () => {
  const bundlePath = path.join(projectRoot, "dist", "file-bundle.js");
  assert.ok(fs.existsSync(bundlePath), "dist/file-bundle.js should be checked in for double-click use");
  const bundle = fs.readFileSync(bundlePath, "utf8");
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\b/m);
  assert.match(bundle, /MinesweeperFileRuntime/);
});

test("file bundle follows the canonical core module graph", () => {
  const bundlePath = path.join(projectRoot, "dist", "file-bundle.js");
  const bundle = fs.readFileSync(bundlePath, "utf8");

  assert.match(bundle, /src\/core\/games\/2048\/engine\.js/);
  assert.match(bundle, /src\/core\/games\/minesweeper\/generator\.js/);
  assert.match(bundle, /src\/core\/games\/minesweeper\/solver\.js/);
  assert.match(bundle, /src\/core\/games\/minesweeper\/state\.js/);
  assert.match(bundle, /src\/core\/games\/rogue\/index\.js/);
  assert.doesNotMatch(bundle, /moduleFactories\["src\/2048-game\.js"\]/);
  assert.doesNotMatch(bundle, /moduleFactories\["src\/state\.js"\]/);
  assert.doesNotMatch(bundle, /[ \t]+\r?$/m, "generated bundle should not contain trailing whitespace");
});

test("one ESM application entry owns all Web game adapters", () => {
  assert.doesNotMatch(indexHtml, /<script[^>]+src=["']\.\/src\/(?:game-tabs|sudoku-game|lianliankan(?:-levels)?|lianliankan-game)\.js["']/i);
  assert.match(appSource, /import\s+["']\.\/game-tabs\.js["']/);
  assert.match(appSource, /import\s+["']\.\/sudoku-game\.js["']/);
  assert.match(appSource, /import\s+["']\.\/lianliankan-game\.js["']/);
});

test("file bundle includes the canonical Sudoku, Link-Link and Rogue modules", () => {
  const bundle = fs.readFileSync(path.join(projectRoot, "dist", "file-bundle.js"), "utf8");
  for (const moduleId of [
    "src/core/games/sudoku/engine.js",
    "src/core/games/lianliankan/engine.js",
    "src/core/games/lianliankan/levels.js",
    "src/core/games/rogue/game.js",
  ]) {
    assert.match(bundle, new RegExp(moduleId.replaceAll("/", "\\/")));
  }
  assert.match(bundle, /moduleFactories\["src\/sudoku-game\.js"\]/);
  assert.match(bundle, /moduleFactories\["src\/lianliankan-game\.js"\]/);
  assert.doesNotMatch(bundle, /moduleFactories\["src\/lianliankan-levels\.js"\]/);
  assert.doesNotMatch(bundle, /moduleFactories\["src\/rogue-(?:game|level|state|items|contracts|sectors)\.js"\]/);
});
