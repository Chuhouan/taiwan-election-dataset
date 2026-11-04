export function concentration(votes, total) {
  if (
    !(total > 0) ||
    !votes.length ||
    votes.some((v) => !Number.isFinite(v) || v < 0)
  )
    return null;
  return votes.reduce((sum, v) => sum + (v / total) ** 2, 0);
}
export function effectiveCandidates(votes, total) {
  const h = concentration(votes, total);
  return h > 0 ? 1 / h : null;
}
export function weightedShare(rows, candidate) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (!total) return null;
  return (
    (rows.reduce(
      (s, r) =>
        s + (r.candidates.find((c) => c.name === candidate)?.votes || 0),
      0,
    ) /
      total) *
    100
  );
}
export function bubbleRadius(votes, maxVotes, maxRadius) {
  return votes >= 0 && maxVotes > 0
    ? Math.sqrt(votes / maxVotes) * maxRadius
    : 0;
}
export function ordinaryLeastSquares(pairs) {
  const points = pairs.filter((p) => p.every(Number.isFinite)),
    n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p[0], 0) / n,
    my = points.reduce((s, p) => s + p[1], 0) / n,
    xx = points.reduce((s, p) => s + (p[0] - mx) ** 2, 0),
    yy = points.reduce((s, p) => s + (p[1] - my) ** 2, 0),
    xy = points.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
  if (!xx) return null;
  return {
    count: n,
    slope: xy / xx,
    intercept: my - (xy / xx) * mx,
    r2: yy ? (xy * xy) / (xx * yy) : 0,
  };
}
