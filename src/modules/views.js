import { seatLayout } from "../charts/seat-layout.js";
/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    renderNationalStable,
    renderDetailStable,
    overviewRecords,
    renderAlternativeLegend,
    chartTip,
    wireChart,
    wireChartBase,
    renderBrushDetail,
    drawRegionalSeatArc,
  });
  /* Additional views inspired by analytical election cartography; geometry is original. */
  ctx.COUNTY_ORDER = [
    "63000",
    "65000",
    "10017",
    "68000",
    "10018",
    "10004",
    "10005",
    "66000",
    "10007",
    "10008",
    "10009",
    "10020",
    "10010",
    "67000",
    "64000",
    "10013",
    "10002",
    "10015",
    "10014",
    "10016",
    "09020",
    "09007",
  ];
  ctx.COUNTY_TILES = {
    "09007": [-1, 0],
    "09020": [-1, 2],
    10016: [-1, 4],
    63000: [3, 0],
    10017: [4, 0],
    65000: [3, 1],
    68000: [2, 1],
    10018: [1, 2],
    10004: [2, 2],
    10005: [2, 3],
    10002: [4, 1],
    66000: [2, 4],
    10007: [1, 4],
    10008: [3, 4],
    10009: [0, 5],
    10020: [1, 5],
    10010: [2, 5],
    67000: [1, 6],
    64000: [2, 6],
    10013: [3, 6],
    10015: [4, 3],
    10014: [4, 5],
  };
  ctx.lastNational = "";
  ctx.lastDetail = "";
  ctx.altMode = "";
  ctx.altPositions = new Map();
  function renderNationalStable() {
    if (ctx.lastNational !== ctx.state.e) {
      ctx.renderNational();
      ctx.lastNational = ctx.state.e;
      ctx.d3
        .selectAll(".national-card")
        .style("opacity", 0.25)
        .transition()
        .duration(ctx.duration())
        .style("opacity", 1);
    } else
      ctx
        .$$("[data-national]")
        .forEach((b) =>
          b.classList.toggle(
            "selected",
            ctx.state.metric === "share" &&
              b.dataset.national === ctx.state.candidate,
          ),
        );
  }
  function renderDetailStable() {
    const sig =
      ctx.state.e +
      "|" +
      ctx.state.key +
      "|" +
      ctx.state.county +
      "|" +
      ctx.state.level +
      "|" +
      ctx.state.chart +
      "|" +
      ctx.state.metric +
      "|" +
      ctx.state.candidate +
      "|" +
      ctx.state.brushed.join(",");
    if (sig === ctx.lastDetail) return;
    ctx.lastDetail = sig;
    if (ctx.state.brushed.length && !ctx.state.key) ctx.renderBrushDetail();
    else {
      ctx.renderDetail();
      ctx.decorateDetailPresentation();
      ctx.presentDistrictSources();
    }
    ctx.d3
      .select("#detail-result")
      .interrupt()
      .style("opacity", 0.15)
      .style("transform", "translateY(5px)")
      .transition()
      .duration(Math.min(ctx.duration(), 240))
      .style("opacity", 1)
      .style("transform", "translateY(0px)");
  }
  function overviewRecords() {
    if (ctx.filterActive && !ctx.state.brushed.length) return [];
    if (ctx.state.brushed.length)
      return ctx.state.brushed.map((k) => ctx.records[k]).filter(ctx.valid);
    if (ctx.dualMode && !ctx.isLeg())
      return Object.values(ctx.records)
        .filter(
          (r) =>
            ctx.valid(r) &&
            (ctx.state.level === "county"
              ? r.town === "000"
              : r.town !== "000") &&
            (!ctx.state.county || r.county === ctx.state.county),
        )
        .sort(
          (a, b) =>
            ctx.COUNTY_ORDER.indexOf(a.county) -
            ctx.COUNTY_ORDER.indexOf(b.county),
        );
    return Object.values(ctx.records)
      .filter(
        (r) =>
          ctx.valid(r) &&
          (ctx.isLeg()
            ? r.town === "000"
            : ctx.state.county
              ? r.county === ctx.state.county && r.town !== "000"
              : ctx.goToProductMode
                ? (ctx.state.level === "county" ? r.town === "000" : r.town !== "000")
                : r.town === "000") &&
          (!ctx.state.county || r.county === ctx.state.county),
      )
      .sort(
        (a, b) =>
          ctx.COUNTY_ORDER.indexOf(a.county) -
            ctx.COUNTY_ORDER.indexOf(b.county) ||
          Number(a.district) - Number(b.district) ||
          Number(a.town) - Number(b.town),
      );
  }

  function renderAlternativeLegend() {
    let base =
      ctx.state.chart === "hex"
        ? ctx.isLeg()
          ? "每格 1 選區＝1 席"
          : ctx.overviewRecords().some((r) => r.town !== "000")
            ? "每格 1 鄉鎮市區"
            : "每格 1 縣市"
        : "圓面積 ∝ 有效票數";
    let desc =
      ctx.state.chart === "hex"
        ? "等格圖 · 面積一致，並非人口或票數比例"
        : "票數圖 · 位置經避讓調整，非精確地理座標";
    let title = {
      winner: "第一名政黨",
      runner: "第二名政黨",
      margin: "前兩名差距",
      turnout: "投票率",
      share: ctx.state.candidate + " 得票率",
      swing: ctx.state.swingParty + " 得票率變化",
    }[ctx.state.metric];
    let body = "";
    if (["winner", "runner"].includes(ctx.state.metric)) {
      let ps = [
        ...new Set(
          ctx
            .overviewRecords()
            .map((r) =>
              ctx.state.metric === "runner"
                ? r.candidates[1]?.party
                : r.candidates[0].party,
            )
            .filter(Boolean),
        ),
      ];
      body =
        '<div class="legend-parties">' +
        ps
          .map(
            (p) =>
              '<span><i style="background:' +
              ctx.color(p) +
              '"></i>' +
              ctx.esc(p) +
              "</span>",
          )
          .join("") +
        "</div>";
    } else {
      let sample = ctx.overviewRecords()[0];
      body = ctx.legendRamp(
        ctx.d3.range(7).map((i) => {
          if (ctx.state.metric === "margin")
            return ctx.d3.interpolateRgbBasis([
              "#fff3dd",
              "#f9bf76",
              "#df684b",
              "#a42f47",
            ])(i / 6);
          if (ctx.state.metric === "turnout")
            return ctx.d3.interpolateRgb("#eee9f0", "#66507a")(i / 6);
          if (ctx.state.metric === "share")
            return ctx.d3.interpolateRgb(
              "#e6edf3",
              ctx.color(
                sample?.candidates.find((c) => c.name === ctx.state.candidate)
                  ?.party,
              ),
            )(i / 6);
          return ctx.d3.interpolateRgbBasis(["#4779b3", "#f3f4f5", "#d8803b"])(
            i / 6,
          );
        }),
        ctx.state.metric === "margin"
          ? ["0", "差距（百分點）", "35+"]
          : ctx.state.metric === "turnout"
            ? ["30%", "投票率", "85%+"]
            : ctx.state.metric === "share"
              ? ["0%", "得票率", "65%+"]
              : ["−25", "2024−2020（pp）", "+25"],
      );
    }
    if (ctx.EXTRA_METRICS[ctx.state.metric]) {
      ctx.$("#legend").innerHTML =
        ctx.extraMetricLegend() +
        '<div class="legend-foot">' +
        base +
        " · " +
        desc +
        "</div>";
      ctx.$("#view-description").textContent = desc;
      return;
    }
    ctx.$("#legend").innerHTML =
      '<div class="legend-title">' +
      base +
      " · " +
      ctx.esc(title) +
      "</div>" +
      body +
      '<div class="legend-foot">' +
      desc +
      (ctx.state.metric === "runner" ? " · 灰色＝無第二名" : "") +
      "</div>";
    ctx.$("#view-description").textContent = desc;
    ctx.$("#chart-coordinate").textContent =
      ctx.state.chart === "hex"
        ? "EQUAL AREA / " + ctx.overviewRecords().length + " UNITS"
        : "VOTE-WEIGHTED / " + ctx.overviewRecords().length + " REGIONS";
  }
  function chartTip(ev, r) {
    const tip = ctx.$("#map-tooltip");
    if (ctx.showLinkedReading && (ctx.dualMode || ctx.state.chart === "ternary")) {
      ctx.showLinkedReading(r); tip.hidden = true; return;
    }
    tip.innerHTML =
      '<div class="tip-place">' +
      ctx.esc(ctx.areaName(r, true)) +
      "</div>" +
      (ctx.markReadout ? '<div class="tip-current">' + ctx.esc(ctx.chartReading?.(r) || ctx.markReadout(r).text) + '</div>' : '') +
      r.candidates
        .slice(0, 3)
        .map(
          (c, i) =>
            '<div class="tip-row"><span><i style="background:' +
            ctx.color(c.party) +
            '"></i>' +
            (i + 1) +
            " " +
            ctx.esc(c.name) +
            "</span><b>" +
            ctx.pct(c.share) +
            "</b></div>",
        )
        .join("") +
      '<div class="tip-bottom"><span>' +
      ctx.fmt(r.total) +
      " 張有效票</span><span>差距 " +
      r.margin.toFixed(2) +
      " pp</span></div>";
    tip.hidden = false;
    const b = ctx.$("#map-host").getBoundingClientRect(),
      tw = 245,
      start = ctx.dualMode && ctx.dualFocus === "both" ? b.width : 0,
      end = start + ctx.chartDimensions().width;
    tip.style.left =
      Math.max(start + 8, Math.min(end - tw, ev.clientX - b.left + 16)) + "px";
    tip.style.top =
      Math.max(105, Math.min(b.height - 195, ev.clientY - b.top - 75)) + "px";
  }
  function wireChart(selection) {
    ctx.wireChartBase(selection);
    ctx.wireRegionListEvents(selection);
  }
  function wireChartBase(selection) {
    selection
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("data-region-key", (d) => d.key)
      .attr("data-votes", (d) => d.r.total)
      .attr("aria-label", (d) => {
        const result =
          ctx.state.chart === "ternary"
            ? d.r.candidates
                .slice(0, 3)
                .map((c) => c.name + " " + ctx.pct((c.votes / d.r.total) * 100))
                .join("；")
            : ctx.state.chart === "scatter" && ctx.state.distribution === "ecdf"
              ? ctx.state.candidate +
                " " +
                ctx.pct(d.x) +
                "；累積地區比例 " +
                ctx.pct(d.y)
              : ctx.state.chart === "scatter" && ctx.chartReading
                ? ctx.chartReading(d.r)
              : ["hex", "bubble"].includes(ctx.state.chart)
                ? ctx.markReadout(d.r).text
                : "前兩名差距 " + d.r.margin.toFixed(2) + " 百分點";
        return (
          ctx.areaName(d.r, true) +
          "；" +
          result +
          "；" +
          ctx.fmt(d.r.total) +
          "有效票"
        );
      })
      .on("focus", (event, d) => {
        const box = event.currentTarget.getBoundingClientRect();
        ctx.chartTip({ clientX: box.right, clientY: box.top }, d.r);
      })
      .on("blur", () => {
        ctx.$("#map-tooltip").hidden = true;
      })
      .on("pointerenter.local", (event, d) => {
        ctx.d3.selectAll(".unit").classed("hovering", (n) => n.key === d.key);
      })
      .on("pointerleave.local", () => {
        ctx.d3.selectAll(".unit").classed("hovering", false);
      })
      .on("focus.local", (event, d) => {
        ctx.d3.selectAll(".unit").classed("hovering", (n) => n.key === d.key);
      })
      .on("blur.local", () => {
        ctx.d3.selectAll(".unit").classed("hovering", false);
      })
      .on("pointermove", (ev, d) => {
        ctx.chartTip(ev, d.r);
        ctx
          .$$(".region-row.hovering")
          .forEach((n) => n.classList.remove("hovering"));
        document
          .querySelector(
            '.region-row[data-region="' +
              (ctx.isLeg() ? d.key : d.r.county + "/000") +
              '"]',
          )
          ?.classList.add("hovering");
      })
      .on("pointerleave", () => {
        ctx.$("#map-tooltip").hidden = true;
        ctx
          .$$(".region-row.hovering")
          .forEach((n) => n.classList.remove("hovering"));
      })
      .on("click", (ev, d) => {
        ev.stopPropagation();
        ctx.selectRegion(d.key, false);
      })
      .on("keydown", (ev, d) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.selectRegion(d.key, false);
        }
      });
  }

  function renderBrushDetail() {
    const rs = ctx.state.brushed.map((k) => ctx.records[k]).filter(ctx.valid),
      tot = ctx.d3.sum(rs, (r) => r.total),
      cast = ctx.d3.sum(rs, (r) => r.cast),
      eligible = ctx.d3.sum(rs, (r) => r.eligible);
    const cs = ctx.records["00000/000"].candidates
      .map((c) => ({
        ...c,
        votes: ctx.d3.sum(
          rs,
          (r) => r.candidates.find((x) => x.name === c.name)?.votes || 0,
        ),
      }))
      .sort((a, b) => b.votes - a.votes);
    cs.forEach((c) => (c.share = (c.votes / tot) * 100));
    const margin = ((cs[0].votes - cs[1].votes) / tot) * 100;
    ctx.$("#detail-title").textContent = rs.length + " 個地區";
    ctx.$("#detail-scope").textContent =
      (ctx.filterActive ? "條件篩選合計" : "框選合計") + " · 同一場選舉";
    ctx.$("#detail-stats").innerHTML =
      '<div class="detail-stat"><small>有效票合計</small><strong>' +
      ctx.fmt(tot) +
      '</strong></div><div class="detail-stat"><small>投票率</small><strong>' +
      ctx.pct((cast / eligible) * 100) +
      "</strong></div>";
    ctx.$("#detail-result").innerHTML = ctx.resultCandidates({
      candidates: cs,
    });
    ctx
      .$$("#detail-result .elected")
      .forEach((n) => (n.textContent = "全國當選"));
    ctx.$("#detail-chart").innerHTML =
      '<div class="chart-caption"><span>所選地區前兩名差距</span><span>' +
      ctx.fmt(cs[0].votes - cs[1].votes) +
      ' 票</span></div><div class="margin-callout"><strong>' +
      margin.toFixed(2) +
      "</strong><span>百分點</span></div>";
    ctx.$("#detail-note").textContent =
      "依已框選地區票數加總；未將百分比直接平均。";
  }

  function drawRegionalSeatArc() {
    const host = ctx.chartDimensions(),
      cw = host.width,
      ch = Math.max(350, host.height),
      svg = ctx.d3.select("#scatter").attr("viewBox", `0 0 ${cw} ${ch}`);
    svg.selectAll("*").remove();
    ctx.altMode = "seats";
    const rs = Object.values(ctx.records)
      .filter(
        (r) =>
          ctx.valid(r) &&
          r.town === "000" &&
          (!ctx.state.county || r.county === ctx.state.county),
      )
      .sort(
        (a, b) =>
          ["民進黨", "國民黨", "無黨籍"].indexOf(ctx.winner(a).party) -
          ["民進黨", "國民黨", "無黨籍"].indexOf(ctx.winner(b).party),
      );
    const {
      radius: R,
      cx,
      cy,
      slots,
    } = seatLayout(
      cw,
      ch,
      Math.max(170, ctx.chartToolsBottom()),
      rs.length === 73 ? [10, 13, 15, 17, 18] : [rs.length],
    );
    const nodes = rs.map((r, i) => ({ r, key: ctx.keyOf(r), ...slots[i] }));
    const dots = svg
      .selectAll(".seat-dot")
      .data(nodes)
      .join("circle")
      .attr("class", "seat-dot")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", Math.max(4, Math.min(9, R / 26)))
      .attr("fill", (d) => ctx.color(ctx.winner(d.r).party))
      .attr("stroke", (d) => (d.key === ctx.state.key ? "#17334e" : "white"))
      .attr("stroke-width", (d) => (d.key === ctx.state.key ? 3 : 1.5));
    ctx.wireChart(dots);
    svg
      .append("text")
      .attr("x", cx)
      .attr("y", cy - 55)
      .attr("text-anchor", "middle")
      .attr("class", "seat-total")
      .style("font-size", "32px")
      .text(rs.length + " 席");
    svg
      .append("text")
      .attr("x", cx)
      .attr("y", cy - 28)
      .attr("text-anchor", "middle")
      .attr("class", "small-name")
      .text("區域類別 · 全院113席，過半57席");
    ctx.$("#legend").innerHTML =
      '<div class="legend-title">每點一席 · 僅含區域立委</div><div class="legend-foot">示意排列，非實際座次；不含原住民與不分區。</div>';
    ctx.$("#view-description").textContent =
      "區域立委席次示意 · 點選議席查看選區結果";
    ctx.$("#chart-coordinate").textContent = "PARLIAMENT / REGIONAL SEATS";
  }
}
