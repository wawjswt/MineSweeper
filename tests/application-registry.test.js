import test from "node:test";
import assert from "node:assert/strict";
import { createGameRegistry } from "../src/application/game-registry.js";

test("game registry lists registered domains and replaces a named handler", () => {
  const registry = createGameRegistry({ initialGame: "sweep" });
  const first = { getState: () => ({ version: 1 }) };
  const replacement = { getState: () => ({ version: 2 }) };

  assert.equal(registry.register("sweep", first), first);
  assert.equal(registry.register("sweep", replacement), replacement);
  assert.deepEqual(registry.list(), ["sweep"]);
  assert.equal(registry.has("sweep"), true);
  assert.equal(registry.current(), "sweep");
  assert.deepEqual(registry.get("sweep").getState(), { version: 2 });
});

test("select keeps the current game when the requested domain is unknown", () => {
  const registry = createGameRegistry({ initialGame: "sweep" });
  registry.register("sweep", {});

  assert.deepEqual(registry.select("unknown"), {
    ok: false,
    game: "sweep",
    previous: "sweep",
  });
  assert.equal(registry.current(), "sweep");
});

test("dispatch routes actions to the selected or explicitly named game", () => {
  const actions = [];
  const registry = createGameRegistry({ initialGame: "sweep" });
  registry.register("sweep", {
    dispatch(action) {
      actions.push(["sweep", action]);
      return { state: "sweep-next" };
    },
  });
  registry.register("rogue", {
    dispatch(action) {
      actions.push(["rogue", action]);
      return { state: "rogue-next" };
    },
  });

  assert.deepEqual(registry.dispatch({ type: "reset" }), {
    handled: true,
    game: "sweep",
    result: { state: "sweep-next" },
  });
  assert.deepEqual(registry.dispatch({ type: "reveal" }, "rogue"), {
    handled: true,
    game: "rogue",
    result: { state: "rogue-next" },
  });
  assert.deepEqual(actions, [
    ["sweep", { type: "reset" }],
    ["rogue", { type: "reveal" }],
  ]);
});

test("dispatch reports an unregistered game without throwing", () => {
  const registry = createGameRegistry({ initialGame: "sweep" });

  assert.deepEqual(registry.dispatch({ type: "reset" }), {
    handled: false,
    game: "sweep",
    result: null,
  });
  assert.deepEqual(registry.dispatch({ type: "reset" }, "rogue"), {
    handled: false,
    game: "rogue",
    result: null,
  });
});

test("register rejects invalid names and non-object handlers", () => {
  const registry = createGameRegistry();

  assert.throws(() => registry.register("", {}), TypeError);
  assert.throws(() => registry.register("sweep", null), TypeError);
  assert.throws(() => registry.register("sweep", { dispatch: "not-a-function" }), TypeError);
  assert.throws(() => registry.register("sweep", { getState: "not-a-function" }), TypeError);
});
