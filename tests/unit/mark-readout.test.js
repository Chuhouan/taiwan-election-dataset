import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { markReadout } from "../../src/data/mark-readout.js";

const data = JSON.parse(
  readFileSync(new URL("../../dist/data.json", import.meta.url), "utf8"),
);
const r = data.president["10004/000"];
function context(metric) {
  return {
    state: { metric, candidate: "賴清德", otherCandidate: "侯友宜" },
    areaName: (row) => row.name,
    keyOf: (row) => row.county + "/" + row.town,
    metricDefinition: () => ({
      title: metric === "turnout" ? "投票率" : "得票率差",
    }),
    EXTRA_METRICS: { difference: {}, bivariate: {} },
    extraMetricValue: (row) =>
      (100 *
        (row.candidates.find((c) => c.name === "賴清德").votes -
          row.candidates.find((c) => c.name === "侯友宜").votes)) /
      row.total,
    marginOf: (row) =>
      (100 * (row.candidates[0].votes - row.candidates[1].votes)) / row.total,
    turnoutOf: (row) => (100 * row.cast) / row.eligible,
    fmt: (value) => value.toLocaleString("en-US"),
    pct: (value) => value.toFixed(2) + "%",
  };
}
describe("one metric, one correctly named readout", () => {
  it("labels Hsinchu's selected candidate, not its local winner", () => {
    expect(markReadout(context("share"), r).text).toBe("賴清德 27.42%");
    expect(markReadout(context("winner"), r).text).toBe("侯友宜 37.03%");
  });
  it("turnout and candidate differences do not inherit a winner's name", () => {
    const turnout = markReadout(context("turnout"), r);
    expect(turnout.candidate).toBe("");
    expect(turnout.text).toMatch(/^投票率 \d+\.\d{2}%$/);
    const difference = markReadout(context("difference"), r);
    expect(difference.candidate).toBe("");
    expect(difference.text).toMatch(/^賴清德 − 侯友宜 -9\.61 個百分點$/);
  });
  it("missing candidates produce no fabricated percentage", () => {
    const ctx = context("share");
    ctx.state.candidate = "未提名";
    expect(markReadout(ctx, r).formatted).toBe("—");
  });
});
