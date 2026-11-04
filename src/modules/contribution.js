/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    contributionRows,
    renderContribution,
    renderContributionChart,
    comparisonRecords,
    serializeComparisonRoute,
    parseComparisonRoute,
    renderComparisonWorkspace,
    drawComparisonChart,
  });
  ctx
    .$(".workspace-actions")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="contribution-open" title="分析候選人的票源、淨領先與地區優勢">票源分析</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    '<dialog id="contribution-dialog"><div class="dialog-header"><h2>選票貢獻分析</h2><button id="contribution-close" aria-label="關閉貢獻分析">×</button></div><div class="dialog-body"><div class="contribution-options"><label>候選人 A<select id="contribution-a"></select></label><label>比較候選人 B<select id="contribution-b"></select></label></div><p>全國貢獻＝地區A票數÷A全國票數；淨領先＝A票數−B票數；相對優勢＝A地區得票率−A全國得票率。累積比例依A票數由大至小加總。</p><div id="contribution-table"></div></div></dialog>',
  );
  ctx
    .$("#contribution-dialog .contribution-options")
    .insertAdjacentHTML(
      "beforeend",
      '<label>圖表<select id="contribution-view"><option value="curve">累積票源貢獻</option><option value="waterfall">淨領先票數</option></select></label>',
    );
  ctx
    .$("#contribution-table")
    .insertAdjacentHTML(
      "beforebegin",
      '<div class="contribution-visual"><svg id="contribution-chart" role="img" aria-label="票源貢獻分析圖"></svg><p id="contribution-chart-note"></p></div>',
    );
  function contributionRows() {
    if (ctx.isLeg()) return [];
    const a = ctx.$("#contribution-a").value,
      b = ctx.$("#contribution-b").value,
      nat = ctx.records["00000/000"].candidates.find((c) => c.name === a);
    let accumulated = 0;
    return ctx
      .scoped()
      .map((r) => {
        const av = r.candidates.find((c) => c.name === a)?.votes || 0,
          bv = r.candidates.find((c) => c.name === b)?.votes || 0;
        return {
          r,
          av,
          net: av - bv,
          contribution: (av / nat.votes) * 100,
          advantage:
            (av / r.total) * 100 -
            (nat.votes / ctx.records["00000/000"].total) * 100,
        };
      })
      .sort((x, y) => y.av - x.av)
      .map((d) => ({ ...d, cumulative: (accumulated += d.contribution) }));
  }
  function renderContribution() {
    const rs = ctx.contributionRows();
    ctx.$("#contribution-table").innerHTML =
      '<table class="analysis-table"><thead><tr><th>地區</th><th>A票數</th><th>全國貢獻</th><th>累積貢獻</th><th>A−B票數</th><th>相對全國優勢</th></tr></thead><tbody>' +
      rs
        .map(
          (d) =>
            "<tr><td>" +
            ctx.esc(ctx.areaName(d.r, true)) +
            "</td><td>" +
            ctx.fmt(d.av) +
            "</td><td>" +
            ctx.pct(d.contribution) +
            "</td><td>" +
            ctx.pct(d.cumulative) +
            "</td><td>" +
            ctx.fmt(d.net) +
            "</td><td>" +
            ctx.sign(d.advantage) +
            " pp</td></tr>",
        )
        .join("") +
      "</tbody></table>";
    ctx.renderContributionChart(rs);
  }
  function renderContributionChart(rs) {
    const svg = ctx.d3
      .select("#contribution-chart")
      .attr("viewBox", "0 0 900 270");
    svg.selectAll("*").remove();
    const left = 75,
      right = 875,
      top = 20,
      bottom = 220,
      note = ctx.$("#contribution-chart-note"),
      a = ctx.$("#contribution-a").value,
      b = ctx.$("#contribution-b").value;
    if (!rs.length) {
      note.textContent = "目前範圍沒有符合的地區。";
      return;
    }
    if (ctx.$("#contribution-view").value === "curve") {
      const x = ctx.d3
          .scaleLinear()
          .domain([0, rs.length])
          .range([left, right]),
        y = ctx.d3.scaleLinear().domain([0, 100]).range([bottom, top]),
        points = [
          { index: 0, cumulative: 0 },
          ...rs.map((d, i) => ({ ...d, index: i + 1 })),
        ];
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(0,${bottom})`)
        .call(ctx.d3.axisBottom(x).ticks(7).tickFormat(ctx.d3.format("d")));
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(${left},0)`)
        .call(
          ctx.d3
            .axisLeft(y)
            .ticks(5)
            .tickFormat((d) => d + "%")
            .tickSize(-(right - left)),
        );
      svg
        .append("path")
        .datum(points)
        .attr("fill", "none")
        .attr(
          "stroke",
          ctx.color(
            ctx.records["00000/000"].candidates.find((c) => c.name === a).party,
          ),
        )
        .attr("stroke-width", 3)
        .attr(
          "d",
          ctx.d3
            .line()
            .x((d) => x(d.index))
            .y((d) => y(d.cumulative)),
        );
      const last = points.at(-1);
      svg
        .append("circle")
        .attr("cx", x(last.index))
        .attr("cy", y(last.cumulative))
        .attr("r", 5)
        .attr("fill", "#172331");
      svg
        .append("text")
        .attr("class", "scatter-label")
        .attr("x", right)
        .attr("y", Math.max(top + 12, y(last.cumulative) - 10))
        .attr("text-anchor", "end")
        .text(ctx.pct(last.cumulative) + " 全國得票");
      note.textContent =
        "依 " +
        a +
        " 的地區票數由多至少累積；分母為其全國票數。目前範圍 " +
        rs.length +
        " 地區，合計 " +
        ctx.pct(last.cumulative) +
        "。橫軸為地區數，並非人口比例。";
      return;
    }
    const aggregateByCounty =
        rs.length > 30 && rs.every((d) => d.r.town !== "000"),
      grouped = aggregateByCounty
        ? Array.from(
            ctx.d3.group(rs, (d) => d.r.county),
            ([county, items]) => ({
              name: ctx.data.counties[county],
              net: ctx.d3.sum(items, (d) => d.net),
              votes: ctx.d3.sum(items, (d) => d.av),
            }),
          ).sort((a, b) => b.votes - a.votes)
        : rs.map((d) => ({ name: ctx.areaName(d.r, true), net: d.net }));
    let running = 0;
    for (const item of grouped) {
      item.start = running;
      running += item.net;
      item.end = running;
    }
    const x = ctx.d3
        .scaleBand()
        .domain(ctx.d3.range(grouped.length))
        .range([left, right])
        .padding(0.2),
      y = ctx.d3
        .scaleLinear()
        .domain([
          Math.min(
            0,
            ctx.d3.min(grouped, (d) => Math.min(d.start, d.end)),
          ),
          Math.max(
            0,
            ctx.d3.max(grouped, (d) => Math.max(d.start, d.end)),
          ),
        ])
        .nice()
        .range([bottom, top]);
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", `translate(${left},0)`)
      .call(
        ctx.d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(right - left))
          .tickFormat(ctx.d3.format("~s")),
      );
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", `translate(0,${bottom})`)
      .call(
        ctx.d3
          .axisBottom(x)
          .tickValues(
            ctx.d3
              .range(grouped.length)
              .filter(
                (i) => i % Math.max(1, Math.ceil(grouped.length / 7)) === 0,
              ),
          )
          .tickFormat((i) => grouped[i].name.replace(/縣|市/g, "").slice(0, 4)),
      )
      .select(".domain")
      .remove();
    svg
      .append("line")
      .attr("x1", left)
      .attr("x2", right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#687787");
    svg
      .selectAll(".waterfall-bar")
      .data(grouped)
      .join("rect")
      .attr("class", "waterfall-bar")
      .attr("x", (_, i) => x(i))
      .attr("width", x.bandwidth())
      .attr("y", (d) => y(Math.max(d.start, d.end)))
      .attr("height", (d) => Math.max(1, Math.abs(y(d.start) - y(d.end))))
      .attr("fill", (d) => (d.net >= 0 ? "#16804f" : "#a65c46"))
      .append("title")
      .text(
        (d) =>
          d.name +
          "：" +
          ctx.fmt(d.net) +
          " 票；累積 " +
          ctx.fmt(d.end) +
          " 票",
      );
    svg
      .append("text")
      .attr("class", "scatter-label")
      .attr("x", right)
      .attr("y", Math.max(top + 12, y(running) - 8))
      .attr("text-anchor", "end")
      .text("合計 " + ctx.fmt(running) + " 票");
    note.textContent =
      a +
      " − " +
      b +
      "，依 A 地區票數排序逐步累加；正值表示 A 領先，負值表示 B 領先。" +
      (aggregateByCounty
        ? "每欄為目前範圍內同縣市的鄉鎮票數加總。"
        : "每欄一個地區。") +
      "各欄數值可懸停查看。";
  }
  ctx.$("#contribution-open").onclick = () => {
    if (ctx.isLeg()) return;
    const cs = ctx.records["00000/000"].candidates;
    for (const id of ["a", "b"])
      ctx.$("#contribution-" + id).innerHTML = cs
        .map((c) => "<option>" + ctx.esc(c.name) + "</option>")
        .join("");
    ctx.$("#contribution-a").value = ctx.state.candidate;
    ctx.$("#contribution-b").value = cs.find(
      (c) => c.name !== ctx.state.candidate,
    ).name;
    ctx.renderContribution();
    ctx.$("#contribution-dialog").showModal();
  };
  ctx.$("#contribution-close").onclick = () =>
    ctx.$("#contribution-dialog").close();
  for (const id of ["a", "b", "view"])
    ctx.$("#contribution-" + id).onchange = ctx.renderContribution;
  ctx.compareBaseline = true;
  ctx.comparisonView = "bars";
  ctx.comparisonMetric = "share";
  ctx.comparisonPair = [0, 1];
  function comparisonRecords() {
    const aggregate = ctx.aggregateCurrentSelection();
    return [
      ...ctx.state.pins.map((k) => ctx.records[k]).filter(Boolean),
      ...(aggregate ? [aggregate] : []),
      ...(!ctx.isLeg() && ctx.compareBaseline
        ? [ctx.records["00000/000"]]
        : []),
    ];
  }
  function serializeComparisonRoute(p) {
    if (!ctx.compareBaseline) p.set("baseline", "0");
    if (ctx.state.drawer === "compare") {
      p.set("comparison-view", ctx.comparisonView);
      p.set("comparison-metric", ctx.comparisonMetric);
      p.set("comparison-pair", ctx.comparisonPair.join(","));
    }
  }
  function parseComparisonRoute(p) {
    ctx.compareBaseline = p.get("baseline") !== "0";
    ctx.comparisonView =
      p.has("comparison-view") ? p.get("comparison-view") === "dumbbell" ? "dumbbell" : "bars" : ctx.state.pins.length === 2 && !ctx.isLeg() ? "dumbbell" : "bars";
    ctx.comparisonAutoSignature = ctx.state.pins.join(",");
    ctx.comparisonMetric = ["turnout", "valid", "margin"].includes(
      p.get("comparison-metric"),
    )
      ? p.get("comparison-metric")
      : "share";
    const pair = (p.get("comparison-pair") || "0,1").split(",").map(Number);
    ctx.comparisonPair =
      pair.length === 2 &&
      pair.every((n) => Number.isInteger(n) && n >= 0 && n <= 4)
        ? pair
        : [0, 1];
  }
  function renderComparisonWorkspace() {
    const aggregate = ctx.aggregateCurrentSelection();
    const signature = ctx.state.pins.join(",");
    if (signature !== ctx.comparisonAutoSignature) {
      if (!ctx.isLeg()) ctx.comparisonView = ctx.state.pins.length === 2 ? "dumbbell" : "bars";
      ctx.comparisonPair = [0, 1];
      ctx.comparisonAutoSignature = signature;
    }
    if (
      ctx.state.drawer !== "compare" ||
      (!ctx.state.pins.length && !aggregate)
    )
      return;
    const baseline = !ctx.isLeg() ? ctx.records["00000/000"] : null,
      rs = ctx.comparisonRecords();
    const names = [
      ...new Set(rs.flatMap((r) => r.candidates.map((c) => c.name))),
    ];
    ctx.$("#compare-content").innerHTML =
      (baseline
        ? '<label class="comparison-baseline"><input id="compare-baseline" type="checkbox" ' +
          (ctx.compareBaseline ? "checked" : "") +
          ">顯示全國基準</label>"
        : "") +
      '<table class="analysis-table compare-matrix"><thead><tr><th>指標</th>' +
      rs
        .map(
          (r) =>
            "<th>" +
            ctx.esc(r.aggregateName || ctx.areaName(r, true)) +
            "</th>",
        )
        .join("") +
      "</tr></thead><tbody>" +
      ["有效票數", "投票率", "較全國投票率", "前兩名差距"]
        .map(
          (name, i) =>
            "<tr><th>" +
            name +
            "</th>" +
            rs
              .map(
                (r) =>
                  "<td>" +
                  (i === 0
                    ? ctx.fmt(r.total)
                    : i === 1
                      ? ctx.pct(ctx.turnoutOf(r))
                      : i === 2
                        ? baseline
                          ? ctx.sign(
                              ctx.turnoutOf(r) - ctx.turnoutOf(baseline),
                            ) + " pp"
                          : "—"
                        : ctx.marginOf(r).toFixed(2) + " pp") +
                  "</td>",
              )
              .join("") +
            "</tr>",
        )
        .join("") +
      names
        .map(
          (name) =>
            "<tr><th>" +
            ctx.esc(name) +
            "</th>" +
            rs
              .map((r) => {
                const c = r.candidates.find((c) => c.name === name),
                  share = c ? (c.votes / r.total) * 100 : 0;
                return (
                  "<td>" +
                  (c
                    ? '<div class="comparison-bar"><i style="width:' +
                      share +
                      "%;background:" +
                      ctx.color(c.party) +
                      '"></i></div>' +
                      ctx.pct(share)
                    : "—") +
                  "</td>"
                );
              })
              .join("") +
            "</tr>",
        )
        .join("") +
      '</tbody></table><button id="clear-comparison">清除比較地區</button>';
    ctx
      .$("#compare-content")
      .insertAdjacentHTML(
        "afterbegin",
        '<div class="comparison-chart-controls"><label>圖形<select id="comparison-view"><option value="bars">並列橫條</option><option value="dumbbell">兩地區啞鈴</option></select></label><label id="comparison-metric-label">指標<select id="comparison-metric"><option value="share">候選人得票率</option><option value="turnout">投票率</option><option value="valid">有效票</option><option value="margin">前兩名差距</option></select></label><label id="comparison-pair-a-label">地區A<select id="comparison-pair-a"></select></label><label id="comparison-pair-b-label">地區B<select id="comparison-pair-b"></select></label><button id="comparison-svg">圖表 SVG</button></div><div class="comparison-visuals"><svg id="comparison-chart" role="img" aria-label="多地區選舉統計比較"></svg><div class="comparison-table-wrap"></div></div>',
      );
    ctx.$(".comparison-table-wrap").append(ctx.$(".compare-matrix"));
    if (ctx.isLeg()) ctx.comparisonView = "bars";
    ctx.$("#comparison-view").value = ctx.comparisonView;
    ctx.$("#comparison-view option[value=dumbbell]").disabled =
      ctx.isLeg() || rs.length < 2;
    ctx.$("#comparison-metric").value = ctx.comparisonMetric;
    for (const [id, index] of [
      ["a", 0],
      ["b", 1],
    ]) {
      ctx.comparisonPair[index] = Math.min(
        ctx.comparisonPair[index],
        rs.length - 1,
      );
      ctx.$("#comparison-pair-" + id).innerHTML = rs
        .map(
          (r, i) =>
            '<option value="' +
            i +
            '">' +
            ctx.esc(r.aggregateName || ctx.areaName(r, true)) +
            "</option>",
        )
        .join("");
      ctx.$("#comparison-pair-" + id).value = String(ctx.comparisonPair[index]);
      ctx.$("#comparison-pair-" + id + "-label").hidden =
        ctx.comparisonView !== "dumbbell";
      ctx.$("#comparison-pair-" + id).onchange = (ev) => {
        ctx.comparisonPair[index] = Number(ev.target.value);
        ctx.renderDrawer();
        ctx.updateHash();
      };
    }
    ctx.$("#comparison-metric-label").hidden =
      ctx.comparisonView === "dumbbell";
    ctx.$("#comparison-view").onchange = (ev) => {
      ctx.comparisonView = ev.target.value;
      ctx.renderDrawer();
      ctx.updateHash();
    };
    ctx.$("#comparison-metric").onchange = (ev) => {
      ctx.comparisonMetric = ev.target.value;
      ctx.renderDrawer();
      ctx.updateHash();
    };
    ctx.drawComparisonChart(rs);
    ctx.$("#comparison-svg").onclick = () =>
      ctx.saveBlob(
        new Blob(
          [
            ctx.standaloneSVGPanel(
              ctx.$("#comparison-chart"),
              "2024 " + (ctx.isLeg() ? "區域立委" : "總統") + " · 地區比較",
              "依原始票數計算；比率先加總再計算；資料來源為中選會最終結果",
            ),
          ],
          { type: "image/svg+xml;charset=utf-8" },
        ),
        "臺灣選舉-地區比較.svg",
      );
    if (baseline)
      ctx.$("#compare-baseline").onchange = (ev) => {
        ctx.compareBaseline = ev.target.checked;
        ctx.renderDrawer();
        ctx.updateHash();
      };
    ctx.$("#clear-comparison").onclick = () => {
      ctx.state.pins = [];
      ctx.updateUI();
    };
  }

  function drawComparisonChart(rs) {
    const svg = ctx.d3.select("#comparison-chart"),
      width = 620,
      height = Math.max(320, rs.length * 64 + 80);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();
    const left = 150,
      right = 588,
      top = 35,
      bottom = height - 42;
    if (ctx.comparisonView === "dumbbell" && !ctx.isLeg()) {
      const a = rs[ctx.comparisonPair[0]],
        b = rs[ctx.comparisonPair[1]],
        cs = ctx.records["00000/000"].candidates,
        values = cs.flatMap((c) => [
          ctx.shareOf(a, c.name),
          ctx.shareOf(b, c.name),
        ]),
        extent = ctx.d3.extent(values),
        domain = [
          Math.max(0, Math.floor(extent[0] / 5) * 5),
          Math.min(100, Math.ceil(extent[1] / 5) * 5),
        ],
        x = ctx.d3
          .scaleLinear()
          .domain(domain[1] > domain[0] ? domain : [0, 100])
          .range([left, right]),
        y = ctx.d3
          .scalePoint()
          .domain(cs.map((c) => c.name))
          .range([top + 35, bottom - 55]);
      svg
        .append("g")
        .attr("class", "scatter-axis")
        .attr("transform", `translate(0,${bottom})`)
        .call(
          ctx.d3
            .axisBottom(x)
            .ticks(5)
            .tickFormat((v) => v + "%"),
        );
      svg
        .append("text")
        .attr("class", "scatter-label")
        .attr("x", 0)
        .attr("y", 17)
        .text("A " + (a.aggregateName || ctx.areaName(a, true)));
      svg
        .append("text")
        .attr("class", "scatter-label")
        .attr("x", 0)
        .attr("y", 34)
        .text("B " + (b.aggregateName || ctx.areaName(b, true)));
      for (const c of cs) {
        const av = ctx.shareOf(a, c.name),
          bv = ctx.shareOf(b, c.name),
          cy = y(c.name);
        svg
          .append("text")
          .attr("x", 0)
          .attr("y", cy + 4)
          .attr("font-size", 13)
          .attr("fill", ctx.color(c.party))
          .text(c.name);
        svg
          .append("line")
          .attr("x1", x(av))
          .attr("x2", x(bv))
          .attr("y1", cy)
          .attr("y2", cy)
          .attr("stroke", "#7e8d98")
          .attr("stroke-width", 2);
        for (const [value, fill, dy, label] of [
          [av, "#d59224", -12, "A"],
          [bv, "#842cb1", 22, "B"],
        ]) {
          svg
            .append("circle")
            .attr("class", "comparison-dumbbell-point")
            .attr("data-candidate", c.name)
            .attr("data-group", label)
            .attr("data-share", value)
            .attr("cx", x(value))
            .attr("cy", cy)
            .attr("r", 5)
            .attr("fill", fill);
          svg
            .append("text")
            .attr("x", x(value))
            .attr("y", cy + dy)
            .attr("text-anchor", "middle")
            .attr("font-size", 14)
            .attr("fill", fill)
            .text(label + " " + ctx.pct(value));
        }
        svg
          .append("text")
          .attr("x", right)
          .attr("y", cy + 38)
          .attr("text-anchor", "end")
          .attr("font-size", 12)
          .attr("fill", "#526575")
          .text("A−B " + ctx.sign(av - bv) + "pp");
      }
      return;
    }
    const byCandidate = ctx.comparisonMetric === "share",
      max =
        ctx.comparisonMetric === "valid"
          ? ctx.d3.max(rs, (r) => r.total)
          : ctx.comparisonMetric === "margin"
            ? Math.max(10, ctx.d3.max(rs, ctx.marginOf))
            : 100,
      x = ctx.d3
        .scaleLinear()
        .domain([0, max || 1])
        .nice()
        .range([left, right]),
      row = ctx.d3
        .scaleBand()
        .domain(ctx.d3.range(rs.length))
        .range([top, bottom])
        .padding(0.18);
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", `translate(0,${bottom})`)
      .call(
        ctx.d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((v) =>
            ctx.comparisonMetric === "valid"
              ? ctx.d3.format("~s")(v)
              : v + (ctx.comparisonMetric === "margin" ? "pp" : "%"),
          ),
      );
    rs.forEach((r, i) => {
      const cy = row(i),
        cs = byCandidate
          ? ctx.isLeg()
            ? r.candidates.slice(0, 1)
            : ctx.records["00000/000"].candidates.map((c) => ({
                ...c,
                votes: r.candidates.find((x) => x.name === c.name)?.votes || 0,
              }))
          : [
              {
                name: "",
                party: "",
                value:
                  ctx.comparisonMetric === "valid"
                    ? r.total
                    : ctx.comparisonMetric === "turnout"
                      ? ctx.turnoutOf(r)
                      : ctx.marginOf(r),
              },
            ];
      svg
        .append("text")
        .attr("x", left - 12)
        .attr("y", cy + row.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", 12)
        .attr("fill", "#394856")
        .text(r.aggregateName || ctx.areaName(r, true));
      cs.forEach((c, j) => {
        const value = byCandidate ? (c.votes / r.total) * 100 : c.value,
          y = cy + (j * row.bandwidth()) / cs.length,
          h = Math.min(12, row.bandwidth() / cs.length - 2),
          end = x(value);
        svg
          .append("rect")
          .attr("class", "comparison-value-bar")
          .attr("data-region", r.aggregateName ? "selection" : ctx.keyOf(r))
          .attr("data-candidate", c.name)
          .attr("data-value", value)
          .attr("x", left)
          .attr("y", y)
          .attr("width", Math.max(0, end - left))
          .attr("height", Math.max(2, h))
          .attr("fill", byCandidate ? ctx.color(c.party) : "#5b8b91")
          .append("title")
          .text(c.name + " " + (byCandidate ? ctx.pct(value) : value));
        svg
          .append("text")
          .attr("x", Math.min(right + 25, end + 5))
          .attr("y", y + h)
          .attr("font-size", 12)
          .attr("fill", "#526575")
          .text(
            ctx.comparisonMetric === "valid"
              ? ctx.fmt(value)
              : Number(value).toFixed(2),
          );
      });
    });
    if (byCandidate && !ctx.isLeg())
      ctx.records["00000/000"].candidates.forEach((c, i) => {
        svg
          .append("rect")
          .attr("x", left + i * 135)
          .attr("y", 8)
          .attr("width", 8)
          .attr("height", 8)
          .attr("fill", ctx.color(c.party));
        svg
          .append("text")
          .attr("x", left + i * 135 + 14)
          .attr("y", 16)
          .attr("font-size", 12)
          .attr("fill", "#526575")
          .text(c.name);
      });
  }
}
