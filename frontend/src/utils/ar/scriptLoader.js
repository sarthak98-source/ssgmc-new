const _loaded = new Set();
export function loadScript(src) {
  if (_loaded.has(src)) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => {
      _loaded.add(src);
      res();
    };
    s.onerror = () => rej(new Error("Failed: " + src));
    document.head.appendChild(s);
  });
}
