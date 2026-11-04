import { test, expect } from "vitest";
import { findOutliers } from "../../src/data/outliers.js";
test("IQR interpolates quartiles and excludes only strict tail values", () => {
  const result = findOutliers([1, 2, 3, 4, 5, 100].map((value) => ({ value })));
  expect(result.q1).toBe(2.25); expect(result.q3).toBe(4.75);
  expect(result.rows.map((r) => r.value)).toEqual([100]);
});
test("constant distributions and insufficient data are not flagged", () => {
  expect(findOutliers(Array.from({ length: 20 }, () => ({ value: 4 })), "z").rows).toEqual([]);
  expect(findOutliers([{ value: 2 }, { value: null }, { value: 100 }]).lower).toBeNull();
});
test("z score uses sample standard deviation and retains original rows", () => {
  const rows = Array.from({ length: 30 }, (_, key) => ({ value: key === 0 ? 100 : 0, key })), copy = structuredClone(rows), result = findOutliers(rows, "z");
  expect(result.rows.map((r) => r.key)).toEqual([0]); expect(rows).toEqual(copy);
  expect(result.sd).toBeCloseTo(Math.sqrt(10000 / 30), 8);
});
