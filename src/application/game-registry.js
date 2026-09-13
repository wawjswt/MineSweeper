function assertGameName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new TypeError("game name must be a non-empty string");
  }
}

function assertHandler(handler) {
  if (!handler || typeof handler !== "object") {
    throw new TypeError("game handler must be an object");
  }
  if ("getState" in handler && typeof handler.getState !== "function") {
    throw new TypeError("game handler getState must be a function");
  }
  if ("dispatch" in handler && typeof handler.dispatch !== "function") {
    throw new TypeError("game handler dispatch must be a function");
  }
}

export function createGameRegistry({ initialGame = null } = {}) {
  if (initialGame !== null) assertGameName(initialGame);

  const handlers = new Map();
  let currentGame = initialGame;

  function register(name, handler) {
    assertGameName(name);
    assertHandler(handler);
    handlers.set(name, handler);
    return handler;
  }

  function unregister(name) {
    assertGameName(name);
    const removed = handlers.delete(name);
    if (removed && currentGame === name) currentGame = null;
    return removed;
  }

  function has(name) {
    return handlers.has(name);
  }

  function get(name) {
    return handlers.get(name) || null;
  }

  function list() {
    return Array.from(handlers.keys());
  }

  function select(name) {
    const previous = currentGame;
    if (!handlers.has(name)) {
      return { ok: false, game: currentGame, previous };
    }
    currentGame = name;
    return { ok: true, game: currentGame, previous };
  }

  function current() {
    return currentGame;
  }

  function dispatch(action, gameName = currentGame) {
    const handler = handlers.get(gameName);
    if (!handler || typeof handler.dispatch !== "function") {
      return { handled: false, game: gameName, result: null };
    }
    return {
      handled: true,
      game: gameName,
      result: handler.dispatch(action),
    };
  }

  return Object.freeze({ register, unregister, has, get, list, select, current, dispatch });
}
