// Descriptive outliers use equal-weight areas; they do not diagnose data errors.
export function findOutliers(rows, method = "iqr") {
  const valid = rows.filter((r) => Number.isFinite(r.value)), values = valid.map((r) => r.value).sort((a, b) => a - b), n = values.length;
  if (n < 4) return { n, lower: null, upper: null, rows: [], method };
  const quantile = (p) => { const i = (n - 1) * p, a = Math.floor(i); return values[a] + (values[Math.min(a + 1, n - 1)] - values[a]) * (i - a); },
    q1 = quantile(.25), q3 = quantile(.75), mean = values.reduce((a, b) => a + b, 0) / n,
    sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)),
    lower = method === "z" ? mean - 3 * sd : q1 - 1.5 * (q3 - q1),
    upper = method === "z" ? mean + 3 * sd : q3 + 1.5 * (q3 - q1);
  return { n, lower, upper, method, q1, q3, mean, sd,
    rows: valid.filter((r) => r.value < lower || r.value > upper).map((r) => ({ ...r, direction: r.value < lower ? "偏低" : "偏高", z: sd ? (r.value - mean) / sd : 0 })).sort((a, b) => b.value - a.value) };
}
