// Left-inverse empirical weighted CDF; no interpolation or invented observations.
export function weightedQuantile(source, probability) {
  const rows = source.filter((r) => Number.isFinite(r.value) && Number.isFinite(r.weight) && r.weight > 0).slice().sort((a, b) => a.value - b.value);
  if (!rows.length) return null;
  const target = Math.max(0, Math.min(1, probability)) * rows.reduce((sum, r) => sum + r.weight, 0);
  let sum = 0;
  for (const row of rows) { sum += row.weight; if (sum >= target) return row.value; }
  return rows.at(-1).value;
}
