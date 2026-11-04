import { describe, expect, it } from "vitest";
import { describeScope } from "../../src/data/scope.js";

const town = (county, id) => ({ county, town: id, total: 100 });
function context(overrides = {}) {
  const a = town("a", "001"), b = town("a", "002"), c = town("b", "001"),
    ac = town("a", "000"), bc = town("b", "000");
  const records = { "a/001": a, "a/002": b, "b/001": c, "a/000": ac, "b/000": bc };
  return {
    state: { chart: "ternary", level: "town", county: "", brushed: [], key: "" },
    data: { counties: { a: "甲縣", b: "乙縣" } }, records,
    scoped: () => [a, b, c], valid: (r) => r.total > 0,
    keyOf: (r) => `${r.county}/${r.town}`, isLeg: () => false,
    filterActive: false, hasConditions: () => false,
    filterSpec: { mode: "replace" }, conditionHighlight: [],
    ...overrides,
  };
}
describe("analysis scope descriptions", () => {
  it("parliament describes seat types rather than the unrelated regional map collection", () => {
    const ctx = context({ isLeg: () => true, fullParliament: true, seatFocus: "不分區", parliamentData: { members: [{ type: "region" }, { type: "list" }, { type: "region" }, { type: "indigenous" }] }, seatInFocus: (m) => m.type === "list" });
    ctx.state.chart = "small";
    expect(describeScope(ctx)).toMatchObject({ count: 1, total: 4, kind: "席次聚焦", unit: "席次" });
    ctx.parliamentData = null;
    expect(describeScope(ctx).pending).toBe(true);
  });
  it("fixed inspection does not replace the statistical area", () => {
    const ctx = context();
    ctx.state.key = "a/001";
    expect(describeScope(ctx)).toMatchObject({ area: "全臺", count: 3, total: 3, kind: "分析範圍" });
  });
  it("brush is a statistical selection, not a highlight", () => {
    const ctx = context();
    ctx.state.brushed = ["a/001"];
    ctx.scoped = () => [ctx.records["a/001"]];
    expect(describeScope(ctx)).toMatchObject({ count: 1, total: 3, kind: "框選分析", highlighted: null });
  });
  it("highlight count refers to the unchanged analysis collection", () => {
    const ctx = context({ hasConditions: () => true, filterSpec: { mode: "highlight" }, conditionHighlight: ["a/001", "missing"] });
    expect(describeScope(ctx)).toMatchObject({ count: 3, total: 3, highlighted: 1 });
  });
  it("an empty filter retains its denominator and town unit", () => {
    const ctx = context({ filterActive: true, scoped: () => [] });
    expect(describeScope(ctx)).toMatchObject({ count: 0, total: 3, unit: "鄉鎮市區", kind: "條件篩選" });
  });
  it("county overview uses its actual units rather than the town toggle", () => {
    const ctx = context();
    ctx.state.chart = "hex";
    ctx.scoped = () => [ctx.records["a/000"], ctx.records["b/000"]];
    expect(describeScope(ctx)).toMatchObject({ count: 2, total: 2, unit: "縣市" });
  });
  it("a county drilldown uses a county denominator", () => {
    const ctx = context();
    ctx.state.county = "a";
    ctx.scoped = () => [ctx.records["a/001"], ctx.records["a/002"]];
    expect(describeScope(ctx)).toMatchObject({ area: "甲縣", count: 2, total: 2 });
  });
});
