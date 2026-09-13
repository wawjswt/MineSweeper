import { createGameRegistry } from "./game-registry.js";

function entriesOf(games) {
  if (!games || typeof games !== "object") return [];
  return Object.entries(games);
}

export function createGameRuntime({ initialGame = null, games = {} } = {}) {
  const registry = createGameRegistry({ initialGame });
  for (const [name, session] of entriesOf(games)) registry.register(name, session);

  function getSession(gameName = registry.current()) {
    return gameName ? registry.get(gameName) : null;
  }

  function getState(gameName = registry.current()) {
    const session = getSession(gameName);
    return typeof session?.getState === "function" ? session.getState() : null;
  }

  function dispatch(action, gameName = registry.current()) {
    const result = registry.dispatch(action, gameName);
    return {
      ...result,
      state: result.handled ? getState(gameName) : null,
    };
  }

  function callLifecycle(method) {
    for (const name of registry.list()) {
      const session = registry.get(name);
      if (typeof session?.[method] === "function") session[method]();
    }
  }

  return Object.freeze({
    listGames: () => registry.list(),
    currentGame: () => registry.current(),
    select: (name) => registry.select(name),
    getState,
    dispatch,
    pause: () => callLifecycle("pause"),
    resume: () => callLifecycle("resume"),
  });
}
