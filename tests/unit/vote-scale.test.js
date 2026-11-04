import { test, expect } from "vitest";
import { rankVoteRegions } from "../../src/data/vote-scale.js";
test("vote concentration uses ballot weights, includes every region, and never mutates inputs", () => {
  const input = [
      { id: "small", total: 5 },
      { id: "large", total: 60 },
      { id: "mid", total: 35 },
    ],
    before = JSON.stringify(input),
    s = rankVoteRegions(input);
  expect(s.total).toBe(100);
  expect(s.halfCount).toBe(1);
  expect(s.topFive).toBe(100);
  expect(s.rows.map((d) => d.share)).toEqual([60, 35, 5]);
  expect(s.rows.map((d) => d.cumulative)).toEqual([60, 95, 100]);
  expect(JSON.stringify(input)).toBe(before);
});
test("empty or zero-vote inputs cannot create infinite contribution shares", () => {
  expect(rankVoteRegions([{ total: 0 }, { total: NaN }])).toEqual({
    rows: [],
    total: 0,
    halfCount: 0,
    topFive: 0,
  });
  const s = rankVoteRegions(
    Array.from({ length: 22 }, (_, i) => ({ total: i + 1 })),
  );
  expect(s.rows).toHaveLength(22);
  expect(s.rows.at(-1).cumulative).toBe(100);
  expect(s.halfCount).toBe(7);
});
