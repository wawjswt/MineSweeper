export function loadImageSource(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取失败"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export async function compressImageDataUrl(dataUrl) {
  const img = new Image();
  const ready = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("无法解码"));
  });
  img.src = dataUrl;
  await ready;

  const maxSide = 1920;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("no ctx");
  c.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}
