import { motionDuration, animateMotion } from "../core/motion.js";
import "../styles/bubbles.css";
import { packVoteGroups } from "./bubble-layout.js";
import { rankVoteRegions } from "../data/vote-scale.js";

export function installBubbles(ctx) {
  let query = "",
    lastInspected = "",
    scopeSignature = "",
    layoutSignature = "",
    cached = [],
    ranking = null;
  const pane = ctx.$("#chart-pane");
  pane.insertAdjacentHTML(
    "beforeend",
    `<section id="bubble-rank" class="bubble-rank" hidden aria-label="完整地區票數排行">
    <header><strong>有效票排行</strong><span id="bubble-rank-count"></span></header>
    <label class="bubble-search"><span>⌕</span><input id="bubble-search" type="search" placeholder="查找地區" aria-label="在票數排行中查找地區"><button type="button" id="bubble-search-clear" aria-label="清除排行搜尋" hidden>×</button></label>
    <p id="bubble-query-state">按票數由多至少 · 搜尋只影響列表</p>
    <div id="bubble-rank-list" role="group" aria-label="地區有效票與累積占比"></div>
    <footer>占比與累積均以目前分析範圍有效票為分母。</footer></section>`,
  );
  pane.insertAdjacentHTML(
    "beforeend",
    '<div id="bubble-compact-tabs" class="bubble-compact-tabs" role="group" aria-label="緊湊工作區" hidden><button type="button" data-bubble-panel="chart">規模圖</button><button type="button" data-bubble-panel="rank">完整排行</button></div>',
  );
  const tabs = ctx.$("#bubble-compact-tabs");
  for (const button of tabs.querySelectorAll("button"))
    button.onclick = () => {
      ctx.chartOptions.bubbleCompactView = button.dataset.bubblePanel;
      ctx.updateUI();
    };
  const panel = ctx.$("#bubble-rank"),
    legend = ctx.$("#legend"),
    legendHome = document.createComment("bubble-legend-home");
  legend.before(legendHome);
  ctx.$("#bubble-search").oninput = (event) => {
    query = event.target.value;
    renderRows();
  };
  ctx.$("#bubble-search-clear").onclick = () => {
    query = "";
    ctx.$("#bubble-search").value = "";
    renderRows();
    ctx.$("#bubble-search").focus();
  };
  ctx.presentBubbleWorkspace = () => {
    if (ctx.state.chart === "bubble" && ctx.scoped().length) {
      if (legend.parentElement !== pane) pane.append(legend);
    } else if (legend.previousSibling !== legendHome) legendHome.after(legend);
    const compact =
      ctx.state.chart === "bubble" &&
      ctx.chartOptions.bubbleLayout === "bar" &&
      ctx.chartDimensions().width < 900;
    const rankOnly = compact && ctx.chartOptions.bubbleCompactView === "rank";
    tabs.hidden =
      !compact ||
      !ctx.scoped().length ||
      (ctx.dualMode && ctx.dualFocus === "map");
    pane.classList.toggle("bubble-list-only", rankOnly);
    for (const button of tabs.querySelectorAll("button"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.bubblePanel === (rankOnly ? "rank" : "chart")),
      );
    panel.hidden =
      (compact && !rankOnly) ||
      ctx.state.chart !== "bubble" ||
      ctx.chartOptions.bubbleLayout !== "bar" ||
      !ctx.scoped().length ||
      (ctx.dualMode && ctx.dualFocus === "map");
    syncPinnedRow();
  };
  function syncPinnedRow() {
    if (panel.hidden || lastInspected === ctx.state.key) return;
    if (!ctx.state.key) {
      lastInspected = "";
      return;
    }
    const row = [...panel.querySelectorAll(".bubble-rank-row")].find(
      (n) => n.dataset.regionKey === ctx.state.key,
    );
    if (row) {
      row.scrollIntoView({ block: "nearest", inline: "nearest" });
      lastInspected = ctx.state.key;
    }
  }
  const shareText = (value) =>
    value > 0 && value < 0.01 ? "<0.01" : value.toFixed(2);
  ctx.drawBubbleWorkspace = draw;
  function renderRows() {
    if (!ranking) return;
    const needle = query.trim().replaceAll("台", "臺"),
      visible = ranking.rows.filter((d) =>
        ctx.areaName(d.r, true).replaceAll("台", "臺").includes(needle),
      );
    ctx.$("#bubble-search-clear").hidden = !query;
    ctx.$("#bubble-rank-count").textContent = ranking.rows.length + " 地區";
    ctx.$("#bubble-query-state").textContent = query
      ? `找到 ${visible.length}／${ranking.rows.length} 地區 · 圖表範圍不變`
      : "按票數由多至少 · 搜尋只影響列表";
    const rowBefore = new Map([...ctx.$$(".bubble-rank-row")].map(n => [n.dataset.regionKey, n.getBoundingClientRect().top]));
    const list = ctx.d3.select("#bubble-rank-list"),
      rows = list
        .selectAll("button")
        .data(visible, (d) => ctx.keyOf(d.r))
        .join((enter) => {
          const row = enter
            .append("button")
            .attr("type", "button")
            .attr("class", "bubble-rank-row");
          row.append("span").attr("class", "bubble-row-number");
          const content = row
            .append("span")
            .attr("class", "bubble-row-content");
          content.append("span").attr("class", "bubble-row-name");
          content.append("span").attr("class", "bubble-row-track").append("i");
          const values = row.append("span").attr("class", "bubble-row-values");
          values.append("b");
          values.append("small");
          return row;
        })
        .attr("data-region-key", (d) => ctx.keyOf(d.r))
        .attr("aria-pressed", (d) => String(ctx.state.key === ctx.keyOf(d.r)))
        .attr(
          "aria-label",
          (d) =>
            `${ctx.areaName(d.r, true)}，${ctx.fmt(d.r.total)}有效票，占範圍${d.share.toFixed(2)}%，累計${d.cumulative.toFixed(2)}%`,
        )
        .attr(
          "title",
          (d) => `按票數排序至此，累計 ${d.cumulative.toFixed(2)}% 有效票`,
        )
        .on("click", (_, d) => ctx.selectRegion(ctx.keyOf(d.r), false))
        .on("pointerenter.cumulative focus.cumulative", (_, d) => {
          panel.querySelector("footer").textContent =
            `累積至第 ${d.rank} 名，涵蓋 ${d.cumulative.toFixed(2)}% 範圍有效票。`;
          const mark = [...ctx.$("#scatter").querySelectorAll(".bubble-unit")]
            .find(node => node.dataset.regionKey === ctx.keyOf(d.r));
          if (mark) {
            const box = mark.getBoundingClientRect();
            ctx.chartTip({ clientX: box.right, clientY: box.top }, d.r);
          }
        })
        .on("pointerleave.cumulative blur.cumulative", () => {
          panel.querySelector("footer").textContent =
            "占比與累積均以目前分析範圍有效票為分母。";
          ctx.$("#map-tooltip").hidden = true;
        })
        .on("keydown", function (event) {
          const buttons = [
              ...ctx.$("#bubble-rank-list").querySelectorAll("button"),
            ],
            index = buttons.indexOf(this);
          let next =
            event.key === "ArrowDown"
              ? Math.min(index + 1, buttons.length - 1)
              : event.key === "ArrowUp"
                ? Math.max(index - 1, 0)
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : null;
          if (next !== null) {
            event.preventDefault();
            buttons[next]?.focus();
          }
        });
    rows
      .select(".bubble-row-number")
      .text((d) => String(d.rank).padStart(2, "0"));
    rows.select(".bubble-row-name").text((d) => ctx.areaName(d.r, true));
    rows
      .select(".bubble-row-track i")
      .style("width", (d) => (d.r.total / ranking.rows[0].r.total) * 100 + "%")
      .style("background", (d) => ctx.fill(d.r, ctx.keyOf(d.r)));
    rows.select(".bubble-row-values b").text((d) => ctx.fmt(d.r.total));
    rows
      .select(".bubble-row-values small")
      .text((d) => `占 ${shareText(d.share)}%`);
    list
      .selectAll(".bubble-search-empty")
      .data(visible.length ? [] : [0])
      .join("p")
      .attr("class", "bubble-search-empty")
      .text("未找到符合地區；圖表範圍不變。可清除搜尋查看完整排行。");
    rows.order().each(function (d) {
      const before = rowBefore.get(ctx.keyOf(d.r));
      if (before == null) return;
      const delta = before - this.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) animateMotion(this, "rank", [{transform:`translateY(${delta}px)`},{transform:"none"}], "layout");
    });
    syncPinnedRow();
    ctx.refreshLinkedMarks?.();
  }
  function layout(records, rect, mode) {
    const signature = [
      mode,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      records.map((r) => ctx.keyOf(r) + ":" + r.total).join("|"),
    ].join(";");
    if (signature === layoutSignature) return cached.map((d) => ({ ...d }));
    const max = Math.max(...records.map((r) => r.total)),
      nodes = records.map((r) => ({
        r,
        key: ctx.keyOf(r),
        radius: Math.sqrt(r.total / max) * 70,
      }));
    if (mode === "rank") {
      const cols = Math.max(
          1,
          Math.ceil(Math.sqrt((nodes.length * rect.width) / rect.height)),
        ),
        rows = Math.ceil(nodes.length / cols),
        cell = Math.min(rect.width / cols, rect.height / rows),
        ordered = nodes.slice().sort((a, b) => b.r.total - a.r.total);
      ordered.forEach((d, i) => {
        d.x = ((i % cols) + 0.5) * cell;
        d.y = (Math.floor(i / cols) + 0.5) * cell;
        d.radius *= cell / 150;
      });
    } else if (mode === "geo") {
      nodes.forEach((d) => {
        const geo = ctx.geoByKey[ctx.isLeg() ? d.r.county + "/000" : d.key],
          p = geo ? geo.path.centroid(geo.f) : [0, 0];
        d.x = d.ax = p[0];
        d.y = d.ay = p[1];
      });
      ctx.d3
        .forceSimulation(nodes)
        .randomSource(ctx.d3.randomLcg(0.42))
        .force("x", ctx.d3.forceX((d) => d.ax).strength(0.25))
        .force("y", ctx.d3.forceY((d) => d.ay).strength(0.25))
        .force(
          "collision",
          ctx.d3.forceCollide((d) => d.radius + 4).iterations(3),
        )
        .stop()
        .tick(120);
    } else {
      const grouped = packVoteGroups(nodes, rect, { partition: mode === "bar" });
      layoutSignature = signature;
      cached = grouped;
      return grouped.map((d) => ({ ...d }));
    }
    const x0 = ctx.d3.min(nodes, (d) => d.x - d.radius - 3),
      x1 = ctx.d3.max(nodes, (d) => d.x + d.radius + 3),
      y0 = ctx.d3.min(nodes, (d) => d.y - d.radius - 3),
      y1 = ctx.d3.max(nodes, (d) => d.y + d.radius + 3),
      fit = Math.min(rect.width / (x1 - x0), rect.height / (y1 - y0));
    nodes.forEach((d) => {
      d.x = rect.x + rect.width / 2 + (d.x - (x0 + x1) / 2) * fit;
      d.y = rect.y + rect.height / 2 + (d.y - (y0 + y1) / 2) * fit;
      d.radius *= fit;
    });
    layoutSignature = signature;
    cached = nodes;
    return nodes.map((d) => ({ ...d }));
  }
  function draw() {
    const { width: cw, height: ch } = ctx.chartDimensions(),
      records = ctx.overviewRecords(),
      bars = ctx.chartOptions.bubbleLayout === "bar",
      compact = bars && cw < 900,
      baseTop = ctx.chartToolsBottom() + 24,
      top = baseTop + (compact ? 36 : 0),
      rankWidth =
        bars && !compact ? Math.max(310, Math.min(440, cw * 0.34)) : 0,
      plotWidth = cw - rankWidth,
      bottom = ch - 105,
      rect = {
        x: 26,
        y: top + 56,
        width: Math.max(80, plotWidth - 52),
        height: Math.max(90, bottom - top - 65),
      },
      svg = ctx.d3
        .select("#scatter")
        .attr("viewBox", `0 0 ${cw} ${ch}`)
        .attr("data-bubble-workspace", "true");
    if (ctx.altMode !== "bubble-workspace") {
      svg.selectAll("*").remove();
      ctx.altMode = "bubble-workspace";
      svg.append("g").attr("class", "bubble-stage");
    }
    const signature =
      ctx.state.e + "|" + records.map((r) => ctx.keyOf(r)).join(",");
    if (signature !== scopeSignature) {
      scopeSignature = signature;
      query = "";
      ctx.$("#bubble-search").value = "";
    }
    ranking = rankVoteRegions(records);
    const previousLayout = layoutSignature;
    const nodes = layout(records, rect, ctx.chartOptions.bubbleLayout),
      units = svg
        .select(".bubble-stage")
        .selectAll(".unit")
        .data(nodes, (d) => d.key)
        .join((enter) => {
          const u = enter
            .append("g")
            .attr("class", "unit bubble-unit")
            .attr("transform", (d) => `translate(${d.x},${d.y})`);
          u.append("circle")
            .attr("class", "hit-area")
            .attr("fill", "transparent");
          u.append("circle").attr("class", "unit-halo").attr("fill", "none");
          u.append("circle").attr("class", "unit-shape");
          u.append("text")
            .attr("class", "unit-name")
            .attr("text-anchor", "middle");
          u.append("text")
            .attr("class", "unit-value")
            .attr("text-anchor", "middle");
          return u;
        });
    const positions =
      previousLayout !== layoutSignature
        ? units
            .interrupt()
            .transition()
            .duration(ctx.motionCross ? 0 : motionDuration("layout"))
            .ease(ctx.d3.easeCubicOut)
        : units;
    if (previousLayout !== layoutSignature && !ctx.motionCross) {
      units.classed("moving", true);
      positions.on("end.labels", function () { this.classList.remove("moving"); });
    }
    positions.attr("transform", (d) => `translate(${d.x},${d.y})`);
    units
      .attr("data-radius", (d) => d.radius)
      .attr("data-votes", (d) => d.r.total)
      .classed("light-fill", !["winner", "runner"].includes(ctx.state.metric));
    ctx.wireChart(units);
    units.select(".hit-area").attr("r", (d) => Math.max(12, d.radius));
    units
      .select(".unit-halo")
      .attr("r", (d) => Math.max(12, d.radius + 4))
      .attr("pointer-events", "none");
    units
      .select(".unit-shape")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => ctx.fill(d.r, d.key))
      .attr("fill-opacity", 0.78);
    units
      .select(".unit-name")
      .attr("y", -3)
      .style(
        "font-size",
        (d) => Math.min(17, Math.max(12, d.radius * 0.27)) + "px",
      )
      .text((d) =>
        ctx.isLeg()
          ? ctx.data.counties[d.r.county].slice(0, 2) +
            " " +
            Number(d.r.district)
          : ctx.areaName(d.r),
      )
      .style("display", (d) =>
        ctx.state.labels && d.radius >= 25 ? null : "none",
      );
    units
      .select(".unit-value")
      .attr("y", 17)
      .style(
        "font-size",
        (d) => Math.min(19, Math.max(12, d.radius * 0.3)) + "px",
      )
      .text((d) =>
        d.r.total >= 10000
          ? (d.r.total / 10000).toFixed(1) + "萬"
          : ctx.fmt(d.r.total),
      )
      .style("display", (d) => (d.radius >= 31 ? null : "none"));
    units.each(function (d) {
      for (const selector of [".unit-name", ".unit-value"]) {
        const label = this.querySelector(selector);
        if (label.getComputedTextLength() > d.radius * 1.8)
          label.style.display = "none";
      }
    });
    svg
      .selectAll(".bubble-party-caption")
      .data(
        bars ? [...ctx.d3.group(nodes, (d) => d.r.candidates[0].party)] : [],
        (d) => d[0],
      )
      .join("text")
      .attr("class", "bubble-party-caption")
      .attr("x", (d) => d[1][0].groupX)
      .attr("y", rect.y + 15)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => ctx.color(d[0]))
      .attr("font-size", 13)
      .attr("font-weight", 600)
      .text((d) => d[0] + " · " + d[1].length + " 地區");
    const summary = svg
      .selectAll(".bubble-summary")
      .data([ranking])
      .join("g")
      .attr("class", "bubble-summary")
      .attr("transform", `translate(28,${top})`);
    summary
      .selectAll("text")
      .data([
        {
          x: 0,
          label: `範圍內前 ${Math.min(5, records.length)} 地區`,
          value: ranking.topFive.toFixed(1) + "% 有效票",
        },
        {
          x: Math.min(240, plotWidth * 0.5),
          label: "涵蓋半數有效票",
          value: ranking.halfCount + " 個地區",
        },
      ])
      .join("text")
      .attr("x", (d) => d.x)
      .attr("y", 0)
      .text((d) => d.label)
      .attr("class", "bubble-stat-label")
      .each(function (d) {
        ctx.d3
          .select(this)
          .append("tspan")
          .attr("x", d.x)
          .attr("dy", 27)
          .attr("class", "bubble-stat-value")
          .text(d.value);
      });
    svg.selectAll(".bubble-pin-label").remove();
    const pin = nodes.find((d) => d.key === ctx.state.key);
    if (pin) {
      const name = ctx.areaName(pin.r, true),
        w = Math.min(plotWidth - 48, name.length * 13 + 22),
        x = Math.max(24, Math.min(plotWidth - w - 24, pin.x + pin.radius + 12)),
        y = Math.max(top + 58, Math.min(bottom - 32, pin.y - 34)),
        label = svg
          .append("g")
          .attr("class", "bubble-pin-label")
          .attr("pointer-events", "none");
      label
        .append("path")
        .attr("d", `M${pin.x},${pin.y}L${x + 8},${y + 24}`)
        .attr("stroke", "#304e60")
        .attr("fill", "none");
      label
        .append("rect")
        .attr("x", x)
        .attr("y", y)
        .attr("width", w)
        .attr("height", 28)
        .attr("rx", 3)
        .attr("fill", "white")
        .attr("stroke", "#bcc8d0");
      label
        .append("text")
        .attr("x", x + 10)
        .attr("y", y + 19)
        .attr("font-size", 13)
        .attr("fill", "#203c4d")
        .text(name);
    }
    panel.style.left = compact ? "14px" : cw - rankWidth + "px";
    panel.style.right = "12px";
    panel.style.top = (compact ? baseTop + 32 : top - 5) + "px";
    tabs.style.top = baseTop - 8 + "px";
    panel.style.bottom = "16px";
    panel.classList.toggle("compact", compact);
    renderRows();
    drawLegend(nodes, plotWidth, false);
    legend.style.setProperty("--bubble-key-top", bottom + "px");
    ctx.$("#view-description").textContent = bars
      ? "依地區第一名分群 · 圓面積＝有效票，非政黨得票 · 完整排行同步選取"
      : ctx.chartOptions.bubbleLayout === "geo"
        ? "近似地理、位置經避讓 · 圓面積＝有效票，非地表範圍"
        : ctx.chartOptions.bubbleLayout === "rank"
          ? "依有效票排序 · 所有圓使用同一面積比例"
          : "緊密排列，非地理位置 · 小地區可由地區排名精確查詢";
    ctx.$("#chart-coordinate").textContent = "VOTE SCALE / VALID BALLOTS";
    svg
      .attr("data-render-ready", "true")
      .attr("data-total-count", nodes.length);
  }
  function drawLegend(nodes, plotWidth, compact) {
    const colorLabel = ctx.state.metric === "winner" ? "各地第一名政黨" :
      ctx.state.metric === "runner" ? "各地第二名政黨" : ctx.metricDefinition().title;
    const max = ctx.d3.greatest(nodes, (d) => d.r.total),
      legend = ctx.$("#legend"),
      colorKey = [
        ...legend.querySelectorAll(
          ".legend-parties,.legend-ramp,.legend-ticks",
        ),
      ]
        .map((n) => n.outerHTML)
        .join("");
    if (!max) return;
    const radius = (v) => max.radius * Math.sqrt(v / max.r.total),
      values = [100, 1000, 10000, 50000, 100000, 500000, 1000000, 2000000]
        .filter((v) => v <= max.r.total && radius(v) <= 34)
        .slice(-3);
    let x = 14;
    const height = 86,
      items = values.map((v) => {
        const r = radius(v),
          cx = x + r;
        x += r * 2 + 20;
        return `<circle data-votes="${v}" cx="${cx}" cy="${68 - r}" r="${r}" fill="none" stroke="#6b7f8d"/><text x="${cx}" y="84" text-anchor="middle" font-size="12" fill="#455f70">${v >= 10000 ? v / 10000 + "萬" : ctx.fmt(v)}</text>`;
      });
    legend.innerHTML = `<div class="legend-title">圓面積＝有效票數</div><svg class="bubble-scale" role="img" aria-label="與圖中同一比例的票數面積圖例" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}">${items.join("")}</svg><div class="bubble-color-key">${colorKey}</div><div class="legend-foot">顏色：${ctx.esc(colorLabel)} · 所有圓使用同一面積比例${ctx.chartOptions.bubbleLayout === "bar" ? "。組別由各地第一名決定；圓大小並非該黨得票數。" : ""}</div>`;
    legend.classList.add("bubble-workspace-legend");
    legend.style.setProperty("--bubble-legend-width", plotWidth - 36 + "px");
    legend.classList.toggle("bubble-legend-compact", compact);
    if (compact)
      legend.innerHTML =
        '<div class="legend-title">圓面積＝有效票 · 完整地區排行在下方</div><div class="bubble-color-key">' +
        colorKey +
        "</div>";
  }
}
