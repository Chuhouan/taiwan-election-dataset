import { selectionTransition } from "../../src/core/selection.js";
import { test, expect } from "vitest";
import { createStore, bindFlatState } from "../../src/core/store.js";
import { createContext } from "../../src/core/context.js";
import {
  cameraFromRoute,
  comparableDifference,
} from "../../src/core/router.js";
import { createScheduler } from "../../src/core/dispatcher.js";
test("analysis, domain and independent presentation cameras have separate ownership", () => {
  const ctx = createContext({});
  ctx.state = { e: "president", brushed: [], chart: "ternary" };
  ctx.transform = { k: 2 };
  ctx.axes = { x: "share" };
  ctx.groupSelection = { a: ["63000/010"], b: [] };
  ctx.state.e = "legislator";
  expect(ctx.store.getState().domain.shared.e).toBe("legislator");
  expect(ctx.store.getState().analysis.groups.a).toEqual(["63000/010"]);
  expect(ctx.store.getState().presentation.left.camera.k).toBe(2);
  expect(ctx.store.getState().presentation.right.axes.x).toBe("share");
});
test("selectors notify only relevant subscribers, unsubscribe works", () => {
  const s = createStore({
    domain: { year: 2024 },
    presentation: { chart: "map" },
  });
  const seen = [];
  const off = s.subscribe(
    (s) => s.domain.year,
    (y) => seen.push(y),
  );
  s.set(["presentation", "chart"], "hex");
  s.set(["domain", "year"], 2020);
  off();
  s.set(["domain", "year"], 2016);
  expect(seen).toEqual([2020]);
});
test("invalid cameras and incomparable geography cannot produce changes", () => {
  expect(cameraFromRoute("2,0.2,-0.1")).toEqual([2, 0.2, -0.1]);
  for (const v of ["0,0,0", "29,0,0", "2,NaN,0", "1,2"])
    expect(cameraFromRoute(v)).toBeNull();
  expect(comparableDifference(40, 45, "B")).toBe(5);
  for (const grade of ["C", "D"])
    expect(comparableDifference(40, 45, grade)).toBeNull();
  expect(comparableDifference(null, 45, "A")).toBeNull();
});
test("scheduler coalesces a burst and preserves invalidation reasons", () => {
  let run;
  const calls = [];
  const q = createScheduler(
    (reasons) => calls.push(reasons),
    (fn) => ((run = fn), 1),
    () => {},
  );
  q.schedule("size");
  q.schedule("metric");
  expect(calls).toEqual([]);
  run();
  expect(calls).toEqual([["size", "metric"]]);
});

test("inspection preserves population and pinned sets; drilling explicitly changes county", () => {
  const state = { county: "", brushed: ["a"], pins: ["b"] };
  const r = { county: "63000" };
  expect(selectionTransition(state, "63000/010", r, false)).toEqual({
    key: "63000/010",
    county: "",
    inspection: true,
  });
  expect(state.brushed).toEqual(["a"]);
  expect(selectionTransition(state, "63000/010", r, true)).toEqual({
    key: "63000/010",
    county: "63000",
    inspection: false,
  });
});

test("ternary camera has its own presentation branch and validates deep links", () => {
  const ctx = createContext({});
  ctx.state = {};
  ctx.transform = { k: 3 };
  ctx.ternaryCamera = [2, 0.1, -0.1];
  expect(ctx.store.getState().presentation.right.camera).toEqual([
    2, 0.1, -0.1,
  ]);
  expect(ctx.store.getState().presentation.left.camera).toEqual({ k: 3 });
  expect(cameraFromRoute("7,0,0", 6)).toBeNull();
  expect(cameraFromRoute("2,0.1,-0.1", 6)).toEqual([2, 0.1, -0.1]);
});
