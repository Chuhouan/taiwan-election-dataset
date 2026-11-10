/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    listCandidate,
    listMetric,
    formatListMetric,
    renderList,
    parseRegionRoute,
    highlightRegionList,
    wireRegionListEvents,
    wireMapListHover,
  });
  // Keyed region rows retain keyboard focus while sorting and filtering.
  ctx
    .$("#sort")
    .insertAdjacentHTML(
      "beforeend",
      '<option value="metric">目前指標由高到低</option>',
    );

  function listCandidate(r) {
    return ctx.state.metric === "runner"
      ? r.candidates[1]
      : ["share", "advantage", "difference", "bivariate"].includes(
            ctx.state.metric,
          )
        ? r.candidates.find((c) => c.name === ctx.state.candidate)
        : r.candidates[0];
  }
  function listMetric(r) {
    if (ctx.EXTRA_METRICS[ctx.state.metric]) return ctx.extraMetricValue(r);
    const c = ctx.listCandidate(r);
    return ctx.state.metric === "turnout"
      ? ctx.turnoutOf(r)
      : ctx.state.metric === "margin"
        ? ctx.marginOf(r)
        : c
          ? (c.votes / r.total) * 100
          : -1;
  }
  function formatListMetric(r) {
    const v = ctx.listMetric(r);
    return v == null
      ? "—"
      : ["leadVotes", "validVotes"].includes(ctx.state.metric)
        ? ctx.fmt(v)
        : v.toFixed(2);
  }
  function renderList() {
    if (ctx.goToProductMode && !document.body.classList.contains("list-open")) {
      if (ctx.state.drawer === "table") ctx.renderTable();
      return;
    }
    const rs = ctx.listRecords();
    ctx.$("#list-title").textContent = ctx.state.brushed.length
      ? "已選地區"
      : ctx.isLeg()
        ? "區域立委選區"
        : rs[0]?.town !== "000"
          ? "鄉鎮市區結果"
          : "縣市結果";
    ctx.$("#list-count").textContent = rs.length;
    ctx.$("#rank-value").textContent =
      ctx.state.sort === "votes"
        ? "有效票"
        : ctx.state.sort === "turnout"
          ? "投票率"
          : ctx.state.sort === "metric"
            ? "目前指標"
            : "差距";
    ctx.$(".list-column-head>span:first-child").textContent =
      "地區 / " +
      (ctx.state.metric === "runner"
        ? "第二名"
        : ctx.state.metric === "share"
          ? ctx.state.candidate
          : "第一名");
    ctx.$("#coverage").textContent = ctx.isLeg()
      ? "73 個區域選區"
      : ctx.state.brushed.length
        ? rs.length + " 個已選鄉鎮"
        : ctx.state.county
          ? ctx.data.counties[ctx.state.county] + " · " + rs.length + " 鄉鎮"
          : "22 縣市 · 368 鄉鎮";
    const before = new Map(
      ctx
        .$$(".region-row")
        .map((el) => [el.dataset.region, el.getBoundingClientRect().top]),
    );
    const rows = ctx.d3
      .select("#region-list")
      .selectAll(".region-row")
      .data(rs, ctx.keyOf)
      .join(
        (enter) => enter.append("button").attr("class", "region-row"),
        (update) => update,
        (exit) => exit.remove(),
      )
      .order()
      .attr("data-region", ctx.keyOf)
      .classed("active", (r) => ctx.keyOf(r) === ctx.state.key);
    rows.html((r) => {
      const c = ctx.listCandidate(r),
        value =
          ctx.state.sort === "votes"
            ? ctx.fmt(r.total)
            : ctx.state.sort === "turnout"
              ? ctx.pct(r.turnout)
              : ctx.state.sort === "metric"
                ? ctx.formatListMetric(r)
                : r.margin.toFixed(2),
        unit =
          ctx.state.sort === "votes"
            ? "張"
            : ctx.state.sort === "turnout"
              ? "投票率"
              : ctx.state.sort === "metric"
                ? (ctx.EXTRA_METRICS[ctx.state.metric]?.unit ??
                  ([
                    "advantage",
                    "difference",
                    "competitive",
                    "margin",
                  ].includes(ctx.state.metric)
                    ? "pp"
                    : "%"))
                : "百分點";
      return (
        '<span class="row-main"><span class="row-name">' +
        ctx.esc(ctx.areaName(r)) +
        '</span><span class="row-winner"><i style="background:' +
        ctx.color(c?.party) +
        '"></i>' +
        ctx.esc(c?.name || "無第二名") +
        " · " +
        ctx.pct(c?.share) +
        '</span></span><span class="row-value">' +
        value +
        "<small>" +
        unit +
        "</small></span>"
      );
    });
    rows
      .on("click", (_, r) =>
        ctx.selectRegion(
          ctx.keyOf(r),
          ctx.state.chart === "map" && !ctx.dualMode,
        ),
      )
      .on("pointerenter", (_, r) => {
        ctx.world
          ?.selectAll(".geo")
          .classed(
            "hovering",
            (f) =>
              ctx.geoKey(f) ===
              (ctx.isLeg() ? r.county + "/000" : ctx.keyOf(r)),
          );
      })
      .on("pointerleave", () =>
        ctx.world?.selectAll(".geo").classed("hovering", false),
      );
    if (!matchMedia("(prefers-reduced-motion:reduce)").matches)
      rows.each(function (r) {
        const previous = before.get(ctx.keyOf(r)),
          delta =
            previous == null ? 0 : previous - this.getBoundingClientRect().top;
        if (Math.abs(delta) > 1)
          this.animate(
            [
              { transform: "translateY(" + delta + "px)" },
              { transform: "translateY(0)" },
            ],
            { duration: 200, easing: "ease-out" },
          );
      });
    if (!ctx.goToProductMode || ctx.state.drawer === "table") ctx.renderTable();
  }
  // Add the metric sort to the shared route contract.
  function parseRegionRoute(p) {
    if (p.get("sort") === "metric") ctx.state.sort = "metric";
  }
  ctx.$$("[data-metric]").forEach(
    (button) =>
      (button.onclick = () => {
        ctx.state.metric = button.dataset.metric;
        ctx.state.sort = "metric";
        ctx.updateUI();
      }),
  );
  function highlightRegionList(key, r) {
    if (!r) return;
    ctx
      .$$(".region-row.hovering")
      .forEach((n) => n.classList.remove("hovering"));
    (
      document.querySelector('.region-row[data-region="' + key + '"]') ||
      document.querySelector('.region-row[data-region="' + r.county + '/000"]')
    )?.classList.add("hovering");
  }
  function wireRegionListEvents(selection) {
    selection.on("pointermove.list", (_, d) => {
      ctx
        .$$(".region-row.hovering")
        .forEach((n) => n.classList.remove("hovering"));
      document
        .querySelector('.region-row[data-region="' + d.key + '"]')
        ?.classList.add("hovering");
    });
  }
  function wireMapListHover() {
    ctx.world
      ?.selectAll(".geo")
      .on("pointerleave.list", () =>
        ctx
          .$$(".region-row.hovering")
          .forEach((n) => n.classList.remove("hovering")),
      );
  }
}
