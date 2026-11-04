import { test, expect } from "vitest";
import {
  concentration,
  effectiveCandidates,
  bubbleRadius,
  weightedShare,
  ordinaryLeastSquares,
} from "../../src/data/metrics.js";
test("empty denominators remain missing; equal and concentrated votes have known ENP", () => {
  expect(concentration([1], 0)).toBeNull();
  expect(effectiveCandidates([1, 1, 1], 3)).toBeCloseTo(3);
  expect(effectiveCandidates([10, 0, 0], 10)).toBe(1);
});
test("bubble area ratio equals the raw vote ratio", () => {
  const a = bubbleRadius(50000, 1000000, 60),
    b = bubbleRadius(250000, 1000000, 60);
  expect((a * a) / (b * b)).toBeCloseTo(0.2, 12);
});
test("pooled support uses vote denominators rather than a mean of percentages", () => {
  expect(
    weightedShare(
      [
        { total: 100, candidates: [{ name: "A", votes: 90 }] },
        { total: 900, candidates: [{ name: "A", votes: 90 }] },
      ],
      "A",
    ),
  ).toBe(18);
});
test("OLS has known slope, intercept, R2 and rejects a constant X", () => {
  expect(
    ordinaryLeastSquares([
      [0, 1],
      [1, 3],
      [2, 5],
    ]),
  ).toEqual({ count: 3, slope: 2, intercept: 1, r2: 1 });
  expect(
    ordinaryLeastSquares([
      [1, 2],
      [1, 3],
    ]),
  ).toBeNull();
});
