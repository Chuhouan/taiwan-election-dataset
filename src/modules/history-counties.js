/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    countyHistoryType,
    countyHistoryAvailable,
    countyHistoryElection,
    countyHistoryValue,
    countyHistoryDelta,
    countyHistoryStatus,
    countyHistoryMax,
    countyHistorySequential,
    countyHistoryColor,
    countyHistoryFormat,
    countyHistoryLabel,
    countyHistoryParties,
    countyHistoryReadout,
    countyHistoryPct,
    selectCountyHistory,
    countyHistoryLegend,
    renderCountyMatrix,
    countyHistoryInsets,
    countyHistoryPaths,
    countyHistoryMapShapes,
    countyHistoryConnectZoom,
    renderCountyHistoryMaps,
    countyHistorySetWipe,
    renderCountyHistorySwipe,
    renderCountyHistoryTrend,
    countyHistoryStop,
    countyHistoryEnsureYears,
    countyHistoryControls,
    renderCountyHistory,
    openCountyHistory,
    openCountyHistoryForElection,
    countyHistoryExportLegend,
    countyHistoryExportXML,
    countyHistoryExportName,
    parseCountyHistoryRoute,
    serializeCountyHistoryRoute,
  });
  /* Comparable whole-county series. Lower-level names are never joined here. */
  ctx.COUNTY_HISTORY_TYPES = {
    president: {
      title: "總統選舉",
      file: "history-counties.json",
      years: [1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024],
      shareMax: 80,
      marginMax: 50,
    },
    "legislator-list": {
      title: "立委政黨票",
      file: "history-party-list.json",
      years: [2008, 2012, 2016, 2020, 2024],
      shareMax: 80,
      marginMax: 50,
    },
    mayor: {
      title: "縣市長選舉",
      file: "history-mayors.json",
      years: [2014, 2018, 2022],
      shareMax: 100,
      marginMax: 100,
    },
  };
  ctx.countyHistory = {
    kind: "president",
    view: "matrix",
    metric: "dpp",
    a: 2020,
    b: 2024,
    county: "63000",
    sort: "geography",
    camera: [1, 0, 0],
    wipe: 50,
    arrows: false,
  };
  ctx.countyHistoryCache = new Map();
  ctx.countyHistoryParty = { dpp: "民主進步黨", kmt: "中國國民黨" };
  ctx.countyHistoryAsset = null;
  ctx.countyHistoryRequest = 0;
  ctx.countyHistoryZoom = null;
  ctx.countyHistoryZoomPanels = [];
  ctx.countyHistoryTimer = null;
  ctx.countyHistorySwipeUpdater = null;
  ctx.countyHistorySpatialCurrent = null;
  ctx
    .$("#history-close")
    .insertAdjacentHTML(
      "beforebegin",
      '<button id="county-history-open">縣市歷史 ↗</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="county-history-dialog" aria-labelledby="county-history-title">
 <header class="history-header"><div><span id="county-history-subtitle">依選票類型比較 · 22縣市統計範圍</span><h2 id="county-history-title">縣市歷史分析</h2></div><div class="history-downloads"><button id="county-history-national">全國結果</button><button id="county-history-csv">CSV</button><button id="county-history-svg">SVG</button><button id="county-history-png">PNG</button><button id="county-history-close" aria-label="關閉縣市歷史">×</button></div></header>
 <div class="county-history-toolbar">
  <label>選票<select id="county-history-kind">${Object.entries(
    ctx.COUNTY_HISTORY_TYPES,
  )
    .map(([k, t]) => '<option value="' + k + '">' + t.title + "</option>")
    .join("")}</select></label>
  <div class="segmented"><button data-history-view="maps">結果</button><button data-history-view="swipe">變化</button><button data-history-view="trend">趨勢</button><button data-history-view="matrix">矩陣</button><button data-history-view="spatial">空間關聯</button></div>
  <label id="county-history-metric-label">指標<select id="county-history-metric"><option value="dpp">民進黨得票率</option><option value="kmt">國民黨得票率</option><option value="winner">地區第一名</option><option value="turnout">投票率</option><option value="margin">前兩名差距</option></select></label>
  <label id="county-history-sort-label">排序<select id="county-history-sort"><option value="geography">地理順序</option><option value="mean">歷屆指標平均值</option><option value="volatility">歷屆指標波動（標準差）</option><option value="votes">最新屆有效票</option></select></label>

  <label id="county-history-county-label">縣市<select id="county-history-county"></select></label>
  <button id="county-history-spatial-csv" hidden>空間 CSV</button><div id="county-history-zoom"><button id="county-history-plus" aria-label="放大歷史地圖">＋</button><button id="county-history-minus" aria-label="縮小歷史地圖">−</button><button id="county-history-reset">全臺</button></div>
 </div>
 <div id="county-history-time" class="county-history-time" hidden><button id="county-history-play" aria-label="播放年份B" aria-pressed="false">播放</button><label id="county-history-a-label">年份 A<select id="county-history-a"></select></label><label id="county-history-b-label">年份 B<select id="county-history-b"></select></label><span>時間軸</span><input id="county-history-year-slider" type="range" min="0" step="1" aria-label="年份B時間軸"><strong id="county-history-year-output"></strong><label id="county-history-wipe-label" hidden>分割位置<input id="county-history-wipe" type="range" min="0" max="100" step="1" aria-label="擦除比較分割位置"><output id="county-history-wipe-output"></output></label></div>
 <div class="county-history-body"><div id="county-history-legend"></div><div class="county-history-plot"><svg id="county-history-chart" role="group" aria-label="歷史縣市選舉比較"></svg></div><div id="county-history-readout" class="county-history-readout" aria-live="polite"></div><details class="county-history-method"><summary>統計範圍、合併方法與可比性</summary><p id="county-history-method"></p><p>地圖以現今縣市形狀示意統計範圍，不是歷史測量界線。比率均先加總原始票數與分母後計算，不平均下級百分比、不推估選民轉移。未提名與缺資料都不是0%支持率；趨勢斷點及差值空白保留其差異。</p><a href="https://www.moi.gov.tw/News_toggle3.aspx?n=174&sms=9015" target="_blank" rel="noopener">內政部縣市改制說明 ↗</a></details><footer id="county-history-source" class="history-source"></footer></div>
</dialog>`,
  );
  const matrixPlot = ctx.$(".county-history-plot");
  ctx.$("#county-history-time").insertAdjacentHTML("beforeend",
    '<span id="county-history-comparability" role="status"></span>');
  matrixPlot.addEventListener("scroll", () => {
    matrixPlot.style.setProperty("--matrix-scroll-x", matrixPlot.scrollLeft + "px");
    matrixPlot.style.setProperty("--matrix-scroll-y", matrixPlot.scrollTop + "px");
  }, { passive: true });
  function countyHistoryType() {
    return ctx.COUNTY_HISTORY_TYPES[ctx.countyHistory.kind];
  }
  ctx.$("#county-history-metric-label").insertAdjacentHTML("afterend", '<label id="history-arrows-label" hidden><input id="history-arrows" type="checkbox">變化箭頭 · 長度∝pp，↑增↓減</label>');
  ctx.$("#history-arrows").onchange = (event) => { ctx.countyHistory.arrows = event.target.checked; ctx.renderCountyHistory(); ctx.updateHash(); };
  ctx.$("#county-history-sort").append(new Option("相鄰有效屆次的第一名政黨更替次數", "changes"));
  function countyHistoryAvailable(u) {
    return (
      !!u &&
      u.available !== false &&
      u.validVotes > 0 &&
      u.candidates?.length > 0
    );
  }
  function countyHistoryElection(year) {
    return ctx.countyHistoryAsset?.elections.find((e) => e.year === year);
  }
  function countyHistoryValue(u, metric = ctx.countyHistory.metric) {
    if (!ctx.countyHistoryAvailable(u)) return null;
    if (metric === "winner") return u.candidates[0].share;
    if (metric === "turnout") return u.turnout;
    if (metric === "margin") return u.margin;
    const c = u.candidates.find(
      (c) => c.party === ctx.countyHistoryParty[metric],
    );
    return c ? (c.votes / u.validVotes) * 100 : null;
  }
  function countyHistoryDelta(code, metric = ctx.countyHistory.metric) {
    const a = ctx.countyHistoryValue(
        ctx.countyHistoryElection(ctx.countyHistory.a)?.units[code],
        metric,
      ),
      b = ctx.countyHistoryValue(
        ctx.countyHistoryElection(ctx.countyHistory.b)?.units[code],
        metric,
      );
    return a == null || b == null ? null : b - a;
  }
  function countyHistoryStatus(u, metric = ctx.countyHistory.metric) {
    return !ctx.countyHistoryAvailable(u)
      ? "缺資料"
      : ctx.countyHistoryValue(u, metric) == null
        ? "未提名此黨"
        : "可用";
  }
  function countyHistoryMax() {
    return ctx.countyHistory.metric === "margin"
      ? ctx.countyHistoryType().marginMax
      : ctx.countyHistory.metric === "turnout"
        ? 100
        : ctx.countyHistoryType().shareMax;
  }
  function countyHistorySequential(v) {
    return ctx.d3.interpolateRgb(
      "#edf0ec",
      ctx.countyHistory.metric === "dpp"
        ? "#16734c"
        : ctx.countyHistory.metric === "kmt"
          ? "#284f9b"
          : ctx.countyHistory.metric === "turnout"
            ? "#6c527f"
            : "#b65345",
    )(Math.max(0, Math.min(1, v / ctx.countyHistoryMax())));
  }
  function countyHistoryColor(u, difference = false) {
    const v = difference ? u : ctx.countyHistoryValue(u);
    if (v == null)
      return !difference && !ctx.countyHistoryAvailable(u)
        ? "url(#history-county-missing)"
        : "#dce2e7";
    if (difference)
      return ctx.d3.interpolateRgbBasis(["#435f9e", "#f5f5ef", "#bd613d"])(
        (Math.max(-30, Math.min(30, v)) + 30) / 60,
      );
    return ctx.countyHistory.metric === "winner"
      ? ctx.historyPartyColor(u.candidates[0].party)
      : ctx.countyHistorySequential(v);
  }
  function countyHistoryFormat(v) {
    return v == null
      ? "—"
      : ctx.countyHistory.metric === "margin"
        ? v.toFixed(2) + " pp"
        : ctx.pct(v);
  }
  function countyHistoryLabel() {
    return ctx.countyHistory.view === "trend"
      ? "兩黨得票率與投票率"
      : ctx.$("#county-history-metric").selectedOptions[0]?.textContent || "";
  }
  function countyHistoryParties() {
    return [
      ...new Set(
        ctx.countyHistoryAsset.elections.flatMap((e) =>
          Object.values(e.units)
            .filter(ctx.countyHistoryAvailable)
            .map((u) => u.candidates[0].party),
        ),
      ),
    ];
  }
  function countyHistoryReadout(code, year = ctx.countyHistory.b) {
    const u = ctx.countyHistoryElection(year)?.units[code];
    if (!u) return;
    const readout = ctx.$("#county-history-readout");
    const matrix = ctx.countyHistory.view === "matrix";
    const detailsOpen = !!readout.querySelector("details")?.open;
    const detail = (label, content) => matrix
      ? '<details' + (detailsOpen ? ' open' : '') + '><summary>' + label + '</summary>' + content + '</details>'
      : content;
    if (!ctx.countyHistoryAvailable(u)) {
      readout.innerHTML =
        "<strong>" +
        ctx.esc(u.name) +
        "</strong><span>" +
        year +
        " · 缺資料</span>" + detail("查看資料缺漏說明", "<small>" +
        ctx.esc(u.missing_reason || "本批來源沒有可核對的完整結果") +
        (u.source
          ? ' <a href="' +
            ctx.esc(u.source) +
            '" target="_blank" rel="noopener">中選會說明 ↗</a>'
          : "") +
        "</small>");
      return;
    }
    const trend = ctx.countyHistory.view === "trend",
      metric = trend ? "dpp" : ctx.countyHistory.metric,
      delta =
        ctx.countyHistory.view === "spatial" ||
        (ctx.countyHistory.metric === "winner" && !trend)
          ? null
          : ctx.countyHistoryDelta(code, metric),
      leader = u.candidates[0],
      originalUnits = "<small>原始統計單位：" +
        Object.values(u.originalUnits).map(ctx.esc).join("＋") +
        (ctx.countyHistory.kind === "legislator-list" ? "；第一名政黨不等於席次當選結果。" : "") +
        "</small>";
    readout.innerHTML =
      "<strong>" +
      ctx.esc(u.name) +
      "</strong><span>" +
      year +
      (matrix && metric !== "winner" ? " 年" : " · " + ctx.esc(leader.name) + " 第一名 " + ctx.pct(leader.share)) +
      "</span>" +
      (trend
        ? "<span>民進黨 " +
          ctx.countyHistoryPct(ctx.countyHistoryValue(u, "dpp")) +
          " · 國民黨 " +
          ctx.countyHistoryPct(ctx.countyHistoryValue(u, "kmt")) +
          " · 投票率 " +
          ctx.countyHistoryPct(u.turnout) +
          "</span>"
        : matrix && metric === "winner" ? "" : "<span>" +
          ctx.countyHistoryLabel() +
          " " +
          (ctx.countyHistoryValue(u) == null
            ? "未提名此黨"
            : ctx.countyHistoryFormat(ctx.countyHistoryValue(u))) +
          "</span>") +
      "<span>" +
      ctx.fmt(u.validVotes) +
      " 有效票</span>" +
      (delta == null || matrix
        ? ""
        : "<span>" +
          (trend ? "民進黨 " : "") +
          ctx.countyHistory.a +
          " → " +
          ctx.countyHistory.b +
          "　<b>" +
          ctx.sign(delta) +
          " pp</b></span>") +
      (ctx.countyHistory.view === "spatial" &&
      ctx.countyHistorySpatialExclusion(code)
        ? '<small class="history-analysis-excluded">' +
          ctx.esc(ctx.countyHistorySpatialExclusion(code)) +
          "</small>"
        : "") +
      detail("統計範圍與歷屆趨勢", originalUnits);
    const sequence = ctx.countyHistoryAsset.elections.map((e) => ({ year: e.year, value: ctx.countyHistoryValue(e.units[code], metric) })),
      spark = ctx.d3.select(matrix ? readout.querySelector("details") : readout).append("svg").attr("class", "history-sparkline")
        .attr("width", 190).attr("height", 46).attr("viewBox", "0 0 190 46").attr("role", "img")
        .attr("aria-label", u.name + "歷屆同一指標趨勢；缺資料保留斷點"),
      sx = ctx.d3.scalePoint().domain(sequence.map((r) => r.year)).range([6, 184]),
      sy = ctx.d3.scaleLinear().domain([0, 100]).range([39, 6]);
    spark.append("path").datum(sequence).attr("d", ctx.d3.line().defined((d) => Number.isFinite(d.value)).x((d) => sx(d.year)).y((d) => sy(d.value)))
      .attr("fill", "none").attr("stroke", "#385d73").attr("stroke-width", 1.8);
    spark.selectAll("circle").data(sequence.filter((d) => Number.isFinite(d.value))).join("circle")
      .attr("cx", (d) => sx(d.year)).attr("cy", (d) => sy(d.value)).attr("r", (d) => d.year === year ? 4 : 2)
      .attr("fill", "#385d73").append("title").text((d) => d.year + " · " + ctx.pct(d.value));
  }
  function countyHistoryPct(v) {
    return v == null ? "—" : ctx.pct(v);
  }
  function selectCountyHistory(code, year) {
    ctx.countyHistory.county = code;
    if (year) ctx.countyHistory.b = year;
    ctx.renderCountyHistory();
  }
  function countyHistoryLegend() {
    const el = ctx.$("#county-history-legend");
    if (ctx.countyHistory.view === "trend")
      el.innerHTML =
        '<b>縣市加總後比率</b><div class="legend-parties"><span><i style="background:#16734c"></i>民進黨</span><span><i style="background:#284f9b"></i>國民黨</span><span><i style="background:#8c798f"></i>投票率（虛線）</span></div>';
    else if (ctx.countyHistory.metric === "winner")
      el.innerHTML =
        '<b>地區第一名所屬政黨</b><div class="legend-parties">' +
        ctx
          .countyHistoryParties()
          .map(
            (p) =>
              '<span><i style="background:' +
              ctx.historyPartyColor(p) +
              '"></i>' +
              ctx.esc(p) +
              "</span>",
          )
          .join("") +
        "</div>";
    else {
      const max = ctx.countyHistoryMax();
      el.innerHTML =
        "<b>" +
        ctx.countyHistoryLabel() +
        ' · 各屆共同色階</b><div class="history-shared-scale">' +
        ctx.legendRamp(
          ctx.d3
            .range(7)
            .map((i) => ctx.countyHistorySequential((max * i) / 6)),
          [
            "0",
            max / 2 + (ctx.countyHistory.metric === "margin" ? " pp" : "%"),
            max + (ctx.countyHistory.metric === "margin" ? " pp" : "%"),
          ],
        ) +
        "</div>";
    }
    if (
      ctx.countyHistory.view === "maps" &&
      ctx.countyHistory.metric !== "winner"
    )
      el.insertAdjacentHTML(
        "beforeend",
        '<span class="history-delta-key">B−A <i style="background:linear-gradient(90deg,#435f9e,#f5f5ef,#bd613d)"></i> ≤−30 / 0 / ≥+30 pp</span>',
      );
    const missing = ctx.countyHistoryAsset.elections.some((e) =>
        Object.values(e.units).some((u) => !ctx.countyHistoryAvailable(u)),
      ),
      uncontested =
        ["dpp", "kmt"].includes(ctx.countyHistory.metric) &&
        ctx.countyHistoryAsset.elections.some((e) =>
          Object.values(e.units).some(
            (u) =>
              ctx.countyHistoryAvailable(u) &&
              ctx.countyHistoryValue(u) == null,
          ),
        );
    if (missing || uncontested)
      el.insertAdjacentHTML(
        "beforeend",
        '<span class="history-na-key">' +
          (missing ? '<i class="history-missing-swatch"></i>缺資料' : "") +
          (uncontested
            ? '<i class="history-uncontested-swatch"></i>未提名此黨'
            : "") +
          "</span>",
      );
  }
  function renderCountyMatrix(svg) {
    const years = ctx.countyHistoryAsset.elections,
      codes = Object.keys(ctx.countyHistoryAsset.counties),
      metric = ctx.countyHistory.metric;
    const mean = (c) =>
        ctx.d3.mean(years, (e) => ctx.countyHistoryValue(e.units[c])),
      sd = (c) =>
        ctx.d3.deviation(years, (e) => ctx.countyHistoryValue(e.units[c]));
    const changes = (code) => years.slice(1).reduce((sum, year, i) => {
      const a = years[i].units[code], b = year.units[code];
      return sum + Number(ctx.countyHistoryAvailable(a) && ctx.countyHistoryAvailable(b) && a.candidates[0].party !== b.candidates[0].party);
    }, 0);
    codes.sort((a, b) =>
      ctx.countyHistory.sort === "changes" ? changes(b) - changes(a) : ctx.countyHistory.sort === "mean"
        ? (mean(b) ?? -1) - (mean(a) ?? -1)
        : ctx.countyHistory.sort === "volatility"
          ? (sd(b) ?? -1) - (sd(a) ?? -1)
          : ctx.countyHistory.sort === "votes"
            ? (years.at(-1).units[b].validVotes ?? -1) -
              (years.at(-1).units[a].validVotes ?? -1)
            : ctx.COUNTY_ORDER.indexOf(a) - ctx.COUNTY_ORDER.indexOf(b),
    );
    const width = Math.max(1000, ctx.$("#county-history-chart").clientWidth),
      height = Math.max(500, ctx.$("#county-history-chart").clientHeight),
      x = ctx.d3
        .scaleBand()
        .domain(years.map((e) => e.year))
        .range([120, width - 12])
        .padding(0.05),
      y = ctx.d3
        .scaleBand()
        .domain(codes)
        .range([48, height - 20])
        .padding(0.12);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const cells = years.flatMap((e) =>
        codes.map((code) => ({ year: e.year, code, u: e.units[code] })),
      ),
      cell = svg
        .append("g")
        .selectAll("g")
        .data(cells)
        .join("g")
        .attr("class", "history-matrix-cell")
        .attr("data-county", (d) => d.code)
        .attr("data-year", (d) => d.year)
        .attr("data-value", (d) => ctx.countyHistoryValue(d.u))
        .attr("data-status", (d) => ctx.countyHistoryStatus(d.u))
        .attr("role", "button")
        .attr("tabindex", (d) =>
          d.code === ctx.countyHistory.county && d.year === ctx.countyHistory.b
            ? 0
            : -1,
        )
        .attr(
          "aria-label",
          (d) =>
            d.year +
            " " +
            d.u.name +
            " " +
            ctx.countyHistoryLabel() +
            " " +
            (ctx.countyHistoryValue(d.u) == null
              ? ctx.countyHistoryStatus(d.u)
              : ctx.countyHistoryFormat(ctx.countyHistoryValue(d.u))),
        )
        .attr("transform", (d) => `translate(${x(d.year)},${y(d.code)})`)
        .on("pointerenter", (_, d) => ctx.countyHistoryReadout(d.code, d.year))
        .on("click", (_, d) => ctx.selectCountyHistory(d.code, d.year))
        .on("keydown", (ev, d) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ctx.selectCountyHistory(d.code, d.year);
          }
        });
    cell
      .append("rect")
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 2)
      .attr("fill", (d) => ctx.countyHistoryColor(d.u))
      .attr("stroke", (d) =>
        d.code === ctx.countyHistory.county && d.year === ctx.countyHistory.b
          ? "#152b3a"
          : "none",
      )
      .attr("stroke-width", 2.5);
    cell
      .append("text")
      .attr("x", x.bandwidth() / 2)
      .attr("y", y.bandwidth() / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 14)
      .attr("fill", (d) =>
        ctx.countyHistoryValue(d.u) != null &&
        ctx.d3.lab(ctx.countyHistoryColor(d.u)).l < 58
          ? "#fff"
          : "#273e4a",
      )
      .text((d) =>
        ctx.countyHistoryValue(d.u) == null
          ? ctx.countyHistoryStatus(d.u)
          : metric === "winner"
            ? d.u.candidates[0].name
            : ctx.countyHistoryValue(d.u).toFixed(1) +
              (metric === "margin" ? " pp" : "%"),
      );
    const countyHeader = svg.append("g").attr("class", "history-matrix-counties");
    countyHeader.append("rect").attr("width", 118).attr("height", height).attr("fill", "#f5f7f8");
    countyHeader.append("g")
      .attr("class", "history-axis")
      .attr("transform", "translate(104,0)")
      .call(ctx.d3.axisLeft(y).tickSize(0).tickFormat((code) => ctx.countyHistoryAsset.counties[code]))
      .call((g) => g.select(".domain").remove());
    const yearHeader = svg.append("g").attr("class", "history-matrix-years");
    yearHeader.append("rect").attr("width", width).attr("height", 45).attr("fill", "#f5f7f8");
    yearHeader.append("g")
      .attr("class", "history-axis")
      .attr("transform", "translate(0,35)")
      .call(ctx.d3.axisTop(x).tickSize(0))
      .call((g) => g.select(".domain").remove());
    const corner = yearHeader.append("g").attr("class", "history-matrix-corner");
    corner.append("rect").attr("width", 118).attr("height", 45).attr("fill", "#f5f7f8");
    corner.append("text").attr("x", 104).attr("y", 32).attr("text-anchor", "end").attr("font-size", 12)
      .attr("fill", "#536575").text("縣市 ／ 年份");
    const sort = ctx.$("#county-history-sort").selectedOptions[0].textContent;
    const note = document.createElement("span");
    note.className = "history-matrix-sort";
    note.textContent = "排序：" + sort;
    note.title = ctx.countyHistory.sort === "volatility"
      ? "按各縣市有效屆次的樣本標準差由高到低排序；排除未提名與缺資料。"
      : sort;
    ctx.$("#county-history-legend").append(note);
  }
  function countyHistoryInsets(layer, paths, mapHeight) {
    const codes = ["09007", "09020", "10016"],
      row = (mapHeight - 62) / 3;
    codes.forEach((code, j) => {
      const f = ctx.counties.find((f) => f.properties.COUNTYCODE === code),
        top = 46 + j * row,
        h = row - 8;
      layer
        .append("line")
        .attr("x1", 10)
        .attr("x2", 94)
        .attr("y1", top)
        .attr("y2", top)
        .attr("stroke", "#bccbd0");
      layer
        .append("text")
        .attr("x", 10)
        .attr("y", top + 16)
        .attr("font-size", 12)
        .attr("fill", "#61727e")
        .text(f.properties.COUNTYNAME);
      if (code === "09007") {
        const fs = ctx.towns.filter((t) => t.properties.COUNTYCODE === code),
          cell = (h - 23) / 2,
          ps = fs.map((t, i) =>
            ctx.d3.geoPath(
              ctx.d3.geoMercator().fitExtent(
                [
                  [12 + (i % 2) * 42, top + 23 + Math.floor(i / 2) * cell],
                  [
                    49 + (i % 2) * 42,
                    top + 23 + Math.floor(i / 2) * cell + cell - 4,
                  ],
                ],
                t,
              ),
            ),
          );
        paths[code] = () => fs.map((t, i) => ps[i](t)).join("");
      } else if (code === "09020") {
        const split = (remote) => ({
            ...f,
            geometry: {
              type: "MultiPolygon",
              coordinates: (f.geometry.type === "MultiPolygon"
                ? f.geometry.coordinates
                : [f.geometry.coordinates]
              ).filter((p) => p[0][0][0] > 119 === remote),
            },
          }),
          main = split(false),
          remote = split(true),
          a = ctx.d3.geoPath(
            ctx.d3.geoMercator().fitExtent(
              [
                [12, top + 27],
                [70, top + h],
              ],
              main,
            ),
          ),
          b = ctx.d3.geoPath(
            ctx.d3.geoMercator().fitExtent(
              [
                [76, top + 32],
                [93, top + h - 20],
              ],
              remote,
            ),
          );
        paths[code] = () => a(main) + b(remote);
        layer
          .append("text")
          .attr("x", 74)
          .attr("y", top + h - 5)
          .attr("font-size", 12)
          .attr("fill", "#61727e")
          .text("烏坵");
      } else {
        const fs = ctx.towns.filter((t) => t.properties.COUNTYCODE === code),
          outer = ["望安鄉", "七美鄉"],
          main = fs.filter((t) => !outer.includes(t.properties.TOWNNAME)),
          a = ctx.d3.geoPath(
            ctx.d3.geoMercator().fitExtent(
              [
                [12, top + 27],
                [72, top + h],
              ],
              { type: "FeatureCollection", features: main },
            ),
          ),
          cell = (h - 24) / 2,
          ps = outer.map((name, i) => {
            const t = fs.find((t) => t.properties.TOWNNAME === name);
            return [
              t,
              ctx.d3.geoPath(
                ctx.d3.geoMercator().fitExtent(
                  [
                    [78, top + 24 + i * cell],
                    [94, top + 24 + (i + 1) * cell - 3],
                  ],
                  t,
                ),
              ),
            ];
          });
        paths[code] = () =>
          main.map((t) => a(t)).join("") + ps.map(([t, p]) => p(t)).join("");
      }
    });
  }
  function countyHistoryPaths(layer, width, height) {
    const main = ctx.counties.filter(
        (f) => !["09007", "09020", "10016"].includes(f.properties.COUNTYCODE),
      ),
      p = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [105, 48],
            [width - 14, height - 14],
          ],
          { type: "FeatureCollection", features: main },
        ),
      ),
      paths = {};
    main.forEach((f) => (paths[f.properties.COUNTYCODE] = p));
    ctx.countyHistoryInsets(layer, paths, height);
    return paths;
  }
  function countyHistoryMapShapes(layer, paths, spec, svg) {
    const value = (code) =>
      spec.difference
        ? ctx.countyHistoryDelta(code)
        : ctx.countyHistoryValue(
            ctx.countyHistoryElection(spec.year)?.units[code],
          );
    const state = (code) => {
      if (!spec.difference)
        return ctx.countyHistoryStatus(
          ctx.countyHistoryElection(spec.year)?.units[code],
        );
      return !ctx.countyHistoryAvailable(
        ctx.countyHistoryElection(ctx.countyHistory.a)?.units[code],
      ) ||
        !ctx.countyHistoryAvailable(
          ctx.countyHistoryElection(ctx.countyHistory.b)?.units[code],
        )
        ? "缺資料"
        : value(code) == null
          ? "至少一屆未提名此黨"
          : "可用";
    };
    layer
      .selectAll(".history-county-shape")
      .data(ctx.counties)
      .join("path")
      .attr("class", "history-county-shape")
      .classed(
        "selected",
        (f) => f.properties.COUNTYCODE === ctx.countyHistory.county,
      )
      .attr("data-county", (f) => f.properties.COUNTYCODE)
      .attr("data-year", spec.year || "difference")
      .attr("data-value", (f) => value(f.properties.COUNTYCODE))
      .attr("data-status", (f) => state(f.properties.COUNTYCODE))
      .attr("d", (f) => paths[f.properties.COUNTYCODE](f))
      .attr("fill", (f) => {
        const c = f.properties.COUNTYCODE;
        return spec.difference
          ? state(c) === "缺資料"
            ? "url(#history-county-missing)"
            : ctx.countyHistoryColor(value(c), true)
          : ctx.countyHistoryColor(
              ctx.countyHistoryElection(spec.year).units[c],
            );
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("vector-effect", "non-scaling-stroke")
      .attr("tabindex", (f) =>
        f.properties.COUNTYCODE === ctx.countyHistory.county ? 0 : -1,
      )
      .attr("role", "button")
      .attr(
        "aria-label",
        (f) =>
          f.properties.COUNTYNAME +
          " " +
          spec.title +
          " " +
          (value(f.properties.COUNTYCODE) == null
            ? state(f.properties.COUNTYCODE)
            : ctx.countyHistoryFormat(value(f.properties.COUNTYCODE))),
      )
      .on("pointerenter", (_, f) => {
        const c = f.properties.COUNTYCODE;
        ctx.countyHistoryReadout(c, spec.year || ctx.countyHistory.b);
        svg
          .selectAll(".history-county-shape")
          .classed("hovered", (f) => f.properties.COUNTYCODE === c);
      })
      .on("pointerleave", () =>
        svg.selectAll(".history-county-shape").classed("hovered", false),
      )
      .on("click", (_, f) => ctx.selectCountyHistory(f.properties.COUNTYCODE))
      .on("keydown", (ev, f) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.selectCountyHistory(f.properties.COUNTYCODE);
        }
      })
      .append("title")
      .text((f) => {
        const c = f.properties.COUNTYCODE;
        return (
          f.properties.COUNTYNAME +
          " · " +
          spec.title +
          " · " +
          (value(c) == null
            ? state(c)
            : spec.difference
              ? ctx.sign(value(c)) + " pp"
              : ctx.countyHistoryFormat(value(c)))
        );
      });
  }
  function drawHistorySwingArrows(layer, paths, spec) {
    if (!spec.difference || !ctx.countyHistory.arrows || ctx.countyHistory.metric === "winner") return;
    const rows = ctx.counties.map((f) => ({ f, value: ctx.countyHistoryDelta(f.properties.COUNTYCODE) })).filter((d) => Number.isFinite(d.value) && d.value !== 0),
      max = ctx.d3.max(rows, (d) => Math.abs(d.value)) || 1;
    const anchor = (d) => {
      const code = d.f.properties.COUNTYCODE, path = paths[code];
      if (typeof path.centroid === "function") return path.centroid(d.f);
      const shape = layer.selectAll(".history-county-shape").filter((f) => f.properties.COUNTYCODE === code).node(), box = shape.getBBox();
      return [box.x + box.width / 2, box.y + box.height / 2];
    };
    const arrows = layer.append("g").attr("class", "history-swing-arrows").selectAll("g").data(rows).join("g")
      .attr("class", "history-swing-arrow").attr("data-value", (d) => d.value)
      .attr("data-county", (d) => d.f.properties.COUNTYCODE)
      .attr("transform", (d) => `translate(${anchor(d).join(",")})`)
      .on("click", (_, d) => ctx.selectCountyHistory(d.f.properties.COUNTYCODE));
    arrows.append("path").attr("d", (d) => {
      const dy = -d.value / max * 32, head = Math.sign(dy) * Math.min(5, Math.abs(dy) / 3);
      return `M0,${-dy / 2}L0,${dy / 2}M-4,${dy / 2 - head}L0,${dy / 2}L4,${dy / 2 - head}`;
    }).attr("fill", "none").attr("stroke", "#172331").attr("stroke-width", 2).attr("vector-effect", "non-scaling-stroke")
      .style("filter", "drop-shadow(0 0 1px white)");
    arrows.append("title").text((d) => d.f.properties.COUNTYNAME + " · " + ctx.sign(d.value) + "pp；縣市原始票數比率 B−A，非個人選民流動。");
  }
  function countyHistoryConnectZoom(panels, layers, width, height) {
    ctx.countyHistoryZoomPanels = panels;
    ctx.countyHistoryZoom = ctx.d3
      .zoom()
      .extent([
        [0, 35],
        [width, height],
      ])
      .scaleExtent([1, 8])
      .on("zoom", (ev) => {
        layers.forEach((l) => l.attr("transform", ev.transform));
        panels.forEach((p) => p.property("__zoom", ev.transform));
        ctx.countyHistory.camera = [
          ev.transform.k,
          ev.transform.x / width,
          ev.transform.y / height,
        ];
      })
      .on("end", ctx.updateHash);
    const restored = ctx.d3.zoomIdentity
      .translate(
        ctx.countyHistory.camera[1] * width,
        ctx.countyHistory.camera[2] * height,
      )
      .scale(ctx.countyHistory.camera[0]);
    panels.forEach((p) =>
      p
        .call(ctx.countyHistoryZoom)
        .call(ctx.countyHistoryZoom.transform, restored)
        .on("dblclick.zoom", null),
    );
  }
  function renderCountyHistoryMaps(svg) {
    const width = Math.max(1000, ctx.$("#county-history-chart").clientWidth),
      height = Math.max(360, ctx.$("#county-history-chart").clientHeight),
      mapHeight = height - 35,
      defs = svg.select("defs"),
      layers = [],
      panels = [],
      specs =
        ctx.countyHistory.metric === "winner"
          ? [
              {
                year: ctx.countyHistory.a,
                title: ctx.countyHistory.a + " · 地區第一名",
              },
              {
                year: ctx.countyHistory.b,
                title: ctx.countyHistory.b + " · 地區第一名",
              },
            ]
          : [
              {
                year: ctx.countyHistory.a,
                title: ctx.countyHistory.a + " · " + ctx.countyHistoryLabel(),
              },
              {
                year: ctx.countyHistory.b,
                title: ctx.countyHistory.b + " · " + ctx.countyHistoryLabel(),
              },
              {
                difference: true,
                title:
                  "變化 · " + ctx.countyHistory.b + " − " + ctx.countyHistory.a,
              },
            ],
      span = width / specs.length,
      pw = span - 16;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    specs.forEach((spec, i) => {
      const g = svg.append("g").attr("transform", `translate(${i * span},0)`);
      g.append("text")
        .attr("x", 12)
        .attr("y", 22)
        .attr("font-size", 15)
        .attr("font-weight", 700)
        .attr("fill", "#1a3345")
        .text(spec.title);
      const id = "history-map-clip-" + i;
      defs
        .append("clipPath")
        .attr("id", id)
        .append("rect")
        .attr("x", 0)
        .attr("y", 35)
        .attr("width", pw)
        .attr("height", mapHeight - 35);
      const viewport = g.append("g").attr("clip-path", `url(#${id})`);
      viewport
        .append("rect")
        .attr("y", 35)
        .attr("width", pw)
        .attr("height", mapHeight - 35)
        .attr("fill", "transparent");
      const layer = viewport.append("g");
      layers.push(layer);
      panels.push(viewport);
      const panelPaths = ctx.countyHistoryPaths(layer, pw, mapHeight);
      ctx.countyHistoryMapShapes(
        layer,
        panelPaths,
        spec,
        svg,
      );
      drawHistorySwingArrows(layer, panelPaths, spec);
      g.append("text")
        .attr("x", 10)
        .attr("y", height - 6)
        .attr("font-size", 12)
        .attr("fill", "#607280")
        .text("現今縣市示意 · 離島獨立比例");
      if (i < specs.length - 1)
        g.append("line")
          .attr("x1", span - 6)
          .attr("x2", span - 6)
          .attr("y1", 5)
          .attr("y2", height)
          .attr("stroke", "#dce3e7");
    });
    ctx.countyHistoryConnectZoom(panels, layers, pw, mapHeight);
  }
  function countyHistorySetWipe(value) {
    ctx.countyHistory.wipe = Math.max(0, Math.min(100, value));
    ctx.$("#county-history-wipe").value = ctx.countyHistory.wipe;
    ctx.$("#county-history-wipe-output").textContent =
      Math.round(ctx.countyHistory.wipe) + "%";
    ctx.countyHistorySwipeUpdater?.();
    ctx.updateHash();
  }
  function renderCountyHistorySwipe(svg) {
    const width = Math.max(1000, ctx.$("#county-history-chart").clientWidth),
      height = Math.max(360, ctx.$("#county-history-chart").clientHeight),
      bottom = height - 25,
      defs = svg.select("defs"),
      layers = [],
      panels = [];
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const common = defs.append("clipPath").attr("id", "history-swipe-plot");
    common
      .append("rect")
      .attr("y", 35)
      .attr("width", width)
      .attr("height", bottom - 35);
    const clip = defs
      .append("clipPath")
      .attr("id", "history-swipe-b")
      .append("rect")
      .attr("y", 35)
      .attr("height", bottom - 35);
    for (const [i, year] of [
      ctx.countyHistory.a,
      ctx.countyHistory.b,
    ].entries()) {
      const outer = svg
          .append("g")
          .attr("clip-path", "url(#history-swipe-plot)"),
        viewport = outer
          .append("g")
          .attr("clip-path", i ? "url(#history-swipe-b)" : null);
      viewport
        .append("rect")
        .attr("y", 35)
        .attr("width", width)
        .attr("height", bottom - 35)
        .attr("fill", "#f5f7f8");
      const layer = viewport.append("g");
      layers.push(layer);
      panels.push(viewport);
      ctx.countyHistoryMapShapes(
        layer,
        ctx.countyHistoryPaths(layer, width, bottom),
        { year, title: year + " · " + ctx.countyHistoryLabel() },
        svg,
      );
    }
    svg
      .append("text")
      .attr("x", 12)
      .attr("y", 23)
      .attr("font-size", 16)
      .attr("font-weight", 700)
      .attr("fill", "#263e4e")
      .text("A · " + ctx.countyHistory.a + " · " + ctx.countyHistoryLabel());
    svg
      .append("text")
      .attr("x", width - 12)
      .attr("y", 23)
      .attr("text-anchor", "end")
      .attr("font-size", 16)
      .attr("font-weight", 700)
      .attr("fill", "#263e4e")
      .text("B · " + ctx.countyHistory.b + " · " + ctx.countyHistoryLabel());
    svg
      .append("text")
      .attr("class", "history-swipe-instruction")
      .attr("x", 12)
      .attr("y", height - 4)
      .attr("font-size", 12)
      .attr("fill", "#607280")
      .text("拖曳分割線比較同一位置 · 共用比例與相機 · 離島獨立比例");
    const handle = svg
      .append("g")
      .attr("class", "history-swipe-handle")
      .attr("role", "slider")
      .attr("tabindex", 0)
      .attr("aria-label", "擦除比較分割位置")
      .attr("aria-valuemin", 0)
      .attr("aria-valuemax", 100);
    handle
      .append("line")
      .attr("y1", 35)
      .attr("y2", bottom)
      .attr("stroke", "#263e4e")
      .attr("stroke-width", 2);
    handle
      .append("line")
      .attr("y1", 35)
      .attr("y2", bottom)
      .attr("stroke", "transparent")
      .attr("stroke-width", 24);
    handle
      .append("circle")
      .attr("cy", (35 + bottom) / 2)
      .attr("r", 18)
      .attr("fill", "#fff")
      .attr("stroke", "#263e4e")
      .attr("stroke-width", 2);
    handle
      .append("text")
      .attr("y", (35 + bottom) / 2 + 5)
      .attr("text-anchor", "middle")
      .attr("font-size", 18)
      .text("↔");
    ctx.countyHistorySwipeUpdater = () => {
      const x = (width * ctx.countyHistory.wipe) / 100;
      clip.attr("x", x).attr("width", width - x);
      handle
        .attr("transform", `translate(${x},0)`)
        .attr("aria-valuenow", Math.round(ctx.countyHistory.wipe));
    };
    ctx.countyHistorySwipeUpdater();
    handle
      .call(
        ctx.d3
          .drag()
          .on("start", (e) => e.sourceEvent.stopPropagation())
          .on("drag", (e) => ctx.countyHistorySetWipe((e.x / width) * 100)),
      )
      .on("keydown", (ev) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) {
          ev.preventDefault();
          ctx.countyHistorySetWipe(
            ev.key === "Home"
              ? 0
              : ev.key === "End"
                ? 100
                : ctx.countyHistory.wipe + (ev.key === "ArrowLeft" ? -2 : 2),
          );
        }
      });
    ctx.countyHistoryConnectZoom(panels, layers, width, bottom);
  }
  function renderCountyHistoryTrend(svg) {
    const code = ctx.countyHistory.county,
      years = ctx.countyHistoryAsset.elections,
      width = Math.max(1000, ctx.$("#county-history-chart").clientWidth),
      height = Math.max(360, ctx.$("#county-history-chart").clientHeight),
      x = ctx.d3
        .scalePoint()
        .domain(years.map((e) => e.year))
        .range([95, width - 40]),
      y = ctx.d3
        .scaleLinear()
        .domain([0, 100])
        .range([height - 70, 40]);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", "translate(65,0)")
      .call(
        ctx.d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(width - 105))
          .tickFormat((d) => d + "%"),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", `translate(0,${height - 55})`)
      .call(ctx.d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").remove());
    for (let i = 1; i < years.length; i++) {
      const before = years[i - 1].units[code], after = years[i].units[code],
        oldUnits = Object.values(before?.originalUnits || {}).sort().join(","),
        newUnits = Object.values(after?.originalUnits || {}).sort().join(",");
      if (!oldUnits || !newUnits || oldUnits === newUnits) continue;
      const xpos = (x(years[i - 1].year) + x(years[i].year)) / 2,
        marker = svg.append("g").attr("class", "history-boundary-change");
      marker.append("line").attr("x1", xpos).attr("x2", xpos).attr("y1", 35).attr("y2", height - 70).attr("stroke", "#8b6c42").attr("stroke-dasharray", "3 4");
      marker.append("text").attr("x", xpos + 6).attr("y", 26).attr("font-size", 12).attr("fill", "#785b34").text("原統計單位變更");
      marker.append("title").text(Object.values(before.originalUnits).join("＋") + " → " + Object.values(after.originalUnits).join("＋") + "；曲線使用已核驗的整縣合併口徑，並非逐年歷史邊界相同。");
    }
    for (const s of [
      { metric: "dpp", name: "民進黨", color: "#16734c" },
      { metric: "kmt", name: "國民黨", color: "#284f9b" },
      { metric: "turnout", name: "投票率", color: "#8c798f", dash: "5 4" },
    ]) {
      const values = years.map((e) => ({
        year: e.year,
        value: ctx.countyHistoryValue(e.units[code], s.metric),
      }));
      svg
        .append("path")
        .datum(values)
        .attr("class", "county-history-trend")
        .attr("data-metric", s.metric)
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", s.dash || null)
        .attr(
          "d",
          ctx.d3
            .line()
            .defined((d) => d.value != null)
            .x((d) => x(d.year))
            .y((d) => y(d.value)),
        );
      const points = svg
        .append("g")
        .selectAll("circle")
        .data(values.filter((d) => d.value != null))
        .join("circle")
        .attr("data-metric", s.metric)
        .attr("data-year", (d) => d.year)
        .attr("data-value", (d) => d.value)
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.value))
        .attr("r", 5)
        .attr("fill", s.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("role", "button")
        .attr("tabindex", (d) => (d.year === ctx.countyHistory.b ? 0 : -1))
        .attr(
          "aria-label",
          (d) => d.year + " " + s.name + " " + ctx.pct(d.value),
        )
        .on("click", (_, d) => ctx.selectCountyHistory(code, d.year))
        .on("keydown", (ev, d) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ctx.selectCountyHistory(code, d.year);
          }
        });
      points
        .append("title")
        .text((d) => d.year + " " + s.name + " " + ctx.pct(d.value));
    }
    svg
      .append("text")
      .attr("x", 65)
      .attr("y", height - 10)
      .attr("font-size", 13)
      .attr("fill", "#657783")
      .text(
        ctx.countyHistoryAsset.counties[code] +
          " · 同一政黨跨屆比較；未提名／缺資料保留斷點，不推論選民轉移",
      );
  }
  function countyHistoryStop() {
    if (ctx.countyHistoryTimer) clearInterval(ctx.countyHistoryTimer);
    ctx.countyHistoryTimer = null;
    ctx.$("#county-history-play").textContent = "播放";
    ctx.$("#county-history-play").setAttribute("aria-pressed", "false");
  }
  function countyHistoryEnsureYears() {
    const years = ctx.countyHistoryType().years;
    for (const key of ["a", "b"])
      if (!years.includes(ctx.countyHistory[key]))
        ctx.countyHistory[key] = years.at(key === "a" ? -2 : -1);
  }
  function countyHistoryControls() {
    const s = ctx.countyHistory,
      t = ctx.countyHistoryType(),
      map = ["maps", "swipe"].includes(s.view),
      spatial = s.view === "spatial";
    if (spatial && s.metric === "winner") s.metric = "turnout";
    ctx.$("#county-history-metric option[value=winner]").disabled = spatial;
    ctx.$("#county-history-spatial-csv").hidden = !spatial;
    ctx.$("#county-history-kind").value = s.kind;
    for (const key of ["metric", "sort", "a", "b", "county"])
      ctx.$("#county-history-" + key).value = s[key];
    for (const b of ctx.$$("[data-history-view]"))
      b.classList.toggle("active", b.dataset.historyView === s.view);
    ctx.$("#county-history-sort-label").hidden = s.view !== "matrix";
    ctx.$("#county-history-metric-label").hidden = s.view === "trend";
    ctx.$("#history-arrows-label").hidden = s.view !== "maps" || s.metric === "winner";
    ctx.$("#history-arrows").checked = !!s.arrows;
    ctx.$("#county-history-county-label").hidden = s.view === "matrix";
    for (const id of ["county-history-a-label", "county-history-zoom"])
      ctx.$("#" + id).hidden = !map;
    for (const id of ["county-history-b-label", "county-history-time"])
      ctx.$("#" + id).hidden = !map && !spatial;
    ctx.$("#county-history-wipe-label").hidden = s.view !== "swipe";
    ctx.$("#county-history-wipe").value = s.wipe;
    ctx.$("#county-history-wipe-output").textContent = Math.round(s.wipe) + "%";
    ctx.$("#county-history-year-slider").max = t.years.length - 1;
    ctx.$("#county-history-year-slider").value = t.years.indexOf(s.b);
    ctx.$("#county-history-year-output").textContent = s.b;
    ctx
      .$("#county-history-year-slider")
      .setAttribute("aria-valuetext", s.b + "年");
    ctx.$("#county-history-subtitle").textContent =
      t.title + " · " + t.years[0] + "—" + t.years.at(-1) + " · 22縣市統計範圍";
  }
  function renderCountyHistory() {
    if (
      !ctx.countyHistoryAsset ||
      ctx.countyHistoryAsset !==
        ctx.countyHistoryCache.get(ctx.countyHistory.kind)?.asset
    )
      return;
    if (
      ctx.countyHistory.view === "spatial" &&
      typeof ctx.renderCountyHistorySpatial !== "function"
    ) {
      ctx.$("#county-history-readout").textContent = "載入空間分析模組…";
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          if (typeof ctx.renderCountyHistorySpatial === "function")
            ctx.renderCountyHistory();
          else
            ctx.$("#county-history-readout").textContent =
              "空間分析模組載入失敗，請重新整理。";
        },
        { once: true },
      );
      return;
    }
    ctx.countyHistoryControls();
    const svg = ctx.d3.select("#county-history-chart");
    svg
      .attr("data-ready", "false")
      .attr("data-spatial-n", null)
      .attr("data-spatial-I", null)
      .attr("data-spatial-p", null)
      .attr("data-spatial-common", null)
      .on(".zoom", null)
      .selectAll("*")
      .remove();
    ctx.countyHistoryZoom = null;
    ctx.countyHistoryZoomPanels = [];
    ctx.countyHistorySwipeUpdater = null;
    const pattern = svg
      .append("defs")
      .append("pattern")
      .attr("id", "history-county-missing")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 7)
      .attr("height", 7);
    pattern
      .append("rect")
      .attr("width", 7)
      .attr("height", 7)
      .attr("fill", "#f1f3f4");
    pattern
      .append("path")
      .attr("d", "M-1,1L1,-1M0,7L7,0M6,8L8,6")
      .attr("stroke", "#9daab3")
      .attr("stroke-width", 1);
    ctx.countyHistoryLegend();
    svg
      .attr("data-view", ctx.countyHistory.view)
      .attr("data-kind", ctx.countyHistory.kind);
    if (ctx.countyHistory.view === "matrix") ctx.renderCountyMatrix(svg);
    else if (ctx.countyHistory.view === "maps")
      ctx.renderCountyHistoryMaps(svg);
    else if (ctx.countyHistory.view === "swipe")
      ctx.renderCountyHistorySwipe(svg);
    else if (ctx.countyHistory.view === "spatial") {
      ctx.countyHistorySpatialCurrent = null;
      ctx.$("#county-history-spatial-csv").disabled = true;
      if (!ctx.renderCountyHistorySpatial(svg)) {
        ctx.updateHash();
        return;
      }
      ctx.$("#county-history-spatial-csv").disabled = false;
    } else ctx.renderCountyHistoryTrend(svg);
    ctx.countyHistoryReadout(ctx.countyHistory.county);
    const comparison = ctx.countyHistory, code = comparison.county;
    const aUnit = ctx.countyHistoryElection(comparison.a)?.units[code],
      bUnit = ctx.countyHistoryElection(comparison.b)?.units[code];
    const comparisonMetric = comparison.view === "trend" ? "dpp" : comparison.metric;
    const aValue = ctx.countyHistoryValue(aUnit, comparisonMetric), bValue = ctx.countyHistoryValue(bUnit, comparisonMetric);
    const numeric = comparisonMetric !== "winner" && Number.isFinite(aValue) && Number.isFinite(bValue);
    const merged = [aUnit, bUnit].some(unit => unit && Object.keys(unit.originalUnits || {}).length > 1);
    const status = ctx.$("#county-history-comparability");
    status.textContent = numeric ? merged ? "已按官方證據合併後比較" : "可直接比較" :
      comparisonMetric === "winner" ? "分類結果分別查閱，不計數值差" : "目前不提供比較";
    status.title = ctx.countyHistoryAsset.derived_method;
    if (["maps", "swipe", "trend"].includes(comparison.view)) {
      const pair = document.createElement("p");
      pair.className = "county-history-pair";
      const endpoint = (unit, value) => !Number.isFinite(value) ? ctx.countyHistoryStatus(unit, comparisonMetric) :
        comparisonMetric === "winner" ? unit.candidates[0].party + " " + ctx.pct(value) :
          comparisonMetric === "margin" ? value.toFixed(2) + " 個百分點" : ctx.pct(value);
      pair.textContent = (ctx.countyHistoryAsset.counties[code] || code) + " · " + (comparison.view === "trend" ? "民進黨得票率" : ctx.countyHistoryLabel()) +
        " · " + comparison.a + " " + endpoint(aUnit, aValue) +
        " → " + comparison.b + " " + endpoint(bUnit, bValue) +
        (numeric ? " · " + comparison.b + " − " + comparison.a + " = " + ctx.sign(bValue - aValue) + " 個百分點" :
          " · " + status.textContent);
      ctx.$("#county-history-readout").prepend(pair);
    }
    ctx.$("#county-history-method").textContent =
      ctx.countyHistoryAsset.derived_method +
      (ctx.countyHistory.view === "spatial"
        ? " 空間分析固定使用現今完整縣市統計範圍之Rook共邊拓撲，並取各屆共同非缺值、非未提名且有範圍內鄰接的縣市；海島不按距離補接。每屆地區等權、權重列標準化，999次排列、種子2024，上尾單尾p加1校正；缺值、未提名及孤立縣市排除，不補0。拓撲不是歷史法定界線，結果不能推論個人轉投、因果或直接外推至鄉鎮尺度。"
        : "");
    const elections = ctx.countyHistoryAsset.elections,
      available = elections.reduce(
        (n, e) =>
          n + Object.values(e.units).filter(ctx.countyHistoryAvailable).length,
        0,
      );
    ctx.$("#county-history-source").textContent =
      "中選會原始結果 · " +
      elections.length +
      "屆／" +
      available +
      "個可用縣市結果" +
      (available < elections.length * 22
        ? "／" + (elections.length * 22 - available) + "個缺資料"
        : "") +
      "；保留原始縣市組成、來源檔SHA256。政黨未提名不填0。";
    svg.attr("data-ready", "true");
    ctx.countyHistoryResizeSignature = svg.node().clientWidth + "x" + svg.node().clientHeight;
    ctx.updateHash();
  }
  async function openCountyHistory() {
    ctx.presentHistoryNavigation?.("county");
    for (const id of ["history-dialog", "archive-dialog"])
      if (ctx.$("#" + id)?.open) ctx.$("#" + id).close();
    const dialog = ctx.$("#county-history-dialog");
    if (!dialog.open) dialog.showModal();
    ctx.countyHistoryEnsureYears();
    ctx.countyHistoryControls();
    const request = ++ctx.countyHistoryRequest,
      kind = ctx.countyHistory.kind;
    ctx.$("#county-history-chart").setAttribute("data-ready", "false");
    for (const id of ["csv", "svg", "png", "spatial-csv"])
      ctx.$("#county-history-" + id).disabled = true;
    ctx.countyHistorySpatialCurrent = null;
    ctx.$("#county-history-source").textContent = "";
    ctx.$("#county-history-method").textContent = "資料載入中。";
    if (!ctx.countyHistoryCache.has(kind)) {
      const entry = { asset: null, promise: null };
      entry.promise = fetch(ctx.countyHistoryType().file)
        .then((r) => {
          if (!r.ok) throw Error("Historical data unavailable");
          return r.json();
        })
        .then((asset) => {
          entry.asset = asset;
          return asset;
        })
        .catch((error) => {
          ctx.countyHistoryCache.delete(kind);
          throw error;
        });
      ctx.countyHistoryCache.set(kind, entry);
    }
    ctx.$("#county-history-readout").textContent =
      "按需載入" + ctx.countyHistoryType().title + "資料…";
    ctx.d3.select("#county-history-chart").selectAll("*").remove();
    try {
      const asset = await ctx.countyHistoryCache.get(kind).promise;
      if (
        request !== ctx.countyHistoryRequest ||
        !dialog.open ||
        kind !== ctx.countyHistory.kind
      )
        return;
      ctx.countyHistoryAsset = asset;
      for (const id of ["a", "b"])
        ctx.$("#county-history-" + id).innerHTML = asset.elections
          .map((e) => "<option>" + e.year + "</option>")
          .join("");
      ctx.$("#county-history-county").innerHTML = ctx.COUNTY_ORDER.map(
        (c) =>
          '<option value="' +
          c +
          '">' +
          ctx.esc(asset.counties[c]) +
          "</option>",
      ).join("");
      for (const id of ["csv", "svg", "png"])
        ctx.$("#county-history-" + id).disabled = false;
      ctx.renderCountyHistory();
    } catch {
      if (request === ctx.countyHistoryRequest)
        ctx.$("#county-history-readout").textContent =
          "資料載入失敗。重新選擇選票可再試。";
    }
  }
  function openCountyHistoryForElection(kind, year) {
    ctx.countyHistoryStop();
    ctx.countyHistory.kind = ctx.COUNTY_HISTORY_TYPES[kind]
      ? kind
      : "president";
    ctx.countyHistory.a = year;
    ctx.countyHistory.b = year;
    ctx.countyHistoryEnsureYears();
    const years = ctx.countyHistoryType().years,
      i = years.indexOf(ctx.countyHistory.b);
    ctx.countyHistory.a = years[Math.max(0, i - 1)];
    ctx.countyHistory.view = "maps";
    ctx.countyHistory.camera = [1, 0, 0];
    ctx.openCountyHistory();
  }
  ctx.$("#county-history-open").onclick = ctx.openCountyHistory;
  ctx.$("#county-history-close").onclick = () => {
    ctx.$("#county-history-dialog").close();
  };
  ctx.$("#county-history-dialog").addEventListener("close", () => {
    ctx.countyHistoryStop();
    ctx.countyHistoryRequest++;
    ctx.updateHash();
  });
  ctx.$("#county-history-national").onclick = () => {
    ctx.$("#county-history-dialog").close();
    ctx.$("#history-open").click();
  };
  ctx.$("#county-history-kind").onchange = (ev) => {
    ctx.countyHistoryStop();
    ctx.countyHistory.kind = ev.target.value;
    ctx.countyHistoryAsset = null;
    ctx.countyHistory.camera = [1, 0, 0];
    ctx.countyHistoryEnsureYears();
    ctx.openCountyHistory();
  };
  for (const b of ctx.$$("[data-history-view]"))
    b.onclick = () => {
      ctx.countyHistoryStop();
      ctx.countyHistory.view = b.dataset.historyView;
      ctx.countyHistoryViewTouched = true;
      ctx.renderCountyHistory();
    };
  for (const key of ["metric", "sort", "a", "b", "county"])
    ctx.$("#county-history-" + key).onchange = (ev) => {
      ctx.countyHistoryStop();
      ctx.countyHistory[key] = ["a", "b"].includes(key)
        ? +ev.target.value
        : ev.target.value;
      // Change-first: picking two years defaults to the change view until the
      // reader explicitly chooses another view.
      if (
        ["a", "b"].includes(key) &&
        !ctx.countyHistoryViewTouched &&
        ctx.countyHistory.view === "matrix"
      )
        ctx.countyHistory.view = "swipe";
      ctx.renderCountyHistory();
    };
  for (const [id, factor] of [
    ["plus", 1.5],
    ["minus", 1 / 1.5],
  ])
    ctx.$("#county-history-" + id).onclick = () => {
      if (ctx.countyHistoryZoom)
        ctx.countyHistoryZoomPanels[0].call(
          ctx.countyHistoryZoom.scaleBy,
          factor,
        );
    };
  ctx.$("#county-history-reset").onclick = () => {
    ctx.countyHistory.camera = [1, 0, 0];
    ctx.renderCountyHistory();
  };
  ctx.$("#county-history-wipe").oninput = (ev) =>
    ctx.countyHistorySetWipe(+ev.target.value);
  ctx.$("#county-history-year-slider").oninput = (ev) => {
    ctx.countyHistoryStop();
    ctx.countyHistory.b = ctx.countyHistoryType().years[+ev.target.value];
    ctx.renderCountyHistory();
  };
  ctx.$("#county-history-play").onclick = () => {
    if (ctx.countyHistoryTimer) {
      ctx.countyHistoryStop();
      return;
    }
    ctx.$("#county-history-play").textContent = "暫停";
    ctx.$("#county-history-play").setAttribute("aria-pressed", "true");
    ctx.countyHistoryTimer = setInterval(() => {
      if (!ctx.$("#county-history-dialog").open) {
        ctx.countyHistoryStop();
        return;
      }
      const years = ctx.countyHistoryType().years;
      ctx.countyHistory.b =
        years[(years.indexOf(ctx.countyHistory.b) + 1) % years.length];
      ctx.renderCountyHistory();
    }, 1400);
  };
  ctx.$("#county-history-csv").onclick = () => {
    if (!ctx.countyHistoryAsset) return;
    ctx.countyHistoryStop();
    const rows = ctx.countyHistoryAsset.elections.flatMap((e) =>
      Object.values(e.units).flatMap((u) =>
        (ctx.countyHistoryAvailable(u) ? u.candidates : [{}]).map((c) => [
          ctx.countyHistoryType().title,
          e.year,
          u.code,
          u.name,
          Object.values(u.originalUnits).join("＋"),
          c.name ?? "",
          c.party ?? "",
          c.votes ?? "",
          c.share ?? "",
          u.validVotes ?? "",
          u.cast ?? "",
          u.eligible ?? "",
          u.turnout ?? "",
          ctx.countyHistoryAvailable(u) ? "可用" : "缺資料",
          u.missing_reason || "",
          ctx.countyHistoryAsset.comparability_status,
          JSON.stringify(e.sourceSHA256),
        ]),
      ),
    );
    ctx.csvTable(
      [
        "選票類型",
        "年份",
        "統計縣市ID",
        "統計縣市",
        "原始縣市單位",
        "候選人或政黨",
        "來源政黨",
        "票數",
        "得票率",
        "有效票",
        "投票數",
        "選舉人數",
        "投票率",
        "資料狀態",
        "缺資料說明",
        "統計對應",
        "來源檔SHA256",
      ],
      rows,
      "臺灣-" + ctx.countyHistoryType().title + "-縣市歷史結果.csv",
    );
  };
  function countyHistoryExportLegend() {
    let rows;
    if (ctx.countyHistory.view === "trend")
      rows = [
        { label: "民主進步黨得票率", color: "#16734c" },
        { label: "中國國民黨得票率", color: "#284f9b" },
        { label: "投票率（虛線）", color: "#8c798f" },
      ];
    else if (ctx.countyHistory.metric === "winner")
      rows = ctx
        .countyHistoryParties()
        .map((p) => ({ label: p, color: ctx.historyPartyColor(p) }));
    else {
      const max = ctx.countyHistoryMax();
      rows = [
        {
          label: ctx.countyHistoryLabel() + "（各屆共同色階）",
          ramp: ctx.d3
            .range(7)
            .map((i) => ctx.countyHistorySequential((max * i) / 6)),
          ticks: ["0", max / 2 + "", max + ""],
        },
      ];
      if (ctx.countyHistory.view === "maps")
        rows.push({
          label: "變化 B−A（百分點）",
          ramp: ctx.d3
            .range(9)
            .map((i) => ctx.countyHistoryColor(-30 + i * 7.5, true)),
          ticks: ["≤−30", "0", "≥+30"],
        });
    }
    if (ctx.countyHistory.kind === "mayor")
      rows.push({
        label: "斜線＝缺資料；灰色＝未提名此黨，兩者不補0",
        color: "#dce2e7",
      });
    return rows;
  }
  function countyHistoryExportXML() {
    if (!ctx.countyHistoryAsset) return null;
    ctx.countyHistoryStop();
    const t = ctx.countyHistoryType(),
      s = ctx.countyHistory,
      view = {
        matrix: "歷史矩陣",
        maps: "雙年份比較",
        swipe: "擦除比較",
        trend: "縣市走勢",
        spatial: "歷屆空間關聯",
      }[s.view];
    if (s.view === "spatial")
      return ctx.standaloneSVGPanel(
        ctx.$("#county-history-chart"),
        "臺灣" + t.title + " · 歷屆空間關聯 · " + ctx.countyHistoryLabel(),
        t.years[0] +
          "—" +
          t.years.at(-1) +
          "；固定共同可用縣市、Rook共邊、列標準化；999次排列、種子2024；不推論個人行為或因果。",
        {
          legend: ctx.countyHistoryExportLegend(),
          metadata: {
            kind: s.kind,
            metric: s.metric,
            sourceVersion: ctx.countyHistoryAsset.version,
            sources: ctx.countyHistoryAsset.sources,
            spatial: ctx.countyHistorySpatialMetadata(),
          },
        },
      );
    return ctx.standaloneSVGPanel(
      ctx.$("#county-history-chart"),
      "臺灣" + t.title + " · " + view + " · " + ctx.countyHistoryLabel(),
      (["matrix", "trend", "spatial"].includes(s.view)
        ? t.years[0] + "—" + t.years.at(-1)
        : s.a + " → " + s.b) +
        "；22縣市統計範圍，現今形狀僅作定位；不將未提名或缺資料補0。" +
        (s.kind === "legislator-list" ? "政黨票第一名不等於席次當選。" : ""),
      {
        legend: ctx.countyHistoryExportLegend(),
        cleanCopy: (copy) => {
          const handle = copy.querySelector(".history-swipe-handle");
          if (handle) {
            for (const e of handle.querySelectorAll(
              'circle,text,line[stroke="transparent"]',
            ))
              e.remove();
            handle.removeAttribute("role");
            handle.removeAttribute("aria-valuenow");
          }
          const note = copy.querySelector(".history-swipe-instruction");
          if (note)
            note.textContent =
              "A／B同尺度比較 · 分割位置 " +
              Math.round(s.wipe) +
              "% · 離島獨立比例";
        },
        metadata: {
          kind: s.kind,
          years: t.years,
          yearA: s.a,
          yearB: s.b,
          county: s.county,
          wipe: s.wipe,
          metric: s.metric,
          sourceVersion: ctx.countyHistoryAsset.version,
          sources: ctx.countyHistoryAsset.sources,
          method: ctx.countyHistoryAsset.derived_method,
          spatial:
            s.view === "spatial"
              ? ctx.countyHistorySpatialMetadata()
              : undefined,
        },
      },
    );
  }
  function countyHistoryExportName() {
    return (
      "臺灣-" +
      ctx.countyHistoryType().title +
      "-" +
      ctx.countyHistory.view +
      "-" +
      ctx.countyHistoryLabel()
    );
  }
  ctx.$("#county-history-svg").onclick = () => {
    const xml = ctx.countyHistoryExportXML();
    if (xml)
      ctx.saveBlob(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        ctx.countyHistoryExportName() + ".svg",
      );
  };
  ctx.$("#county-history-png").onclick = () => {
    const xml = ctx.countyHistoryExportXML();
    if (xml) ctx.downloadPNG(xml, ctx.countyHistoryExportName());
  };
  function parseCountyHistoryRoute(p) {
    const changeFirst = p.has("history-a") && p.has("history-b");
    if (!p.has("history-region") && !changeFirst) {
      if (ctx.$("#county-history-dialog").open)
        ctx.$("#county-history-dialog").close();
      return;
    }
    ctx.countyHistoryStop();
    const s = ctx.countyHistory;
    s.kind = ctx.COUNTY_HISTORY_TYPES[p.get("history-kind")]
      ? p.get("history-kind")
      : "president";
    s.view = ["matrix", "maps", "swipe", "trend", "spatial"].includes(
      p.get("history-region"),
    )
      ? p.get("history-region")
      : p.has("history-a") && p.has("history-b")
        ? "swipe"
        : "matrix";
    s.metric = ["dpp", "kmt", "winner", "turnout", "margin"].includes(
      p.get("history-metric"),
    )
      ? p.get("history-metric")
      : "dpp";
    s.sort = ["mean", "volatility", "votes", "changes"].includes(p.get("history-sort"))
      ? p.get("history-sort")
      : "geography";
    s.arrows = p.get("history-arrows") === "1";
    for (const key of ["a", "b"]) s[key] = +p.get("history-" + key);
    ctx.countyHistoryEnsureYears();
    s.county = ctx.data.counties[p.get("history-county")]
      ? p.get("history-county")
      : "63000";
    const cam = (p.get("history-camera") || "").split(",").map(Number);
    s.camera =
      cam.length === 3 &&
      cam.every(Number.isFinite) &&
      cam[0] >= 1 &&
      cam[0] <= 8
        ? cam
        : [1, 0, 0];
    const wipe = +p.get("history-wipe");
    s.wipe =
      p.has("history-wipe") && Number.isFinite(wipe)
        ? Math.max(0, Math.min(100, wipe))
        : 50;
    requestAnimationFrame(ctx.openCountyHistory);
  }
  function serializeCountyHistoryRoute(p) {
    if (!ctx.$("#county-history-dialog").open) return;
    for (const [key, v] of Object.entries({
      kind: ctx.countyHistory.kind,
      region: ctx.countyHistory.view,
      metric: ctx.countyHistory.metric,
      sort: ctx.countyHistory.sort,
      a: ctx.countyHistory.a,
      b: ctx.countyHistory.b,
      county: ctx.countyHistory.county,
      wipe: +ctx.countyHistory.wipe.toFixed(2),
      arrows: ctx.countyHistory.arrows ? "1" : "0",
      camera: ctx.countyHistory.camera.map((n) => +n.toFixed(5)).join(","),
    }))
      p.set("history-" + key, v);
  }
  document.addEventListener("keydown", (ev) => {
    if (
      !ev.target.closest?.('#county-history-chart [role="button"]') ||
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(ev.key)
    )
      return;
    const nodes = ctx.$$('#county-history-chart [role="button"]'),
      i = nodes.indexOf(ev.target),
      step =
        ctx.countyHistory.view === "matrix" &&
        ["ArrowLeft", "ArrowRight"].includes(ev.key)
          ? 22
          : 1,
      next =
        ev.key === "Home"
          ? 0
          : ev.key === "End"
            ? nodes.length - 1
            : (i +
                (["ArrowLeft", "ArrowUp"].includes(ev.key) ? -step : step) +
                nodes.length) %
              nodes.length;
    ev.preventDefault();
    ev.target.tabIndex = -1;
    nodes[next].tabIndex = 0;
    nodes[next].focus();
  });
  ctx.countyHistoryResizeSignature = "";
  new ResizeObserver(() => {
    if (!ctx.$("#county-history-dialog").open || !ctx.countyHistoryAsset)
      return;
    const svg = ctx.$("#county-history-chart"),
      signature = svg.clientWidth + "x" + svg.clientHeight;
    if (signature === ctx.countyHistoryResizeSignature) return;
    ctx.countyHistoryResizeSignature = signature;
    requestAnimationFrame(() => {
      if (ctx.$("#county-history-dialog").open) ctx.renderCountyHistory();
    });
  }).observe(ctx.$("#county-history-chart"));
}
