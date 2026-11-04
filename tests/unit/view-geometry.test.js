import { test, expect } from "vitest";
import { placeCallouts } from "../../src/charts/annotations.js";
import { seatLayout } from "../../src/charts/seat-layout.js";
test("close observations get distinct, bounded callouts in priority order", () => {
  const bounds = { left: 20, top: 20, right: 420, bottom: 260 },
    items = [
      { key: "selected", x: 200, y: 100, width: 160 },
      { key: "extreme", x: 202, y: 101, width: 160 },
    ],
    out = placeCallouts(items, bounds);
  expect(out.map((d) => d.key)).toEqual(["selected", "extreme"]);
  for (const d of out) {
    expect(d.x).toBeGreaterThanOrEqual(bounds.left);
    expect(d.x + d.w).toBeLessThanOrEqual(bounds.right);
    expect(d.y).toBeGreaterThanOrEqual(bounds.top);
    expect(d.y + d.h).toBeLessThanOrEqual(bounds.bottom);
  }
  const [a, b] = out;
  expect(
    a.x >= b.x + b.w ||
      b.x >= a.x + a.w ||
      a.y >= b.y + b.h ||
      b.y >= a.y + a.h,
  ).toBe(true);
});
test.each([
  [1280, 646],
  [1440, 710],
  [1920, 890],
])("113 and 73 seat arcs respect toolbar and legend space at %i", (w, h) => {
  for (const counts of [
    [15, 19, 23, 26, 30],
    [10, 13, 15, 17, 18],
  ]) {
    const { slots } = seatLayout(w, h, 190, counts);
    expect(slots).toHaveLength(counts.reduce((a, b) => a + b));
    expect(
      new Set(slots.map((d) => d.x.toFixed(5) + "," + d.y.toFixed(5))).size,
    ).toBe(slots.length);
    for (const d of slots) {
      expect(d.x).toBeGreaterThan(30);
      expect(d.x).toBeLessThan(w - 30);
      expect(d.y).toBeGreaterThan(210);
      expect(d.y).toBeLessThanOrEqual(h - 115);
    }
  }
});
