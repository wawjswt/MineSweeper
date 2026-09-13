export function toGameTabViewModel(runtime) {
  const names = typeof runtime?.listGames === "function" ? runtime.listGames() : [];
  const active = typeof runtime?.currentGame === "function" ? runtime.currentGame() : null;
  return {
    tabs: names.map((name) => ({
      name,
      active: name === active,
      disabled: false,
    })),
    loading: names.length === 0,
  };
}
