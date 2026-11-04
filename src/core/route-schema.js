import { cameraFromRoute } from "./router.js";

export const routeEnums = {
  e: ["president", "legislator"], chart: ["map", "hex", "bubble", "ternary", "small", "scatter"],
  l: ["county", "town"], sort: ["margin", "name", "votes", "turnout", "metric"],
  distribution: ["swarm", "scatter", "histogram", "ecdf", "box", "dumbbell"],
  export: ["range", "selected", "all"], drawer: ["table", "compare"],
  split: ["40", "50", "60"], focus: ["map", "chart", "both"],
  "f-logic": ["and", "or"], "f-mode": ["replace", "intersection", "union", "highlight"],
  "point-color": ["party", "county"], "point-size": ["fixed", "votes"],
  "density-mode": ["points", "contour", "hexbin"], "density-weight": ["regions", "votes"],
  "bubble-layout": ["geo", "rank", "pack", "bar"], "bubble-panel": ["rank", "chart"],
  "hex-layout": ["geo", "party", "margin", "votes"], "hex-labels": ["simple", "standard", "detail"],
  "axis-x": ["turnout", "margin", "share", "votes"], "axis-y": ["turnout", "margin", "share", "votes"],
  "axis-color": ["party", "county"], "axis-size": ["fixed", "votes"],
  "plot-xScale": ["linear", "log"], "plot-yScale": ["linear", "log"],
  "map-encoding": ["area", "margin", "symbols"], "color-mode": ["standard", "accessible"],
  "label-density": ["sparse", "standard", "rich"], "boundary-style": ["county", "town", "subtle"],
  "island-insets": ["compact", "expanded"], seats: ["full", "regional"], "seat-focus": ["all", "區域", "不分區", "原住民"],
};
const binary = ["dual", "detail", "list", "labels", "groups", "relative", "difference", "small-reverse", "inspect", "ternary-focus", "density", "focus-mode"];
const booleans = ["ternary-references", "ternary-extremes", ...["quadrants", "trend", "labels", "brush", "neutral"].map((k) => "plot-" + k)];
const candidates = ["賴清德", "侯友宜", "柯文哲"];
export function validateRoute(input, { records, counties, extraMetrics = [] } = {}) {
  const p = new URLSearchParams(input), corrected = new Set();
  const remove = (key) => { p.delete(key); corrected.add(key); };
  const enums = { ...routeEnums, m: ["winner", "runner", "margin", "turnout", "share", ...extraMetrics] };
  if (!p.has("m") && p.has("v") && enums.m.includes(p.get("v"))) { p.set("m", p.get("v")); p.delete("v"); }
  for (const [key, allowed] of Object.entries(enums)) if (p.has(key) && !allowed.includes(p.get(key))) remove(key);
  for (const key of binary) if (p.has(key) && !["0", "1"].includes(p.get(key))) remove(key);
  for (const key of booleans) if (p.has(key) && !["true", "false"].includes(p.get(key))) remove(key);
  for (const key of ["candidate", "candidate-b", "other", "f-candidate", "reference-candidate"])
    if (p.has(key) && !candidates.includes(p.get(key))) remove(key);
  for (const key of ["f-share", "f-turnout", "f-margin", "reference-share"])
    if (p.has(key) && (p.get(key).trim() === "" || !Number.isFinite(+p.get(key)) || +p.get(key) < 0 || +p.get(key) > 100)) remove(key);
  for (const [key, max] of [["camera", 28], ["ternary-camera", 6], ["small-camera", 12], ["history-camera", 12], ["village-camera", 28]])
    if (p.has(key) && !cameraFromRoute(p.get(key), max)) remove(key);
  const election = p.get("e") || "president", rs = records?.[election];
  for (const key of ["c", "context-county"]) if (p.has(key) && counties && !counties[p.get(key)]) remove(key);
  if (p.has("r") && rs && !rs[p.get("r")]?.total) remove("r");
  for (const key of ["selection", "pins", "group-a", "group-b", "f-base"]) {
    if (!p.has(key) || !rs) continue;
    const original = p.get(key), clean = [...new Set(original.split(","))]
      .filter((k) => rs[k]?.total > 0 && counties?.[rs[k].county]).slice(0, key === "pins" ? 3 : 368).join(",");
    if (clean !== original) { if (clean) p.set(key, clean); else p.delete(key); corrected.add(key); }
  }
  if (election === "legislator") {
    if (p.get("chart") === "ternary") { p.set("chart", "hex"); corrected.add("chart"); }
    if (p.has("m") && !["winner", "runner", "margin", "turnout"].includes(p.get("m"))) { p.set("m", "winner"); corrected.add("m"); }
    if (p.get("dual") === "1") { p.delete("dual"); corrected.add("dual"); }
  }
  for (const key of ["group-name-a", "group-name-b"])
    if (p.has(key)) p.set(key, p.get(key).trim().slice(0, 24));
  return { params: p, corrected: [...corrected] };
}
