function getDefaultWechatApi() {
  try {
    return globalThis.wx || null;
  } catch {
    return null;
  }
}

function normalizeImage(result) {
  const file = result?.tempFiles?.[0] || {};
  const path = result?.tempFilePaths?.[0] || file.path || "";
  if (!path) return null;
  return {
    path: String(path),
    width: Number(file.width) || 0,
    height: Number(file.height) || 0,
  };
}

export function createWechatMedia(wxApi = getDefaultWechatApi()) {
  return {
    chooseImage() {
      return new Promise((resolve) => {
        try {
          if (typeof wxApi?.chooseImage !== "function") {
            resolve(null);
            return;
          }
          wxApi.chooseImage({
            count: 1,
            sourceType: ["album", "camera"],
            success: (result) => resolve(normalizeImage(result)),
            fail: () => resolve(null),
          });
        } catch {
          resolve(null);
        }
      });
    },
  };
}
