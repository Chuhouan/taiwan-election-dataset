/** Small explicit store. Transient hover is deliberately outside persisted state. */
export function createStore(initial = {}) {
  let state = structuredClone(initial),
    revision = 0;
  const listeners = new Set();
  return {
    getState: () => state,
    set(path, value) {
      let parent = state;
      for (const key of path.slice(0, -1)) parent = parent[key] ??= {};
      if (Object.is(parent[path.at(-1)], value)) return;
      parent[path.at(-1)] = value;
      this.commit();
    },
    commit() {
      revision++;
      for (const item of listeners) {
        const next = item.select(state);
        if (!item.equal(next, item.value)) {
          const before = item.value;
          item.value = next;
          item.listener(next, before, revision);
        }
      }
    },
    subscribe(select, listener, equal = Object.is) {
      const item = { select, listener, equal, value: select(state) };
      listeners.add(item);
      return () => listeners.delete(item);
    },
    get revision() {
      return revision;
    },
  };
}
export function bindFlatState(store, initial) {
  const domain = new Set([
    "e",
    "level",
    "county",
    "candidate",
    "swingParty",
    "otherCandidate",
  ]);
  const analysis = new Set([
    "key",
    "inspection",
    "brushed",
    "pins",
    "brushEnabled",
  ]);
  const path = (key) => [
    domain.has(key)
      ? "domain"
      : analysis.has(key)
        ? "analysis"
        : "presentation",
    "shared",
    key,
  ];
  for (const [key, value] of Object.entries(initial))
    store.set(path(key), value);
  return new Proxy(
    {},
    {
      get: (_, key) => path(key).reduce((v, k) => v?.[k], store.getState()),
      set: (_, key, value) => (store.set(path(key), value), true),
      ownKeys: () => [
        ...new Set(
          Object.values(store.getState()).flatMap((v) =>
            Object.keys(v.shared || {}),
          ),
        ),
      ],
      getOwnPropertyDescriptor: () => ({
        enumerable: true,
        configurable: true,
      }),
    },
  );
}
