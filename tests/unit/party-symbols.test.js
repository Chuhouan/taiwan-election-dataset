import { test, expect } from "vitest";
import { partySymbolPath } from "../../src/charts/party-symbols.js";
test("alternative triangle and square preserve the circle area used for vote size", () => {
  for (const radius of [1, 4.5, 20]) {
    const triangle = [...partySymbolPath(radius, "國民黨").matchAll(/-?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?/g)].map((m) => Number(m[0])),
      points = [[triangle[0], triangle[1]], [triangle[2], triangle[3]], [triangle[4], triangle[5]]],
      area = Math.abs(points.reduce((sum, p, i) => { const next = points[(i + 1) % 3]; return sum + p[0] * next[1] - next[0] * p[1]; }, 0)) / 2;
    expect(area).toBeCloseTo(Math.PI * radius ** 2, 8);
    const half = Math.abs(Number(partySymbolPath(radius, "民眾黨").match(/M(-?[0-9.]+)/)[1]));
    expect(4 * half ** 2).toBeCloseTo(Math.PI * radius ** 2, 8);
  }
});
