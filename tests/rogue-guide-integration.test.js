import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createRogueGuideDialogController,
  getRogueGuideRenderSections,
  getRogueGuideCatalog,
} from "../src/rogue-guide.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

function createFakeDialog() {
  const listeners = new Map();
  return {
    open: false,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
      this.dispatch("close");
    },
  };
}

test("tactical guide markup provides a labelled native dialog with stable navigation hooks", () => {
  assert.match(indexHtml, /<button[^>]+id=["']rogueGuideButton["'][^>]*aria-controls=["']rogueGuideDialog["']/);
  assert.match(indexHtml, /<dialog[^>]+id=["']rogueGuideDialog["'][^>]*aria-labelledby=["']rogueGuideTitle["']/);
  assert.match(indexHtml, /id=["']rogueGuideTitle["']/);
  assert.match(indexHtml, /id=["']rogueGuideClose["']/);
  assert.match(indexHtml, /id=["']rogueGuideChapters["'][^>]*aria-label=/);
  assert.match(indexHtml, /id=["']rogueGuideContent["']/);
});

test("guide render model covers every catalog section and its dynamic card data", () => {
  const catalog = getRogueGuideCatalog();
  const sections = getRogueGuideRenderSections(catalog);

  assert.deepEqual(sections.map(({ id }) => id), [
    "overview", "floors", "contracts", "special-cells", "tools", "upgrades", "illustrations", "tips",
  ]);
  assert.equal(sections.find(({ id }) => id === "floors").cards.length, catalog.floors.length);
  assert.equal(sections.find(({ id }) => id === "tools").cards.length, catalog.tools.length);
  assert.equal(sections.find(({ id }) => id === "special-cells").cards.length, catalog.specialCells.length);
  assert.equal(sections.find(({ id }) => id === "contracts").cards.length, catalog.contracts.length);
  assert.equal(sections.find(({ id }) => id === "upgrades").cards.length, catalog.upgrades.length);
  assert.ok(sections.find(({ id }) => id === "floors").notes.some((note) => note.includes("A、B、C")));
  assert.ok(sections.find(({ id }) => id === "contracts").cards.every(({ meta }) => meta.includes("未完成扣 1 点能量")));
  assert.equal(sections.find(({ id }) => id === "illustrations").illustrations.length, catalog.illustrations.length);
  assert.deepEqual(
    sections.find(({ id }) => id === "illustrations").illustrations.map(({ path, alt, caption }) => ({ path, alt, caption })),
    catalog.illustrations.map(({ path, alt, caption }) => ({ path, alt, caption })),
  );
});

test("guide controller blocks gameplay shortcuts while open and restores trigger focus after close", () => {
  const dialog = createFakeDialog();
  const trigger = {
    focusCount: 0,
    addEventListener() {},
    focus() { this.focusCount += 1; },
  };
  const gameState = { selectedContract: "noDamage", selectedTool: "scoutPulse", markMode: "mark", timer: 17 };
  const before = structuredClone(gameState);
  const controller = createRogueGuideDialogController({ dialog, trigger, closeButton: null });
  const event = {
    key: "r",
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };

  assert.equal(controller.open(), true);
  assert.equal(dialog.open, true);
  assert.equal(controller.handleGlobalKeydown(event), true);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(gameState, before);

  assert.equal(controller.close(), true);
  assert.equal(dialog.open, false);
  assert.equal(trigger.focusCount, 1);
});

test("guide controller lets dialog navigation keys pass through while blocking only gameplay shortcuts", () => {
  const dialog = createFakeDialog();
  const trigger = { addEventListener() {}, focus() {} };
  const controller = createRogueGuideDialogController({ dialog, trigger, closeButton: null });
  controller.open();

  const tabEvent = {
    key: "Tab",
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  assert.equal(controller.handleGlobalKeydown(tabEvent), false);
  assert.equal(tabEvent.prevented, false);
  assert.equal(tabEvent.stopped, false);

  const enterEvent = {
    key: "Enter",
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  assert.equal(controller.handleGlobalKeydown(enterEvent), false);
  assert.equal(enterEvent.prevented, false);
  assert.equal(enterEvent.stopped, false);
});
