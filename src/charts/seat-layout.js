export function seatLayout(width, height, toolbarBottom, counts) {
  const cx = width / 2,
    cy = height - 115,
    radius = Math.max(35, Math.min((width - 100) / 2, cy - toolbarBottom - 36)),
    slots = [];
  counts.forEach((count, row) => {
    const r =
      radius *
      (counts.length === 1 ? 0.65 : 0.48 + (row * 0.52) / (counts.length - 1));
    for (let i = 0; i < count; i++) {
      const angle =
        count === 1 ? Math.PI / 2 : Math.PI - (i / (count - 1)) * Math.PI;
      slots.push({
        angle,
        x: cx + Math.cos(angle) * r,
        y: cy - Math.sin(angle) * r,
      });
    }
  });
  slots.sort((a, b) => b.angle - a.angle);
  return { cx, cy, radius, slots };
}
