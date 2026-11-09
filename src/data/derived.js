/** src/data/derived.js — explicit visualization service dependencies. */
export function install(ctx) {
  Object.assign(ctx, {
    extraMetricValue,
    metricDomainMaximum,
    extraMetricColor,
    extraMetricLegend,
    metricValue,
    fill,
  });
  function extraMetricValue(r) {
    if (!r || !r.total) return null;
    const shares = r.candidates.map((c) => c.votes / r.total);
    switch (ctx.state.metric) {
      case "leadVotes":
        return r.candidates[0].votes - (r.candidates[1]?.votes || 0);
      case "advantage":
        return (
          ctx.shareOf(r, ctx.state.candidate) -
          ctx.shareOf(ctx.records["00000/000"], ctx.state.candidate)
        );
      case "difference":
        return (
          ctx.shareOf(r, ctx.state.candidate) -
          ctx.shareOf(r, ctx.state.otherCandidate || "侯友宜")
        );
      case "validVotes":
        return r.total;
      case "competitive":
        return ctx.marginOf(r);
      case "enp":
        return ctx.metrics.effectiveCandidates(
          r.candidates.map((c) => c.votes),
          r.total,
        );
      case "concentration":
        return ctx.metrics.concentration(
          r.candidates.map((c) => c.votes),
          r.total,
        );
      case "bivariate":
        return ctx.shareOf(r, ctx.state.candidate);
    }
  }

  function metricDomainMaximum() {
    if (ctx.metricMaximumRecords !== ctx.records) {
      ctx.metricMaximumRecords = ctx.records;
      ctx.metricMaximumCache.clear();
    }
    const level =
        !ctx.dualMode && ["hex", "bubble"].includes(ctx.state.chart)
          ? ctx.overviewRecords().some((r) => r.town !== "000")
            ? "town"
            : "county"
          : ctx.state.level,
      key = level + "|" + ctx.state.metric;
    if (!ctx.metricMaximumCache.has(key))
      ctx.metricMaximumCache.set(
        key,
        ctx.d3.max(
          Object.values(ctx.records).filter(
            (r) =>
              ctx.valid(r) &&
              (level === "county" ? r.town === "000" : r.town !== "000"),
          ),
          (r) => ctx.extraMetricValue(r),
        ) || 1,
      );
    return ctx.metricMaximumCache.get(key);
  }

  function extraMetricColor(r) {
    const v = ctx.extraMetricValue(r);
    if (v == null) return "#d3dce6";
    if (["advantage", "difference"].includes(ctx.state.metric))
      return ctx.d3
        .scaleLinear()
        .domain([-50, 0, 50])
        .range(["#a55335", "#f6f6f4", "#326d85"])
        .clamp(true)(v);
    if (ctx.state.metric === "competitive")
      return ["#f1d7aa", "#e9a974", "#cb6a4c", "#8c3b4c"][
        v <= 1 ? 0 : v <= 5 ? 1 : v <= 10 ? 2 : 3
      ];
    if (ctx.state.metric === "bivariate") {
      const share = ctx.shareOf(r, ctx.state.candidate),
        turnout = ctx.turnoutOf(r);
      return ctx.BIVARIATE_COLORS[turnout < 65 ? 0 : turnout < 75 ? 1 : 2][
        share < 25 ? 0 : share < 35 ? 1 : 2
      ];
    }
    return ctx.d3.interpolateRgb(
      "#ecf0ed",
      "#315e65",
    )(
      Math.min(
        1,
        ctx.state.metric === "enp"
          ? (v - 1) / 2
          : ctx.state.metric === "concentration"
            ? v
            : v / ctx.metricDomainMaximum(),
      ),
    );
  }

  function extraMetricLegend() {
    const metric = ctx.EXTRA_METRICS[ctx.state.metric];
    if (!metric) return "";
    let body = "";
    if (ctx.state.metric === "bivariate")
      body =
        '<div class="bivariate-legend"><span class="bivariate-y">投票率 →</span><div class="bivariate-matrix">' +
        ctx.BIVARIATE_COLORS.slice()
          .reverse()
          .map((row, i) =>
            row
              .map(
                (c, j) =>
                  '<i class="bivariate-cell" data-bi="' +
                  (2 - i) +
                  "-" +
                  j +
                  '" style="background:' +
                  c +
                  '" title="得票率 ' +
                  ["<25%", "25–<35%", "≥35%"][j] +
                  "；投票率 " +
                  ["≥75%", "65–<75%", "<65%"][i] +
                  '；點選僅高亮對應地區"></i>',
              )
              .join(""),
          )
          .join("") +
        '</div><span>得票率 →</span></div><div class="legend-foot bivariate-thresholds"><span>得票率分界 25%／35%；</span><span>投票率分界 65%／75%</span></div>';
    else if (ctx.state.metric === "competitive")
      body =
        '<div class="legend-parties">' +
        ["≤1", "1–5", "5–10", ">10"]
          .map(
            (v, i) =>
              '<span><i style="background:' +
              ["#f1d7aa", "#e9a974", "#cb6a4c", "#8c3b4c"][i] +
              '"></i>' +
              v +
              " pp</span>",
          )
          .join("") +
        "</div>";
    else {
      const diverging = ["advantage", "difference"].includes(ctx.state.metric),
        max =
          ctx.state.metric === "enp"
            ? 3
            : ctx.state.metric === "concentration"
              ? 1
              : ctx.metricDomainMaximum(),
        colors = ctx.d3
          .range(9)
          .map((i) =>
            diverging
              ? ctx.d3
                  .scaleLinear()
                  .domain([-50, 0, 50])
                  .range(["#a55335", "#f6f6f4", "#326d85"])(-50 + i * 12.5)
              : ctx.d3.interpolateRgb("#ecf0ed", "#315e65")(i / 8),
          );
      body =
        ctx.legendRamp(
          colors,
          diverging
            ? ["≤−50 pp", "0", "≥+50 pp"]
            : [
                ctx.state.metric === "enp" ? "1" : "0",
                (Math.round(max * 50) / 100) + (metric.unit ? " " + metric.unit : ""),
                String(Math.round(max * 100) / 100),
              ],
        ) +
        '<div class="legend-na"><i></i>無資料／NA · 不進入色階</div>';
    }
    return (
      '<div class="legend-title">' +
      ctx.esc(
        ctx.state.metric === "bivariate"
          ? ctx.state.candidate + "得票率 × 投票率"
          : ctx.state.metric === "advantage"
            ? ctx.state.candidate + " − 全國平均"
            : ctx.state.metric === "difference"
              ? ctx.state.candidate +
                " − " +
                (ctx.state.otherCandidate || "侯友宜")
              : metric.title,
      ) +
      "</div>" +
      body +
      (["enp", "concentration"].includes(ctx.state.metric)
        ? '<div class="legend-foot">' +
          (ctx.state.metric === "enp" ? "ENP = 1 / Σp²" : "HHI = Σp²") +
          "；p為候選人有效票占比，描述分散程度，不代表政治極化。</div>"
        : "")
    );
  }

  function metricValue(r, key) {
    if (!r) return null;
    if (ctx.EXTRA_METRICS[ctx.state.metric]) return ctx.extraMetricValue(r);
    if (ctx.state.metric === "turnout") return r.turnout;
    if (ctx.state.metric === "share") {
      const c = r.candidates.find((c) => c.name === ctx.state.candidate);
      return c ? c.share : null;
    }
    if (ctx.state.metric === "swing") return ctx.swing(key);
    return r.margin;
  }

  function fill(r, key) {
    if (!r || !r.total)
      return ctx.isLeg() && ctx.state.chart === "map"
        ? "#dce2e7"
        : "url(#" +
            (ctx.state.chart === "map" ? "map" : "scatter") +
            "-missing)";
    if (ctx.isLeg() && ctx.state.chart === "map") return "#cbd6e1";
    if (ctx.EXTRA_METRICS[ctx.state.metric]) return ctx.extraMetricColor(r);
    if (ctx.state.metric === "runner")
      return r.candidates[1] ? ctx.color(r.candidates[1].party) : "#cbd6e1";
    if (ctx.state.metric === "winner") return ctx.color(r.candidates[0].party);
    let v = ctx.metricValue(r, key);
    if (v == null) return "#d3dce6";
    if (ctx.state.metric === "margin")
      return ctx.d3.interpolateRgbBasis([
        "#fff3dd",
        "#f9bf76",
        "#df684b",
        "#a42f47",
      ])(Math.min(v / 35, 1));
    if (ctx.state.metric === "turnout")
      return ctx.d3.interpolateRgb(
        "#eee9f0",
        "#66507a",
      )(Math.max(0, Math.min(1, (v - 30) / 55)));
    if (ctx.state.metric === "share") {
      const c = r.candidates.find((c) => c.name === ctx.state.candidate);
      return ctx.d3.interpolateRgb(
        "#e6edf3",
        ctx.color(c.party),
      )(Math.min(v / 65, 1));
    }
    return v < 0
      ? ctx.d3.interpolateRgb("#f3f4f5", "#4779b3")(Math.min(-v / 25, 1))
      : ctx.d3.interpolateRgb("#f3f4f5", "#d8803b")(Math.min(v / 25, 1));
  }
}
