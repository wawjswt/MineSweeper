import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "miniprogram", "generated", "runtime.js");

test("Mini Program build emits a CommonJS runtime without Web globals", () => {
  execFileSync(process.execPath, ["tools/build-miniprogram.mjs"], {
    cwd: projectRoot,
    stdio: "pipe",
  });

  const source = fs.readFileSync(outputPath, "utf8");
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|\blocalStorage\b/);
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    globalThis: {},
  }, { filename: outputPath });
  const runtime = module.exports;
  assert.equal(typeof runtime.createMiniProgramRuntime, "function");
});
