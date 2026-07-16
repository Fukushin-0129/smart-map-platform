export function installMapCapture() {
  if (window.__SMART_MAP_CAPTURE_INSTALLED__) return;
  window.__SMART_MAP_CAPTURE_INSTALLED__ = true;

  const patchMapConstructor = () => {
    const maps = window.google?.maps;
    const OriginalMap = maps?.Map;
    if (!OriginalMap || OriginalMap.__smartMapCaptured) return false;

    const CapturedMap = new Proxy(OriginalMap, {
      construct(target, args, newTarget) {
        const instance = Reflect.construct(target, args, newTarget);
        window.__SMART_MAP_INSTANCE__ = instance;
        window.dispatchEvent(new CustomEvent('smart-map-ready', { detail: { map: instance } }));
        return instance;
      },
    });

    Object.defineProperty(CapturedMap, '__smartMapCaptured', { value: true });
    maps.Map = CapturedMap;
    return true;
  };

  let callback = window.initSmartMap;
  Object.defineProperty(window, 'initSmartMap', {
    configurable: true,
    get() {
      return callback;
    },
    set(nextCallback) {
      callback = (...args) => {
        patchMapConstructor();
        return nextCallback(...args);
      };
    },
  });

  document.addEventListener('load', (event) => {
    const target = event.target;
    if (target instanceof HTMLScriptElement && target.src.includes('maps.googleapis.com')) patchMapConstructor();
  }, true);

  const timer = window.setInterval(() => {
    patchMapConstructor();
    if (window.__SMART_MAP_INSTANCE__) window.clearInterval(timer);
  }, 10);

  window.setTimeout(() => window.clearInterval(timer), 15000);
}