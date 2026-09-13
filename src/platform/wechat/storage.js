function getDefaultWechatApi() {
  try {
    return globalThis.wx || null;
  } catch {
    return null;
  }
}

export function createWechatStorage(wxApi = getDefaultWechatApi()) {
  return {
    getItem(key) {
      try {
        if (typeof wxApi?.getStorageSync !== "function") return null;
        const value = wxApi.getStorageSync(key);
        return value === "" || value === null || value === undefined ? null : String(value);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (typeof wxApi?.setStorageSync !== "function") return false;
        wxApi.setStorageSync(key, String(value));
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        if (typeof wxApi?.removeStorageSync !== "function") return false;
        wxApi.removeStorageSync(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
