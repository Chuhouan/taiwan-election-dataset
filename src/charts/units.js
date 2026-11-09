/** src/charts/units.js — explicit visualization service dependencies. */
export function install(ctx) {
  Object.assign(ctx, {
    hexPath,
    chartWinner,
    tileMetric,
    layoutHexUnits,
    drawHexRanking,
    drawPublicationHex,
    drawAlternative,
  });
  function hexPath(radius) {
    return (
      "M" +
      ctx.d3
        .range(6)
        .map((i) =>
          [
            Math.cos(((60 * i - 30) * Math.PI) / 180) * radius,
            Math.sin(((60 * i - 30) * Math.PI) / 180) * radius,
          ].join(","),
        )
        .join("L") +
      "Z"
    );
  }

  function chartWinner(r) {
    return ctx.state.metric === "runner"
      ? r.candidates[1] || { name: "無第二名", party: "無", share: null }
      : r.candidates[0];
  }

  function tileMetric(r) {
    if (ctx.EXTRA_METRICS[ctx.state.metric]) {
      const v = ctx.extraMetricValue(r);
      return v == null
        ? "—"
        : (["validVotes", "leadVotes"].includes(ctx.state.metric)
            ? ctx.fmt(v)
            : v.toFixed(2)) +
            " " +
            ctx.EXTRA_METRICS[ctx.state.metric].unit;
    }
    if (ctx.state.metric === "margin") return r.margin.toFixed(1) + " pp";
    if (ctx.state.metric === "turnout") return ctx.pct(r.turnout);
    if (ctx.state.metric === "swing") {
      const v = ctx.swing(ctx.keyOf(r));
      return v == null ? "—" : ctx.sign(v) + " pp";
    }
    if (ctx.state.metric === "share") {
      return ctx.pct(
        r.candidates.find((c) => c.name === ctx.state.candidate)?.share,
      );
    }
    return ctx.pct(ctx.chartWinner(r).share);
  }

  function layoutHexUnits(input, cw, ch, top, bottom) {
    let rs = input.slice();
    const countyLayout =
        ctx.chartOptions.hexLayout === "geo" &&
        !ctx.isLeg() &&
        !ctx.state.county &&
        rs.every((r) => r.town === "000"),
      summary = countyLayout && cw >= 900,
      plotWidth = summary ? cw * 0.57 : cw;
    if (ctx.chartOptions.hexLayout !== "geo")
      rs.sort((a, b) =>
        ctx.chartOptions.hexLayout === "party"
          ? ctx.d3.ascending(a.candidates[0].party, b.candidates[0].party) ||
            ctx.marginOf(b) - ctx.marginOf(a)
          : ctx.chartOptions.hexLayout === "margin"
            ? ctx.marginOf(a) - ctx.marginOf(b)
            : b.total - a.total,
      );
    const columns = Math.max(
        3,
        Math.ceil(
          Math.sqrt(
            ((rs.length * (plotWidth - 70)) / Math.max(80, bottom - top)) *
              0.866,
          ),
        ),
      ),
      positions = rs.map((r, i) => {
        const grid = countyLayout
          ? ctx.COUNTY_TILES[r.county]
          : [i % columns, Math.floor(i / columns)];
        return {
          r,
          key: ctx.keyOf(r),
          ux: (grid[0] + 0.5 * (grid[1] & 1)) * Math.sqrt(3),
          uy: grid[1] * 1.5,
        };
      }),
      minx = ctx.d3.min(positions, (d) => d.ux) - 1,
      maxx = ctx.d3.max(positions, (d) => d.ux) + 1,
      miny = ctx.d3.min(positions, (d) => d.uy) - 1,
      maxy = ctx.d3.max(positions, (d) => d.uy) + 1,
      rr = Math.max(
        9,
        Math.min(
          (plotWidth - 70) / (maxx - minx),
          (bottom - top) / (maxy - miny),
          countyLayout ? 120 : 90,
        ),
      );
    return {
      summary,
      nodes: positions.map((d) => ({
        ...d,
        x: plotWidth / 2 + (d.ux - (minx + maxx) / 2) * rr,
        y: (top + bottom) / 2 + (d.uy - (miny + maxy) / 2) * rr,
        radius: rr - 2,
      })),
    };
  }

  function drawHexRanking(svg, rs, cw, top, bottom, publication = false) {
    svg.selectAll(".hex-ranking").remove();
    const g = svg.append("g").attr("class", "hex-ranking"),
      left = cw * 0.62,
      right = cw - 30,
      low = ["winner", "runner", "margin", "competitive"].includes(
        ctx.state.metric,
      ),
      value = (r) =>
        ["winner", "runner", "margin", "competitive"].includes(ctx.state.metric)
          ? ctx.marginOf(r)
          : ctx.listMetric(r),
      limit = Math.max(
        3,
        Math.min(rs.length, Math.floor((bottom - top - 105) / 26)),
      ),
      rank = rs
        .slice()
        .sort((a, b) => (low ? value(a) - value(b) : value(b) - value(a)))
        .slice(0, limit),
      unit = [
        "winner",
        "runner",
        "margin",
        "competitive",
        "advantage",
        "difference",
      ].includes(ctx.state.metric)
        ? "pp"
        : (ctx.EXTRA_METRICS[ctx.state.metric]?.unit ?? "%"),
      title = low
        ? "競爭最接近的縣市"
        : ctx.state.metric === "share"
          ? ctx.state.candidate + "得票率最高的縣市"
          : (ctx.EXTRA_METRICS[ctx.state.metric]?.title || "投票率") + "排名",
      x = ctx.d3
        .scaleLinear()
        .domain([
          Math.min(0, ctx.d3.min(rank, value)),
          ctx.d3.max(rank, value) || 1,
        ])
        .range([left + 76, right - 70]);
    g.append("text")
      .attr("x", left)
      .attr("y", top + 10)
      .attr("class", "scatter-label")
      .style("font-size", "15px")
      .style("font-weight", 600)
      .text(title);
    g.append("text")
      .attr("x", left)
      .attr("y", top + 32)
      .attr("class", "scatter-label")
      .text("顯示 " + limit + "／" + rs.length + " 縣市 · 完整清單見地區排名");
    const rows = g
      .selectAll(".hex-ranking-row")
      .data(rank.map((r) => ({ r, key: ctx.keyOf(r) })))
      .join("g")
      .attr("class", "hex-ranking-row")
      .attr("transform", (_, i) => `translate(0,${top + 55 + i * 26})`);
    rows
      .append("rect")
      .attr("x", left - 6)
      .attr("y", -15)
      .attr("width", right - left + 12)
      .attr("height", 25)
      .attr("fill", "transparent");
    rows
      .append("text")
      .attr("x", left)
      .attr("y", 0)
      .attr("font-size", 12)
      .attr("fill", "#536b79")
      .text((d) => ctx.areaName(d.r));
    rows
      .append("rect")
      .attr("class", "hex-rank-bar")
      .attr("data-value", (d) => value(d.r))
      .attr("x", (d) => Math.min(x(0), x(value(d.r))))
      .attr("y", -10)
      .attr("width", (d) => Math.abs(x(value(d.r)) - x(0)))
      .attr("height", 10)
      .attr("fill", (d) => ctx.fill(d.r, d.key));
    rows
      .append("text")
      .attr("x", right)
      .attr("y", 0)
      .attr("text-anchor", "end")
      .attr("font-size", 12)
      .attr("fill", "#536b79")
      .text(
        (d) =>
          (["leadVotes", "validVotes"].includes(ctx.state.metric)
            ? ctx.fmt(value(d.r))
            : value(d.r).toFixed(2)) +
          " " +
          unit,
      );
    if (!publication) ctx.wireChart(rows);
    else rows.attr("data-region-key", (d) => d.key);
    const counts = ctx.d3
      .rollups(
        rs,
        (v) => v.length,
        (r) => r.candidates[0].party,
      )
      .sort((a, b) => b[1] - a[1]);
    g.append("text")
      .attr("x", left)
      .attr("y", bottom - 19)
      .attr("font-size", 12)
      .attr("fill", "#657985")
      .text("第一名縣市數：" + counts.map(([p, n]) => p + " " + n).join(" · "));
    g.append("text")
      .attr("x", left)
      .attr("y", bottom + 2)
      .attr("font-size", 12)
      .attr("fill", "#657985")
      .text("總統依全國票數決定當選，不按縣市數。");
  }

  function drawPublicationHex(svg, width, height) {
    const rs = ctx.overviewRecords(),
      layout = ctx.layoutHexUnits(rs, width, height, 24, height - 30),
      units = svg
        .append("g")
        .selectAll("g")
        .data(layout.nodes)
        .join("g")
        .attr("class", "unit")
        .attr("data-region-key", (d) => d.key)
        .classed("light-fill", !["winner", "runner"].includes(ctx.state.metric))
        .attr("transform", (d) => `translate(${d.x},${d.y})`);
    units
      .append("path")
      .attr("class", "unit-shape")
      .attr("d", (d) => ctx.hexPath(d.radius))
      .attr("fill", (d) => ctx.fill(d.r, d.key))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);
    units
      .append("text")
      .attr("class", "unit-name")
      .attr("y", ctx.chartOptions.hexLabels === "simple" ? 5 : -8)
      .attr("text-anchor", "middle")
      .style(
        "font-size",
        (d) => Math.max(12, Math.min(22, d.radius * 0.25)) + "px",
      )
      .style("opacity", (d) => (ctx.state.labels && d.radius >= 16 ? 1 : 0))
      .text((d) =>
        ctx.isLeg()
          ? (ctx.data.counties[d.r.county] || "").slice(0, 2) +
            " " +
            Number(d.r.district)
          : ctx.areaName(d.r),
      );
    if (ctx.chartOptions.hexLabels !== "simple")
      units
        .append("text")
        .attr("class", "unit-value")
        .attr("y", 14)
        .attr("text-anchor", "middle")
        .style(
          "font-size",
          (d) => Math.max(12, Math.min(24, d.radius * 0.28)) + "px",
        )
        .style("opacity", (d) => (d.radius >= 20 ? 1 : 0))
        .text((d) => ctx.tileMetric(d.r));
    if (ctx.chartOptions.hexLabels === "detail")
      units
        .append("text")
        .attr("class", "unit-candidate")
        .attr("y", 33)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("opacity", (d) => (d.radius > 40 ? 1 : 0))
        .text((d) => ctx.chartWinner(d.r).name);
    if (layout.summary)
      ctx.drawHexRanking(svg, rs, width, 24, height - 30, true);
  }

  function drawAlternative() {
    if (ctx.state.chart === "small") {
      ctx.isLeg() ? ctx.drawSeatArc() : ctx.drawSmallMultiples();
      return;
    }
    if (ctx.state.chart === "ternary") {
      ctx.drawTernary();
      return;
    }
    if (ctx.state.chart === "scatter" && ctx.state.distribution === "swarm") {
      ctx.drawBeeswarm();
      return;
    }
    const host = ctx.chartDimensions(),
      cw = Math.max(300, host.width),
      ch = Math.max(260, host.height),
      svg = ctx.d3.select("#scatter").attr("viewBox", `0 0 ${cw} ${ch}`);
    let rs = ctx.overviewRecords();
    if (
      ctx.altMode !== ctx.state.chart ||
      !svg.select(".alternative-stage").size()
    ) {
      svg.selectAll("*").remove();
      svg.append("g").attr("class", "alternative-stage");
      ctx.altPositions = new Map();
      ctx.altMode = ctx.state.chart;
    }
    const stage = svg.select(".alternative-stage");
    let nodes = [];
    const top = ctx.chartToolsBottom() + 30,
      bot = ch - 55,
      layout = ctx.layoutHexUnits(rs, cw, ch, top, bot);
    nodes = layout.nodes;
    if (layout.summary) ctx.drawHexRanking(svg, rs, cw, top, bot);
    else svg.selectAll(".hex-ranking").remove();
    const joining = stage.selectAll(".unit").data(nodes, (d) => d.key);
    joining
      .exit()
      .transition()
      .duration(ctx.duration() / 2)
      .style("opacity", 0)
      .remove();
    const entering = joining
      .enter()
      .append("g")
      .attr("class", "unit")
      .attr("transform", (d) => {
        const prev = ctx.altPositions.get(d.key),
          geo = ctx.geoByKey[ctx.isLeg() ? d.r.county + "/000" : d.key],
          p = prev || (geo ? geo.path.centroid(geo.f) : [cw / 2, ch / 2]);
        return `translate(${p[0]},${p[1]}) scale(.3)`;
      })
      .style("opacity", 0);
    entering
      .append("circle")
      .attr("class", "unit-halo")
      .attr("fill", "none")
      .attr("pointer-events", "none");
    entering
      .append(ctx.state.chart === "hex" ? "path" : "circle")
      .attr("class", "unit-shape")
      .attr("fill", (d) => ctx.fill(d.r, d.key));
    entering
      .append("text")
      .attr("class", "unit-name")
      .attr("text-anchor", "middle");
    entering
      .append("text")
      .attr("class", "unit-value")
      .attr("text-anchor", "middle");
    entering
      .append("text")
      .attr("class", "unit-candidate")
      .attr("text-anchor", "middle");
    const generation = (Number(svg.attr("data-generation")) || 0) + 1;
    svg.attr("data-generation", generation);
    const all = entering.merge(joining);
    svg.attr("data-render-ready", all.empty() ? "true" : "false");
    ctx.wireChart(all);
    all
      .classed("selected", (d) => d.key === ctx.state.key)
      .attr("data-region-key", (d) => d.key);
    all
      .select(".unit-halo")
      .attr("r", (d) => Math.max(12, d.radius + 3))
      .attr("display", ctx.state.chart === "bubble" ? null : "none");
    all
      .select(".unit-shape")
      .transition()
      .duration(ctx.duration())
      .attr("d", (d) =>
        ctx.state.chart === "hex" ? ctx.hexPath(d.radius) : null,
      )
      .attr("r", (d) => (ctx.state.chart === "bubble" ? d.radius : null))
      .attr("fill", (d) => ctx.fill(d.r, d.key))
      .attr("stroke", (d) => {
        if (d.key === ctx.state.key) return "#142b48";
        return ctx.state.chart === "bubble" ? "none" : "#fff";
      })
      .attr("stroke-width", (d) => (d.key === ctx.state.key ? 3 : 2));
    all
      .select(".unit-name")
      .attr("y", (d) => (d.radius > 25 ? -11 : -4))
      .style("font-size", (d) => (d.radius > 28 ? "11px" : "9px"))
      .text((d) => {
        if (ctx.isLeg())
          return (
            (ctx.data.counties[d.r.county] || "")
              .replace("臺", "台")
              .slice(0, 2) +
            " " +
            Number(d.r.district)
          );
        return ctx.areaName(d.r);
      })
      .style("opacity", (d) => (ctx.state.labels && d.radius >= 16 ? 1 : 0));
    all
      .select(".unit-value")
      .attr("y", (d) => (d.radius > 25 ? 7 : 8))
      .style("font-size", (d) =>
        ctx.isLeg() && ctx.state.chart === "hex"
          ? "12px"
          : d.radius > 30
            ? "17px"
            : "11px",
      )
      .text((d) =>
        ctx.state.chart === "bubble"
          ? d.r.total >= 10000
            ? (d.r.total / 10000).toFixed(1) + "萬"
            : ctx.fmt(d.r.total)
          : ctx.tileMetric(d.r),
      )
      .style("opacity", (d) => (d.radius >= 20 ? 1 : 0));
    if (ctx.state.chart === "hex") {
      all.on("dblclick", (_, d) => {
        if (!ctx.isLeg() && d.r.town === "000") ctx.selectRegion(d.key, true);
      });
      all
        .select(".unit-name")
        .attr(
          "y",
          ctx.chartOptions.hexLabels === "simple" &&
            ["winner", "runner"].includes(ctx.state.metric)
            ? -7
            : ctx.chartOptions.hexLabels === "simple"
              ? 4
              : -8,
        )
        .style(
          "font-size",
          (d) => Math.min(18, Math.max(12, d.radius * 0.22)) + "px",
        );
      all
        .select(".unit-value")
        .attr("y", 15)
        .text((d) =>
          ctx.chartOptions.hexLabels === "simple"
            ? ctx.chartWinner(d.r).name.slice(0, 1)
            : ctx.tileMetric(d.r),
        )
        .style(
          "font-size",
          ctx.chartOptions.hexLabels === "simple" ? "16px" : null,
        )
        .style("opacity", (d) =>
          d.radius >= 20 &&
          (ctx.chartOptions.hexLabels !== "simple" ||
            ["winner", "runner"].includes(ctx.state.metric))
            ? 1
            : 0,
        );
    }
    all
      .select(".unit-candidate")
      .attr("y", (d) => (d.radius > 30 ? 24 : 21))
      .style("font-size", "9px")
      .text((d) => ctx.chartWinner(d.r).name)
      .style("opacity", (d) =>
        ctx.state.labels &&
        ctx.state.chart !== "bubble" &&
        d.radius > 30 &&
        (ctx.state.chart !== "hex" || ctx.chartOptions.hexLabels === "detail")
          ? 1
          : 0,
      );
    all.each(function (d) {
      if (ctx.state.chart !== "bubble") return;
      for (const cls of [".unit-name", ".unit-value"]) {
        const label = this.querySelector(cls);
        if (label && label.getComputedTextLength() > d.radius * 1.7)
          label.style.opacity = "0";
      }
    });
    svg.selectAll(".hex-selection-callout").remove();
    const selected = nodes.find((d) => d.key === ctx.state.key);
    if (selected)
      svg.append("text")
        .attr("class", "hex-selection-callout")
        .attr("x", 28)
        .attr("y", top - 10)
        .attr("fill", "#244b63")
        .attr("font-size", 13)
        .text("固定檢視 · " + ctx.areaName(selected.r, true) + " · " + ctx.tileMetric(selected.r));
    all.classed(
      "light-fill",
      (d) => !["winner", "runner"].includes(ctx.state.metric),
    );
    all
      .interrupt()
      .transition()
      .duration(ctx.duration())
      .delay((d, i) => Math.min(i * 5, 120))
      .ease(ctx.d3.easeCubicInOut)
      .attr("transform", (d) => `translate(${d.x},${d.y}) scale(1)`)
      .style("opacity", 1)
      .on("end.ready", function (d, i) {
        if (
          i === nodes.length - 1 &&
          Number(svg.attr("data-generation")) === generation
        )
          svg.attr("data-render-ready", "true");
      });
    ctx.altPositions = new Map(nodes.map((d) => [d.key, [d.x, d.y]]));
  }
}
