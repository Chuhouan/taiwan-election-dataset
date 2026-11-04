import { test, expect } from "vitest";
import { weightedQuantile } from "../../src/data/weighted.js";
test("weighted percentiles are the left-inverse empirical CDF", () => {
  const rows = [{ value: 10, weight: 1 }, { value: 20, weight: 8 }, { value: 30, weight: 1 }];
  expect([.25, .5, .75].map((p) => weightedQuantile(rows, p))).toEqual([20, 20, 20]);
  expect(weightedQuantile(rows, 0)).toBe(10); expect(weightedQuantile(rows, 1)).toBe(30);
});
test("missing and zero weights never become observations", () => {
  expect(weightedQuantile([{ value: 1, weight: 0 }, { value: null, weight: 10 }], .5)).toBeNull();
});
