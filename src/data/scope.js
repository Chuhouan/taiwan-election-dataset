// Describe the existing statistical collection without mutating it.
export function describeScope(ctx) {
  if (ctx.isLeg() && ctx.state.chart === "small" && ctx.fullParliament) {
    const members = ctx.parliamentData?.members;
    return { area: "全臺", count: members ? members.filter((m) => ctx.seatInFocus(m)).length : 0,
      total: members?.length || 0, unit: "席次", kind: ctx.seatFocus && ctx.seatFocus !== "all" ? "席次聚焦" : "席次範圍", highlighted: null, pending: !members };
  }
  const rs = ctx.scoped(),
    legislator = ctx.isLeg(),
    countyUnits = !legislator && (rs.length ? rs[0].town === "000" :
      !ctx.filterActive && !ctx.state.county &&
      ((!ctx.dualMode && ["hex", "bubble"].includes(ctx.state.chart)) || ctx.state.level === "county")),
    universe = Object.values(ctx.records).filter((r) => ctx.valid(r) &&
      (legislator ? r.town === "000" : countyUnits ? r.town === "000" : r.town !== "000") &&
      (!ctx.state.county || r.county === ctx.state.county)),
    keys = new Set(rs.map(ctx.keyOf)),
    highlight = ctx.highlightOnlyActive
      ? ctx.highlightOnlyActive()
      : ctx.hasConditions() && ctx.filterSpec.mode === "highlight",
    highlighted = highlight ? ctx.conditionHighlight.filter((key) => keys.has(key)).length : null;
  return {
    area: ctx.state.county ? ctx.data.counties[ctx.state.county] : "全臺",
    count: rs.length,
    total: universe.length,
    unit: legislator ? "選區" : countyUnits ? "縣市" : "鄉鎮市區",
    kind: ctx.filterActive ? "條件篩選" : ctx.state.brushed.length ? "框選分析" : "分析範圍",
    highlighted,
  };
}
