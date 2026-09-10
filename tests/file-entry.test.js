import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

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
