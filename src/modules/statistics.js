/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    syncScatterSettings,
    axisValue,
    drawStatTemplate,
    prepareStatisticsControls,
    decorateSwarmStatistics,
    drawStatScatter,
    serializeStatisticsRoute,
    parseStatisticsRoute,
  });
  ctx.statsOther = "侯友宜";
  ctx.axes = { x: "turnout", y: "margin", size: "votes", color: "party" };
  ctx.labels = {
    turnout: "投票率（%）",
    margin: "前兩名差距（pp）",
    share: "候選人得票率（%）",
    votes: "有效票數",
  };
  ctx
    .$(".map-workspace")
    .insertAdjacentHTML(
      "beforeend",
      '<div id="axes-control" class="axes-control" hidden><label>X軸<select id="axis-x"></select></label><label>Y軸<select id="axis-y"></select></label><label>點大小<select id="axis-size"><option value="votes">有效票（面積）</option><option value="fixed">固定大小</option></select></label><label>顏色<select id="axis-color"><option value="party">第一名政黨</option><option value="county">所屬縣市</option></select></label></div>',
    );
  for (const id of ["x", "y"]) {
    ctx.$("#axis-" + id).innerHTML = Object.entries(ctx.labels)
      .map(([v, l]) => '<option value="' + v + '">' + l + "</option>")
      .join("");
    ctx.$("#axis-" + id).value = ctx.axes[id];
  }
  for (const id of Object.keys(ctx.axes))
    ctx.$("#axis-" + id).onchange = (ev) => {
      ctx.axes[id] = ev.target.value;
      ctx.updateUI();
    };
  ctx
    .$("#axes-control")
    .insertAdjacentHTML(
      "beforeend",
      '<label id="axis-candidate-label" hidden>候選人<select id="axis-candidate"><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select></label>',
    );
  ctx.$("#axis-candidate").onchange = (ev) => {
    ctx.state.candidate = ev.target.value;
    ctx.updateUI();
  };
  ctx.scatterSettings = {
    xScale: "linear",
    yScale: "linear",
    xMin: "",
    xMax: "",
    yMin: "",
    yMax: "",
    quadrants: true,
    trend: false,
    labels: false,
    brush: false,
    neutral: false,
  };
  ctx
    .$("#axes-control")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="scatter-settings-open">座標與分析設定</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    '<dialog id="scatter-settings-dialog" class="scatter-settings-dialog"><form id="scatter-settings-form"><div class="filter-title"><h2>散點圖設定</h2><button type="button" id="scatter-settings-close" aria-label="關閉散點設定">×</button></div><p>空白範圍採目前地區的資料範圍。對數軸只顯示正值，保留原始數值讀數。</p><div class="scatter-settings-grid">' +
      ["x", "y"]
        .map(
          (k) =>
            "<fieldset><legend>" +
            k.toUpperCase() +
            ' 軸</legend><label>尺度<select id="scatter-' +
            k +
            'Scale"><option value="linear">線性</option><option value="log">對數（10底）</option></select></label><label>最小值<input id="scatter-' +
            k +
            'Min" type="number" step="any" placeholder="自動"></label><label>最大值<input id="scatter-' +
            k +
            'Max" type="number" step="any" placeholder="自動"></label></fieldset>',
        )
        .join("") +
      '</div><div class="scatter-settings-checks">' +
      [
        ["quadrants", "兩軸中位數／四象限"],
        ["trend", "線性趨勢與 R²（地區等權）"],
        ["labels", "標示目前選取與五個最大地區"],
        ["brush", "開啟框選地區"],
        ["neutral", "中性色；只強調選取地區"],
      ]
        .map(
          ([k, label]) =>
            '<label><input type="checkbox" id="scatter-' +
            k +
            '">' +
            label +
            "</label>",
        )
        .join("") +
      '</div><p id="scatter-settings-error" role="alert"></p><div class="filter-actions"><button type="button" id="scatter-settings-reset">還原自動範圍</button><button type="submit">套用</button></div></form></dialog>',
  );
  function syncScatterSettings() {
    for (const [k, v] of Object.entries(ctx.scatterSettings)) {
      const el = ctx.$("#scatter-" + k);
      if (typeof v === "boolean") el.checked = v;
      else el.value = v;
    }
  }
  ctx.$("#scatter-settings-open").onclick = () => {
    ctx.syncScatterSettings();
    ctx.$("#scatter-settings-error").textContent = "";
    ctx.$("#scatter-settings-dialog").showModal();
  };
  ctx.$("#scatter-settings-close").onclick = () =>
    ctx.$("#scatter-settings-dialog").close();
  ctx.$("#scatter-settings-reset").onclick = () => {
    for (const k of ["xMin", "xMax", "yMin", "yMax"])
      ctx.$("#scatter-" + k).value = "";
    ctx.$("#scatter-xScale").value = "linear";
    ctx.$("#scatter-yScale").value = "linear";
  };
  ctx.$("#scatter-settings-form").onsubmit = (ev) => {
    ev.preventDefault();
    const next = {};
    for (const [k, v] of Object.entries(ctx.scatterSettings))
      next[k] =
        typeof v === "boolean"
          ? ctx.$("#scatter-" + k).checked
          : ctx.$("#scatter-" + k).value;
    for (const k of ["x", "y"]) {
      const lo = next[k + "Min"],
        hi = next[k + "Max"];
      if (lo !== "" && hi !== "" && Number(lo) >= Number(hi)) {
        ctx.$("#scatter-settings-error").textContent =
          k.toUpperCase() + " 軸最小值必須小於最大值";
        return;
      }
      if (
        next[k + "Scale"] === "log" &&
        [lo, hi].some((v) => v !== "" && Number(v) <= 0)
      ) {
        ctx.$("#scatter-settings-error").textContent = "對數軸範圍必須大於0";
        return;
      }
    }
    ctx.scatterSettings = next;
    ctx.$("#scatter-settings-dialog").close();
    ctx.updateUI();
  };
  ctx
    .$("#distribution-filter")
    .insertAdjacentHTML(
      "beforeend",
      '<label id="swarm-neutral-label"><input type="checkbox" id="swarm-neutral">中性色</label>',
    );
  ctx.$("#swarm-neutral").onchange = (ev) => {
    ctx.scatterSettings.neutral = ev.target.checked;
    ctx.updateUI();
  };
  function axisValue(r, field) {
    if (field === "share") return ctx.shareOf(r, ctx.state.candidate) ?? 0;
    if (field === "votes") return r.total;
    if (field === "margin") return ctx.marginOf(r);
    return ctx.turnoutOf(r);
  }
  ctx
    .$("#distribution-style")
    .insertAdjacentHTML(
      "beforeend",
      '<option value="histogram">得票率直方圖</option><option value="ecdf">累積分布 ECDF</option><option value="box">縣市箱線圖</option><option value="dumbbell">候選人啞鈴圖</option>',
    );
  ctx
    .$(".map-workspace")
    .insertAdjacentHTML(
      "beforeend",
      '<div id="stat-template-controls" class="stat-template-controls" hidden><label>候選人 A<select id="stats-candidate"><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select></label><label id="stats-other-label">候選人 B<select id="stats-other"><option>侯友宜</option><option>賴清德</option><option>柯文哲</option></select></label></div>',
    );
  ctx.$("#stats-candidate").onchange = (ev) => {
    ctx.state.candidate = ev.target.value;
    ctx.updateUI();
  };
  ctx.$("#stats-other").onchange = (ev) => {
    ctx.statsOther = ev.target.value;
    ctx.updateUI();
  };
  ctx.$("#distribution-style").onchange = (ev) => {
    ctx.state.distribution = ev.target.value;
    ctx.updateUI();
  };
  function drawStatTemplate() {
    const rs = ctx.scoped(),
      host = ctx.chartDimensions(),
      cw = host.width,
      ch = host.height,
      svg = ctx.d3.select("#scatter").attr("viewBox", `0 0 ${cw} ${ch}`);
    svg.selectAll("*").remove();
    const mode = ctx.state.distribution,
      candidate = ctx.state.candidate,
      other = ctx.statsOther,
      top = ctx.chartToolsBottom() + 48,
      left = mode === "dumbbell" ? 180 : 75,
      right = cw - 35,
      bottom = ch - (mode === "box" ? 105 : 65),
      x = ctx.d3.scaleLinear().domain([0, 100]).range([left, right]);
    ctx.$("#stats-candidate").value = candidate;
    ctx.$("#stats-other").value = other;
    ctx.$("#stats-other-label").hidden = mode !== "dumbbell";
    ctx.$("#relative-control").hidden = true;
    if (mode === "ecdf") {
      const ordered = rs
        .slice()
        .sort((a, b) => ctx.shareOf(a, candidate) - ctx.shareOf(b, candidate));
      const nodes = ordered.map((r, i) => ({
        r,
        key: ctx.keyOf(r),
        x: ctx.shareOf(r, candidate),
        y: ((i + 1) / ordered.length) * 100,
      }));
      const y = ctx.d3.scaleLinear().domain([0, 100]).range([bottom, top]);
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(0,${bottom})`)
        .call(ctx.d3.axisBottom(x).tickFormat((v) => v + "%"));
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(${left},0)`)
        .call(
          ctx.d3
            .axisLeft(y)
            .ticks(5)
            .tickSize(-(right - left))
            .tickFormat((v) => v + "%"),
        );
      svg
        .append("path")
        .datum([{ x: 0, y: 0 }, ...nodes, { x: 100, y: 100 }])
        .attr("class", "ecdf-line")
        .attr(
          "d",
          ctx.d3
            .line()
            .curve(ctx.d3.curveStepAfter)
            .x((d) => x(d.x))
            .y((d) => y(d.y)),
        )
        .attr("fill", "none")
        .attr("stroke", "#326d85")
        .attr("stroke-width", 2);
      const dots = svg
        .selectAll(".ecdf-dot")
        .data(nodes)
        .join("circle")
        .attr("class", "ecdf-dot")
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => (d.key === ctx.state.key ? 7 : 3))
        .attr("data-share", (d) => d.x)
        .attr("data-cumulative", (d) => d.y)
        .attr("fill", (d) => ctx.color(d.r.candidates[0].party))
        .attr("stroke", "#fff");
      ctx.wireChart(dots);
      svg
        .append("text")
        .attr("x", left)
        .attr("y", top - 20)
        .attr("class", "scatter-label")
        .text("縱軸：得票率不高於橫軸值的地區比例 · n=" + nodes.length);
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">' +
        ctx.esc(candidate) +
        ' · 地區累積分布</div><div class="legend-foot">橫軸為候選人得票率；縱軸為地區累積比例。每個地區等權，不是累積選票貢獻。</div>';
    } else if (mode === "histogram") {
      const bins = ctx.d3
          .bin()
          .domain([0, 100])
          .thresholds(ctx.d3.range(5, 100, 5))
          .value((r) => ctx.shareOf(r, candidate))(rs),
        y = ctx.d3
          .scaleLinear()
          .domain([0, ctx.d3.max(bins, (b) => b.length) || 1])
          .nice()
          .range([bottom, top]);
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(0,${bottom})`)
        .call(
          ctx.d3
            .axisBottom(x)
            .ticks(10)
            .tickFormat((d) => d + "%"),
        );
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(${left},0)`)
        .call(
          ctx.d3
            .axisLeft(y)
            .ticks(5)
            .tickSize(-(right - left)),
        );
      svg
        .selectAll(".histogram-bin")
        .data(bins)
        .join("rect")
        .attr("class", "histogram-bin")
        .attr("data-count", (b) => b.length)
        .attr("x", (b) => x(b.x0) + 1)
        .attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 2))
        .attr("y", (b) => y(b.length))
        .attr("height", (b) => bottom - y(b.length))
        .attr("fill", "#5b8b91")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr(
          "aria-label",
          (b) => b.x0 + "至" + b.x1 + "%：" + b.length + "地區",
        )
        .on("click", (_, b) => {
          if (!b.length) return;
          ctx.state.brushed = b.map(ctx.keyOf);
          ctx.state.key = "";
          ctx.lastDetail = "";
          ctx.updateUI();
        })
        .on("keydown", (ev, b) => {
          if ((ev.key === "Enter" || ev.key === " ") && b.length) {
            ev.preventDefault();
            ctx.state.brushed = b.map(ctx.keyOf);
            ctx.state.key = "";
            ctx.lastDetail = "";
            ctx.updateUI();
          }
        })
        .append("title")
        .text((b) => b.x0 + "–" + b.x1 + "%：" + b.length + "個地區");
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">' +
        ctx.esc(candidate) +
        ' · 地區得票率分布</div><div class="legend-foot">橫軸為得票率，縱軸為地區數；每箱5百分點，地區等權。點選箱子篩選。</div>';
    } else if (mode === "box") {
      const groups = Array.from(
          ctx.d3.group(rs, (r) => r.county),
          ([county, items]) => {
            const values = items
              .map((r) => ctx.shareOf(r, candidate))
              .sort(ctx.d3.ascending);
            return {
              county,
              name: ctx.data.counties[county],
              n: values.length,
              min: values[0],
              q1: ctx.d3.quantileSorted(values, 0.25),
              median: ctx.d3.quantileSorted(values, 0.5),
              q3: ctx.d3.quantileSorted(values, 0.75),
              max: values.at(-1),
            };
          },
        ),
        bx = ctx.d3
          .scaleBand()
          .domain(groups.map((d) => d.county))
          .range([left, right])
          .padding(0.4),
        y = ctx.d3.scaleLinear().domain([0, 100]).range([bottom, top]);
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(${left},0)`)
        .call(
          ctx.d3
            .axisLeft(y)
            .ticks(5)
            .tickSize(-(right - left))
            .tickFormat((d) => d + "%"),
        );
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(0,${bottom})`)
        .call(ctx.d3.axisBottom(bx).tickFormat((c) => ctx.data.counties[c]))
        .selectAll("text")
        .attr("transform", "rotate(-40)")
        .attr("text-anchor", "end");
      const marks = svg
        .selectAll(".county-box")
        .data(groups)
        .join("g")
        .attr("class", "county-box")
        .attr("data-county", (d) => d.county)
        .attr("data-region-key", (d) => d.county + "/000")
        .classed("selected", (d) => ctx.state.key.split("/")[0] === d.county)
        .attr("data-count", (d) => d.n)
        .attr("data-q1", (d) => d.q1)
        .attr("data-median", (d) => d.median)
        .attr("data-q3", (d) => d.q3)
        .attr("transform", (d) => "translate(" + bx(d.county) + ",0)")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr(
          "aria-label",
          (d) =>
            d.name + " " + d.n + "地區；中位數" + d.median.toFixed(2) + "%",
        )
        .on("pointermove", (ev, d) => {
          ctx.chartTip(ev, ctx.records[d.county + "/000"]);
          ctx.$("#map-tooltip").innerHTML =
            '<div class="tip-place">' +
            ctx.esc(d.name) +
            "</div><p>" +
            d.n +
            " 個地區 · 等權分布</p><p>Q1 " +
            d.q1.toFixed(2) +
            "% · 中位數 " +
            d.median.toFixed(2) +
            "% · Q3 " +
            d.q3.toFixed(2) +
            "%</p>";
        })
        .on("pointerleave", () => {
          ctx.$("#map-tooltip").hidden = true;
        })
        .on("click", (_, d) => ctx.selectRegion(d.county + "/000", false))
        .on("keydown", (ev, d) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ctx.selectRegion(d.county + "/000", false);
          }
        });
      marks
        .append("line")
        .attr("x1", bx.bandwidth() / 2)
        .attr("x2", bx.bandwidth() / 2)
        .attr("y1", (d) => y(d.min))
        .attr("y2", (d) => y(d.max))
        .attr("stroke", "#526575");
      marks
        .append("rect")
        .attr("x", 0)
        .attr("width", bx.bandwidth())
        .attr("y", (d) => y(d.q3))
        .attr("height", (d) => Math.max(1, y(d.q1) - y(d.q3)))
        .attr("fill", "#b5d2d4")
        .attr("stroke", "#526575");
      marks
        .append("line")
        .attr("x1", 0)
        .attr("x2", bx.bandwidth())
        .attr("y1", (d) => y(d.median))
        .attr("y2", (d) => y(d.median))
        .attr("stroke", "#172331")
        .attr("stroke-width", 2);
      marks
        .append("title")
        .text(
          (d) =>
            d.name +
            " n=" +
            d.n +
            "；Q1 " +
            d.q1.toFixed(2) +
            "；中位數 " +
            d.median.toFixed(2) +
            "；Q3 " +
            d.q3.toFixed(2),
        );
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">' +
        ctx.esc(candidate) +
        ' · 各縣市地區分布</div><div class="legend-foot">盒為Q1–Q3，線為中位數，鬚為最小與最大值。地區等權，非選民分布；單一地區不形成分散程度。</div>';
    } else {
      const limit = Math.max(1, Math.min(20, Math.floor((bottom - top) / 20))),
        visible = rs
          .slice()
          .sort((a, b) => b.total - a.total)
          .slice(0, limit),
        extent = ctx.d3.extent(
          visible.flatMap((r) => [
            ctx.shareOf(r, candidate),
            ctx.shareOf(r, other),
          ]),
        );
      if (extent.every(Number.isFinite))
        x.domain([
          Math.max(0, Math.floor(extent[0] / 10) * 10 - 10),
          Math.min(100, Math.ceil(extent[1] / 10) * 10 + 10),
        ]);
      const y = ctx.d3
          .scaleBand()
          .domain(visible.map(ctx.keyOf))
          .range([top, bottom])
          .padding(0.35),
        ca = ctx.records["00000/000"].candidates.find(
          (c) => c.name === candidate,
        ),
        cb = ctx.records["00000/000"].candidates.find((c) => c.name === other);
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(0,${bottom})`)
        .call(
          ctx.d3
            .axisBottom(x)
            .ticks(5)
            .tickFormat((d) => d + "%"),
        );
      const marks = svg
        .selectAll(".dumbbell-row")
        .data(visible)
        .join("g")
        .attr("class", "dumbbell-row")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr(
          "aria-label",
          (r) =>
            ctx.areaName(r, true) +
            " " +
            candidate +
            " " +
            ctx.pct(ctx.shareOf(r, candidate)) +
            "；" +
            other +
            " " +
            ctx.pct(ctx.shareOf(r, other)),
        )
        .on("click", (_, r) => ctx.selectRegion(ctx.keyOf(r), false))
        .on("keydown", (ev, r) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ctx.selectRegion(ctx.keyOf(r), false);
          }
        });
      marks
        .append("line")
        .attr("x1", (r) => x(ctx.shareOf(r, candidate)))
        .attr("x2", (r) => x(ctx.shareOf(r, other)))
        .attr("y1", (r) => y(ctx.keyOf(r)) + y.bandwidth() / 2)
        .attr("y2", (r) => y(ctx.keyOf(r)) + y.bandwidth() / 2)
        .attr("stroke", "#a8b4bd")
        .attr("stroke-width", 2);
      for (const [name, c] of [
        [candidate, ca],
        [other, cb],
      ])
        marks
          .append("circle")
          .attr("cx", (r) => x(ctx.shareOf(r, name)))
          .attr("cy", (r) => y(ctx.keyOf(r)) + y.bandwidth() / 2)
          .attr("r", 4)
          .attr("fill", ctx.color(c.party));
      marks
        .append("text")
        .attr("class", "scatter-label")
        .attr("x", left - 12)
        .attr("y", (r) => y(ctx.keyOf(r)) + y.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .text((r) => ctx.areaName(r, true));
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">' +
        ctx.esc(candidate) +
        " 與 " +
        ctx.esc(other) +
        ' · 得票率</div><div class="legend-foot">目前範圍有效票最多的' +
        visible.length +
        "個地區；橫軸為得票率，兩點距離為百分點差。</div>";
    }
    ctx.$("#view-description").textContent = {
      histogram: "得票率分布直方圖",
      ecdf: "地區得票率累積分布",
      box: "縣市內部地區差異",
      dumbbell: "候選人得票率啞鈴圖",
    }[mode];
  }
  function prepareStatisticsControls() {
    ctx.$("#swarm-neutral-label").hidden =
      ctx.state.chart !== "scatter" || ctx.state.distribution !== "swarm";
    ctx.$("#swarm-neutral").checked = ctx.scatterSettings.neutral;
    const template =
      ["histogram", "ecdf", "box", "dumbbell"].includes(
        ctx.state.distribution,
      ) && !ctx.isLeg();
    ctx.$("#stat-template-controls").hidden =
      ctx.state.chart !== "scatter" || !template;
    for (const option of ctx.$("#distribution-style").options)
      if (["histogram", "ecdf", "box", "dumbbell"].includes(option.value))
        option.disabled = ctx.isLeg();
    if (
      ctx.isLeg() &&
      ["histogram", "ecdf", "box", "dumbbell"].includes(ctx.state.distribution)
    )
      ctx.state.distribution = "swarm";
    if (ctx.state.chart === "scatter" && template)
      ctx.$("#axes-control").hidden = true;
    if (ctx.isLeg()) {
      if (ctx.axes.x === "share") ctx.axes.x = "turnout";
      if (ctx.axes.y === "share") ctx.axes.y = "margin";
    }
    for (const key of ["x", "y"]) {
      ctx.$("#axis-" + key).value = ctx.axes[key];
      ctx.$("#axis-" + key).querySelector("option[value=share]").disabled =
        ctx.isLeg();
    }
    ctx.$("#axis-candidate-label").hidden =
      ctx.isLeg() ||
      !["share"].some((v) => ctx.axes.x === v || ctx.axes.y === v);
    ctx.$("#axis-candidate").value = ctx.state.candidate;
    ctx.$("#axes-control").hidden =
      ctx.state.chart !== "scatter" || ctx.state.distribution !== "scatter";
  }
  function decorateSwarmStatistics() {
    ctx.d3
      .select("#scatter")
      .selectAll(".swarm-dot")
      .attr("fill", (d) =>
        ctx.scatterSettings.neutral
          ? d.key === ctx.state.key
            ? "#172331"
            : "#9aa9b3"
          : ctx.color(d.r.candidates[0].party),
      );
    const rs = ctx.scoped(),
      cw = ctx.chartDimensions().width,
      ch = ctx.chartDimensions().height,
      x = ctx.d3
        .scaleLinear()
        .domain([
          0,
          Math.max(10, ctx.d3.max(rs, (r) => ctx.marginOf(r)) * 1.06),
        ])
        .nice()
        .range([78, cw - 45]),
      sorted = rs.map((r) => ctx.marginOf(r)).sort(ctx.d3.ascending),
      svg = ctx.d3.select("#scatter");
    const top = ctx.chartToolsBottom() + 62,
      values = [0.25, 0.5, 0.75].map((q) => ctx.d3.quantileSorted(sorted, q));
    svg
      .insert("rect", ":first-child")
      .attr("class", "swarm-iqr-band")
      .attr("x", x(values[0]))
      .attr("y", top)
      .attr("width", Math.max(0, x(values[2]) - x(values[0])))
      .attr("height", Math.max(0, ch - 65 - top))
      .attr("fill", "#956b33")
      .attr("opacity", 0.055)
      .attr("pointer-events", "none");
    values.forEach((value, i) => {
      svg
        .append("line")
        .attr("class", "swarm-quantile-line")
        .attr("data-quantile", [0.25, 0.5, 0.75][i])
        .attr("data-value", value)
        .attr("x1", x(value))
        .attr("x2", x(value))
        .attr("y1", top)
        .attr("y2", ch - 65)
        .attr("stroke", i === 1 ? "#956b33" : "#a0aab3")
        .attr("stroke-width", i === 1 ? 1.5 : 1)
        .attr("stroke-dasharray", i === 1 ? null : "4 4")
        .attr("pointer-events", "none");
      svg
        .append("text")
        .attr("class", "swarm-quantile-label")
        .attr("x", 78 + ((cw - 123) * i) / 2)
        .attr("y", top - 22)
        .attr("text-anchor", i === 0 ? "start" : i === 1 ? "middle" : "end")
        .attr("font-size", 13)
        .attr("fill", i === 1 ? "#76501f" : "#536575")
        .text(["Q1 ", "中位數 ", "Q3 "][i] + value.toFixed(2) + " pp");
    });
  }
  function drawStatScatter(
    target = null,
    dimensions = null,
    publication = false,
  ) {
    const host = dimensions || ctx.chartDimensions(),
      cw = Math.max(300, host.width),
      ch = Math.max(300, host.height),
      svg = (target || ctx.d3.select("#scatter")).attr(
        "viewBox",
        `0 0 ${cw} ${ch}`,
      );
    svg.selectAll("*").remove();
    const rs = ctx.scoped(),
      left = 70,
      right = cw - 38,
      top = publication ? 65 : ctx.chartToolsBottom() + 62,
      bottom = ch - 65,
      settings = ctx.scatterSettings;
    const eligible = rs.filter((r) =>
      ["x", "y"].every(
        (k) =>
          Number.isFinite(ctx.axisValue(r, ctx.axes[k])) &&
          (settings[k + "Scale"] !== "log" ||
            ctx.axisValue(r, ctx.axes[k]) > 0),
      ),
    );
    function scale(k) {
      const values = eligible.map((r) => ctx.axisValue(r, ctx.axes[k])),
        extent = ctx.d3.extent(values);
      let lo =
          settings[k + "Min"] === ""
            ? (extent[0] ?? (settings[k + "Scale"] === "log" ? 1 : 0))
            : Number(settings[k + "Min"]),
        hi =
          settings[k + "Max"] === ""
            ? (extent[1] ?? 10)
            : Number(settings[k + "Max"]);
      if (!(hi > lo)) {
        hi = lo + (settings[k + "Scale"] === "log" ? Math.max(1, lo) : 1);
      }
      const result = (
        settings[k + "Scale"] === "log"
          ? ctx.d3.scaleLog()
          : ctx.d3.scaleLinear()
      ).domain([lo, hi]);
      if (settings[k + "Min"] === "" && settings[k + "Max"] === "")
        result.nice();
      return result;
    }
    const x = scale("x").range([left, right]),
      y = scale("y").range([bottom, top]),
      radius = ctx.d3
        .scaleSqrt()
        .domain([0, ctx.d3.max(rs, (r) => r.total) || 1])
        .range([0, 20]),
      palette = ctx.countyColorScale(),
      inside = (r) => {
        const xv = ctx.axisValue(r, ctx.axes.x),
          yv = ctx.axisValue(r, ctx.axes.y);
        return (
          xv >= x.domain()[0] &&
          xv <= x.domain()[1] &&
          yv >= y.domain()[0] &&
          yv <= y.domain()[1]
        );
      },
      visible = eligible.filter(inside);
    const clipId = publication
      ? "publication-scatter-clip"
      : "scatter-plot-clip";
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", left)
      .attr("y", top)
      .attr("width", right - left)
      .attr("height", Math.max(1, bottom - top));
    const plot = svg
      .append("g")
      .attr("class", "scatter-plot")
      .attr("clip-path", "url(#" + clipId + ")");
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", `translate(0,${bottom})`)
      .call(
        ctx.d3
          .axisBottom(x)
          .ticks(6, settings.xScale === "log" ? "~g" : undefined),
      );
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", `translate(${left},0)`)
      .call(
        ctx.d3
          .axisLeft(y)
          .ticks(5, settings.yScale === "log" ? "~g" : undefined)
          .tickSize(-(right - left)),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("text")
      .attr("class", "scatter-label")
      .attr("x", left)
      .attr("y", top - 26)
      .text(
        ctx.labels[ctx.axes.y] +
          (ctx.axes.y === "share" ? " · " + ctx.state.candidate : "") +
          (settings.yScale === "log" ? " · 對數" : ""),
      );
    svg
      .append("text")
      .attr("class", "scatter-label")
      .attr("x", right)
      .attr("y", bottom + 40)
      .attr("text-anchor", "end")
      .text(
        ctx.labels[ctx.axes.x] +
          (ctx.axes.x === "share" ? " · " + ctx.state.candidate : "") +
          (settings.xScale === "log" ? " · 對數" : ""),
      );
    if (settings.quadrants && eligible.length) {
      for (const k of ["x", "y"]) {
        const median = ctx.d3.median(eligible, (r) =>
          ctx.axisValue(r, ctx.axes[k]),
        );
        plot
          .append("line")
          .attr("class", "quadrant-reference")
          .attr("x1", k === "x" ? x(median) : left)
          .attr("x2", k === "x" ? x(median) : right)
          .attr("y1", k === "y" ? y(median) : top)
          .attr("y2", k === "y" ? y(median) : bottom)
          .attr("stroke", "#956b33")
          .attr("stroke-dasharray", "4 4")
          .attr("data-median", median);
      }
      svg
        .append("text")
        .attr("class", "scatter-label")
        .attr("x", left)
        .attr("y", top - 9)
        .text("虛線：目前範圍地區中位數（等權）");
    }
    if (settings.trend && eligible.length >= 3) {
      const xs = eligible.map((r) => ctx.axisValue(r, ctx.axes.x)),
        ys = eligible.map((r) => ctx.axisValue(r, ctx.axes.y)),
        mx = ctx.d3.mean(xs),
        my = ctx.d3.mean(ys),
        xx = ctx.d3.sum(xs, (v) => (v - mx) ** 2),
        yy = ctx.d3.sum(ys, (v) => (v - my) ** 2),
        xy = ctx.d3.sum(xs, (v, i) => (v - mx) * (ys[i] - my));
      if (xx > 0 && yy > 0) {
        const { slope, intercept, r2 } = ctx.metrics.ordinaryLeastSquares(
            xs.map((v, i) => [v, ys[i]]),
          ),
          points = ctx.d3
            .range(101)
            .map((i) => {
              const value = x.invert(left + ((right - left) * i) / 100);
              return { x: value, y: intercept + slope * value };
            })
            .filter((d) => settings.yScale !== "log" || d.y > 0);
        plot
          .append("path")
          .attr("class", "regression-line")
          .attr("data-slope", slope)
          .attr("data-intercept", intercept)
          .attr("data-r2", r2)
          .attr("data-count", eligible.length)
          .attr(
            "d",
            ctx.d3
              .line()
              .x((d) => x(d.x))
              .y((d) => y(d.y))(points),
          )
          .attr("fill", "none")
          .attr("stroke", "#172331")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "7 3");
        svg
          .append("text")
          .attr("class", "scatter-label")
          .attr("x", right)
          .attr("y", top - 9)
          .attr("text-anchor", "end")
          .text(
            "地區等權 OLS · n=" +
              eligible.length +
              " · R²=" +
              r2.toFixed(3) +
              " · 非因果",
          );
      }
    }
    const nodes = visible.map((r) => ({
        r,
        key: ctx.keyOf(r),
        x: x(ctx.axisValue(r, ctx.axes.x)),
        y: y(ctx.axisValue(r, ctx.axes.y)),
      })),
      dots = plot
        .selectAll(".scatter-dot")
        .data(nodes, (d) => d.key)
        .join("circle")
        .attr("class", "scatter-dot")
        .classed("mark-selected", (d) => d.key === ctx.state.key)
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", (d) => (ctx.axes.size === "fixed" ? 5 : radius(d.r.total)))
        .attr("fill", (d) =>
          settings.neutral
            ? d.key === ctx.state.key
              ? "#172331"
              : "#a1afb9"
            : ctx.axes.color === "county"
              ? palette(d.r.county)
              : ctx.color(d.r.candidates[0].party),
        )
        .attr("stroke", (d) => (d.key === ctx.state.key ? "#172331" : "white"));
    if (!publication) ctx.wireChart(dots);
    else dots.attr("data-region-key", (d) => d.key);
    if (settings.labels || ctx.state.key) {
      const selected = nodes.find((d) => d.key === ctx.state.key),
        largest = settings.labels
          ? nodes
              .slice()
              .sort((a, b) => b.r.total - a.r.total)
              .slice(0, 5)
          : [],
        labels = [
          ...new Map(
            [selected, ...largest].filter(Boolean).map((d) => [d.key, d]),
          ).values(),
        ];
      ctx.drawCallouts(
        svg,
        labels.map((d) => ({ ...d, label: ctx.areaName(d.r, true) })),
        { left: left + 5, top: top + 5, right: right - 5, bottom: bottom - 5 },
        "scatter-value-callouts",
      );
    }
    if (settings.brush && !publication) {
      const brush = ctx.d3
        .brush()
        .extent([
          [left, top],
          [right, bottom],
        ])
        .on("end", (ev) => {
          if (!ev.sourceEvent || !ev.selection) return;
          const [[x0, y0], [x1, y1]] = ev.selection;
          ctx.state.brushed = nodes
            .filter((d) => d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1)
            .map((d) => d.key);
          ctx.state.key = "";
          settings.brush = false;
          ctx.lastDetail = "";
          ctx.updateUI();
          ctx.toast(ctx.state.brushed.length + " 個地區已框選");
        });
      svg.append("g").attr("class", "scatter-brush").call(brush);
    }
    const colorEntries = settings.neutral
        ? [
            { name: "其他地區", fill: "#a1afb9" },
            { name: "目前選取", fill: "#172331" },
          ]
        : ctx.axes.color === "county"
          ? [...new Set(rs.map((r) => r.county))].map((c) => ({
              name: ctx.data.counties[c],
              fill: palette(c),
            }))
          : [...new Set(rs.map((r) => r.candidates[0].party))].map((p) => ({
              name: p,
              fill: ctx.color(p),
            })),
      colorLegend =
        '<div class="legend-parties">' +
        colorEntries
          .map(
            (c) =>
              '<span><i style="background:' +
              c.fill +
              '"></i>' +
              ctx.esc(c.name) +
              "</span>",
          )
          .join("") +
        "</div>",
      colorKey =
        colorEntries.length > 6
          ? '<details class="legend-color-details"><summary>縣市色彩圖例 ↗</summary>' +
            colorLegend +
            "</details>"
          : colorLegend;
    if (!publication) {
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">' +
        ctx.labels[ctx.axes.x] +
        " × " +
        ctx.labels[ctx.axes.y] +
        "</div>" +
        colorKey +
        '<div class="legend-foot">顯示 ' +
        visible.length +
        "／" +
        rs.length +
        " 地區；大小：" +
        (ctx.axes.size === "fixed" ? "每點相同" : "面積正比有效票") +
        "；顏色：" +
        (settings.neutral
          ? "中性／選取強調"
          : ctx.axes.color === "county"
            ? "縣市"
            : "第一名政黨") +
        "。" +
        (settings.trend
          ? "趨勢採地區等權最小平方法，表示關聯，不代表個人行為或因果。"
          : "") +
        "</div>";
      ctx.$("#view-description").textContent =
        "顯示 " +
        visible.length +
        "／" +
        rs.length +
        " 地區 · " +
        (settings.trend
          ? "地區等權線性關聯，不代表因果"
          : "範圍／尺度／參考線可調整");
    }
    return { visible: visible.length, total: rs.length };
  }
  function serializeStatisticsRoute(p) {
    for (const [k, v] of Object.entries(ctx.axes)) p.set("axis-" + k, v);
    if (
      !ctx.isLeg() &&
      (ctx.axes.x === "share" ||
        ctx.axes.y === "share" ||
        ["histogram", "ecdf", "box", "dumbbell"].includes(
          ctx.state.distribution,
        ))
    )
      p.set("candidate", ctx.state.candidate);
    if (ctx.state.distribution === "dumbbell") p.set("other", ctx.statsOther);
    if (ctx.state.chart === "scatter")
      for (const [k, v] of Object.entries(ctx.scatterSettings))
        if (v !== "") p.set("plot-" + k, String(v));
  }
  function parseStatisticsRoute(p) {
    ctx.statsOther = ["賴清德", "侯友宜", "柯文哲"].includes(p.get("other"))
      ? p.get("other")
      : "侯友宜";
    for (const k of ["x", "y"])
      ctx.axes[k] = ctx.labels[p.get("axis-" + k)]
        ? p.get("axis-" + k)
        : k === "x"
          ? "turnout"
          : "margin";
    ctx.axes.size = p.get("axis-size") === "fixed" ? "fixed" : "votes";
    ctx.axes.color = p.get("axis-color") === "county" ? "county" : "party";
    for (const k of Object.keys(ctx.axes))
      ctx.$("#axis-" + k).value = ctx.axes[k];
    for (const [k, v] of Object.entries(ctx.scatterSettings)) {
      const raw = p.get("plot-" + k);
      if (typeof v === "boolean")
        ctx.scatterSettings[k] =
          raw == null ? k === "quadrants" : raw === "true";
      else if (k.endsWith("Scale"))
        ctx.scatterSettings[k] = raw === "log" ? "log" : "linear";
      else
        ctx.scatterSettings[k] =
          raw !== null && raw !== "" && Number.isFinite(Number(raw)) ? raw : "";
    }
    for (const k of ["x", "y"]) {
      const lo = ctx.scatterSettings[k + "Min"],
        hi = ctx.scatterSettings[k + "Max"];
      if (
        (lo !== "" && hi !== "" && Number(lo) >= Number(hi)) ||
        (ctx.scatterSettings[k + "Scale"] === "log" &&
          [lo, hi].some((v) => v !== "" && Number(v) <= 0))
      )
        ctx.scatterSettings[k + "Min"] = ctx.scatterSettings[k + "Max"] = "";
    }
  }
}
