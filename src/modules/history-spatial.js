/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    loadCountyHistoryAdjacency,
    countyHistorySpatialStudies,
    countyHistorySpatialMetadata,
    countyHistorySpatialExclusion,
    renderCountyHistorySpatial,
  });
  /* Historical spatial comparison on a fixed, explicitly named statistical topology. */
  ctx.countyHistoryAdjacency = null;
  ctx.countyHistoryAdjacencyPromise = null;
  ctx.countyHistorySpatialCache = new Map();
  function loadCountyHistoryAdjacency() {
    if (!ctx.countyHistoryAdjacencyPromise)
      ctx.countyHistoryAdjacencyPromise = fetch("history-adjacency.json")
        .then((r) => {
          if (!r.ok) throw Error("county adjacency");
          return r.json();
        })
        .then((payload) => {
          ctx.countyHistoryAdjacency = payload;
          if (
            ctx.$("#county-history-dialog").open &&
            ctx.countyHistory.view === "spatial"
          )
            ctx.renderCountyHistory();
          return payload;
        })
        .catch((error) => {
          ctx.countyHistoryAdjacencyPromise = null;
          if (
            ctx.$("#county-history-dialog").open &&
            ctx.countyHistory.view === "spatial"
          )
            ctx.$("#county-history-readout").textContent =
              "鄰接資料載入失敗。重新切換視圖可再試。";
          throw error;
        });
    return ctx.countyHistoryAdjacencyPromise;
  }
  function countyHistorySpatialStudies() {
    const key = ctx.countyHistory.kind + "|" + ctx.countyHistory.metric;
    if (ctx.countyHistorySpatialCache.has(key))
      return ctx.countyHistorySpatialCache.get(key);
    const elections = ctx.countyHistoryAsset.elections,
      codes = ctx.COUNTY_ORDER.filter((code) =>
        elections.every((e) => ctx.countyHistoryValue(e.units[code]) != null),
      ),
      commonGraph = Object.fromEntries(
        codes.map((code) => [
          code,
          (ctx.countyHistoryAdjacency.rook[code] || []).filter((k) =>
            codes.includes(k),
          ),
        ]),
      );
    const studies = elections.map((e) => ({
      year: e.year,
      study: ctx.spatialMoran(
        codes.map((code) => ({
          key: code,
          value: ctx.countyHistoryValue(e.units[code]),
        })),
        commonGraph,
        999,
        2024,
      ),
    }));
    const result = {
      codes,
      graph: commonGraph,
      studies,
      unavailable: ctx.COUNTY_ORDER.filter((code) => !codes.includes(code)),
      isolates: codes.filter((code) => !commonGraph[code].length),
    };
    ctx.countyHistorySpatialCache.set(key, result);
    return result;
  }
  function countyHistorySpatialMetadata() {
    if (!ctx.countyHistoryAdjacency || !ctx.countyHistorySpatialCurrent)
      return null;
    const { codes, unavailable, isolates, studies } =
      ctx.countyHistorySpatialCurrent;
    return {
      topology: ctx.countyHistoryAdjacency.metadata,
      commonAvailableCodes: codes,
      unavailableCodes: unavailable,
      isolates,
      metric: ctx.countyHistory.metric,
      permutations: 999,
      seed: 2024,
      weighting: "row_standardized_equal_counties",
      years: studies.map(({ year, study: s }) => ({
        year,
        n: s.n,
        I: s.I,
        pUpper: s.pUpper,
        expected: s.expected,
      })),
    };
  }
  function countyHistorySpatialExclusion(code) {
    if (!ctx.countyHistorySpatialCurrent) return "";
    if (ctx.countyHistorySpatialCurrent.unavailable.includes(code))
      return (
        "未納入共同空間集合：" +
        ctx.countyHistoryAsset.elections
          .filter((e) => ctx.countyHistoryValue(e.units[code]) == null)
          .map((e) => e.year + " " + ctx.countyHistoryStatus(e.units[code]))
          .join("、")
      );
    if (ctx.countyHistorySpatialCurrent.isolates.includes(code))
      return "未納入共同空間集合：沒有範圍內Rook共邊鄰接，不以距離補接";
    return "";
  }
  function renderCountyHistorySpatial(svg) {
    if (!ctx.countyHistoryAdjacency) {
      svg
        .append("text")
        .attr("x", 30)
        .attr("y", 60)
        .attr("fill", "#627783")
        .text("按需載入共同縣市鄰接…");
      ctx.loadCountyHistoryAdjacency().catch(() => {});
      return false;
    }
    const result = ctx.countyHistorySpatialStudies();
    ctx.countyHistorySpatialCurrent = result;
    const selected = result.studies.find((e) => e.year === ctx.countyHistory.b),
      s = selected.study,
      width = Math.max(1000, ctx.$("#county-history-chart").clientWidth),
      height = Math.max(360, ctx.$("#county-history-chart").clientHeight),
      unit = ctx.countyHistory.metric === "margin" ? " pp" : "%",
      split = Math.round(width * 0.64),
      plotTop = 76,
      plotBottom = height - 62,
      x = ctx.d3
        .scaleLinear()
        .domain([0, 100])
        .range([72, split - 35]),
      y = ctx.d3.scaleLinear().domain([0, 100]).range([plotBottom, plotTop]);
    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("data-spatial-n", s.n)
      .attr("data-spatial-I", s.I)
      .attr("data-spatial-p", s.pUpper)
      .attr("data-spatial-common", result.codes.join(","));
    svg
      .append("text")
      .attr("x", 72)
      .attr("y", 22)
      .attr("font-size", 16)
      .attr("font-weight", 650)
      .attr("fill", "#263e4e")
      .text(
        ctx.countyHistory.b + " · " + ctx.countyHistoryLabel() + "與鄰接平均",
      );
    svg
      .append("text")
      .attr("x", 72)
      .attr("y", 45)
      .attr("font-size", 12)
      .attr("fill", "#607783")
      .text("各屆固定 " + s.n + " 縣市 · 等權 · Rook 共邊 · 列標準化");
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", `translate(0,${plotBottom})`)
      .call(
        ctx.d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((v) => (v === 0 ? "" : v + unit))
          .tickSize(-Math.max(0, plotBottom - plotTop)),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", "translate(72,0)")
      .call(
        ctx.d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((v) => v + unit)
          .tickSize(0),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(100))
      .attr("y1", y(0))
      .attr("y2", y(100))
      .attr("stroke", "#b8c4cb")
      .attr("stroke-dasharray", "4 4");
    svg
      .append("text")
      .attr("x", (72 + split - 35) / 2)
      .attr("y", height - 26)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .attr("fill", "#536c7d")
      .text("本地" + ctx.countyHistoryLabel() + "（" + unit.trim() + "）");
    svg
      .append("text")
      .attr(
        "transform",
        `translate(17,${(plotBottom + plotTop) / 2}) rotate(-90)`,
      )
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .attr("fill", "#536c7d")
      .text("範圍內鄰接平均（" + unit.trim() + "）");
    const dots = svg
      .append("g")
      .selectAll("circle")
      .data(s.nodes)
      .join("circle")
      .attr("class", "history-spatial-point")
      .attr("data-county", (d) => d.key)
      .attr("data-year", ctx.countyHistory.b)
      .attr("data-value", (d) => d.value)
      .attr("data-lag", (d) => d.lag)
      .attr("cx", (d) => x(d.value))
      .attr("cy", (d) => y(d.lag))
      .attr("r", (d) => (d.key === ctx.countyHistory.county ? 7 : 5))
      .attr("fill", (d) => ctx.countyHistorySequential(d.value))
      .attr("stroke", (d) =>
        d.key === ctx.countyHistory.county ? "#142e41" : "#fff",
      )
      .attr("stroke-width", 2)
      .attr("tabindex", (_, i) => (i === 0 ? 0 : -1))
      .attr("role", "button")
      .attr(
        "aria-label",
        (d) =>
          ctx.countyHistoryAsset.counties[d.key] +
          " " +
          ctx.countyHistoryFormat(d.value) +
          "；鄰接 " +
          ctx.countyHistoryFormat(d.lag),
      )
      .on("pointerenter", (_, d) => ctx.countyHistoryReadout(d.key))
      .on("click", (_, d) => ctx.selectCountyHistory(d.key))
      .on("keydown", (ev, d) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.selectCountyHistory(d.key);
        }
      });
    dots
      .append("title")
      .text(
        (d) =>
          ctx.countyHistoryAsset.counties[d.key] +
          " · " +
          ctx.countyHistoryFormat(d.value) +
          "；鄰接平均 " +
          ctx.countyHistoryFormat(d.lag),
      );
    const placed = s.nodes.map((d) => ({
      x: x(d.value) - 7,
      y: y(d.lag) - 7,
      w: 14,
      h: 14,
    }));
    const ordered = s.nodes
      .slice()
      .sort((a, b) =>
        a.key === ctx.countyHistory.county
          ? -1
          : b.key === ctx.countyHistory.county
            ? 1
            : 0,
      );
    for (const node of ordered) {
      const name = ctx.countyHistoryAsset.counties[node.key],
        w = name.length * 13 + 6;
      for (const [dx, dy] of [
        [9, -10],
        [9, 16],
        [-w - 9, -10],
        [-w - 9, 16],
        [9, -24],
      ]) {
        const box = {
          x: x(node.value) + dx,
          y: y(node.lag) + dy - 12,
          w,
          h: 15,
        };
        if (
          box.x < 74 ||
          box.x + w > split - 30 ||
          box.y < plotTop ||
          box.y + 15 > plotBottom ||
          placed.some(
            (p) =>
              box.x < p.x + p.w &&
              box.x + w > p.x &&
              box.y < p.y + p.h &&
              box.y + 15 > p.y,
          )
        )
          continue;
        placed.push(box);
        svg
          .append("text")
          .attr("class", "history-spatial-label")
          .attr("x", box.x)
          .attr("y", box.y + 12)
          .attr("font-size", 12)
          .attr("fill", "#3d5667")
          .attr("pointer-events", "none")
          .text(name);
        break;
      }
    }
    svg
      .append("line")
      .attr("x1", split)
      .attr("x2", split)
      .attr("y1", 4)
      .attr("y2", height - 8)
      .attr("stroke", "#d5dfe5");
    const rx = split + 30,
      right = width - 22,
      rw = right - rx;
    svg
      .append("text")
      .attr("x", rx)
      .attr("y", 22)
      .attr("font-size", 16)
      .attr("font-weight", 650)
      .attr("fill", "#263e4e")
      .text("Moran’s I · 同集合跨屆對照");
    svg
      .append("text")
      .attr("x", rx)
      .attr("y", 53)
      .attr("font-size", 26)
      .attr("font-weight", 650)
      .attr("fill", "#263e4e")
      .text(s.I == null ? "—" : s.I.toFixed(4));
    svg
      .append("text")
      .attr("x", rx + 150)
      .attr("y", 52)
      .attr("font-size", 13)
      .attr("fill", "#607783")
      .text("正向單尾 p " + (s.pUpper == null ? "—" : s.pUpper.toFixed(3)));
    const tx = ctx.d3
        .scalePoint()
        .domain(result.studies.map((e) => e.year))
        .range([rx + 32, right - 12]),
      ty = ctx.d3
        .scaleLinear()
        .domain([
          Math.min(-0.15, ...result.studies.map((e) => e.study.I ?? 0)),
          Math.max(0.65, ...result.studies.map((e) => e.study.I ?? 0)),
        ])
        .nice()
        .range([height - 122, 100]);
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", `translate(${rx + 24},0)`)
      .call(
        ctx.d3
          .axisLeft(ty)
          .ticks(4)
          .tickSize(-Math.max(0, rw - 36)),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", `translate(0,${height - 113})`)
      .call(
        ctx.d3
          .axisBottom(tx)
          .tickSize(0)
          .tickFormat((year) =>
            result.studies.length > 5 &&
            rw < 430 &&
            result.studies.indexOf(
              result.studies.find((e) => e.year === year),
            ) %
              2 ===
              1 &&
            year !== result.studies.at(-1).year
              ? ""
              : year,
          ),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("path")
      .datum(result.studies)
      .attr("fill", "none")
      .attr("stroke", "#355b76")
      .attr("stroke-width", 2)
      .attr(
        "d",
        ctx.d3
          .line()
          .defined((e) => e.study.I != null)
          .x((e) => tx(e.year))
          .y((e) => ty(e.study.I)),
      );
    const years = svg
      .append("g")
      .selectAll("circle")
      .data(result.studies.filter((e) => e.study.I != null))
      .join("circle")
      .attr("class", "history-spatial-year")
      .attr("data-year", (e) => e.year)
      .attr("data-I", (e) => e.study.I)
      .attr("data-p", (e) => e.study.pUpper)
      .attr("data-n", (e) => e.study.n)
      .attr("cx", (e) => tx(e.year))
      .attr("cy", (e) => ty(e.study.I))
      .attr("r", (e) => (e.year === ctx.countyHistory.b ? 6 : 4))
      .attr("fill", (e) =>
        e.year === ctx.countyHistory.b ? "#b8743d" : "#355b76",
      )
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("role", "button")
      .attr("tabindex", (e) => (e.year === ctx.countyHistory.b ? 0 : -1))
      .attr("aria-label", (e) => e.year + " Moran I " + e.study.I.toFixed(4))
      .on("click", (_, e) => {
        ctx.countyHistory.b = e.year;
        ctx.renderCountyHistory();
      })
      .on("keydown", (ev, e) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.countyHistory.b = e.year;
          ctx.renderCountyHistory();
        }
      });
    years
      .append("title")
      .text(
        (e) =>
          e.year +
          " · n=" +
          e.study.n +
          " · I=" +
          e.study.I.toFixed(6) +
          " · p=" +
          e.study.pUpper.toFixed(3),
      );
    const excluded = result.unavailable.length + result.isolates.length;
    for (const [i, text] of [
      "999次排列 · 固定種子2024 · 期望值 " + (s.expected?.toFixed(4) || "—"),
      "排除 " + excluded + " 縣市：缺值／未提名或無範圍內鄰接",
      "固定共同統計範圍；不推論個人行為或因果",
    ].entries())
      svg
        .append("text")
        .attr("x", rx)
        .attr("y", height - 64 + i * 20)
        .attr("font-size", 12)
        .attr("fill", "#607783")
        .text(text);
    return true;
  }
  ctx.$("#county-history-spatial-csv").onclick = () => {
    if (!ctx.countyHistorySpatialCurrent) return;
    ctx.countyHistoryStop();
    const result = ctx.countyHistorySpatialCurrent;
    const rows = result.studies.flatMap(({ year, study: s }) => {
      const election = ctx.countyHistoryElection(year),
        nodes = new Map(s.nodes.map((n) => [n.key, n]));
      return ctx.COUNTY_ORDER.map((key) => {
        const node = nodes.get(key);
        return [
          ctx.countyHistoryType().title,
          year,
          key,
          ctx.countyHistoryAsset.counties[key],
          ctx.countyHistoryLabel(),
          ctx.countyHistoryValue(election.units[key]) ?? "",
          node?.lag ?? "",
          ctx.countyHistory.metric === "margin" ? "pp" : "%",
          node ? "納入" : "排除",
          node ? "" : ctx.countyHistorySpatialExclusion(key),
          s.I,
          s.pUpper,
          s.n,
          s.permutations,
          2024,
          ctx.countyHistoryAdjacency.metadata.topology_id,
          ctx.countyHistoryAdjacency.metadata.sourceSHA256,
          JSON.stringify(election.sourceSHA256),
        ];
      });
    });
    ctx.csvTable(
      [
        "選票類型",
        "年份",
        "縣市ID",
        "縣市",
        "指標",
        "本地數值",
        "鄰接等權平均",
        "單位",
        "共同集合狀態",
        "排除理由",
        "共同範圍Moran_I",
        "正向單尾排列_p",
        "參與縣市數",
        "排列次數",
        "種子",
        "共同統計拓撲",
        "鄰接來源SHA256",
        "選票來源SHA256",
      ],
      rows,
      "臺灣-" + ctx.countyHistoryType().title + "-共同縣市空間關聯.csv",
    );
  };
}
