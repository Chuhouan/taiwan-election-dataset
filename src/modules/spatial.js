/** Explicit module installer; dependencies are supplied by the application context. */
import { installLocalSpatial } from "../ui/local-spatial.js";
export function install(ctx) {
  Object.assign(ctx, {
    spatialCurrentRows,
    renderSpatial,
    drawSpatialScatter,
    drawSpatialPermutations,
    renderSpatialLocal,
    renderSpatialComponents,
  });
  /* Advanced town-scale spatial research; geometry is loaded only on demand. */
  ctx.spatialPayload = null;
  ctx.spatialStudy = null;
  ctx.spatialScope = [];
  ctx.spatialFocus = "";
  ctx.spatialGeneration = 0;
  ctx
    .$(".research-menu-items")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="spatial-open">鄰接與聚集</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="spatial-dialog"><header class="spatial-header"><div><span>2024 總統 · 鄉鎮層級</span><h2>鄰接與空間聚集</h2></div><button id="spatial-close" aria-label="關閉空間分析">×</button></header><div class="spatial-toolbar"><label>候選人<select id="spatial-candidate"><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select></label><label>鄰接<select id="spatial-weights"><option value="rook">Rook · 共邊</option><option value="queen">Queen · 共點或共邊</option></select></label><label>高支持門檻<input id="spatial-threshold" type="number" min="0" max="100" value="40">%</label><button id="spatial-csv">分析 CSV</button><button id="spatial-svg">關聯圖 SVG</button></div><div class="spatial-layout"><aside id="spatial-summary"></aside><section class="spatial-charts"><svg id="spatial-chart" viewBox="0 0 620 350" role="img" aria-label="地區得票率與相鄰地區平均得票率"></svg><svg id="spatial-permutations" viewBox="0 0 620 170" role="img" aria-label="Moran隨機排列參考分布"></svg><div id="spatial-components"></div></section><aside class="spatial-local"><label>鄉鎮<select id="spatial-focus"></select></label><div id="spatial-neighbors"></div></aside></div></dialog>`,
  );
  installLocalSpatial(ctx);
  function spatialCurrentRows() {
    let selected = ctx.state.brushed
        .map((k) => ctx.records[k])
        .filter(ctx.valid),
      towns = Object.values(ctx.records).filter(
        (r) => ctx.valid(r) && r.town !== "000",
      );
    if (selected.length) {
      const counties = new Set(
          selected.filter((r) => r.town === "000").map((r) => r.county),
        ),
        keys = new Set(ctx.state.brushed);
      towns = towns.filter(
        (r) => keys.has(ctx.keyOf(r)) || counties.has(r.county),
      );
    } else if (ctx.filterActive) towns = [];
    else if (ctx.state.county)
      towns = towns.filter((r) => r.county === ctx.state.county);
    return towns;
  }
  ctx.$("#spatial-open").onclick = async () => {
    if (ctx.isLeg()) return;
    const generation = ++ctx.spatialGeneration;
    ctx.spatialStudy = null;
    for (const id of [
      "spatial-chart",
      "spatial-permutations",
      "spatial-components",
      "spatial-neighbors",
    ])
      ctx.$("#" + id).innerHTML = "";
    ctx.spatialScope = ctx.spatialCurrentRows();
    ctx.spatialFocus =
      ctx.state.key && ctx.records[ctx.state.key]?.town !== "000"
        ? ctx.state.key
        : ctx.keyOf(ctx.spatialScope[0] || ctx.records["63000/010"]);
    ctx.$("#spatial-candidate").value = ctx.state.candidate;
    ctx.$("#spatial-summary").textContent = "載入官方圖資衍生鄰接…";
    ctx.$("#spatial-dialog").showModal();
    try {
      if (!ctx.spatialPayload) {
        const response = await fetch("town-adjacency.json");
        if (!response.ok) throw Error("adjacency");
        ctx.spatialPayload = await response.json();
      }
      if (generation !== ctx.spatialGeneration || ctx.isLeg()) return;
      ctx.renderSpatial();
    } catch (error) {
      ctx.$("#spatial-summary").textContent = "鄰接資料載入失敗，請重新開啟。";
      console.error(error);
    }
  };
  ctx.$("#spatial-close").onclick = () => {
    ctx.spatialGeneration++;
    ctx.$("#spatial-dialog").close();
  };
  ctx
    .$("#spatial-dialog")
    .addEventListener("cancel", () => ctx.spatialGeneration++);
  for (const id of [
    "spatial-candidate",
    "spatial-weights",
    "spatial-threshold",
  ])
    ctx.$("#" + id).onchange = ctx.renderSpatial;
  ctx.$("#spatial-focus").onchange = (ev) => {
    ctx.spatialFocus = ev.target.value;
    ctx.renderSpatialLocal();
    ctx.drawSpatialScatter();
  };
  function renderSpatial() {
    if (!ctx.spatialPayload || ctx.isLeg()) return;
    const candidate = ctx.$("#spatial-candidate").value,
      graph = ctx.spatialPayload[ctx.$("#spatial-weights").value],
      rows = ctx.spatialScope.map((r) => ({
        key: ctx.keyOf(r),
        value: ctx.shareOf(r, candidate),
      }));
    ctx.spatialStudy = ctx.spatialMoran(rows, graph);
    const s = ctx.spatialStudy,
      missing = s.excludedKeys.filter((k) =>
        ctx.spatialPayload.metadata.missing_geometry_towns.includes(k),
      );
    ctx.$("#spatial-summary").innerHTML =
      '<h3>目前範圍</h3><div class="spatial-stat"><span>參與統計的鄉鎮</span><b>' +
      s.n +
      "<small> / " +
      rows.length +
      '</small></b></div><div class="spatial-stat"><span>Moran’s I</span><b>' +
      (s.I == null ? "—" : s.I.toFixed(4)) +
      '</b></div><div class="spatial-stat"><span>正向聚集 · 排列 p 值</span><b>' +
      (s.pUpper == null ? "—" : s.pUpper.toFixed(3)) +
      "</b></div><p>排除 " +
      s.excludedKeys.length +
      " 個無鄰接單位，其中 " +
      missing.length +
      " 個缺少可用幾何。海島不按距離或橋梁補接。</p><details open><summary>統計口徑</summary><p>鄉鎮等權，鄰接權重逐列標準化；I = ΣᵢΣⱼwᵢⱼzᵢzⱼ / Σᵢzᵢ²。期望值 " +
      (s.expected == null ? "—" : s.expected.toFixed(4)) +
      "；999次排列、固定種子2024。p為正向聚集單尾上尾比例（加1校正）。坐標顯示地區百分比，非個人行為。</p></details><details><summary>圖資與限制</summary><p>1120928官方村里圖資合併鄉鎮，依未簡化幾何建立鄰接；" +
      ctx.spatialPayload.metadata.excluded_overlap_pairs.length +
      '對明顯重疊圖形不計鄰接。篩選範圍使用其內部子圖，外部鄰居不參與全域統計。結果對尺度、邊界與權重敏感，不能解釋因果或推論個別選民。</p><a href="https://pysal.org/esda/v2.9.0/source/generated/esda.Moran.html" target="_blank" rel="noopener">Moran 指標與排列方法 ↗</a></details>';
    ctx.$("#spatial-focus").innerHTML = ctx.spatialScope
      .map(
        (r) =>
          '<option value="' +
          ctx.esc(ctx.keyOf(r)) +
          '">' +
          ctx.esc(ctx.areaName(r, true)) +
          "</option>",
      )
      .join("");
    if (!ctx.spatialScope.some((r) => ctx.keyOf(r) === ctx.spatialFocus))
      ctx.spatialFocus = ctx.spatialScope[0]
        ? ctx.keyOf(ctx.spatialScope[0])
        : "";
    ctx.$("#spatial-focus").value = ctx.spatialFocus;
    ctx.drawSpatialScatter();
    ctx.drawSpatialPermutations();
    ctx.renderSpatialLocal();
    ctx.renderSpatialComponents(rows, graph);
  }
  function drawSpatialScatter() {
    const svg = ctx.d3.select("#spatial-chart");
    svg.selectAll("*").remove();
    if (!ctx.spatialStudy) return;
    const x = ctx.d3.scaleLinear().domain([0, 100]).range([65, 590]),
      y = ctx.d3.scaleLinear().domain([0, 100]).range([300, 35]);
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", "translate(0,300)")
      .call(
        ctx.d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((v) => v + "%"),
      );
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", "translate(65,0)")
      .call(
        ctx.d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((v) => v + "%")
          .tickSize(-525),
      );
    svg
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(100))
      .attr("y1", y(0))
      .attr("y2", y(100))
      .attr("stroke", "#b4c0c8")
      .attr("stroke-dasharray", "4 4");
    svg
      .append("text")
      .attr("class", "scatter-label")
      .attr("x", 65)
      .attr("y", 18)
      .text("分析範圍內相鄰鄉鎮平均得票率（等權）");
    svg
      .append("text")
      .attr("class", "scatter-label")
      .attr("x", 590)
      .attr("y", 335)
      .attr("text-anchor", "end")
      .text(ctx.$("#spatial-candidate").value + " · 鄉鎮得票率");
    svg
      .selectAll(".spatial-dot")
      .data(ctx.spatialStudy.nodes)
      .join("circle")
      .attr("class", "spatial-dot")
      .classed("selected", (d) => d.key === ctx.spatialFocus)
      .attr("data-key", (d) => d.key)
      .attr("data-value", (d) => d.value)
      .attr("data-lag", (d) => d.lag)
      .attr("cx", (d) => x(d.value))
      .attr("cy", (d) => y(d.lag))
      .attr("r", (d) => (d.key === ctx.spatialFocus ? 7 : 3.5))
      .attr("fill", (d) => (d.key === ctx.spatialFocus ? "#b17d32" : "#5f8991"))
      .attr("opacity", 0.7)
      .attr("stroke", "#fff")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr(
        "aria-label",
        (d) =>
          ctx.areaName(ctx.records[d.key], true) +
          " 得票率" +
          ctx.pct(d.value) +
          " 鄰接平均" +
          ctx.pct(d.lag),
      )
      .on("click", (_, d) => {
        ctx.spatialFocus = d.key;
        ctx.$("#spatial-focus").value = d.key;
        ctx.renderSpatialLocal();
        ctx.drawSpatialScatter();
      })
      .on("keydown", (ev, d) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.spatialFocus = d.key;
          ctx.$("#spatial-focus").value = d.key;
          ctx.renderSpatialLocal();
          ctx.drawSpatialScatter();
        }
      })
      .append("title")
      .text(
        (d) =>
          ctx.areaName(ctx.records[d.key], true) +
          "；" +
          ctx.pct(d.value) +
          "／鄰接" +
          ctx.pct(d.lag),
      );
    svg
      .attr("data-moran-i", ctx.spatialStudy.I ?? "")
      .attr("data-n", ctx.spatialStudy.n)
      .attr("data-p-upper", ctx.spatialStudy.pUpper ?? "");
    ctx.updateChartTabStops();
  }
  function drawSpatialPermutations() {
    const svg = ctx.d3.select("#spatial-permutations");
    svg.selectAll("*").remove();
    const s = ctx.spatialStudy;
    if (!s || s.I == null) return;
    const extent = ctx.d3.extent([...s.simulations, s.I]),
      x = ctx.d3.scaleLinear().domain(extent).nice().range([65, 590]),
      bins = ctx.d3.bin().domain(x.domain()).thresholds(35)(s.simulations),
      y = ctx.d3
        .scaleLinear()
        .domain([0, ctx.d3.max(bins, (b) => b.length) || 1])
        .range([125, 30]);
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", "translate(0,125)")
      .call(ctx.d3.axisBottom(x).ticks(6));
    svg
      .selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("data-count", (b) => b.length)
      .attr("x", (b) => x(b.x0) + 1)
      .attr("width", (b) => Math.max(1, x(b.x1) - x(b.x0) - 1))
      .attr("y", (b) => y(b.length))
      .attr("height", (b) => 125 - y(b.length))
      .attr("fill", "#b6c7cd");
    svg
      .append("line")
      .attr("x1", x(s.I))
      .attr("x2", x(s.I))
      .attr("y1", 25)
      .attr("y2", 125)
      .attr("stroke", "#b17d32")
      .attr("stroke-width", 2);
    svg
      .append("text")
      .attr("class", "scatter-label")
      .attr("x", 65)
      .attr("y", 17)
      .text("999次隨機排列的 I 分布 · 金線為觀測值 " + s.I.toFixed(4));
  }
  function renderSpatialLocal() {
    const r = ctx.records[ctx.spatialFocus],
      host = ctx.$("#spatial-neighbors");
    if (!r) {
      host.textContent = "目前沒有可分析鄉鎮。";
      return;
    }
    const candidate = ctx.$("#spatial-candidate").value,
      keys =
        ctx.spatialPayload[ctx.$("#spatial-weights").value][ctx.spatialFocus] ||
        [],
      neighbors = keys.map((k) => ctx.records[k]).filter(ctx.valid),
      mean = ctx.d3.mean(neighbors, (n) => ctx.shareOf(n, candidate)),
      votes = ctx.d3.sum(
        neighbors,
        (n) => n.candidates.find((c) => c.name === candidate)?.votes || 0,
      ),
      total = ctx.d3.sum(neighbors, (n) => n.total);
    host.innerHTML =
      "<h3>" +
      ctx.esc(r.name) +
      '</h3><div class="spatial-stat"><span>' +
      ctx.esc(candidate) +
      " 得票率</span><b>" +
      ctx.pct(ctx.shareOf(r, candidate)) +
      "</b></div><p>" +
      keys.length +
      "個鄰接鄉鎮；下列包括目前範圍外的鄰居。</p>" +
      (neighbors.length
        ? "<p>鄰接等權平均 " +
          ctx.pct(mean) +
          "<br>鄰接票數合計後 " +
          ctx.pct((votes / total) * 100) +
          "<br>本地 − 鄰接平均 " +
          ctx.sign(ctx.shareOf(r, candidate) - mean) +
          " pp</p>"
        : "<p>缺少可用幾何或沒有符合定義的鄰接，不補造連線。</p>") +
      '<button id="spatial-locate">地圖定位</button>' +
      neighbors
        .map(
          (n) =>
            '<button class="spatial-neighbor" data-spatial-neighbor="' +
            ctx.esc(ctx.keyOf(n)) +
            '"><span>' +
            ctx.esc(ctx.areaName(n, true)) +
            "</span><b>" +
            ctx.pct(ctx.shareOf(n, candidate)) +
            "</b></button>",
        )
        .join("");
    ctx.$("#spatial-locate").onclick = () => {
      ctx.$("#spatial-dialog").close();
      ctx.state.chart = "map";
      document.body.classList.remove("detail-closed");
      ctx.selectRegion(ctx.spatialFocus, true);
    };
    ctx.$$("[data-spatial-neighbor]").forEach(
      (button) =>
        (button.onclick = () => {
          ctx.spatialFocus = button.dataset.spatialNeighbor;
          ctx.$("#spatial-focus").value = ctx.spatialFocus;
          ctx.renderSpatialLocal();
          ctx.drawSpatialScatter();
        }),
    );
  }
  function renderSpatialComponents(rows, graph) {
    const threshold = Math.max(
      0,
      Math.min(100, Number(ctx.$("#spatial-threshold").value) || 0),
    );
    ctx.$("#spatial-threshold").value = threshold;
    const components = ctx.spatialComponents(rows, graph, threshold),
      groups = components.filter((c) => c.length >= 2);
    ctx.$("#spatial-components").innerHTML =
      "<h3>相鄰高支持地區 · ≥" +
      threshold +
      "%</h3><p>" +
      groups.length +
      "組連續區域；另有" +
      components.filter((c) => c.length === 1).length +
      "個單獨單位。這是門檻與連通組探索，並非局部顯著性檢定。</p>" +
      groups
        .map(
          (keys, i) =>
            '<button data-spatial-component="' +
            i +
            '"><b>' +
            keys.length +
            " 鄉鎮</b><span>" +
            ctx.esc(
              keys
                .slice(0, 3)
                .map((k) => ctx.areaName(ctx.records[k], true))
                .join("、"),
            ) +
            (keys.length > 3 ? "…" : "") +
            "</span><small>設為 A 組並回到地圖</small></button>",
        )
        .join("");
    ctx.$$("[data-spatial-component]").forEach(
      (button) =>
        (button.onclick = () => {
          if (ctx.state.brushed.some((k) => ctx.records[k]?.town === "000"))
            ctx.state.brushed = ctx.spatialScope.map(ctx.keyOf);
          ctx.state.level = "town";
          ctx.state.key = "";
          ctx.groupSelection = {
            a: groups[Number(button.dataset.spatialComponent)].slice(),
            b: [],
          };
          ctx.$("#spatial-dialog").close();
          ctx.state.chart = "map";
          ctx.updateUI();
          ctx.buildMap();
          ctx.toast("已以此相鄰組替換 A 組；分析範圍保留");
        }),
    );
  }
  ctx.$("#spatial-csv").onclick = () => {
    if (!ctx.spatialStudy) return;
    ctx.csvTable(
      [
        "地區ID",
        "地區",
        "候選人",
        "得票率",
        "範圍內鄰接平均",
        "鄰接定義",
        "Moran_I",
        "單尾正向排列_p",
        "參與單位",
        "排列次數",
        "圖資版本",
      ],
      ctx.spatialStudy.nodes.map((d) => [
        d.key,
        ctx.areaName(ctx.records[d.key], true),
        ctx.$("#spatial-candidate").value,
        d.value,
        d.lag,
        ctx.$("#spatial-weights").value,
        ctx.spatialStudy.I,
        ctx.spatialStudy.pUpper,
        ctx.spatialStudy.n,
        ctx.spatialStudy.permutations,
        ctx.spatialPayload.metadata.boundary_version,
      ]),
      "臺灣2024-鄉鎮空間分析.csv",
    );
  };
  ctx.$("#spatial-svg").onclick = () => {
    if (!ctx.spatialStudy) return;
    ctx.saveBlob(
      new Blob(
        [
          ctx.standaloneSVGPanel(
            ctx.$("#spatial-chart"),
            "2024 總統 · 鄰接得票率探索",
            ctx.$("#spatial-candidate").value +
              "；" +
              ctx.$("#spatial-weights").value +
              "，鄉鎮等權；Moran I " +
              (ctx.spatialStudy.I?.toFixed(4) || "—") +
              "；描述性關聯，非因果",
          ),
        ],
        { type: "image/svg+xml;charset=utf-8" },
      ),
      "臺灣2024-鄰接關聯.svg",
    );
  };
}
