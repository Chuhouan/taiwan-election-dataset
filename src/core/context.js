import { createStore, bindFlatState } from "./store.js";
export function createContext(vendors) {
  const store = createStore({
    domain: { shared: {} },
    analysis: { shared: {} },
    presentation: { shared: {}, left: {}, right: {} },
  });
  const ctx = { ...vendors, store };
  let flat;
  Object.defineProperty(ctx, "state", {
    get: () => flat,
    set: (value) => {
      flat = bindFlatState(store, value);
    },
    enumerable: true,
  });
  const bindings = {
    filterSpec: ["analysis", "filter"],
    filterActive: ["analysis", "filterActive"],
    conditionBase: ["analysis", "base"],
    conditionHighlight: ["analysis", "highlight"],
    groupSelection: ["analysis", "groups"],
    activeGroup: ["analysis", "activeGroup"],
    chartOptions: ["presentation", "right", "options"],
    axes: ["presentation", "right", "axes"],
    scatterSettings: ["presentation", "right", "scatter"],
    smallMaps: ["presentation", "right", "smallMaps"],
    transform: ["presentation", "left", "camera"],
    ternaryCamera: ["presentation", "right", "camera"],
    dualMode: ["presentation", "shared", "dual"],
    dualSplit: ["presentation", "shared", "split"],
    dualFocus: ["presentation", "shared", "maximized"],
  };
  for (const [key, path] of Object.entries(bindings))
    Object.defineProperty(ctx, key, {
      get: () => path.reduce((v, k) => v?.[k], store.getState()),
      set: (value) => store.set(path, value),
      enumerable: true,
    });
  return ctx;
}
