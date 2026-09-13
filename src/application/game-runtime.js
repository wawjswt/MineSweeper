import { createGameRegistry } from "./game-registry.js";

function entriesOf(games) {
  if (!games || typeof games !== "object") return [];
  return Object.entries(games);
}

export function createGameRuntime({ initialGame = null, games = {}, viewModels = {} } = {}) {
  const registry = createGameRegistry({ initialGame });
  for (const [name, session] of entriesOf(games)) registry.register(name, session);

  function getSession(gameName = registry.current()) {
    return gameName ? registry.get(gameName) : null;
  }

  function getState(gameName = registry.current()) {
    const session = getSession(gameName);
    const state = typeof session?.getState === "function" ? session.getState() : null;
    const viewModel = viewModels?.[gameName];
    return typeof viewModel === "function" ? viewModel(state) : state;
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

  function subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    const unsubscribers = [];
    for (const name of registry.list()) {
      const session = registry.get(name);
      if (typeof session?.subscribe !== "function") continue;
      unsubscribers.push(session.subscribe((state) => {
        const viewModel = viewModels?.[name];
        listener({
          game: name,
          state: typeof viewModel === "function" ? viewModel(state) : state,
        });
      }));
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }

  return Object.freeze({
    listGames: () => registry.list(),
    currentGame: () => registry.current(),
    select: (name) => registry.select(name),
    getState,
    dispatch,
    subscribe,
    pause: () => callLifecycle("pause"),
    resume: () => callLifecycle("resume"),
  });
}
