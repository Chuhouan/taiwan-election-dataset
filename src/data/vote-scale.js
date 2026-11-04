export function rankVoteRegions(records) {
  const sorted = records
      .filter((r) => Number.isFinite(r.total) && r.total > 0)
      .slice()
      .sort((a, b) => b.total - a.total),
    total = sorted.reduce((s, r) => s + r.total, 0);
  let cumulative = 0,
    halfCount = 0;
  const rows = sorted.map((r, i) => {
    cumulative += r.total;
    if (!halfCount && cumulative >= total / 2) halfCount = i + 1;
    return {
      r,
      rank: i + 1,
      share: (r.total / total) * 100,
      cumulative: (cumulative / total) * 100,
    };
  });
  return {
    rows,
    total,
    halfCount,
    topFive: rows[Math.min(4, rows.length - 1)]?.cumulative || 0,
  };
}
