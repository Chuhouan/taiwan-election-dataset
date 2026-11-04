/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, { spatialMoran, spatialComponents });
  /* Pure spatial metrics. Input values are descriptive area shares, not individual behaviour. */
  function spatialMoran(rows, graph, permutations = 999, seed = 2024) {
    const available = new Set(
      rows.filter((r) => Number.isFinite(r.value)).map((r) => r.key),
    );
    const active = rows.filter(
      (r) =>
        available.has(r.key) &&
        (graph[r.key] || []).some((k) => available.has(k)),
    );
    const index = new Map(active.map((r, i) => [r.key, i]));
    const weights = active.map((r) =>
      (graph[r.key] || []).filter((k) => index.has(k)).map((k) => index.get(k)),
    );
    const n = active.length;
    const excludedKeys = rows
      .filter((r) => !index.has(r.key))
      .map((r) => r.key);
    if (n < 3)
      return {
        n,
        excludedKeys,
        nodes: [],
        I: null,
        pUpper: null,
        simulations: [],
        permutations: 0,
      };
    const mean = active.reduce((sum, r) => sum + r.value, 0) / n;
    const centered = active.map((r) => r.value - mean);
    const denominator = centered.reduce((sum, value) => sum + value * value, 0);
    const nodes = active.map((r, i) => ({
      ...r,
      lag:
        weights[i].reduce((sum, j) => sum + active[j].value, 0) /
        weights[i].length,
    }));
    const expected = -1 / (n - 1);
    if (!denominator)
      return {
        n,
        excludedKeys,
        nodes,
        mean,
        expected,
        I: null,
        pUpper: null,
        simulations: [],
        permutations: 0,
      };
    function statistic(values) {
      return (
        values.reduce(
          (sum, value, i) =>
            sum +
            (value * weights[i].reduce((acc, j) => acc + values[j], 0)) /
              weights[i].length,
          0,
        ) / denominator
      );
    }
    const I = statistic(centered),
      simulations = [];
    let randomState = seed >>> 0;
    function random() {
      randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
      return randomState / 4294967296;
    }
    let greater = 0;
    for (let p = 0; p < permutations; p++) {
      const shuffled = centered.slice();
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const value = statistic(shuffled);
      simulations.push(value);
      if (value >= I) greater++;
    }
    return {
      n,
      excludedKeys,
      nodes,
      mean,
      expected,
      I,
      pUpper: permutations ? (greater + 1) / (permutations + 1) : null,
      simulations,
      permutations,
    };
  }
  function spatialComponents(rows, graph, threshold) {
    const remaining = new Set(
        rows.filter((r) => r.value >= threshold).map((r) => r.key),
      ),
      groups = [];
    while (remaining.size) {
      const first = remaining.values().next().value,
        component = [],
        queue = [first];
      remaining.delete(first);
      for (let i = 0; i < queue.length; i++) {
        const key = queue[i];
        component.push(key);
        for (const neighbor of graph[key] || [])
          if (remaining.delete(neighbor)) queue.push(neighbor);
      }
      groups.push(component);
    }
    return groups.sort((a, b) => b.length - a.length);
  }
}
