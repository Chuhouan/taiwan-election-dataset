import { partySymbolPath } from "./party-symbols.js";
/** src/charts/ternary.js — explicit visualization service dependencies. */
export function install(ctx) {
  Object.assign(ctx, { drawTernary, attachTernaryBrush });
  function drawTernary(target = null, dimensions = null, publication = false) {
    const host = dimensions || ctx.chartDimensions(),
      cw = host.width,
      ch = host.height,
      svg = (target || ctx.d3.select("#scatter")).attr(
        "viewBox",
        `0 0 ${cw} ${ch}`,
      );
    svg.on(".zoom", null);
    svg.selectAll("*").remove();
    const camera = ctx.ternaryCamera || [1, 0, 0];
    let baseK = 1,
      baseX = 0,
      baseY = 0;
    ctx.altMode = "ternary";
    const cs = ctx.records["00000/000"].candidates,
      rs = ctx.scoped(),
      top = publication ? 35 : ctx.chartToolsBottom() + 42,
      bottom = ch - (!publication && ctx.dualMode && !ctx.chartOptions.ternaryFocus
        ? cw < 600 ? 116 : 96
        : 75),
      side = Math.min(
        cw - 120,
        (Math.max(100, bottom - top - 25) * 2) / Math.sqrt(3),
      ),
      th = (side * Math.sqrt(3)) / 2,
      cx = cw / 2;
    const vs = [
        [cx, top],
        [cx - side / 2, top + th],
        [cx + side / 2, top + th],
      ],
      point = (a, b, c) => [
        a * vs[0][0] + b * vs[1][0] + c * vs[2][0],
        a * vs[0][1] + b * vs[1][1] + c * vs[2][1],
      ];
    if (ctx.chartOptions.ternaryFocus) {
      const key = svg
        .append("g")
        .attr("class", "ternary-axis-key")
        .attr("pointer-events", "none");
      for (const [index, x, anchor, arrow] of [
        [1, 28, "start", "↙"],
        [0, cw / 2, "middle", "↑"],
        [2, cw - 28, "end", "↘"],
      ]) {
        key
          .append("text")
          .attr("x", x)
          .attr("y", top - 19)
          .attr("text-anchor", anchor)
          .attr("font-size", 13)
          .attr("font-weight", 600)
          .attr("fill", "#344f60")
          .text(cs[index].name + " " + arrow);
      }
    }
    const clipId = publication
        ? "publication-ternary-clip"
        : "ternary-plot-clip",
      clip = svg.append("defs").append("clipPath").attr("id", clipId);
    clip
      .append("rect")
      .attr("x", 25)
      .attr("y", top - 15)
      .attr("width", Math.max(1, cw - 50))
      .attr("height", Math.max(1, bottom - top + 15));
    const viewport = svg
        .append("g")
        .attr(
          "clip-path",
          ctx.chartOptions.ternaryFocus ||
            camera.some((v, i) => v !== (i ? 0 : 1))
            ? "url(#" + clipId + ")"
            : null,
        ),
      g = viewport.append("g").attr("class", "ternary-content");
    g.append("path")
      .attr("d", "M" + vs.map((v) => v.join(",")).join("L") + "Z")
      .attr("fill", "#fff")
      .attr("stroke", "#cad7e5");
    for (let i = 1; i < 10; i++) {
      let t = i / 10;
      [
        [point(t, 0, 1 - t), point(t, 1 - t, 0)],
        [point(0, t, 1 - t), point(1 - t, t, 0)],
        [point(0, 1 - t, t), point(1 - t, 0, t)],
      ].forEach((p) =>
        g
          .append("path")
          .attr("d", "M" + p.map((v) => v.join(",")).join("L"))
          .attr("stroke", "#e3eaf2")
          .attr("stroke-width", 0.8),
      );
      g.append("text")
        .attr("x", point(t, 1 - t, 0)[0] - 8)
        .attr("y", point(t, 1 - t, 0)[1] + 3)
        .attr("text-anchor", "end")
        .attr("class", "ternary-tick ternary-scale-tick")
        .text(Math.round(t * 100) + "%");
    }
    vs.forEach((v, i) => {
      g.append("circle")
        .attr("cx", v[0])
        .attr("cy", v[1])
        .attr("r", 4)
        .attr("fill", ctx.color(cs[i].party));
      g.append("text")
        .attr("x", v[0])
        .attr("y", v[1] + (i === 0 ? -20 : 28))
        .attr("text-anchor", "middle")
        .attr("class", "ternary-corner")
        .attr("fill", ctx.color(cs[i].party))
        .text(cs[i].name);
      g.append("text")
        .attr("x", v[0])
        .attr("y", v[1] + (i === 0 ? -7 : 43))
        .attr("text-anchor", "middle")
        .attr("class", "ternary-tick")
        .text(cs[i].party + " 100%");
    });
    const nodes = rs.map((r) => {
      const ps = cs.map(
          (c) => r.candidates.find((x) => x.name === c.name)?.votes || 0,
        ),
        sum = ctx.d3.sum(ps),
        [x, y] = point(...ps.map((v) => v / sum));
      return { r, key: ctx.keyOf(r), x, y };
    });
    if (ctx.chartOptions.ternaryReferences) {
      const center = point(1 / 3, 1 / 3, 1 / 3);
      for (let i = 0; i < 3; i++) {
        const equal = [0.5, 0.5, 0.5];
        equal[i] = 0;
        const edge = point(...equal);
        g.append("path")
          .attr("class", "ternary-equal-line")
          .attr("d", "M" + vs[i].join(",") + "L" + edge.join(","))
          .attr("fill", "none")
          .attr("stroke", "#7a8a96")
          .attr("stroke-dasharray", "4 4")
          .attr("stroke-width", 1)
          .attr("vector-effect", "non-scaling-stroke");
      }
      g.append("circle")
        .attr("cx", center[0])
        .attr("cy", center[1])
        .attr("r", 4)
        .attr("fill", "none")
        .attr("stroke", "#172331");
      const index = cs.findIndex(
          (c) => c.name === ctx.chartOptions.referenceCandidate,
        ),
        t = ctx.chartOptions.referenceShare / 100,
        others = [0, 1, 2].filter((i) => i !== index),
        a = [0, 0, 0],
        b = [0, 0, 0];
      a[index] = b[index] = t;
      a[others[0]] = 1 - t;
      b[others[1]] = 1 - t;
      const pa = point(...a),
        pb = point(...b);
      g.append("path")
        .attr("class", "ternary-share-reference")
        .attr("d", "M" + pa.join(",") + "L" + pb.join(","))
        .attr("stroke", ctx.color(cs[index].party))
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "7 3")
        .attr("vector-effect", "non-scaling-stroke");
      g.append("text")
        .attr("class", "ternary-reference-label")
        .attr("x", (pa[0] + pb[0]) / 2)
        .attr("y", (pa[1] + pb[1]) / 2 - 8)
        .attr("text-anchor", "middle")
        .attr("fill", ctx.color(cs[index].party))
        .attr("font-size", 12)
        .text(
          ctx.chartOptions.referenceCandidate +
            " " +
            ctx.chartOptions.referenceShare +
            "%",
        );
    }
    const dots = g
      .selectAll(".ternary-dot")
      .data(nodes)
      .join("circle")
      .attr("class", "ternary-dot")
      .classed("mark-selected", (d) => d.key === ctx.state.key)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("fill", (d) => ctx.color(d.r.candidates[0].party))
      .attr("r", (d) =>
        d.key === ctx.state.key ? 8 : rs.length > 50 ? 3.5 : 6,
      )
      .attr("stroke", (d) => (d.key === ctx.state.key ? "#142b48" : "white"))
      .attr("stroke-width", 1)
      .attr("fill-opacity", (d) =>
        ctx.state.brushed.length && !ctx.state.brushed.includes(d.key)
          ? 0.12
          : 0.72,
      );
    ctx.wireChart(dots);
    if (nodes.length && ctx.chartOptions.densityMode !== "hexbin") {
      const balanced = ctx.d3.least(nodes, (d) =>
        ctx.d3.sum(
          d.r.candidates.slice(0, 3),
          (c) => ((c.votes / d.r.total) * 100 - 100 / 3) ** 2,
        ),
      );
      g.append("circle")
        .attr("class", "balanced-marker")
        .attr("cx", balanced.x)
        .attr("cy", balanced.y)
        .attr("r", 9)
        .attr("fill", "none")
        .attr("stroke", "#172331")
        .attr("stroke-width", 1.5)
        .attr("pointer-events", "none");
      g.append("text")
        .attr("class", "balanced-label")
        .attr("x", balanced.x + 12)
        .attr("y", balanced.y - 10)
        .attr("font-size", 12)
        .attr("fill", "#172331")
        .attr("pointer-events", "none")
        .text("最接近均勢");
    }
    if (ctx.chartOptions.ternaryExtremes && nodes.length) {
      const occupied = [];
      for (const element of g
        .selectAll(".balanced-label,.ternary-reference-label")
        .nodes()) {
        const x = Number(element.getAttribute("x")),
          y = Number(element.getAttribute("y")),
          width = element.getComputedTextLength();
        occupied.push({
          x:
            x -
            (element.getAttribute("text-anchor") === "middle" ? width / 2 : 0),
          y: y - 12,
          w: width,
          h: 16,
        });
      }
      for (const c of cs) {
        const best = ctx.d3.greatest(nodes, (d) => ctx.shareOf(d.r, c.name)),
          label =
            ctx.areaName(best.r) +
            " · " +
            c.name +
            " " +
            ctx.pct(ctx.shareOf(best.r, c.name)),
          width = label.length * 10;
        const marker = g
          .append("circle")
          .datum(best)
          .attr("class", "ternary-extreme")
          .attr("cx", best.x)
          .attr("cy", best.y)
          .attr("r", 7)
          .attr("fill", "none")
          .attr("stroke", ctx.color(c.party))
          .attr("stroke-width", 1.5)
          .attr("vector-effect", "non-scaling-stroke");
        ctx.wireChart(marker);
        for (const dy of [-18, 24, -36, 40]) {
          const tx = Math.max(30, Math.min(cw - width - 20, best.x + 12)),
            ty = best.y + dy,
            box = { x: tx, y: ty - 12, w: width, h: 16 };
          if (
            ty < top - 10 ||
            ty > ch - 40 ||
            occupied.some(
              (b) =>
                box.x < b.x + b.w &&
                box.x + box.w > b.x &&
                box.y < b.y + b.h &&
                box.y + box.h > b.y,
            )
          )
            continue;
          occupied.push(box);
          g.append("line")
            .attr("x1", best.x)
            .attr("y1", best.y)
            .attr("x2", tx)
            .attr("y2", ty + 2)
            .attr("stroke", ctx.color(c.party))
            .attr("stroke-width", 0.8)
            .attr("vector-effect", "non-scaling-stroke");
          g.append("text")
            .attr("class", "ternary-extreme-label")
            .attr("x", tx)
            .attr("y", ty)
            .attr("font-size", 12)
            .attr("fill", ctx.color(c.party))
            .attr("pointer-events", "none")
            .text(label);
          break;
        }
      }
    }
    let visibleCount = nodes.length,
      brushNodes = nodes,
      brushExtent = [
        [vs[1][0] - 10, top - 10],
        [vs[2][0] + 10, top + th + 10],
      ];
    if (ctx.chartOptions.ternaryFocus && nodes.length) {
      let k = 2.3;
      const meanX = ctx.d3.mean(nodes, (d) => d.x),
        meanY = ctx.d3.mean(nodes, (d) => d.y),
        targetX = cw / 2,
        targetY = top + (bottom - top) / 2;
      let tx = targetX - k * meanX,
        ty = targetY - k * meanY;
      const selected = nodes.find((d) => d.key === ctx.state.key);
      if (selected) {
        const px = selected.x * k + tx,
          py = selected.y * k + ty;
        tx += Math.max(48, Math.min(cw - 48, px)) - px;
        ty += Math.max(top + 25, Math.min(bottom - 20, py)) - py;
      }
      baseK = k;
      baseX = tx;
      baseY = ty;
      k *= camera[0];
      tx = tx * camera[0] + camera[1] * cw;
      ty = ty * camera[0] + camera[2] * ch;
      g.attr("transform", `translate(${tx},${ty}) scale(${k})`);
      g.selectAll(".ternary-tick").style("font-size", 12 / k + "px");
      g.selectAll(".ternary-scale-tick").each(function () {
        const sx = Math.max(60, Number(this.getAttribute("x")) * k + tx),
          sy = Number(this.getAttribute("y")) * k + ty;
        if (sy < top + 10 || sy > ch - 65 || sx > cw - 60)
          this.setAttribute("display", "none");
        else {
          this.setAttribute("x", (sx - tx) / k);
          this.setAttribute("y", (sy - ty) / k);
          this.setAttribute("text-anchor", "end");
        }
      });
      g.selectAll(".ternary-corner").style("font-size", 16 / k + "px");
      g.selectAll(".ternary-extreme-label,.ternary-reference-label")
        .style("font-size", 12 / k + "px")
        .style("stroke-width", 3 / k + "px");
      g.selectAll(".ternary-extreme").attr("r", 7 / k);
      g.selectAll(".balanced-label").style("font-size", 12 / k + "px");
      g.selectAll(".balanced-marker")
        .attr("r", 9 / k)
        .attr("stroke-width", 1.5 / k);
      dots
        .attr("r", (d) => (d.key === ctx.state.key ? 8 : 4.5) / k)
        .attr("stroke-width", 1 / k);
      brushNodes = nodes.map((d) => ({
        ...d,
        x: d.x * k + tx,
        y: d.y * k + ty,
      }));
      brushExtent = [
        [25, top - 15],
        [cw - 25, bottom],
      ];
      visibleCount = brushNodes.filter(
        (d) => d.x >= 25 && d.x <= cw - 25 && d.y >= top - 15 && d.y <= bottom,
      ).length;
      const mini = svg
        .append("g")
        .attr("class", "ternary-overview")
        .attr("transform", `translate(${cw - 100},${top + 5})`);
      mini
        .append("path")
        .attr("d", "M35,0L0,61L70,61Z")
        .attr("fill", "#fff")
        .attr("stroke", "#9daab5");
      const mx = (x) =>
          Math.max(
            0,
            Math.min(70, (((x - tx) / k - (cx - side / 2)) / side) * 70),
          ),
        my = (y) => Math.max(0, Math.min(61, (((y - ty) / k - top) / th) * 61)),
        x0 = mx(25),
        x1 = mx(cw - 25),
        y0 = my(top - 15),
        y1 = my(bottom);
      mini
        .append("rect")
        .attr("x", x0)
        .attr("y", y0)
        .attr("width", Math.max(0, x1 - x0))
        .attr("height", Math.max(0, y1 - y0))
        .attr("fill", "none")
        .attr("stroke", "#956b33")
        .attr("stroke-dasharray", "3 2");
      mini
        .append("text")
        .attr("x", 35)
        .attr("y", 78)
        .attr("text-anchor", "middle")
        .attr("class", "ternary-tick")
        .text("完整三方座標");
    }
    if (!ctx.chartOptions.ternaryFocus) {
      const [k, x, y] = camera;
      g.attr("transform", `translate(${x * cw},${y * ch}) scale(${k})`);
      g.selectAll("text").each(function () {
        this.style.fontSize =
          parseFloat(getComputedStyle(this).fontSize) / k + "px";
      });
      brushNodes = nodes.map((d) => ({
        ...d,
        x: d.x * k + x * cw,
        y: d.y * k + y * ch,
      }));
    }
    svg.attr("data-ternary-scale", baseK * camera[0]);
    visibleCount = brushNodes.filter(
      (d) => d.x >= 25 && d.x <= cw - 25 && d.y >= top - 15 && d.y <= bottom,
    ).length;
    if (!publication && ctx.state.key) {
      const selected = brushNodes.find((d) => d.key === ctx.state.key);
      if (selected) {
        const label = ctx.areaName(selected.r, true),
          width = Math.min(cw - 70, label.length * 13 + 24),
          x = Math.max(30, Math.min(cw - width - 30, selected.x + 16)),
          y = Math.max(top + 8, Math.min(bottom - 40, selected.y - 42)),
          callout = svg
            .append("g")
            .attr("class", "ternary-selection-label")
            .attr("pointer-events", "none");
        callout
          .append("path")
          .attr("d", `M${selected.x},${selected.y}L${x + 10},${y + 25}`)
          .attr("fill", "none")
          .attr("stroke", "#203e50")
          .attr("stroke-width", 1);
        callout
          .append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", width)
          .attr("height", 28)
          .attr("rx", 3)
          .attr("fill", "#fff")
          .attr("stroke", "#b6c4cc");
        callout
          .append("text")
          .attr("x", x + 12)
          .attr("y", y + 19)
          .attr("font-size", 13)
          .attr("font-weight", 600)
          .attr("fill", "#203e50")
          .text(label);
      }
    }
    if (ctx.state.brushEnabled && !publication)
      ctx.attachTernaryBrush(svg, brushNodes, brushExtent);
    // Annotations live in screen coordinates so zooming never clips or shrinks their text.
    svg.selectAll(".ternary-extreme-label,.balanced-label,.ternary-selection-label").attr("display", "none");
    const inView = (d) => d && d.x >= 25 && d.x <= cw - 25 && d.y >= top + 8 && d.y <= bottom - 8,
      annotated = [], selectedNode = brushNodes.find((d) => d.key === ctx.state.key);
    if (inView(selectedNode)) annotated.push({ ...selectedNode, label: ctx.areaName(selectedNode.r, true) });
    if (ctx.chartOptions.ternaryExtremes) for (const c of cs) {
      const d = ctx.d3.greatest(brushNodes, (n) => ctx.shareOf(n.r, c.name));
      if (inView(d) && !annotated.some((n) => n.key === d.key))
        annotated.push({ ...d, label: ctx.areaName(d.r) + " · " + c.name + " " + ctx.pct(ctx.shareOf(d.r, c.name)) });
    }
    const balancedNode = ctx.d3.least(brushNodes, (d) => ctx.d3.sum(d.r.candidates.slice(0, 3), (c) => ((c.votes / d.r.total) * 100 - 100 / 3) ** 2));
    if (inView(balancedNode) && !annotated.some((n) => n.key === balancedNode.key))
      annotated.push({ ...balancedNode, label: ctx.areaName(balancedNode.r) + " · 最接近均勢" });
    ctx.drawCallouts(svg, annotated, { left: 26, right: cw - 26, top: top + 12, bottom: bottom - 10,
      obstacles: ctx.chartOptions.ternaryFocus ? [{ x: cw - 112, y: top, w: 100, h: 90 }] : [],
    }, "ternary-screen-callouts");
    svg
      .attr("data-visible-count", visibleCount)
      .attr("data-total-count", nodes.length);
    if (publication) return nodes;
    ctx.$("#legend").innerHTML =
      '<div class="legend-title">三方得票率 · 每點一' +
      (ctx.state.level === "town" ? "鄉鎮市區" : "縣市") +
      '</div><div class="legend-foot">三組有效票占比合計100% · ' +
      nodes.length +
      " 個地區" +
      (ctx.chartOptions.ternaryReferences
        ? " · 虛線為兩兩等票及指定得票率參考線"
        : "") +
      (ctx.chartOptions.ternaryFocus
        ? " · 局部顯示 " + visibleCount + " 個；完整三角形可查看全部"
        : "") +
      "</div>";
    ctx.$("#view-description").textContent =
      (ctx.chartOptions.ternaryFocus
        ? "三方點群局部放大 · 顯示 " +
          visibleCount +
          "／" +
          nodes.length +
          " 地區"
        : "三方競爭") + " · 點選地區查看完整結果";
    ctx.$("#chart-coordinate").textContent = "TERNARY / VOTE SHARE";
    if (!ctx.state.brushEnabled) {
      let sizes = [], symbols = [], gestureMoved = false;
      const zoom = ctx.d3
        .zoom()
        .scaleExtent([1, 6])
        .extent([
          [25, top - 15],
          [cw - 25, bottom],
        ])
        .filter((ev) => !ev.button && (ev.type !== "wheel" || ev.ctrlKey))
        .clickDistance(5)
        .on("start", () => {
          gestureMoved = false;
          sizes = g
            .selectAll("text,circle")
            .nodes()
            .map((node) => ({
              node,
              font:
                node.tagName === "text"
                  ? parseFloat(getComputedStyle(node).fontSize) * camera[0]
                  : null,
              radius:
                node.tagName === "circle"
                  ? +node.getAttribute("r") * camera[0]
                  : null,
            }));
          symbols = g.selectAll(".accessible-symbol").nodes().map((node) => ({ node, radius: +node.dataset.symbolRadius * camera[0], party: node.__data__.r.candidates[0].party }));
          svg
            .selectAll(".ternary-selection-label,.ternary-overview,.ternary-screen-callouts")
            .attr("visibility", "hidden");
          ctx.$("#map-tooltip").hidden = true;
        })
        .on("zoom", (ev) => {
          gestureMoved = true;
          const t = ev.transform;
          ctx.ternaryCamera = [t.k, t.x / cw, t.y / ch];
          g.attr(
            "transform",
            `translate(${baseX * t.k + t.x},${baseY * t.k + t.y}) scale(${baseK * t.k})`,
          );
          for (const item of sizes) {
            if (item.font !== null)
              item.node.style.fontSize = item.font / t.k + "px";
            if (item.radius !== null)
              item.node.setAttribute("r", item.radius / t.k);
          }
          for (const item of symbols) item.node.setAttribute("d", partySymbolPath(item.radius / t.k, item.party));
        })
        .on("end", () => {
          // A pointer press alone must leave marks mounted until their click fires.
          // Rebuilding here would remove the click target before pointerup/click.
          if (gestureMoved) ctx.updateUI();
          else svg.selectAll(".ternary-selection-label,.ternary-overview,.ternary-screen-callouts").attr("visibility", null);
        });
      svg
        .call(zoom)
        .property(
          "__zoom",
          ctx.d3.zoomIdentity
            .translate(camera[1] * cw, camera[2] * ch)
            .scale(camera[0]),
        )
        .on("dblclick.zoom", null);
      ctx.ternaryZoomAction = (action) => {
        if (action === "reset") {
          ctx.ternaryCamera = [1, 0, 0];
          ctx.updateUI();
        } else
          svg
            .transition()
            .duration(ctx.duration() ? 180 : 0)
            .call(zoom.scaleBy, action === "in" ? 1.4 : 1 / 1.4);
      };
    } else ctx.ternaryZoomAction = null;
  }

  function attachTernaryBrush(svg, nodes, extent) {
    const brush = ctx.d3
      .brush()
      .extent(extent)
      .on("end", (ev) => {
        if (!ev.sourceEvent || !ev.selection) return;
        const [[x0, y0], [x1, y1]] = ev.selection;
        ctx.state.brushed = nodes
          .filter((n) => n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1)
          .map((n) => n.key);
        ctx.state.key = "";
        ctx.state.brushEnabled = false;
        ctx.updateUI();
        ctx.toast(
          ctx.state.brushed.length
            ? "已框選 " + ctx.state.brushed.length + " 個地區；可切回地理檢視。"
            : "此範圍沒有資料點",
        );
      });
    svg.append("g").attr("class", "ternary-brush").call(brush);
  }
}
