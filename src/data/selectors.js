/** src/data/selectors.js — explicit visualization service dependencies. */
export function install(ctx) {
  Object.assign(ctx, {
    isLeg,
    rec,
    valid,
    areaName,
    keyOf,
    winner,
    marginOf,
    turnoutOf,
    shareOf,
    scoped,
    listRecords,
    sortRecords,
    partyShare,
    swing,
  });
  function isLeg() {
    return ctx.state.e === "legislator";
  }

  function rec(key = ctx.state.key) {
    return ctx.records[key || "00000/000"];
  }

  function valid(r) {
    return r && ctx.data.counties[r.county] && r.total > 0;
  }

  function areaName(r, full = false) {
    if (!r) return "全臺";
    const c = ctx.data.counties[r.county] || "全臺";
    if (ctx.isLeg()) return c + " · 第" + Number(r.district) + "選區";
    return r.town === "000" ? c : (full ? c + " · " : "") + r.name;
  }

  function keyOf(r) {
    return r.county + (ctx.isLeg() ? ":" + r.district : "") + "/" + r.town;
  }

  function winner(r) {
    return r.candidates.find((c) => c.elected) || r.candidates[0];
  }

  function marginOf(r) {
    return r?.total
      ? ((r.candidates[0].votes - (r.candidates[1]?.votes || 0)) / r.total) *
          100
      : null;
  }

  function turnoutOf(r) {
    return r?.eligible ? (r.cast / r.eligible) * 100 : null;
  }

  function shareOf(r, name) {
    const c = r?.candidates.find((c) => c.name === name);
    return c && r.total ? (c.votes / r.total) * 100 : null;
  }

  function scoped() {
    if (ctx.filterActive && !ctx.state.brushed.length) return [];
    if (ctx.state.brushed.length)
      return ctx.state.brushed.map((k) => ctx.records[k]).filter(ctx.valid);
    if (ctx.state.chart === "hex" || ctx.state.chart === "bubble")
      return ctx.overviewRecords();
    return Object.values(ctx.records).filter(
      (r) =>
        ctx.valid(r) &&
        (ctx.isLeg()
          ? r.town === "000"
          : ctx.state.county
            ? r.county === ctx.state.county && r.town !== "000"
            : ctx.state.level === "town"
              ? r.town !== "000"
              : r.town === "000") &&
        (!ctx.state.county || r.county === ctx.state.county),
    );
  }

  function listRecords() {
    return ctx.sortRecords(ctx.scoped());
  }

  function sortRecords(rs) {
    if (ctx.state.sort === "metric")
      return rs.sort((a, b) => ctx.listMetric(b) - ctx.listMetric(a));
    return rs.sort((a, b) =>
      ctx.state.sort === "name"
        ? ctx.areaName(a).localeCompare(ctx.areaName(b), "zh-Hant")
        : ctx.state.sort === "votes"
          ? b.total - a.total
          : ctx.state.sort === "turnout"
            ? (b.turnout || 0) - (a.turnout || 0)
            : a.margin - b.margin,
    );
  }

  function partyShare(r, p) {
    return r
      ? (r.candidates
          .filter((c) => c.party === p)
          .reduce((s, c) => s + c.votes, 0) /
          r.total) *
          100
      : null;
  }

  function swing(key, p = ctx.state.swingParty) {
    const a = ctx.data.president[key],
      b = ctx.data.president2020?.[key];
    return a && b ? ctx.partyShare(a, p) - ctx.partyShare(b, p) : null;
  }
}
