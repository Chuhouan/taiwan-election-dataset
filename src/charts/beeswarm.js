/** src/charts/beeswarm.js — explicit visualization service dependencies. */
export function install(ctx) {
  Object.assign(ctx, { drawBeeswarm });
  let cacheKey = "",
    cachedNodes = [];
  function drawBeeswarm() {
    const host = ctx.chartDimensions(),
      cw = host.width,
      ch = host.height,
      svg = ctx.d3.select("#scatter").attr("viewBox", `0 0 ${cw} ${ch}`);
    svg.selectAll("*").remove();
    ctx.altMode = "swarm";
    const rs = ctx.scoped(),
      parties = [...new Set(rs.map((r) => r.candidates[0].party))],
      left = 78,
      right = cw - 45,
      top = ctx.chartToolsBottom() + 62,
      bottom = ch - 65,
      x = ctx.d3
        .scaleLinear()
        .domain([
          0,
          Math.max(10, ctx.d3.max(rs, (r) => ctx.marginOf(r)) * 1.06),
        ])
        .nice()
        .range([left, right]),
      y = ctx.d3
        .scalePoint()
        .domain(parties)
        .range([top + 25, bottom - 25])
        .padding(0.5);
    const nodes = rs.map((r) => ({
      r,
      key: ctx.keyOf(r),
      x: x(ctx.marginOf(r)),
      fx: x(ctx.marginOf(r)),
      y: y(r.candidates[0].party),
      tx: x(ctx.marginOf(r)),
      ty: y(r.candidates[0].party),
    }));
    const signature = [
      cw,
      ch,
      rs.map((r) => ctx.keyOf(r) + ":" + ctx.marginOf(r)).join("|"),
    ].join(";");
    if (signature === cacheKey)
      nodes.forEach((d, i) => {
        d.x = cachedNodes[i].x;
        d.y = cachedNodes[i].y;
      });
    else {
      ctx.d3
        .forceSimulation(nodes)
        .randomSource(ctx.d3.randomLcg(0.42))
        .force("x", ctx.d3.forceX((d) => d.tx).strength(1))
        .force("y", ctx.d3.forceY((d) => d.ty).strength(0.08))
        .force("collide", ctx.d3.forceCollide(5.2))
        .stop()
        .tick(200);
      cacheKey = signature;
      cachedNodes = nodes.map((d) => ({ x: d.x, y: d.y }));
    }
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", `translate(0,${bottom})`)
      .call(
        ctx.d3
          .axisBottom(x)
          .ticks(6)
          .tickFormat((d) => d + " pp"),
      );
    parties.forEach((p) => {
      svg
        .append("line")
        .attr("x1", left)
        .attr("x2", right)
        .attr("y1", y(p))
        .attr("y2", y(p))
        .attr("stroke", "#dde5ef")
        .attr("stroke-dasharray", "3 4");
      svg
        .append("text")
        .attr("class", "swarm-party")
        .attr("x", left - 13)
        .attr("y", y(p) + 4)
        .attr("text-anchor", "end")
        .attr("fill", ctx.color(p))
        .text(p);
    });
    const margins = nodes.map((d) => ctx.marginOf(d.r)).sort(ctx.d3.ascending);
    for (const [q, label] of [
      [0.25, "Q1"],
      [0.5, "中位"],
      [0.75, "Q3"],
    ]) {
      const v = ctx.d3.quantileSorted(margins, q);
      svg
        .append("line")
        .attr("class", "swarm-quantile")
        .attr("data-q", q)
        .attr("data-value", v.toFixed(2))
        .attr("x1", x(v))
        .attr("x2", x(v))
        .attr("y1", top - 6)
        .attr("y2", bottom)
        .attr("stroke", "#93a6b8")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 3");
      svg
        .append("text")
        .attr("class", "swarm-quantile-label")
        .attr("x", x(v))
        .attr("y", top - 10)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "#687d89")
        .text(label + " " + v.toFixed(1));
    }
    const circles = svg
      .selectAll(".swarm-dot")
      .data(nodes)
      .join("circle")
      .attr("class", "swarm-dot")
      .classed("mark-selected", (d) => d.key === ctx.state.key)
      .attr("cx", (d) => x(ctx.marginOf(d.r)))
      .attr("cy", (d) => d.y)
      .attr("r", (d) => (d.key === ctx.state.key ? 7 : 4.5))
      .attr("fill", (d) => ctx.color(d.r.candidates[0].party))
      .attr("stroke", (d) => (d.key === ctx.state.key ? "#142b48" : "white"));
    ctx.wireChart(circles);
    const closest = ctx.d3.least(nodes, (d) => ctx.marginOf(d.r)),
      chosen = nodes.find((d) => d.key === ctx.state.key),
      annotations = [
        ...new Map(
          [closest, chosen].filter(Boolean).map((d) => [d.key, d]),
        ).values(),
      ];
    ctx.drawCallouts(
      svg,
      annotations
        .sort((a, b) => (b.key === ctx.state.key) - (a.key === ctx.state.key))
        .map((d) => ({
          ...d,
          x: x(ctx.marginOf(d.r)),
          label:
            (d.key === ctx.state.key ? "檢視 · " : "最接近 · ") +
            ctx.areaName(d.r, true) +
            " " +
            ctx.marginOf(d.r).toFixed(2) +
            " pp",
        })),
      { left, top: top + 5, right, bottom: bottom - 8 },
      "swarm-annotations",
    );
    svg
      .append("text")
      .attr("class", "ternary-hint")
      .attr("x", left)
      .attr("y", top - 47)
      .text("接近的競爭 ←");
    svg
      .append("text")
      .attr("class", "ternary-hint")
      .attr("x", right)
      .attr("y", top - 47)
      .attr("text-anchor", "end")
      .text("→ 較大差距");
    ctx.$("#legend").innerHTML =
      '<div class="legend-title">每點一' +
      (ctx.isLeg()
        ? "選區"
        : ctx.state.level === "town"
          ? "鄉鎮市區"
          : "縣市") +
      ' · 依第一名政黨分列</div><div class="legend-foot">橫軸＝前兩名差距，縱向僅作避讓；點大小一致。</div>';
    ctx.$("#view-description").textContent =
      "競爭差距蜂群 · " + nodes.length + " 個地區";
    ctx.$("#chart-coordinate").textContent = "BEESWARM / WINNING MARGIN";
  }
}
