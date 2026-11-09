/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    prepareChartOptions,
    decorateChartOptions,
    decorateTernaryMarks,
    serializeChartRoute,
    parseChartRoute,
    renderChartFindings,
  });
  ctx.ternaryCamera = [1, 0, 0];
  ctx.chartOptions = {
    ternaryColor: "party",
    ternarySize: "fixed",
    density: true,
    densityMode: "contour",
    bubbleLayout: "bar",
    hexLayout: "geo",
    hexLabels: "simple",
    ternaryFocus: true,
    densityWeight: "regions",
    ternaryReferences: false,
    ternaryExtremes: true,
    referenceCandidate: "賴清德",
    referenceShare: 40,
  };
  ctx
    .$(".map-workspace")
    .insertAdjacentHTML(
      "beforeend",
      '<div id="chart-options" class="chart-options" hidden><label id="ternary-color-label">顏色<select id="ternary-color"><option value="party">第一名政黨</option><option value="county">縣市</option></select></label><label id="ternary-size-label">點大小<select id="ternary-size"><option value="fixed">固定</option><option value="votes">有效票數</option></select></label><label id="density-label"><input id="density-toggle" type="checkbox" checked>地區密度</label><label id="bubble-layout-label">排列<select id="bubble-layout"><option value="geo">近似地理</option><option value="rank">依票數排序</option><option value="pack">緊密氣泡</option><option value="bar">政黨分群＋完整排行</option></select></label></div>',
    );
  for (const [id, key] of [
    ["ternary-color", "ternaryColor"],
    ["ternary-size", "ternarySize"],
    ["bubble-layout", "bubbleLayout"],
  ])
    ctx.$("#" + id).onchange = (ev) => {
      ctx.chartOptions[key] = ev.target.value;
      ctx.updateUI();
    };
  ctx.$("#density-toggle").onchange = (ev) => {
    ctx.chartOptions.density = ev.target.checked;
    ctx.updateUI();
  };
  ctx.$("#density-label").innerHTML =
    '顯示<select id="density-mode"><option value="points">原始點</option><option value="contour">點與等高線</option><option value="hexbin">六角密度</option></select>';
  ctx.$("#density-mode").onchange = (ev) => {
    ctx.chartOptions.densityMode = ev.target.value;
    ctx.chartOptions.density = ev.target.value === "contour";
    ctx.updateUI();
  };
  ctx
    .$("#chart-options")
    .insertAdjacentHTML(
      "beforeend",
      '<div id="ternary-view" class="ternary-view-control" hidden><div class="view-modes" role="group" aria-label="三方圖視角"><button type="button" data-ternary-view="focus" aria-pressed="false">聚焦點群</button><button type="button" data-ternary-view="full" aria-pressed="false">完整三角形</button></div><span id="ternary-view-count"></span></div>',
    );
  for (const button of ctx.$$("[data-ternary-view]")) {
    button.onclick = () => {
      const focus = button.dataset.ternaryView === "focus";
      if (focus === ctx.chartOptions.ternaryFocus) return;
      ctx.chartOptions.ternaryFocus = focus;
      ctx.ternaryCamera = [1, 0, 0];
      ctx.updateUI();
    };
  }
  ctx
    .$("#chart-options")
    .insertAdjacentHTML(
      "beforeend",
      '<label id="hex-layout-label" hidden>排列<select id="hex-layout"><option value="geo">近似地理</option><option value="party">依第一名政黨</option><option value="margin">依競爭差距</option><option value="votes">依票數規模</option></select></label><label id="hex-labels-label" hidden>標示<select id="hex-labels"><option value="simple" selected>地名</option><option value="standard">地名與指標</option><option value="detail">完整結果</option></select></label>',
    );
  for (const key of ["Layout", "Labels"])
    ctx.$("#hex-" + key.toLowerCase()).onchange = (ev) => {
      ctx.chartOptions["hex" + key] = ev.target.value;
      ctx.updateUI();
    };
  ctx
    .$("#chart-options")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="ternary-settings-open" hidden>參考與密度設定</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    '<dialog id="ternary-settings-dialog" class="scatter-settings-dialog"><form id="ternary-settings-form"><div class="filter-title"><h2>三方分析設定</h2><button type="button" id="ternary-settings-close" aria-label="關閉三方設定">×</button></div><div class="scatter-settings-checks"><label><input type="checkbox" id="ternary-reference-lines">候選人等票分界與均勢中心</label><label><input type="checkbox" id="ternary-extremes">標註各候選人得票率最高地區</label><label>密度權重<select id="ternary-density-weight"><option value="regions">每個地區等權</option><option value="votes">依有效票規模</option></select></label><label>得票率參考線<select id="ternary-reference-candidate"><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select><input type="number" id="ternary-reference-share" min="0" max="100" value="40">%</label></div><p>等票線表示兩組候選人得票相等；三方坐標始終合計100%。密度按地區或有效票加權，兩者意義不同。</p><div class="filter-actions"><button type="submit">套用</button></div></form></dialog>',
  );
  ctx.$("#ternary-settings-open").onclick = () => {
    ctx.$("#ternary-reference-lines").checked =
      ctx.chartOptions.ternaryReferences;
    ctx.$("#ternary-extremes").checked = ctx.chartOptions.ternaryExtremes;
    ctx.$("#ternary-density-weight").value = ctx.chartOptions.densityWeight;
    ctx.$("#ternary-reference-candidate").value =
      ctx.chartOptions.referenceCandidate;
    ctx.$("#ternary-reference-share").value = ctx.chartOptions.referenceShare;
    ctx.$("#ternary-settings-dialog").showModal();
  };
  ctx.$("#ternary-settings-close").onclick = () =>
    ctx.$("#ternary-settings-dialog").close();
  ctx.$("#ternary-settings-form").onsubmit = (ev) => {
    ev.preventDefault();
    ctx.chartOptions.ternaryReferences = ctx.$(
      "#ternary-reference-lines",
    ).checked;
    ctx.chartOptions.ternaryExtremes = ctx.$("#ternary-extremes").checked;
    ctx.chartOptions.densityWeight = ctx.$("#ternary-density-weight").value;
    ctx.chartOptions.referenceCandidate = ctx.$(
      "#ternary-reference-candidate",
    ).value;
    ctx.chartOptions.referenceShare = Math.max(
      0,
      Math.min(100, Number(ctx.$("#ternary-reference-share").value)),
    );
    ctx.$("#ternary-settings-dialog").close();
    ctx.updateUI();
  };
  function prepareChartOptions() {
    const ternary = ctx.state.chart === "ternary",
      bubble = ctx.state.chart === "bubble",
      hex = ctx.state.chart === "hex";
    ctx.$("#chart-options").hidden = !ternary && !bubble && !hex;
    for (const id of ["hex-layout-label", "hex-labels-label"])
      ctx.$("#" + id).hidden = !hex;
    for (const id of [
      "ternary-color-label",
      "ternary-size-label",
      "density-label",
    ])
      ctx.$("#" + id).hidden = !ternary;
    ctx.$("#bubble-layout-label").hidden = !bubble;
    ctx.$("#ternary-view").hidden = !ternary;
    ctx.$("#ternary-settings-open").hidden = !ternary;
  }
  function decorateChartOptions() {
    const ternary = ctx.state.chart === "ternary";
    const svg = ctx.d3.select("#scatter");
    svg.selectAll(".bubble-ranking,.bubble-ranking-caption").remove();
    if (ternary) ctx.decorateTernaryMarks(svg, ctx.$("#legend"));
  }
  function decorateTernaryMarks(svg, legend) {
    const title = legend.querySelector(".legend-title");
    if (title)
      title.textContent =
        title.textContent.split(" · 密度：")[0] +
        (ctx.chartOptions.densityMode === "points"
          ? ""
          : " · 密度：" +
            (ctx.chartOptions.densityWeight === "votes"
              ? "有效票加權"
              : "地區數"));
    const dots = svg.selectAll(".ternary-dot"),
      nodes = dots.data(),
      size = ctx.d3
        .scaleSqrt()
        .domain([0, ctx.d3.max(nodes, (d) => d.r.total)])
        .range([0, 13]),
      palette = ctx.countyColorScale();
    const densityColor =
      ctx.chartOptions.densityWeight === "votes" ? "#ac661e" : "#39748e";
    svg
      .selectAll(".density-layer path")
      .attr("fill", densityColor)
      .attr("stroke", densityColor);
    if (ctx.chartOptions.densityMode === "contour") {
      legend.querySelector(".density-key")?.remove();
      legend.insertAdjacentHTML(
        "beforeend",
        '<div class="density-key" data-weight="' +
          ctx.chartOptions.densityWeight +
          '"><b>' +
          (ctx.chartOptions.densityWeight === "votes"
            ? "票源規模密度"
            : "地區數量密度") +
          '</b><i style="background:linear-gradient(90deg,#fff,' +
          densityColor +
          ')"></i><span>稀疏 → 密集</span></div>',
      );
    }
    dots
      .attr("fill", (d) =>
        ctx.chartOptions.ternaryColor === "county"
          ? palette(d.r.county)
          : ctx.color(d.r.candidates[0].party),
      )
      .attr(
        "r",
        (d) =>
          (ctx.chartOptions.ternarySize === "votes"
            ? size(d.r.total)
            : d.key === ctx.state.key
              ? 8
              : 4.5) / (+svg.attr("data-ternary-scale") || 1),
      );
    svg
      .select(".density-layer")
      .attr(
        "display",
        ctx.chartOptions.densityMode === "contour" ? "" : "none",
      );
    dots.attr(
      "display",
      ctx.chartOptions.densityMode === "hexbin" ? "none" : null,
    );
    if (ctx.chartOptions.densityMode === "hexbin" && nodes.length) {
      const radius = 10,
        bins = new Map();
      for (const d of nodes) {
        const q = ((Math.sqrt(3) / 3) * d.x - d.y / 3) / radius,
          r = (2 * d.y) / 3 / radius;
        let a = Math.round(q),
          b = Math.round(r),
          c = Math.round(-q - r);
        const da = Math.abs(a - q),
          db = Math.abs(b - r),
          dc = Math.abs(c + q + r);
        if (da > db && da > dc) a = -b - c;
        else if (db > dc) b = -a - c;
        const key = a + "," + b;
        let bin = bins.get(key);
        if (!bin) {
          bin = {
            x: radius * Math.sqrt(3) * (a + b / 2),
            y: radius * 1.5 * b,
            nodes: [],
          };
          bins.set(key, bin);
        }
        bin.nodes.push(d);
      }
      const values = [...bins.values()],
        weight = (d) =>
          ctx.chartOptions.densityWeight === "votes"
            ? ctx.d3.sum(d.nodes, (n) => n.r.total)
            : d.nodes.length,
        maxWeight = ctx.d3.max(values, weight),
        scale = ctx.d3
          .scaleSequential(
            ctx.chartOptions.densityWeight === "votes"
              ? ctx.d3.interpolateYlOrBr
              : ctx.d3.interpolateBlues,
          )
          .domain([0, maxWeight]);
      const marks = svg
        .select(".ternary-content")
        .insert("g", ".ternary-dot")
        .attr("class", "hexbin-layer")
        .selectAll("path")
        .data(values)
        .join("path")
        .attr("d", ctx.hexPath(radius - 0.6))
        .attr("transform", (d) => `translate(${d.x},${d.y})`)
        .attr("fill", (d) => scale(weight(d)))
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.6)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("data-weight", weight)
        .attr("data-count", (d) => d.nodes.length)
        .attr("data-region-keys", (d) => d.nodes.map((n) => n.key).join(","))
        .on("pointerenter.linked", (_, d) =>
          ctx.setRegionHover?.(d.nodes.map((n) => n.key)),
        )
        .on("pointerleave.linked", () => ctx.setRegionHover?.(""))
        .attr(
          "aria-label",
          (d) =>
            d.nodes.length +
            " 個地區，" +
            ctx.fmt(ctx.d3.sum(d.nodes, (n) => n.r.total)) +
            "有效票；按 Enter 選取此組",
        )
        .on("click", (_, d) => {
          ctx.state.brushed = d.nodes.map((n) => n.key);
          ctx.state.key = "";
          ctx.lastDetail = "";
          ctx.updateUI();
        })
        .on("keydown", (ev, d) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ctx.state.brushed = d.nodes.map((n) => n.key);
            ctx.state.key = "";
            ctx.lastDetail = "";
            ctx.updateUI();
          }
        });
      legend.innerHTML =
        '<div class="legend-title">六角密度 · 每格' +
        (ctx.chartOptions.densityWeight === "votes" ? "有效票" : "地區數") +
        "</div>" +
        ctx.legendRamp(
          ctx.d3.range(7).map((i) => scale((maxWeight * i) / 6)),
          [
            "0",
            ctx.chartOptions.densityWeight === "votes" ? "有效票" : "地區數",
            ctx.fmt(maxWeight),
          ],
        ) +
        '<div class="legend-foot">' +
        (ctx.chartOptions.densityWeight === "votes"
          ? "依有效票加權，非地區數量"
          : "每個地區等權，非票數") +
        "；點選格子查看合計。</div>";
    }
    if (ctx.chartOptions.densityMode === "hexbin") {
      const k = +svg.attr("data-ternary-scale") || 1,
        highlight = ctx.highlightOnlyActive
          ? ctx.highlightOnlyActive()
          : ctx.hasConditions() && ctx.filterSpec.mode === "highlight",
        marked = nodes.filter(
          (d) =>
            d.key === ctx.state.key ||
            (ctx.contextCounty && d.r.county === ctx.contextCounty) ||
            ctx.groupSelection.a.includes(d.key) ||
            ctx.groupSelection.b.includes(d.key) ||
            (highlight && ctx.conditionHighlight.includes(d.key)),
        );
      const marks = svg
        .select(".ternary-content")
        .append("g")
        .attr("class", "ternary-selection-overlay")
        .selectAll("circle")
        .data(marked)
        .join("circle")
        .attr("class", "ternary-selection-marker")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", 6 / k)
        .attr("fill", "#fff")
        .attr("fill-opacity", 0.85)
        .attr("stroke", (d) =>
          ctx.groupSelection.a.includes(d.key)
            ? "#a46b22"
            : ctx.groupSelection.b.includes(d.key)
              ? "#7b4b92"
              : "#273f51",
        )
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", (d) =>
          ctx.groupSelection.b.includes(d.key) ? "3 2" : null,
        )
        .attr("vector-effect", "non-scaling-stroke");
      ctx.wireChart(marks);
      svg
        .selectAll(
          ".ternary-equal-line,.ternary-share-reference,.ternary-reference-label,.ternary-extreme,.ternary-extreme-label,.balanced-marker,.balanced-label",
        )
        .raise();
      if (marked.length) {
        const foot = legend.querySelector(".legend-foot");
        if (foot)
          foot.textContent +=
            " 圈點保留選取、A/B與條件高亮；密度的計算集合不變。";
      }
    }
  }
  function serializeChartRoute(p) {
    if (ctx.ternaryCamera?.some((v, i) => v !== (i ? 0 : 1)))
      p.set(
        "ternary-camera",
        ctx.ternaryCamera.map((v) => Number(v.toFixed(5))).join(","),
      );
    p.set("point-color", ctx.chartOptions.ternaryColor);
    p.set("point-size", ctx.chartOptions.ternarySize);
    p.set("density-mode", ctx.chartOptions.densityMode);
    p.set("bubble-layout", ctx.chartOptions.bubbleLayout);
    if (ctx.chartOptions.bubbleCompactView === "rank")
      p.set("bubble-panel", "rank");
    p.set("hex-layout", ctx.chartOptions.hexLayout);
    p.set("hex-labels", ctx.chartOptions.hexLabels);
    p.set("ternary-focus", ctx.chartOptions.ternaryFocus ? "1" : "0");
    p.set("density-weight", ctx.chartOptions.densityWeight);
    p.set("ternary-references", String(ctx.chartOptions.ternaryReferences));
    p.set("ternary-extremes", String(ctx.chartOptions.ternaryExtremes));
    p.set("reference-candidate", ctx.chartOptions.referenceCandidate);
    p.set("reference-share", String(ctx.chartOptions.referenceShare));
  }
  function parseChartRoute(p) {
    ctx.ternaryCamera = ctx.cameraFromRoute(p.get("ternary-camera"), 6) || [
      1, 0, 0,
    ];
    const mode = ["points", "contour", "hexbin"].includes(p.get("density-mode"))
      ? p.get("density-mode")
      : p.get("density") === "0"
        ? "points"
        : "contour";
    ctx.chartOptions = {
      ternaryColor: p.get("point-color") === "county" ? "county" : "party",
      ternarySize: p.get("point-size") === "votes" ? "votes" : "fixed",
      density: mode === "contour",
      densityMode: mode,
      bubbleCompactView: p.get("bubble-panel") === "rank" ? "rank" : "chart",
      bubbleLayout: ["geo", "rank", "pack", "bar"].includes(
        p.get("bubble-layout"),
      )
        ? p.get("bubble-layout")
        : "bar",
      hexLayout: ["party", "margin", "votes"].includes(p.get("hex-layout"))
        ? p.get("hex-layout")
        : "geo",
      hexLabels: ["standard", "detail"].includes(p.get("hex-labels"))
        ? p.get("hex-labels")
        : "simple",
      ternaryFocus: p.get("ternary-focus") !== "0",
      densityWeight: p.get("density-weight") === "votes" ? "votes" : "regions",
      ternaryReferences: p.get("ternary-references") === "true",
      ternaryExtremes: p.get("ternary-extremes") !== "false",
      referenceCandidate: ["賴清德", "侯友宜", "柯文哲"].includes(
        p.get("reference-candidate"),
      )
        ? p.get("reference-candidate")
        : "賴清德",
      referenceShare:
        p.has("reference-share") && Number.isFinite(+p.get("reference-share"))
          ? Math.max(0, Math.min(100, +p.get("reference-share")))
          : 40,
    };
    ctx.$("#ternary-color").value = ctx.chartOptions.ternaryColor;
    ctx.$("#ternary-size").value = ctx.chartOptions.ternarySize;
    ctx.$("#bubble-layout").value = ctx.chartOptions.bubbleLayout;
    ctx.$("#density-mode").value = mode;
    ctx.$("#hex-layout").value = ctx.chartOptions.hexLayout;
    ctx.$("#hex-labels").value = ctx.chartOptions.hexLabels;
  }
  function renderChartFindings() {
    const rs = ctx.scoped();
    if (!rs.length) return;
    if (
      ctx.state.chart === "scatter" &&
      ["histogram", "ecdf", "box", "dumbbell"].includes(ctx.state.distribution)
    ) {
      const best = ctx.d3.greatest(rs, (r) =>
        ctx.shareOf(r, ctx.state.candidate),
      );
      ctx.$("#finding").textContent =
        ctx.areaName(best, true) +
        " 的 " +
        ctx.state.candidate +
        " 得票率為目前範圍最高：" +
        ctx.pct(ctx.shareOf(best, ctx.state.candidate)) +
        "；地區百分比以原始票數計算。";
    } else if (ctx.state.chart === "scatter") {
      ctx.$("#finding").textContent =
        "差距中位數 " +
        ctx.d3.median(rs, (r) => ctx.marginOf(r)).toFixed(2) +
        "pp（地區等權）；最接近：" +
        rs
          .slice()
          .sort((a, b) => ctx.marginOf(a) - ctx.marginOf(b))
          .slice(0, 3)
          .map(
            (r) =>
              ctx.areaName(r, true) + " " + ctx.marginOf(r).toFixed(2) + "pp",
          )
          .join("、") +
        "。";
    }
    if (ctx.state.chart === "small" && !ctx.isLeg() && ctx.relativeMaps)
      ctx.$("#finding").textContent =
        "比較各地與該候選人全國平均的差異，三圖共用±25百分點色階。";
    if (ctx.state.chart === "small" && !ctx.isLeg() && ctx.smallMaps.difference)
      ctx.$("#finding").textContent =
        ctx.smallMaps.a +
        " − " +
        ctx.smallMaps.b +
        "：目前範圍加總後相差 " +
        (
          ctx.d3.sum(
            rs,
            (r) =>
              r.candidates.find((c) => c.name === ctx.smallMaps.a)?.votes || 0,
          ) -
          ctx.d3.sum(
            rs,
            (r) =>
              r.candidates.find((c) => c.name === ctx.smallMaps.b)?.votes || 0,
          )
        ).toLocaleString("en-US") +
        " 票；差值圖以地區百分點差著色，非票數差。";
    let target = null;
    if (ctx.state.chart === "bubble")
      target = ctx.d3.greatest(rs, (r) => r.total);
    else if (ctx.state.chart === "ternary")
      target = ctx.d3.least(rs, (r) =>
        ctx.d3.sum(
          r.candidates.slice(0, 3),
          (c) => ((c.votes / r.total) * 100 - 100 / 3) ** 2,
        ),
      );
    else if (
      ctx.state.chart === "scatter" &&
      ["histogram", "ecdf", "box", "dumbbell"].includes(ctx.state.distribution)
    )
      target = ctx.d3.greatest(rs, (r) => ctx.shareOf(r, ctx.state.candidate));
    else if (["map", "hex", "scatter"].includes(ctx.state.chart))
      target = ctx.d3.least(rs, (r) => ctx.marginOf(r));
    if (target) {
      const container = ctx.$("#finding"),
        name = ctx.areaName(target, true),
        text = container.textContent,
        index = text.indexOf(name);
      if (index >= 0) {
        const button = document.createElement("button");
        button.className = "finding-link";
        button.textContent = name;
        button.setAttribute("aria-label", "查看" + name + "結果");
        button.onclick = () => {
          ctx.selectRegion(ctx.keyOf(target));
        };
        container.replaceChildren(
          document.createTextNode(text.slice(0, index)),
          button,
          document.createTextNode(text.slice(index + name.length)),
        );
      }
    }
  }
}
