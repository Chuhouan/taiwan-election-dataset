/** Explicit module installer; dependencies are supplied by the application context. */
import { weightedQuantile } from "../data/weighted.js";
export function install(ctx) {
  Object.assign(ctx, {
    scaleFromRecord,
    scaleFromVillage,
    scaleValue,
    scaleAggregate,
    scaleRows,
    scaleFormat,
    scaleReadout,
    scaleBeeswarm,
    renderScale,
    loadScaleCounty,
    openScale,
    scaleExportXML,
    parseScaleRoute,
    serializeScaleRoute,
  });
  /* Multiscale descriptive statistics use raw vote totals at every aggregation level. */
  ctx.scalePayload = null;
  ctx.scaleRequest = 0;
  ctx.scaleState = {
    county: "63000",
    town: "010",
    metric: "share",
    candidate: "賴清德",
    selection: "",
    range: "focus",
    weight: "regions",
  };
  ctx
    .$(".research-menu-items")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="scale-open">比較不同尺度</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="scale-dialog" aria-labelledby="scale-title"><header class="history-header"><div><span>2024 總統選舉 · 縣市／鄉鎮／村里</span><h2 id="scale-title">從平均到地區差異</h2></div><div class="history-downloads"><button id="scale-csv">CSV</button><button id="scale-svg">SVG</button><button id="scale-png">PNG</button><button id="scale-close" aria-label="關閉多尺度統計">×</button></div></header><div class="scale-toolbar"><label>縣市<select id="scale-county"></select></label><label>鄉鎮市區<select id="scale-town"></select></label><label>指標<select id="scale-metric"><option value="share">候選人得票率</option><option value="turnout">投票率</option><option value="enp">有效候選人數 ENP</option><option value="hhi">得票集中度 HHI</option></select></label><label id="scale-candidate-label">候選人<select id="scale-candidate"><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select></label><label>坐標範圍<select id="scale-range"><option value="focus">聚焦資料分布</option><option value="full">完整理論範圍</option></select></label></div><div class="scale-body"><div id="scale-scope" class="scale-scope"></div><svg id="scale-chart" role="group" aria-label="縣市鄉鎮村里同尺度分布比較"></svg><div id="scale-readout" class="scale-readout" aria-live="polite"></div><details class="scale-method"><summary>讀圖與統計口徑</summary><p>每點為一個官方統計單位，縱向只用於避讓；方形為特殊／合併統計組。每列的中位數和四分位數採地區等權，黑色菱形則以該列全部原始票數與分母加總後計算，兩者不相同。不同列範圍逐步縮小，不能跨列再加總。</p><p>ENP = 1/Σp²；HHI = Σp²，p為三組候選人有效票占比。投票率分母為選舉人數；分母為零的單位不計比率。地區得票不能直接推論個人偏好、轉投或因果關係。</p></details><footer class="history-source">中選會2024最終結果 · 村里／特殊組與上層票數、投票數及選舉人數逐級核對。按縣市載入，圖形僅描述目前選舉，不假設跨屆下級行政區可比。</footer></div></dialog>`,
  );
  ctx.$(".scale-toolbar").insertAdjacentHTML("beforeend", '<label>分布權重<select id="scale-weight"><option value="regions">地區等權</option><option value="votes">有效票加權</option></select></label>');
  ctx.$(".scale-method").insertAdjacentHTML("beforeend", '<p>有效票加權時，分位數取有效票權重累積達到25／50／75%的第一個觀測值，不插值；零權重與缺值排除。每點仍為一個統計單位，點的縱向密度不代表票數。黑色菱形始終由原始票數與分母聚合計算。</p>');
  function scaleFromRecord(r, key) {
    return {
      id: key,
      name: ctx.areaName(r, true),
      town: r.town,
      level: r.town === "000" ? "county" : "town",
      valid: r.total,
      cast: r.cast,
      eligible: r.eligible,
      votes: Object.fromEntries(r.candidates.map((c) => [c.name, c.votes])),
      special: false,
    };
  }
  function scaleFromVillage(u) {
    const candidates = ctx.data.president["00000/000"].candidates;
    return {
      id: u.id,
      name:
        ctx.scalePayload.metadata.countyName +
        " · " +
        u.townName +
        " · " +
        u.name,
      town: u.town,
      level: "village",
      valid: u.valid,
      cast: u.cast,
      eligible: u.eligible,
      votes: Object.fromEntries(
        candidates.map((c) => [c.name, u.votes[String(Number(c.number))] || 0]),
      ),
      special: !!u.synthetic,
    };
  }
  function scaleValue(u) {
    if (ctx.scaleState.metric === "turnout")
      return u.eligible ? (u.cast / u.eligible) * 100 : null;
    if (!u.valid) return null;
    if (ctx.scaleState.metric === "share")
      return ((u.votes[ctx.scaleState.candidate] || 0) / u.valid) * 100;
    const hhi = ctx.d3.sum(Object.values(u.votes), (v) => (v / u.valid) ** 2);
    return ctx.scaleState.metric === "hhi" ? hhi : hhi ? 1 / hhi : null;
  }
  function scaleAggregate(units) {
    const votes = {};
    for (const u of units)
      for (const [name, v] of Object.entries(u.votes))
        votes[name] = (votes[name] || 0) + v;
    return {
      valid: ctx.d3.sum(units, (u) => u.valid),
      cast: ctx.d3.sum(units, (u) => u.cast),
      eligible: ctx.d3.sum(units, (u) => u.eligible),
      votes,
    };
  }
  function scaleRows() {
    const all = [
        ...ctx.scalePayload.features.map((f) => f.properties),
        ...ctx.scalePayload.special,
      ],
      counties = Object.entries(ctx.data.president)
        .filter(([, r]) => ctx.valid(r) && r.town === "000")
        .map(([key, r]) => ctx.scaleFromRecord(r, key)),
      towns = Object.entries(ctx.data.president)
        .filter(
          ([, r]) => r.county === ctx.scaleState.county && r.town !== "000",
        )
        .map(([key, r]) => ctx.scaleFromRecord(r, key)),
      villages = all
        .filter((u) => u.town === ctx.scaleState.town)
        .map(ctx.scaleFromVillage);
    return [
      { level: "county", name: "縣市", scope: "全臺22縣市", units: counties },
      {
        level: "town",
        name: "鄉鎮市區",
        scope: ctx.data.counties[ctx.scaleState.county],
        units: towns,
      },
      {
        level: "village",
        name: "村里／統計組",
        scope:
          ctx.data.president[ctx.scaleState.county + "/" + ctx.scaleState.town]
            .name,
        units: villages,
      },
    ];
  }
  function scaleFormat(value) {
    return value == null
      ? "—"
      : value.toFixed(ctx.scaleState.metric === "hhi" ? 3 : 2) +
          (["share", "turnout"].includes(ctx.scaleState.metric) ? "%" : "");
  }
  function scaleReadout(u, persist = true) {
    if (persist) ctx.scaleState.selection = u.id;
    ctx.$("#scale-readout").innerHTML =
      "<div><b>" +
      ctx.esc(u.name) +
      "</b><span>" +
      ctx.$("#scale-metric").selectedOptions[0].textContent +
      " " +
      ctx.scaleFormat(ctx.scaleValue(u)) +
      "</span><small>" +
      ctx.fmt(u.valid) +
      " 有效票 · 投票 " +
      ctx.fmt(u.cast) +
      "／選舉人 " +
      ctx.fmt(u.eligible) +
      (u.special ? " · 特殊統計組，沒有估計範圍" : "") +
      '</small></div><button id="scale-locate">' +
      (u.level === "county"
        ? "查看縣內鄉鎮 ↓"
        : u.level === "town"
          ? "開啟鄉鎮村里圖 ↗"
          : "定位此村里 ↗") +
      "</button>";
    ctx.$("#scale-locate").onclick = () => {
      if (u.level === "county") {
        ctx.scaleState.county = u.id.split("/")[0];
        ctx.scaleState.town = "";
        ctx.loadScaleCounty();
      } else {
        ctx.$("#scale-dialog").close();
        ctx.updateHash();
        ctx.openVillage({
          county: ctx.scaleState.county,
          town: u.town,
          selection: u.level === "village" ? u.id : "",
          metric: ctx.scaleState.metric,
          range: ctx.scaleState.range,
          candidate: ctx.scaleState.candidate,
        });
      }
    };
    if (persist) ctx.updateHash();
  }
  function scaleBeeswarm(units, x, center, maxOffset = 43) {
    const radius = 3.4,
      distance = radius * 2 + 1,
      placed = [];
    for (const u of units
      .slice()
      .sort((a, b) => ctx.scaleValue(a) - ctx.scaleValue(b))) {
      const px = x(ctx.scaleValue(u)),
        neighbors = placed.filter((d) => Math.abs(d.x - px) < distance),
        ys = [0];
      for (const n of neighbors) {
        const dy = Math.sqrt(Math.max(0, distance ** 2 - (px - n.x) ** 2));
        ys.push(n.offset + dy, n.offset - dy);
      }
      ys.sort((a, b) => Math.abs(a) - Math.abs(b));
      const offset =
        ys.find(
          (y) =>
            Math.abs(y) < maxOffset &&
            neighbors.every(
              (n) =>
                (px - n.x) ** 2 + (y - n.offset) ** 2 >= distance ** 2 - 0.001,
            ),
        ) ?? 0;
      placed.push({ u, x: px, y: center + offset, offset, radius });
    }
    return placed;
  }
  function renderScale() {
    if (!ctx.scalePayload) return;
    const townCodes = [
      ...new Set([
        ...ctx.scalePayload.features.map((f) => f.properties.town),
        ...ctx.scalePayload.special.map((u) => u.town),
      ]),
    ].sort();
    if (!townCodes.includes(ctx.scaleState.town))
      ctx.scaleState.town = townCodes[0];
    ctx.$("#scale-town").innerHTML = townCodes
      .map(
        (t) =>
          '<option value="' +
          t +
          '">' +
          ctx.esc(ctx.data.president[ctx.scaleState.county + "/" + t].name) +
          "</option>",
      )
      .join("");
    for (const key of ["county", "town", "metric", "candidate", "range", "weight"])
      ctx.$("#scale-" + key).value = ctx.scaleState[key];
    ctx.$("#scale-candidate-label").hidden = ctx.scaleState.metric !== "share";
    ctx.$(".scale-method p").textContent = "每點為一個統計單位，縱向只避讓；方形為特殊統計組。分位數採" + (ctx.scaleState.weight === "votes" ? "有效票加權" : "地區等權") + "；黑色菱形由該列原始票數與分母聚合，不是下級比率的簡單平均。各列範圍不同，不跨列合計。";
  ctx.$("#scale-scope").textContent =
      "全臺 → " +
      ctx.data.counties[ctx.scaleState.county] +
      " → " +
      ctx.data.president[ctx.scaleState.county + "/" + ctx.scaleState.town]
        .name +
      " · 各列共用橫軸 · " +
      (ctx.scaleState.range === "focus" ? "聚焦目前資料範圍" : "完整理論範圍");
    const rows = ctx.scaleRows();
    const totalUnits = ctx.d3.sum(rows, (row) => row.units.length);
    const excluded = ctx.d3.sum(rows, (row) => row.units.filter((unit) => ctx.scaleValue(unit) == null).length);
    ctx.$("#scale-scope").textContent +=
      " · 有效 " + (totalUnits - excluded) + " 單位 · 排除 " + excluded +
      " · 分位數：" + (ctx.scaleState.weight === "votes" ? "有效票加權" : "地區等權");
    const full =
        ctx.scaleState.metric === "enp"
          ? [1, 3]
          : ctx.scaleState.metric === "hhi"
            ? [1 / 3, 1]
            : [0, 100],
      values = rows
        .flatMap((row) => [
          ...row.units.map(ctx.scaleValue),
          ctx.scaleValue(ctx.scaleAggregate(row.units)),
        ])
        .filter((v) => v != null),
      extent = ctx.d3.extent(values),
      pad = Math.max(
        (extent[1] - extent[0]) * 0.08,
        ["enp", "hhi"].includes(ctx.scaleState.metric) ? 0.005 : 1,
      ),
      domain =
        ctx.scaleState.range === "full"
          ? full
          : [
              Math.max(full[0], extent[0] - pad),
              Math.min(full[1], extent[1] + pad),
            ];
    const width = Math.max(1100, ctx.$("#scale-chart").clientWidth),
      height = Math.max(360, ctx.$("#scale-chart").clientHeight),
      left = 185,
      right = width - 210,
      band = Math.min(43, (height - 100) / 6 - 10),
      x = ctx.d3.scaleLinear().domain(domain).range([left, right]),
      svg = ctx.d3.select("#scale-chart");
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", `translate(0,${height - 50})`)
      .call(
        ctx.d3
          .axisBottom(x)
          .ticks(10)
          .tickFormat((v) =>
            ["share", "turnout"].includes(ctx.scaleState.metric)
              ? v + "%"
              : ctx.d3.format(".2~f")(v),
          ),
      )
      .call((g) => g.select(".domain").attr("stroke", "#bccbd3"));
    const party = ctx.data.president["00000/000"].candidates.find(
        (c) => c.name === ctx.scaleState.candidate,
      ).party,
      pointColor =
        ctx.scaleState.metric === "share" ? ctx.color(party) : "#78909c";
    rows.forEach((row, i) => {
      const center = 35 + (height - 100) / 6 + (i * (height - 100)) / 3,
        defined = row.units.filter((u) => ctx.scaleValue(u) != null),
        values = defined.map(ctx.scaleValue).sort(ctx.d3.ascending),
        quantile = (p) => ctx.scaleState.weight === "votes" ? weightedQuantile(defined.map((u) => ({ value: ctx.scaleValue(u), weight: u.valid })), p) : ctx.d3.quantileSorted(values, p),
        median = quantile(0.5),
        q1 = quantile(0.25),
        q3 = quantile(0.75),
        aggregate = ctx.scaleValue(ctx.scaleAggregate(row.units));
      svg
        .append("line")
        .attr("x1", left)
        .attr("x2", right)
        .attr("y1", center)
        .attr("y2", center)
        .attr("stroke", "#dae3e7");
      svg
        .append("text")
        .attr("x", 18)
        .attr("y", center - 13)
        .attr("font-size", 18)
        .attr("font-weight", 600)
        .attr("fill", "#263f50")
        .text(row.name);
      svg
        .append("text")
        .attr("x", 18)
        .attr("y", center + 9)
        .attr("font-size", 13)
        .attr("fill", "#647987")
        .text(row.scope);
      svg
        .append("text")
        .attr("x", 18)
        .attr("y", center + 29)
        .attr("font-size", 12)
        .attr("fill", "#647987")
        .text(defined.length + "／" + row.units.length + " 單位可計比率");
      if (values.length && [q1, median, q3].every(Number.isFinite)) {
        svg
          .append("rect")
          .attr("class", "scale-iqr")
          .attr("data-level", row.level)
          .attr("data-q1", q1)
          .attr("data-q3", q3)
          .attr("x", x(q1))
          .attr("y", center - band)
          .attr("width", Math.max(1, x(q3) - x(q1)))
          .attr("height", band * 2)
          .attr("fill", "#e7ecef");
        svg
          .append("line")
          .attr("x1", x(median))
          .attr("x2", x(median))
          .attr("y1", center - band - 3)
          .attr("y2", center + band + 3)
          .attr("stroke", "#78909c")
          .attr("stroke-dasharray", "3 3");
        svg
          .append("text")
          .attr("x", right + 20)
          .attr("y", center - 25)
          .attr("font-size", 12)
          .attr("fill", "#627783")
          .text("地區中位數");
        svg
          .append("text")
          .attr("x", right + 20)
          .attr("y", center - 4)
          .attr("class", "scale-median-value")
          .attr("data-level", row.level)
          .attr("data-value", median)
          .attr("font-size", 19)
          .attr("font-weight", 600)
          .attr("fill", "#263f50")
          .text(ctx.scaleFormat(median));
        svg
          .append("text")
          .attr("x", right + 20)
          .attr("y", center + 20)
          .attr("font-size", 12)
          .attr("fill", "#627783")
          .text("原始票數合計後");
        svg
          .append("text")
          .attr("x", right + 20)
          .attr("y", center + 41)
          .attr("class", "scale-aggregate-value")
          .attr("data-level", row.level)
          .attr("data-value", aggregate)
          .attr("font-size", 17)
          .attr("fill", "#172331")
          .text("◆ " + ctx.scaleFormat(aggregate));
      }
      const nodes = ctx.scaleBeeswarm(defined, x, center, band),
        marks = svg
          .append("g")
          .selectAll("path")
          .data(nodes)
          .join("path")
          .attr("class", "scale-point")
          .attr("data-scale-level", row.level)
          .attr("data-unit-id", (d) => d.u.id)
          .attr("data-value", (d) => ctx.scaleValue(d.u))
          .attr("d", (d) =>
            ctx.d3
              .symbol()
              .type(d.u.special ? ctx.d3.symbolSquare : ctx.d3.symbolCircle)
              .size(d.u.special ? 42 : 36)(),
          )
          .attr("transform", (d) => `translate(${d.x},${d.y})`)
          .attr("fill", pointColor)
          .attr("fill-opacity", 0.7)
          .attr("stroke", (d) =>
            d.u.id === ctx.scaleState.selection ? "#172331" : "#fff",
          )
          .attr("stroke-width", (d) =>
            d.u.id === ctx.scaleState.selection ? 2.5 : 1,
          )
          .attr("role", "button")
          .attr("tabindex", i === 0 ? 0 : -1)
          .attr(
            "aria-label",
            (d) => d.u.name + " " + ctx.scaleFormat(ctx.scaleValue(d.u)),
          )
          .on("pointerenter", (_, d) => ctx.scaleReadout(d.u, false))
          .on("click", (_, d) => {
            ctx.scaleReadout(d.u);
            svg
              .selectAll(".scale-point")
              .attr("stroke", (n) => (n.u.id === d.u.id ? "#172331" : "#fff"))
              .attr("stroke-width", (n) => (n.u.id === d.u.id ? 2.5 : 1));
          })
          .on("keydown", (ev, d) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              ctx.scaleReadout(d.u);
            }
          });
      marks
        .append("title")
        .text((d) => d.u.name + " " + ctx.scaleFormat(ctx.scaleValue(d.u)));
      if (aggregate != null) {
        svg
          .append("line")
          .attr("class", "scale-aggregate-guide")
          .attr("x1", x(aggregate))
          .attr("x2", x(aggregate))
          .attr("y1", center - band - 6)
          .attr("y2", center)
          .attr("stroke", "#172331")
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.4)
          .attr("pointer-events", "none");
        svg
          .append("path")
          .attr("class", "scale-aggregate-marker")
          .attr("data-level", row.level)
          .attr("data-value", aggregate)
          .attr("d", ctx.d3.symbol().type(ctx.d3.symbolDiamond).size(85)())
          .attr("transform", `translate(${x(aggregate)},${center - band - 12})`)
          .attr("fill", "#172331")
          .append("title")
          .text("原始票數合計後 " + ctx.scaleFormat(aggregate));
      }
    });
    svg
      .append("text")
      .attr("x", left)
      .attr("y", height - 8)
      .attr("font-size", 12)
      .attr("fill", "#647987")
      .text(
        "灰帶：" + (ctx.scaleState.weight === "votes" ? "有效票加權" : "地區等權") + "Q1–Q3　虛線：中位數　◆：原始票數聚合值　方形：特殊統計組",
      );
    const active =
      rows
        .flatMap((row) => row.units)
        .find((u) => u.id === ctx.scaleState.selection) ||
      rows[0].units.find((u) => u.id === ctx.scaleState.county + "/000");
    ctx.scaleReadout(active);
    const marks = ctx.$$("#scale-chart [role=button]");
    marks.forEach((el, i) => (el.tabIndex = i === 0 ? 0 : -1));
    svg.attr("data-ready", "true");
    ctx.updateHash();
  }
  async function loadScaleCounty() {
    const request = ++ctx.scaleRequest,
      county = ctx.scaleState.county;
    ctx.scalePayload = null;
    ctx.$("#scale-chart").removeAttribute("data-ready");
    ctx.$("#scale-readout").textContent =
      "按需載入 " + ctx.data.counties[county] + " 村里統計…";
    try {
      const payload = await ctx.loadVillagePayload("president", county, "");
      if (request !== ctx.scaleRequest || !ctx.$("#scale-dialog").open) return;
      ctx.scalePayload = payload;
      ctx.renderScale();
    } catch {
      if (request === ctx.scaleRequest)
        ctx.$("#scale-readout").textContent =
          "村里資料載入失敗，請關閉後重新開啟。";
    }
  }
  function openScale(options = {}) {
    if (ctx.isLeg()) return;
    for (const [key, value] of Object.entries(options))
      if (key in ctx.scaleState) ctx.scaleState[key] = value;
    if (!ctx.data.counties[ctx.scaleState.county])
      ctx.scaleState.county = "63000";
    ctx.$("#scale-county").innerHTML = ctx.COUNTY_ORDER.map(
      (c) =>
        '<option value="' +
        c +
        '">' +
        ctx.esc(ctx.data.counties[c]) +
        "</option>",
    ).join("");
    ctx.$("#scale-county").value = ctx.scaleState.county;
    if (!ctx.$("#scale-dialog").open) ctx.$("#scale-dialog").showModal();
    ctx.loadScaleCounty();
  }
  ctx.$("#scale-open").onclick = () =>
    ctx.openScale({
      county: ctx.state.county || "63000",
      town: ctx.state.key && !ctx.isLeg() ? ctx.rec().town : "",
      selection: "",
    });
  ctx.$("#scale-close").onclick = () => {
    ctx.scaleRequest++;
    ctx.$("#scale-dialog").close();
    ctx.updateHash();
  };
  ctx.$("#scale-dialog").addEventListener("cancel", () => {
    ctx.scaleRequest++;
    requestAnimationFrame(ctx.updateHash);
  });
  ctx.$("#scale-county").onchange = (ev) => {
    ctx.scaleState.county = ev.target.value;
    ctx.scaleState.town = "";
    ctx.scaleState.selection = "";
    ctx.loadScaleCounty();
  };
  for (const key of ["town", "metric", "candidate", "range", "weight"])
    ctx.$("#scale-" + key).onchange = (ev) => {
      ctx.scaleState[key] = ev.target.value;
      ctx.scaleState.selection = "";
      ctx.renderScale();
    };
  ctx.$("#scale-csv").onclick = () => {
    if (!ctx.scalePayload) return;
    ctx.csvTable(
      [
        "層級",
        "統計單位ID",
        "地區",
        "得票率參照候選人",
        "參照候選人票數",
        "賴清德票數",
        "侯友宜票數",
        "柯文哲票數",
        "有效票",
        "投票數",
        "選舉人數",
        "指標",
        "指標值",
        "特殊統計組",
        "資料版本",
        "分布權重",
      ],
      ctx
        .scaleRows()
        .flatMap((row) =>
          row.units.map((u) => [
            row.level,
            u.id,
            u.name,
            ctx.scaleState.metric === "share" ? ctx.scaleState.candidate : "",
            ctx.scaleState.metric === "share"
              ? u.votes[ctx.scaleState.candidate] || 0
              : "",
            u.votes["賴清德"] || 0,
            u.votes["侯友宜"] || 0,
            u.votes["柯文哲"] || 0,
            u.valid,
            u.cast,
            u.eligible,
            ctx.scaleState.metric,
            ctx.scaleValue(u) ?? "",
            u.special ? "是" : "否",
            "CEC 2024 final",
            ctx.scaleState.weight,
          ]),
        ),
      "臺灣2024-多尺度統計.csv",
    );
  };
  function scaleExportXML() {
    if (!ctx.scalePayload) return null;
    return ctx.standaloneSVGPanel(
      ctx.$("#scale-chart"),
      "2024 總統 · 多尺度統計 · " +
        ctx.$("#scale-metric").selectedOptions[0].textContent +
        " · " +
        (ctx.scaleState.metric === "share" ? ctx.scaleState.candidate : ""),
      ctx.$("#scale-scope").textContent +
        "；每列範圍不同，不跨列合計。" +
        (ctx.scaleState.metric === "enp"
          ? " ENP=1/Σp²，p為候選人有效票占比。"
          : ctx.scaleState.metric === "hhi"
            ? " HHI=Σp²，p為候選人有效票占比。"
            : ""),
    );
  }
  ctx.$("#scale-svg").onclick = () => {
    const xml = ctx.scaleExportXML();
    if (xml)
      ctx.saveBlob(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        "臺灣2024多尺度統計-" +
          ctx.$("#scale-metric").selectedOptions[0].textContent +
          ".svg",
      );
  };
  ctx.$("#scale-png").onclick = () => {
    const xml = ctx.scaleExportXML();
    if (xml)
      ctx.downloadPNG(
        xml,
        "臺灣2024多尺度統計-" +
          ctx.$("#scale-metric").selectedOptions[0].textContent,
      );
  };
  function parseScaleRoute(p) {
    if (!p.has("scale-county") || ctx.isLeg()) {
      if (ctx.$("#scale-dialog").open) ctx.$("#scale-dialog").close();
      return;
    }
    const options = {
      county: ctx.data.counties[p.get("scale-county")]
        ? p.get("scale-county")
        : "63000",
      town: p.get("scale-town") || "",
      metric: ["share", "turnout", "enp", "hhi"].includes(p.get("scale-metric"))
        ? p.get("scale-metric")
        : "share",
      candidate: ["賴清德", "侯友宜", "柯文哲"].includes(
        p.get("scale-candidate"),
      )
        ? p.get("scale-candidate")
        : "賴清德",
      selection: p.get("scale-selection") || "",
      range: p.get("scale-range") === "full" ? "full" : "focus",
      weight: p.get("scale-weight") === "votes" ? "votes" : "regions",
    };
    requestAnimationFrame(() => ctx.openScale(options));
  }
  function serializeScaleRoute(p) {
    if (!ctx.$("#scale-dialog").open) return;
    for (const [key, value] of Object.entries(ctx.scaleState))
      if (value) p.set("scale-" + key, value);
  }
  document.addEventListener("keydown", (ev) => {
    if (
      !ev.target.closest?.("#scale-chart [role=button]") ||
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
    const nodes = ctx.$$("#scale-chart [role=button]"),
      i = nodes.indexOf(ev.target),
      next =
        ev.key === "Home"
          ? 0
          : ev.key === "End"
            ? nodes.length - 1
            : (i +
                (["ArrowLeft", "ArrowUp"].includes(ev.key) ? -1 : 1) +
                nodes.length) %
              nodes.length;
    ev.preventDefault();
    ev.target.tabIndex = -1;
    nodes[next].tabIndex = 0;
    nodes[next].focus();
  });

  new ResizeObserver(() => {
    if (ctx.scalePayload && ctx.$("#scale-dialog").open)
      requestAnimationFrame(ctx.renderScale);
  }).observe(ctx.$("#scale-chart"));
}
