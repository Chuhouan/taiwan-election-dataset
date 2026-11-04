/** Rectangular shelf packing with a single area scale shared by every group. */
export function packVoteGroups(source, rect) {
  const grouped = new Map();
  for (const item of source) {
    const party = item.r.candidates[0].party;
    if (!grouped.has(party)) grouped.set(party, []);
    grouped.get(party).push({ ...item });
  }
  const groups = [...grouped]
    .map(([party, nodes]) => ({
      party,
      nodes: nodes.sort((a, b) => b.radius - a.radius),
      votes: nodes.reduce((s, d) => s + d.r.total, 0),
    }))
    .sort((a, b) => b.votes - a.votes);
  if (!groups.length) return [];
  const gap = 20,
    available = Math.max(1, rect.width - gap * (groups.length - 1)),
    minWidth = Math.min(110, (available / groups.length) * 0.7),
    total = groups.reduce((s, d) => s + d.votes, 0),
    height = Math.max(1, rect.height - 34);
  for (const group of groups)
    group.width =
      minWidth + ((available - minWidth * groups.length) * group.votes) / total;
  function place(group, k, write = false) {
    let x = 0,
      y = 0,
      rowHeight = 0;
    for (const d of group.nodes) {
      const radius = d.radius * k,
        diameter = radius * 2 + 6;
      if (diameter > group.width) return Infinity;
      if (x && x + diameter > group.width) {
        y += rowHeight;
        x = 0;
        rowHeight = 0;
      }
      rowHeight = Math.max(rowHeight, diameter);
      if (write) {
        d.x = x + diameter / 2;
        d.y = y + rowHeight / 2;
        d.radius = radius;
      }
      x += diameter;
    }
    return y + rowHeight;
  }
  let lo = 0,
    hi = Math.max(rect.width, rect.height) / 70;
  for (let i = 0; i < 28; i++) {
    const k = (lo + hi) / 2;
    if (groups.every((g) => place(g, k) <= height)) lo = k;
    else hi = k;
  }
  let offset = rect.x;
  const output = [];
  for (const group of groups) {
    const usedHeight = place(group, lo);
    place(group, lo, true);
    for (const d of group.nodes) {
      d.x += offset;
      d.y += rect.y + 34 + (height - usedHeight) / 2;
      d.groupX = offset + group.width / 2;
      output.push(d);
    }
    offset += group.width + gap;
  }
  return output;
}
