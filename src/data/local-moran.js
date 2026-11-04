export function adjustFDR(pvalues, method = "by") {
  const m = pvalues.length, order = pvalues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), out = Array(m),
    factor = method === "by" ? Array.from({ length: m }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0) : 1;
  let last = 1;
  for (let rank = m - 1; rank >= 0; rank--) {
    last = Math.min(last, order[rank].p * m * factor / (rank + 1)); out[order[rank].i] = last;
  }
  return out;
}
export function localMoran(input, graph, { permutations = 999, seed = 2024, correction = "by" } = {}) {
  const finite = input.filter((r) => Number.isFinite(r.value)), available = new Set(finite.map((r) => r.key)),
    rows = finite.filter((r) => (graph[r.key] || []).some((key) => key !== r.key && available.has(key))),
    n = rows.length, keys = new Set(rows.map((r) => r.key)),
    excluded = input.filter((r) => !keys.has(r.key)).map((r) => r.key),
    mean = n ? rows.reduce((sum, r) => sum + r.value, 0) / n : null,
    centered = rows.map((r) => r.value - mean), denominator = centered.reduce((sum, z) => sum + z * z, 0);
  const settings = { n, excluded, permutations, seed, correction, mean };
  if (n < 4 || !denominator) return { ...settings, rows: [], reason: n < 4 ? "少於4個有鄰接且數值有效的地區" : "所有地區數值相同" };
  const index = new Map(rows.map((r, i) => [r.key, i])), factor = (n - 1) / denominator;
  const output = rows.map((r, i) => {
    const neighbors = [...new Set(graph[r.key] || [])].filter((key) => key !== r.key && index.has(key)),
      k = neighbors.length, lag = neighbors.reduce((sum, key) => sum + centered[index.get(key)], 0) / k,
      I = factor * centered[i] * lag, expected = -(centered[i] ** 2) / denominator,
      pool = rows.map((_, j) => j).filter((j) => j !== i);
    let state = seed >>> 0;
    for (const c of r.key) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
    const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
    let extreme = 0;
    for (let p = 0; p < permutations; p++) {
      const swaps = []; let sum = 0;
      for (let s = 0; s < k; s++) {
        const j = s + Math.floor(random() * (pool.length - s));
        [pool[s], pool[j]] = [pool[j], pool[s]]; swaps.push(j); sum += centered[pool[s]];
      }
      const simulated = factor * centered[i] * sum / k;
      if (Math.abs(simulated - expected) >= Math.abs(I - expected) - 1e-12) extreme++;
      for (let s = k - 1; s >= 0; s--) [pool[s], pool[swaps[s]]] = [pool[swaps[s]], pool[s]];
    }
    return { ...r, I, expected, neighbors, p: (extreme + 1) / (permutations + 1), lag: lag + mean,
      quadrant: centered[i] >= 0 ? lag >= 0 ? "HH 高－高" : "HL 高－低" : lag >= 0 ? "LH 低－高" : "LL 低－低" };
  });
  const adjusted = adjustFDR(output.map((r) => r.p), correction);
  return { ...settings, rows: output.map((r, i) => ({ ...r, q: adjusted[i], significant: adjusted[i] <= .05 })) };
}
