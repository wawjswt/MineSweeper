function getDefaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function createWebStorage(storage = getDefaultStorage()) {
  return {
    getItem(key) {
      try {
        return typeof storage?.getItem === "function" ? storage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (typeof storage?.setItem !== "function") return false;
        storage.setItem(key, String(value));
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        if (typeof storage?.removeItem !== "function") return false;
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
