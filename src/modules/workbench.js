/** Explicit module installer; dependencies are supplied by the application context. */
import { describeScope } from "../data/scope.js";
import { geographyEvidence } from "../data/geography-evidence.js";

export function install(ctx) {
  Object.assign(ctx, {
    normalizeWorkbenchState,
    presentWorkbench,
    renderFinding,
    renderScopeSummary,
    renderBaseFinding,
    downloadRegionResults,
    decorateDetailPresentation,
    decorateWorkbenchChart,
  });
  /* Desktop workbench: state normalization and presentation, using verified V3 results. */
  document.body.classList.add("loading");
  document.body.setAttribute("aria-busy", "true");
  ctx.$(".toolbar").inert = true;
  ctx.$(".analysis-layout").inert = true;
  ctx.initialRoute = new URLSearchParams(location.hash.slice(1));
  ctx.routeRestored = false;
  function normalizeWorkbenchState() {
    if (!ctx.data) return;
    if (!ctx.routeRestored) {
      ctx.routeRestored = true;
      ctx.state.pins = (ctx.initialRoute.get("pins") || "")
        .split(",")
        .filter((k) => ctx.valid(ctx.records[k]))
        .slice(0, 3);
      ctx.state.sort = ["name", "votes", "turnout", "margin"].includes(
        ctx.initialRoute.get("sort"),
      )
        ? ctx.initialRoute.get("sort")
        : "margin";
      ctx.state.labels = ctx.initialRoute.get("labels") !== "0";
      if (ctx.state.key && !ctx.state.inspection)
        ctx.state.county = ctx.records[ctx.state.key].county;
    }
    if (ctx.isLeg() && ctx.state.chart === "ternary") ctx.state.chart = "hex";
    if (
      ![
        "winner",
        "runner",
        "margin",
        "turnout",
        "share",
        ...Object.keys(ctx.EXTRA_METRICS),
      ].includes(ctx.state.metric) ||
      (ctx.isLeg() &&
        !["winner", "runner", "margin", "turnout"].includes(ctx.state.metric))
    )
      ctx.state.metric = "winner";
    ctx.state.brushed = [...new Set(ctx.state.brushed)].filter(
      (k) =>
        ctx.valid(ctx.records[k]) &&
        (ctx.isLeg() ? ctx.records[k].town === "000" : true),
    );
    if (ctx.state.key && !ctx.valid(ctx.records[ctx.state.key]))
      ctx.state.key = "";
  }
  function presentWorkbench() {
    document.body.dataset.chart = ctx.state.chart;
    document.body.dataset.election = ctx.state.e;
    ctx.$("#scatter").setAttribute(
      "aria-label",
      {
        hex: "等單位結果圖",
        bubble: "有效票數氣泡圖",
        ternary: "三方得票率圖",
        small: ctx.isLeg() ? "區域立委席次示意" : "候選人並列地圖",
        scatter: "地區統計分布圖",
      }[ctx.state.chart] || "資料圖",
    );
    ctx
      .$("#list-toggle")
      .setAttribute(
        "aria-expanded",
        document.body.classList.contains("list-open"),
      );
    ctx
      .$("#detail-toggle")
      .setAttribute(
        "aria-expanded",
        !document.body.classList.contains("detail-closed"),
      );
    ctx.$("#export-scope").options[1].disabled = !ctx.state.key;
    ctx.renderScopeSummary();
    ctx.renderFinding();
  }

  function renderFinding() {
    ctx.renderBaseFinding();
    ctx.renderChartFindings();
  }
  function renderBaseFinding() {
    const rs = ctx.scoped();
    if (!rs.length) return;
    const closest = ctx.d3.least(rs, (r) => r.margin),
      largest = ctx.d3.greatest(rs, (r) => r.total);
    let text =
      ctx.areaName(closest, true) +
      "，前兩名相差 " +
      ctx.fmt(
        closest.candidates[0].votes - (closest.candidates[1]?.votes || 0),
      ) +
      " 票（" +
      closest.margin.toFixed(2) +
      " 個百分點）。";
    if (ctx.state.chart === "bubble")
      text =
        ctx.areaName(largest, true) +
        " 的有效票最多：" +
        ctx.fmt(largest.total) +
        " 票。圓面積對應有效票數。";
    if (ctx.state.chart === "scatter")
      text =
        "目前 " +
        rs.length +
        " 個地區的差距中位數為 " +
        ctx.d3.median(rs, (r) => r.margin).toFixed(2) +
        " 個百分點（地區等權）。";
    if (ctx.state.chart === "ternary") {
      const balanced = ctx.d3.least(rs, (r) =>
        ctx.d3.sum(r.candidates.slice(0, 3), (c) => (c.share - 100 / 3) ** 2),
      );
      text =
        ctx.areaName(balanced, true) +
        " 最接近三方均勢：" +
        balanced.candidates
          .map((c) => c.name + " " + ctx.pct(c.share))
          .join("／") +
        "。";
    }
    if (ctx.state.chart === "small")
      text = ctx.isLeg()
        ? "僅呈現73席區域立委；不含34席不分區與6席原住民，並非完整國會席次。"
        : "三位候選人使用相同地理投影與0–65%得票率範圍，可直接比較支持分布。";
    ctx.$("#finding").textContent = text;
  }
  function renderScopeSummary() {
    const scope = describeScope(ctx), host = ctx.$("#scope-summary");
    host.replaceChildren();
    const add = (text, className, action) => {
      const el = document.createElement(action ? "button" : "span");
      el.className = className;
      el.textContent = text;
      if (action) { el.type = "button"; el.onclick = action; el.title = "清除這項狀態"; }
      host.append(el);
    };
    add(`${scope.area} · ${scope.unit}`, "scope-place");
    if (scope.pending) {
      add("席次資料載入中", "scope-chip");
      ctx.$("#selection-bar").textContent = "";
      return;
    }
    const clearable = ["條件篩選", "框選分析"].includes(scope.kind);
    add(`${scope.kind} ${scope.count}／${scope.total}` + (clearable ? " ×" : ""), "scope-chip scope-statistics", scope.kind === "條件篩選"
      ? () => ctx.$("#filter-reset").click() : scope.kind === "框選分析" ? () => { ctx.state.brushed = []; ctx.updateUI(); } : null);
    const dsl = [];
    const groupDSL = (spec) => {
      const parts = [];
      if (spec.share !== "") parts.push(ctx.filterSpec.candidate + " ≥ " + spec.share + "%");
      if (spec.turnout !== "") parts.push("投票率 ≥ " + spec.turnout + "%");
      if (spec.margin !== "") parts.push("差距 ≤ " + spec.margin + "pp");
      if (!parts.length) return "";
      const joiner = spec.logic === "or" ? " ∨ " : " ∧ ";
      return parts.length > 1 ? "(" + parts.join(joiner) + ")" : parts[0];
    };
    const g1 = groupDSL(ctx.filterSpec),
      g2 = groupDSL(ctx.filterSpec2);
    if (g1) dsl.push(g1);
    if (g2) dsl.push(g2);
    if (dsl.length) {
      const expression = dsl.join(ctx.filterInter === "or" ? " ∨ " : " ∧ ");
      add(expression, "scope-chip scope-dsl", () => ctx.$("#filter-reset").click());
      host.lastElementChild.title = expression + " · 點擊清除條件";
    }
    if (scope.count < scope.total)
      add(`排除 ${scope.total - scope.count}`, "scope-chip scope-excluded");
    if (scope.highlighted !== null)
      add(`高亮 ${scope.highlighted} · 合計不變 ×`, "scope-chip scope-highlight", () => {
        if (ctx.bivariateHighlightCell) ctx.toggleBivariateHighlight(ctx.bivariateHighlightCell);
        else ctx.$("#filter-reset").click();
      });
    if (ctx.state.inspection && ctx.valid(ctx.records[ctx.state.key]))
      add(`固定 ${ctx.areaName(ctx.records[ctx.state.key], true)} ×`, "scope-chip scope-pin", ctx.clearInspection);
    for (const group of ["a", "b"])
      if (ctx.groupSelection[group].length)
        add(`${ctx.groupNames?.[group] || group.toUpperCase()} ${ctx.groupSelection[group].length} ×`, `scope-chip scope-group-${group}`, () => { ctx.groupSelection[group] = []; ctx.updateUI(); });
    host.title = "分析範圍決定票數與比率的計算集合。條件高亮和 A／B 分組不改變合計；固定檢視不改變範圍。";
    host.dataset.scopeKind = scope.kind;
    const bar = ctx.$("#selection-bar");
    if (bar) {
      const rs = ctx.scoped(),
        total = ctx.d3.sum(rs, (r) => r.total);
      if (scope.unit === "席次") {
        bar.textContent = "全院 " + scope.total + " 席 · 過半 " + (Math.floor(scope.total / 2) + 1) + " 席";
        bar.title = "";
      } else if (!rs.length || !total) bar.textContent = "0 地區 · 無有效票";
      else {
        const lead = ctx.d3.sum(rs, (r) => r.candidates[0]?.votes || 0);
        bar.textContent =
          rs.length +
          (ctx.isLeg() ? " 選區 · 有效票 " : " 地區 · 有效票 ") +
          ctx.fmt(total) +
          " · 第一名加權 " +
          ctx.pct((lead / total) * 100);
        bar.title =
          "加權比例以原始票數加總計算，不是各地區百分比的平均。";
      }
    }
    const strip = ctx.$("#ab-strip");
    if (strip) {
      const a = ctx.groupSelection.a,
        b = ctx.groupSelection.b;
      if (!a.length && !b.length) {
        strip.hidden = true;
        strip.innerHTML = "";
      } else {
        const cand = ctx.state.candidate;
        const stats = (keys, name) => {
          const rs = keys.map((k) => ctx.records[k]).filter(Boolean),
            total = ctx.d3.sum(rs, (r) => r.total),
            cast = ctx.d3.sum(rs, (r) => r.cast),
            eligible = ctx.d3.sum(rs, (r) => r.eligible),
            votes = ctx.d3.sum(
              rs,
              (r) => r.candidates.find((c) => c.name === cand)?.votes || 0,
            ),
            lead = ctx.d3.sum(
              rs,
              (r) => (r.candidates[0]?.votes || 0) - (r.candidates[1]?.votes || 0),
            );
          return {
            name,
            n: rs.length,
            total,
            turnout: eligible ? (cast / eligible) * 100 : 0,
            share: total ? (votes / total) * 100 : 0,
            lead,
          };
        };
        const sa = stats(a, ctx.groupNames?.a || "A"),
          sb = stats(b, ctx.groupNames?.b || "B");
        strip.hidden = false;
        const cell = (s) =>
          '<div class="ab-group"><b>' +
          ctx.esc(s.name) +
          "</b><span>" +
          s.n +
          " 地區</span><span>有效票 " +
          ctx.fmt(s.total) +
          "</span>" +
          (ctx.isLeg()
            ? ""
            : "<span>" +
              cand +
              " 加權 " +
              ctx.pct(s.share) +
              "</span><span>投票率 " +
              ctx.pct(s.turnout) +
              "</span><span>領先 " +
              ctx.fmt(s.lead) +
              " 票</span>") +
          "</div>";
        const diff =
          !ctx.isLeg() && sa.n && sb.n
            ? '<div class="ab-diff">A−B：' +
              cand +
              " 加權 " +
              ctx.sign(sa.share - sb.share) +
              " pp · 票數 " +
              ctx.sign(sa.total - sb.total) +
              " · 領先差 " +
              ctx.sign(sa.lead - sb.lead) +
              "</div>"
            : "";
        strip.innerHTML =
          [sa, sb].filter((s) => s.n).map(cell).join("") + diff;
        strip.title = "A／B 合計由原始票數加總計算；組名可在地區分組面板更改。";
      }
    }
    const suggest = ctx.$("#view-suggestions");
    if (suggest) {
      const items = [];
      if (!ctx.isLeg()) {
        const mode = ctx.mapModeOf(ctx.state.metric);
        if (ctx.state.chart === "map" && mode === "territory") {
          items.push([
            "三方競爭",
            () => {
              ctx.state.chart = "ternary";
              ctx.updateUI();
            },
          ]);
          items.push([
            "票數規模",
            () => {
              ctx.state.chart = "map";
              ctx.setMapMode("scale");
            },
          ]);
        }
        if (ctx.state.chart === "map" && mode !== "support" && ctx.state.candidate)
          items.push([
            ctx.state.candidate + " 支持度",
            () => {
              ctx.state.chart = "map";
              ctx.setMapMode("support");
            },
          ]);
        if (
          ctx.groupSelection.a.length &&
          ctx.groupSelection.b.length &&
          ctx.state.metric !== "difference"
        )
          items.push([
            "A−B 差值",
            () => {
              ctx.state.chart = "map";
              ctx.setMapMode("difference");
            },
          ]);
      }
      suggest.hidden = !items.length;
      suggest.replaceChildren();
      if (items.length) {
        const lead = document.createElement("span");
        lead.textContent = "下一步";
        suggest.append(lead);
        for (const [label, action] of items.slice(0, 3)) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "suggestion-chip";
          b.textContent = label;
          b.onclick = action;
          suggest.append(b);
        }
      }
    }
  }

  // Explicit export scope: selecting a region must never silently narrow a range export.
  function downloadRegionResults(onlySelection = false) {
    const geometry = geographyEvidence(ctx.isLeg() ? "district" : "administrative", ctx.siteMetadata);
    const mode = onlySelection ? "selected" : ctx.$("#export-scope").value;
    const rs =
      mode === "selected"
        ? ctx.state.key
          ? [ctx.rec()]
          : []
        : mode === "all"
          ? Object.values(ctx.records).filter(
              (r) =>
                ctx.valid(r) &&
                (ctx.isLeg()
                  ? r.town === "000"
                  : ctx.state.level === "town"
                    ? r.town !== "000"
                    : r.town === "000"),
            )
          : ctx.scoped();
    if (!rs.length) {
      ctx.toast("目前範圍沒有可匯出資料");
      return;
    }
    const header = [
      "年份",
      "選舉",
      "地區ID",
      "縣市",
      "地區",
      "號次",
      "候選人",
      "副總統",
      "政黨",
      "票數",
      "得票率",
      "投票數",
      "選舉人數",
      "投票率",
      "有效票",
      "前兩名差距(百分點)",
      "本區第一名",
      "整場選舉當選",
      "地圖指標設定",
      "指標值",
      "指標單位",
      "比較候選人A",
      "比較候選人B",
      "資料版本",
      "election_id",
      "source_version",
      "boundary_version",
      "derived_method",
      "export_scope",
      "source_type",
      "official_boundary",
      "derived_geometry",
      "geometry_vintage",
    ];
    const lines = [
      header,
      ...rs.flatMap((r) =>
        r.candidates.map((c, i) => [
          ctx.CFG[ctx.state.e].year,
          ctx.CFG[ctx.state.e].title,
          ctx.keyOf(r),
          ctx.data.counties[r.county] || "全臺",
          ctx.areaName(r, true),
          c.number,
          c.name,
          c.runningMate || "",
          c.party,
          c.votes,
          (c.votes / r.total) * 100,
          r.cast,
          r.eligible,
          ctx.turnoutOf(r),
          r.total,
          ctx.marginOf(r),
          i === 0 ? "是" : "否",
          c.elected ? "是" : "否",
          ctx.EXTRA_METRICS[ctx.state.metric]?.title || ctx.state.metric,
          ctx.EXTRA_METRICS[ctx.state.metric]
            ? ctx.extraMetricValue(r)
            : ctx.state.metric === "share"
              ? ctx.shareOf(r, ctx.state.candidate)
              : ctx.state.metric === "margin"
                ? ctx.marginOf(r)
                : ctx.state.metric === "turnout"
                  ? ctx.turnoutOf(r)
                  : r.candidates[ctx.state.metric === "runner" ? 1 : 0]?.name ||
                    "",
          ctx.EXTRA_METRICS[ctx.state.metric]?.unit ??
            (["share", "turnout"].includes(ctx.state.metric)
              ? "%"
              : ctx.state.metric === "margin"
                ? "pp"
                : ""),
          ctx.state.candidate,
          ctx.state.otherCandidate || "",
          ctx.dataVersionLabel(),
          ctx.state.e + ":" + ctx.CFG[ctx.state.e].year,
          ctx.siteMetadata?.source_version || "CEC final results",
          ctx.siteMetadata?.boundary_version?.[ctx.isLeg() ? "district" : "administrative"] || "依資料與方法面板標示",
          ctx.isLeg() ? ctx.siteMetadata?.derived_method || "依2024官方村里歸屬合併選區" : "原始行政區票數；未推估歷史下級邊界",
          mode,
          geometry.source_type,
          geometry.official_boundary,
          true,
          geometry.vintage ?? "未核驗日期",
        ]),
      ),
    ];
    const cell = (v) => {
      let s = String(v ?? "");
      if (typeof v === "string" && /^[=+@\-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const blob = new Blob(
        ["\ufeff" + lines.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "臺灣選舉-" + ctx.state.e + "-" + mode + "-" + rs.length + "地區.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    ctx.toast("已匯出 " + rs.length + " 個地區的完整候選人結果");
  }

  // The drawer overlays the canvas; it does not resize the map or reset its camera.

  ctx
    .$(".toolbar-actions")
    .insertAdjacentHTML(
      "afterbegin",
      '<select id="export-scope" aria-label="匯出範圍"><option value="range">目前分析範圍</option><option value="selected">單一選取地區</option><option value="all">全臺目前層級</option></select>',
    );
  ctx
    .$(".map-toolbar")
    .insertAdjacentHTML(
      "beforebegin",
      '<div class="workspace-heading"><div><span class="eyebrow">地理與選票結構</span><h2 id="scope-summary">全臺</h2></div><div class="workspace-actions"><div id="view-suggestions" class="view-suggestions" hidden></div><button id="list-toggle" aria-controls="regions-panel" aria-expanded="false">地區排名</button><button id="detail-toggle" aria-expanded="true">地區詳情</button></div></div><div id="ab-strip" class="ab-strip" hidden></div>',
    );
  ctx.$(".regions-sidebar").id = "regions-panel";
  ctx
    .$(".map-bottom")
    .insertAdjacentHTML(
      "beforebegin",
      '<div id="finding" class="finding" aria-live="polite"></div>',
    );
  ctx.$("#list-toggle").onclick = () => {
    document.body.classList.toggle("list-open");
    ctx
      .$("#list-toggle")
      .setAttribute(
        "aria-expanded",
        document.body.classList.contains("list-open"),
      );
  };
  ctx.$("#detail-toggle").onclick = () => {
    document.body.classList.toggle("detail-closed");
    ctx
      .$("#detail-toggle")
      .setAttribute(
        "aria-expanded",
        !document.body.classList.contains("detail-closed"),
      );
  };
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      document.body.classList.remove("list-open");
      ctx.$("#list-toggle").setAttribute("aria-expanded", "false");
    }
  });
  ctx.listKeys = (ev) => {
    if (!["ArrowDown", "ArrowUp"].includes(ev.key)) return;
    const buttons = ctx.$$(".region-row"),
      i = buttons.indexOf(document.activeElement);
    if (i >= 0) {
      ev.preventDefault();
      buttons[
        (i + (ev.key === "ArrowDown" ? 1 : -1) + buttons.length) %
          buttons.length
      ].focus();
    }
  };
  ctx.$("#region-list").addEventListener("keydown", ctx.listKeys);
  ctx.$("#detail-stats").setAttribute("aria-live", "polite");

  function decorateDetailPresentation() {
    const r = ctx.state.key
      ? ctx.rec()
      : !ctx.isLeg() && ctx.state.county
        ? ctx.records[ctx.state.county + "/000"]
        : null;
    if (r) {
      ctx.$("#detail-note").textContent =
        "投票 " +
        ctx.fmt(r.cast) +
        "／選舉人 " +
        ctx.fmt(r.eligible) +
        " · 中選會";
      for (const n of ctx.$$("#detail-result .elected"))
        n.textContent = ctx.isLeg() ? "選區當選" : "全國當選";
    }
  }

  ctx.relativeMaps = ctx.initialRoute.get("relative") === "1";
  ctx
    .$(".map-toolbar")
    .insertAdjacentHTML(
      "afterend",
      '<div id="relative-control" class="relative-control" hidden><label for="relative-mode">比較基準</label><select id="relative-mode"><option value="absolute">絕對得票率</option><option value="relative">相對全國平均</option></select></div>',
    );
  ctx.$("#relative-mode").value = ctx.relativeMaps ? "relative" : "absolute";
  ctx.$("#relative-mode").onchange = () => {
    ctx.relativeMaps = ctx.$("#relative-mode").value === "relative";
    ctx.updateUI();
  };
  // Shared camera belongs to the comparison, independently of the main map.
  ctx.smallMaps = {
    difference: false,
    a: "賴清德",
    b: "侯友宜",
    reverse: false,
    camera: [1, 0, 0],
  };
  ctx
    .$("#relative-control")
    .insertAdjacentHTML(
      "beforeend",
      '<label><input type="checkbox" id="small-difference">差值圖</label><select id="small-a" aria-label="差值候選人A"></select><span>−</span><select id="small-b" aria-label="差值候選人B"></select><button id="small-order">反轉順序</button><button id="small-reset">重設視角</button>',
    );
  for (const id of ["small-a", "small-b"]) {
    for (const name of ["賴清德", "侯友宜", "柯文哲"]) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      ctx.$("#" + id).append(option);
    }
    ctx.$("#" + id).onchange = () => {
      ctx.smallMaps[id === "small-a" ? "a" : "b"] = ctx.$("#" + id).value;
      ctx.updateUI();
    };
  }
  ctx
    .$("#relative-control")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="small-zoom-in" aria-label="同步放大並列地圖">＋</button><button id="small-zoom-out" aria-label="同步縮小並列地圖">−</button>',
    );
  for (const [id, factor] of [
    ["small-zoom-in", 1.5],
    ["small-zoom-out", 1 / 1.5],
  ])
    ctx.$("#" + id).onclick = () => {
      const [k, x, y] = ctx.smallMaps.camera,
        next = Math.max(1, Math.min(12, k * factor)),
        ratio = next / k;
      ctx.smallMaps.camera = [
        next,
        0.5 + ratio * (x - 0.5),
        0.5 + ratio * (y - 0.5),
      ];
      ctx.updateUI();
    };
  ctx.$("#small-b").value = ctx.smallMaps.b;
  ctx.$("#small-difference").onchange = (ev) => {
    ctx.smallMaps.difference = ev.target.checked;
    ctx.updateUI();
  };
  ctx.$("#small-order").onclick = () => {
    ctx.smallMaps.reverse = !ctx.smallMaps.reverse;
    ctx.updateUI();
  };
  ctx.$("#small-reset").onclick = () => {
    ctx.smallMaps.camera = [1, 0, 0];
    ctx.updateUI();
  };
  const contourCache = new Map();
  function decorateWorkbenchChart() {
    ctx.$("#relative-control").hidden =
      ctx.state.chart !== "small" || ctx.isLeg();
    if (ctx.state.chart === "ternary") {
      const svg = ctx.d3.select("#scatter"),
        dots = svg.selectAll(".ternary-dot"),
        nodes = dots.data(),
        box = svg.attr("viewBox").split(" ").map(Number);
      if (nodes.length > 30 && ctx.chartOptions.densityMode === "contour") {
        const cacheKey =
          ctx.chartOptions.densityWeight +
          "|" +
          box.join(",") +
          "|" +
          nodes
            .map((d) => d.key + ":" + d.x.toFixed(3) + ":" + d.y.toFixed(3))
            .join(";");
        let density = contourCache.get(cacheKey);
        if (!density) {
          density = ctx.d3
            .contourDensity()
            .x((d) => d.x)
            .y((d) => d.y)
            .size([box[2], box[3]])
            .weight((d) =>
              ctx.chartOptions.densityWeight === "votes" ? d.r.total : 1,
            )
            .bandwidth(15)
            .thresholds(5)(nodes);
          if (contourCache.size >= 8)
            contourCache.delete(contourCache.keys().next().value);
          contourCache.set(cacheKey, density);
        }
        svg
          .select(".ternary-content")
          .insert("g", ".ternary-dot")
          .attr("class", "density-layer")
          .attr("pointer-events", "none")
          .selectAll("path")
          .data(density)
          .join("path")
          .attr("d", ctx.d3.geoPath())
          .attr("fill", "#687787")
          .attr("fill-opacity", 0.07)
          .attr("stroke", "#687787")
          .attr("stroke-opacity", 0.2);
        ctx
          .$("#legend")
          .insertAdjacentHTML(
            "beforeend",
            '<div class="legend-foot">平滑輪廓：' +
              (ctx.chartOptions.densityWeight === "votes"
                ? "有效票加權密度，非地區數量"
                : "地區等權密度，非票數") +
              "。</div>",
          );
      }
    }
  }
}
