import { describe, it, expect } from "vitest";
import { validateRoute } from "../../src/core/route-schema.js";
const options = { counties: { a: "甲縣" }, records: { president: { "a/001": { total: 10, county: "a" } }, legislator: {} }, extraMetrics: ["enp"] };
describe("route schema", () => {
  it.each([
    ["chart=nope", "chart"], ["m=bogus", "m"], ["l=world", "l"], ["e=2032", "e"], ["candidate=missing", "candidate"],
    ["f-share=-1", "f-share"], ["f-margin=Infinity", "f-margin"], ["f-turnout=101", "f-turnout"], ["f-share=", "f-share"],
    ["camera=0,0,0", "camera"], ["ternary-camera=7,0,0", "ternary-camera"], ["camera=2,1e100,0", "camera"], ["camera=2,NaN,0", "camera"],
    ["group-a=missing", "group-a"], ["r=missing", "r"], ["c=wrong", "c"], ["pins=wrong", "pins"], ["dual=true", "dual"],
    ["axis-x=foo", "axis-x"], ["point-size=huge", "point-size"], ["reference-share=1000", "reference-share"],
    ["seat-focus=misnamed", "seat-focus"], ["focus=sky", "focus"], ["split=99", "split"], ["context-county=z", "context-county"],
  ])("reports and removes invalid %s", (raw, key) => {
    const result = validateRoute(raw, options);
    expect(result.corrected).toContain(key);
    expect(result.params.has(key)).toBe(false);
  });
  it.each([
    "e=president&chart=ternary&m=enp&l=town", "seats=regional&seat-focus=不分區",
    "f-mode=highlight&f-share=30&f-turnout=70&f-margin=5", "camera=2,0.1,-0.1&ternary-camera=6,0,0",
    "selection=a/001&group-a=a/001&candidate=柯文哲", "density-mode=hexbin&density-weight=votes",
  ])("preserves valid %s", (raw) => expect(validateRoute(raw, options).corrected).toEqual([]));
  it("normalizes incompatible legislature modes", () => {
    const result = validateRoute("e=legislator&chart=ternary&m=share&dual=1", options);
    expect(result.params.get("chart")).toBe("hex"); expect(result.params.get("m")).toBe("winner"); expect(result.params.has("dual")).toBe(false);
  });
  it("deduplicates known selections and preserves unowned lazy feature parameters", () => {
    const result = validateRoute("selection=a/001,a/001,bad&national-history=2024", options);
    expect(result.params.get("selection")).toBe("a/001"); expect(result.params.get("national-history")).toBe("2024");
  });
});
