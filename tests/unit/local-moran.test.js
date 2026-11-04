import { test, expect } from "vitest";
import { localMoran, adjustFDR } from "../../src/data/local-moran.js";
test("BH and BY adjustments agree with independently hand-computed ranks", () => {
  expect(adjustFDR([.01, .04, .03], "bh")).toEqual([.03, .04, .04]);
  const by = adjustFDR([.01, .04, .03], "by");
  expect(by[0]).toBeCloseTo(.03 * 11 / 6, 12); expect(by[1]).toBeCloseTo(.04 * 11 / 6, 12);
});
test("complete graph conditional permutations equal their analytic expectation", () => {
  const input = [1, 2, 4, 8].map((value, i) => ({ key: String(i), value })),
    graph = Object.fromEntries(input.map((r) => [r.key, input.filter((n) => n !== r).map((n) => n.key)])),
    result = localMoran(input, graph, { permutations: 99 });
  for (const row of result.rows) { expect(row.I).toBeCloseTo(row.expected, 12); expect(row.p).toBe(1); expect(row.q).toBe(1); }
});
test("conditional tests are seeded, invariant to origin and positive scale, and do not mutate inputs", () => {
  const input = [3, 4, 9, 10, 30].map((value, i) => ({ key: String(i), value })),
    graph = { 0: ["1"], 1: ["0", "2"], 2: ["1", "3"], 3: ["2", "4"], 4: ["3"] },
    snapshot = structuredClone(input), a = localMoran(input, graph, { permutations: 99, seed: 12 }),
    b = localMoran(input.map((r) => ({ ...r, value: 2 * r.value + 8 })), graph, { permutations: 99, seed: 12 });
  expect(localMoran(input, graph, { permutations: 99, seed: 12 })).toEqual(a);
  a.rows.forEach((r, i) => { expect(r.I).toBeCloseTo(b.rows[i].I, 10); expect(r.p).toBe(b.rows[i].p); });
  expect(input).toEqual(snapshot);
});
test("islands, missing values and a constant collection never receive inferred significance", () => {
  const result = localMoran([{ key: "island", value: 5 }, { key: "missing", value: null }], {});
  expect(result.rows).toEqual([]); expect(result.excluded).toEqual(["island", "missing"]);
});
