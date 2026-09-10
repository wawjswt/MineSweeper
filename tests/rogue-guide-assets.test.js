import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getRogueGuideCatalog } from "../src/rogue-guide.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every rogue guide illustration is a self-contained SVG asset", () => {
  const illustrations = getRogueGuideCatalog().illustrations;

  assert.equal(illustrations.length, 12);

  for (const illustration of illustrations) {
    const assetPath = path.resolve(repoRoot, illustration.path.replace(/^\.\//, ""));
    assert.ok(fs.existsSync(assetPath), `missing illustration asset: ${illustration.path}`);

    const svg = fs.readFileSync(assetPath, "utf8");
    assert.match(svg, /<svg\b[^>]*\bviewBox\s*=\s*["'][^"']+["'][^>]*>/i, `${illustration.path} must define a viewBox`);
    assert.doesNotMatch(svg, /<text\b/i, `${illustration.path} must not contain text nodes`);
    assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["'](?:https?:|data:|\/\/)/i, `${illustration.path} must not embed external references`);
    assert.doesNotMatch(svg, /@import|url\(\s*["']?(?:https?:|data:|\/\/)/i, `${illustration.path} must not reference external fonts or images`);
  }
});
