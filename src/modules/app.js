/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    countyColorScale,
    toast,
    selectRegion,
    resetSelection,
    setElection,
    updateUI,
    renderPrimaryUI,
    national,
    renderNational,
    resultCandidates,
    renderDetail,
    renderNationalOverview,
    legendRamp,
    renderLegend,
    drawScatter,
    renderTable,
    togglePin,
    renderDrawer,
    renderDrawerBase,
    openDrawer,
    search,
    reflowWorkbenchCanvas,
    scheduleCanvasReflow,
    init,
  });
  /* Election Atlas: local CEC data, D3 geometry/zoom, no runtime API dependency. */
  ("use strict");
  ctx.$ = (s) => document.querySelector(s);
  ctx.$$ = (s) => [...document.querySelectorAll(s)];
  ctx.$("#metric-info").onclick = () => {
    const pop = ctx.$("#metric-info-popover"),
      button = ctx.$("#metric-info");
    pop.hidden = !pop.hidden;
    button.setAttribute("aria-expanded", String(!pop.hidden));
    if (pop.hidden) return;
    const d = ctx.metricDefinition(),
      row = (k, v) => "<div><small>" + k + "</small><span>" + ctx.esc(v) + "</span></div>";
    pop.innerHTML =
      "<b>" +
      ctx.esc(d.title) +
      "</b>" +
      row("公式", d.formula) +
      row("單位", d.unit) +
      row("統計層級", d.level) +
      row("分母", d.denominator) +
      row("加權", d.weighted) +
      row("跨屆比較", d.comparable);
  };
  ctx.$("#boundary-badge").onclick = () => ctx.$("#source-badge")?.click();
  ctx.COLORS = {
    民進黨: "#16804f",
    國民黨: "#2758b5",
    民眾黨: "#267b84",
    無黨籍: "#81613d",
    親民黨: "#cf7c30",
  };
  ctx.ACCESSIBLE_COLORS = { 民進黨: "#007f5b", 國民黨: "#0066a6", 民眾黨: "#9d4278", 無黨籍: "#626262", 親民黨: "#996500" };
  ctx.color = (p) => (ctx.colorMode === "accessible" ? ctx.ACCESSIBLE_COLORS[p] : ctx.COLORS[p]) || "#9983b4";
  ctx.fmt = (n) => Number(n || 0).toLocaleString("en-US");
  ctx.pct = (n) => (n == null ? "—" : Number(n).toFixed(2) + "%");
  ctx.sign = (n) => (n > 0 ? "+" : "") + n.toFixed(2);
  ctx.esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  ctx.CFG = {
    president: { year: 2024, title: "總統副總統", date: "01.13", pres: true },
    legislator: { year: 2024, title: "區域立法委員", date: "01.13" },
  };
  ctx.data = undefined;
  ctx.topology = undefined;
  ctx.counties = undefined;
  ctx.towns = undefined;
  ctx.records = undefined;
  ctx.geoByKey = {};
  ctx.mapSvg = undefined;
  ctx.world = undefined;
  ctx.zoom = undefined;
  ctx.transform = ctx.d3.zoomIdentity;
  ctx.w = 0;
  ctx.h = 0;
  ctx.toastTimer = undefined;
  ctx.state = {
    cartography: {
      labels: "standard",
      boundaries: "county",
      insets: "expanded",
    },
    e: "president",
    metric: "winner",
    level: "town",
    chart: "map",
    county: "",
    key: "",
    inspection: false,
    candidate: "賴清德",
    swingParty: "民進黨",
    labels: true,
    sort: "margin",
    brushed: [],
    brushEnabled: false,
    distribution: "swarm",
    pins: [],
    drawer: null,
  };
  ctx.duration = () =>
    matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 550;
  function countyColorScale() {
    const ids = Object.keys(ctx.data.counties);
    return ctx.d3.scaleOrdinal(
      ids,
      ids.map((_, i) => ctx.d3.interpolateRainbow(i / ids.length)),
    );
  }

  function toast(text) {
    ctx.$("#toast").textContent = text;
    ctx.$("#toast").hidden = false;
    clearTimeout(ctx.toastTimer);
    ctx.toastTimer = setTimeout(() => (ctx.$("#toast").hidden = true), 2400);
  }
  function selectRegion(key, doZoom = false) {
    ctx.selectedMember = "";
    const r = ctx.records[key];
    if (!ctx.valid(r)) return;
    if (ctx.state.chart === "ternary" && r.town === "000" && !doZoom) ctx.contextCounty = r.county;
    Object.assign(
      ctx.state,
      ctx.selectionTransition(ctx.state, key, r, doZoom),
    );
    ctx.$("#search").value = "";
    ctx.$("#search-results").hidden = true;
    ctx.updateUI();
    if (doZoom && ctx.state.chart === "map") ctx.zoomToRegion(key);
  }
  function resetSelection() {
    ctx.selectedMember = "";
    ctx.state.brushed = [];
    ctx.state.key = "";
    ctx.state.inspection = false;
    ctx.state.county = "";
    ctx.$("#search").value = "";
    ctx.$("#search-results").hidden = true;
    ctx.updateUI();
    ctx.zoomTo(ctx.d3.zoomIdentity);
  }
  function setElection(e) {
    ctx.resetElectionAnalysis();
    ctx.state.e = e;
    ctx.state.inspection = false;
    ctx.records = ctx.data[e];
    ctx.state.key = "";
    ctx.state.county = "";
    ctx.state.pins = [];
    ctx.state.brushed = [];
    ctx.state.brushEnabled = false;
    if (ctx.isLeg()) {
      ctx.state.metric = "winner";
      ctx.state.chart = "hex";
    } else if (!ctx.CFG[e].pres && ctx.state.chart === "ternary") {
      ctx.state.chart = "hex";
      ctx.state.metric = "winner";
    } else if (
      ["share", "swing"].includes(ctx.state.metric) &&
      !ctx.CFG[e].pres
    )
      ctx.state.metric = "winner";
    ctx.state.candidate = ctx.CFG[e].pres ? ctx.rec().candidates[0].name : "";
    ctx.state.level = "town";
    ctx.$("#search").value = "";
    ctx.updateUI();
    ctx.buildMap();
    if (ctx.state.chart !== "map") ctx.drawScatter();
  }

  ctx.EXTRA_METRICS = {
    leadVotes: { title: "前兩名領先票數", unit: "票", formula: "領先票數＝第一名票數 − 第二名票數" },
    advantage: { title: "候選人相對全國優勢", unit: "pp", formula: "相對全國優勢＝地區得票率 − 全國得票率" },
    difference: { title: "候選人 A−B 得票率差", unit: "pp", formula: "A−B 差＝A 得票率 − B 得票率" },
    validVotes: { title: "有效票規模", unit: "票", formula: "有效票規模＝該地區有效票合計" },
    competitive: { title: "競爭差距分級", unit: "pp", formula: "競爭分級依前兩名差距（pp）分帶著色" },
    bivariate: { title: "進階：得票率 × 投票率", unit: "%", formula: "雙變量：候選人得票率 × 投票率 3×3 分格" },
    enp: { title: "有效候選人數 ENP", unit: "位", formula: "ENP＝1 ÷ Σ（各候選人得票率²）" },
    concentration: { title: "得票集中度 HHI", unit: "", formula: "HHI＝Σ（各候選人得票率²），介於0–1" },
  };
  ctx.BASE_METRIC_FORMULAS = {
    winner: "第一名得票率＝第一名票數 ÷ 該地區有效票",
    runner: "第二名得票率＝第二名票數 ÷ 該地區有效票",
    margin: "競爭差距＝（第一名 − 第二名）÷ 該地區有效票",
    share: "候選人得票率＝該候選人票數 ÷ 該地區有效票",
    turnout: "投票率＝投票數 ÷ 選舉人數",
  };
  ctx.metricFormula = () => {
    const extra = ctx.EXTRA_METRICS[ctx.state.metric];
    if (extra)
      return extra.formula + (extra.unit ? "；單位 " + extra.unit : "") + "。";
    const unit = ctx.state.metric === "margin" ? "pp" : "%";
    return (
      (ctx.BASE_METRIC_FORMULAS[ctx.state.metric] || ctx.state.metric) +
      "；單位 " +
      unit +
      "。票數與百分點不使用同一圖例。"
    );
  };
  ctx.metricDefinition = () => {
    const m = ctx.state.metric,
      extra = ctx.EXTRA_METRICS[m],
      level = ctx.isLeg()
        ? "選區"
        : ctx.state.level === "town"
          ? "鄉鎮市區"
          : "縣市";
    const denominators = {
      turnout: "選舉人數",
      leadVotes: "無（票數差）",
      validVotes: "無（有效票合計）",
    };
    return {
      title: extra ? extra.title : { winner: "第一名得票率", runner: "第二名得票率", margin: "競爭差距", share: "候選人得票率", turnout: "投票率" }[m] || m,
      formula: extra ? extra.formula : ctx.BASE_METRIC_FORMULAS[m] || m,
      unit: extra ? extra.unit || "—" : m === "margin" ? "pp" : "%",
      level,
      denominator: denominators[m] || "該地區有效票",
      weighted: "地圖與列表為地區值；彙總讀數另以原始票數加權計算",
      comparable: ctx.isLeg()
        ? "選區範圍待核實，跨屆不直接比較"
        : ctx.state.level === "county"
          ? "縣市層級使用統一22範圍，跨屆可比"
          : "鄉鎮層級跨屆需邊界對應，未核驗前不可比",
    };
  };

  ctx.BIVARIATE_COLORS = [
    ["#e8e8e8", "#b5c0da", "#6c83b5"],
    ["#b8d6be", "#90b2b3", "#567994"],
    ["#73ae80", "#5a9178", "#2a5a5b"],
  ];
  ctx.metricMaximumRecords = null;
  ctx.metricMaximumCache = new Map();

  ctx.renderingUI = false;
  ctx.pendingUI = false;
  ctx.renderEpoch = 0;
  function updateUI() {
    if (!ctx.data) return;
    if (ctx.renderingUI) {
      ctx.pendingUI = true;
      return;
    }
    ctx.renderingUI = true;
    const started = performance.now();
    try {
      ctx.hydrateRoute();
      ctx.normalizeWorkbenchState();
      const hasResults = ctx.prepareAnalysisState();
      if (hasResults) {
        ctx.renderPrimaryUI();
        ctx.presentWorkbench();
        ctx.presentAnalysis();
      } else ctx.renderEmptyAnalysis();
      ctx.presentParliament();
      ctx.presentParliamentDetail();
      ctx.presentAccessibility();
      ctx.updateDistrictGeometry();
      ctx.presentControls();
      const badge = ctx.$("#boundary-badge");
      if (badge)
        badge.textContent = ctx.isLeg()
          ? "衍生區域選區範圍"
          : ctx.state.level === "town"
            ? "2023 村里邊界 · 簡化"
            : "現行縣市界 · Taiwan Atlas";
      ctx.presentWorkspace?.();
      ctx.presentResearchWorkspace?.();
      ctx.presentReadingPage?.();
      ctx.store.commit();
      requestAnimationFrame(ctx.updateChartTabStops);
      ctx.updateHash();
      ctx.recordRecentView?.();
      document.body.dataset.renderEpoch = String(++ctx.renderEpoch);
      document.body.dataset.renderMs = (performance.now() - started).toFixed(2);
    } finally {
      ctx.renderingUI = false;
      if (ctx.pendingUI) {
        ctx.pendingUI = false;
        queueMicrotask(ctx.updateUI);
      }
    }
  }
  function renderPrimaryUI() {
    ctx.$("#election").value = ctx.state.e;
    ctx.$("#county-filter").value = ctx.state.county;
    ctx.$("#sort").value = ctx.state.sort;
    ctx.$("#breadcrumb").innerHTML =
      '<button data-crumb="all">全臺</button>' +
      (ctx.state.county
        ? '<span>/</span><button data-crumb="county">' +
          ctx.esc(ctx.data.counties[ctx.state.county]) +
          "</button>"
        : "") +
      (ctx.state.key && ctx.rec()?.town !== "000" && !ctx.isLeg()
        ? "<span>/</span><b>" +
          ctx.esc(
            ctx.state.inspection && !ctx.state.county
              ? ctx.areaName(ctx.rec(), true)
              : ctx.rec().name,
          ) +
          "</b>"
        : ctx.isLeg() && ctx.state.key
          ? "<span>/</span><b>第" + Number(ctx.rec().district) + "選區</b>"
          : "");
    ctx.$('[data-crumb="all"]').onclick = ctx.resetSelection;
    if (ctx.$('[data-crumb="county"]'))
      ctx.$('[data-crumb="county"]').onclick = () => {
        if (ctx.isLeg()) {
          ctx.state.key = "";
          ctx.updateUI();
        } else ctx.selectRegion(ctx.state.county + "/000");
      };
    ctx.$$("[data-metric]").forEach((b) => {
      b.classList.toggle("active", ctx.state.metric === b.dataset.metric);
      b.setAttribute("aria-pressed", ctx.state.metric === b.dataset.metric);
      b.disabled =
        (ctx.isLeg() &&
          (ctx.state.chart === "map" ||
            !["winner", "runner", "margin", "turnout"].includes(
              b.dataset.metric,
            ))) ||
        (b.dataset.metric === "swing" && !ctx.CFG[ctx.state.e].pres) ||
        (b.dataset.metric === "share" && !ctx.CFG[ctx.state.e].pres);
    });
    ctx.$$("[data-level]").forEach((b) => {
      b.classList.toggle("active", ctx.state.level === b.dataset.level);
      b.disabled =
        ctx.isLeg() ||
        (!ctx.dualMode &&
          (ctx.state.chart === "hex" || ctx.state.chart === "bubble"));
    });
    ctx.$$("button[data-chart]").forEach((b) => {
      b.classList.toggle("active", ctx.state.chart === b.dataset.chart);
      b.disabled = b.dataset.chart === "ternary" && !ctx.CFG[ctx.state.e].pres;
    });
    ctx.$("#distribution-filter").hidden = ctx.state.chart !== "scatter";
    ctx.$("#distribution-style").value = ctx.state.distribution;
    ctx.$("#labels-toggle").classList.toggle("active", ctx.state.labels);
    ctx.$("#labels-toggle").setAttribute("aria-pressed", ctx.state.labels);
    ctx.$("#candidate-filter").hidden =
      !["share", "swing", "advantage", "difference", "bivariate"].includes(
        ctx.state.metric,
      ) || ctx.isLeg();
    if (!ctx.$("#candidate-filter").hidden) {
      const opts =
        ctx.state.metric === "swing"
          ? ["民進黨", "國民黨"]
          : ctx.data[ctx.state.e]["00000/000"].candidates.map((c) => c.name);
      ctx.$("#candidate-filter-label").textContent =
        ctx.state.metric === "swing" ? "政黨" : "候選人";
      ctx.$("#candidate-select").innerHTML = opts
        .map((n) => "<option>" + ctx.esc(n) + "</option>")
        .join("");
      ctx.$("#candidate-select").value =
        ctx.state.metric === "swing"
          ? ctx.state.swingParty
          : ctx.state.candidate;
    }
    ctx.$("#map").toggleAttribute("hidden", ctx.state.chart !== "map");
    ctx.$("#scatter").toggleAttribute("hidden", ctx.state.chart === "map");
    ctx.$(".map-controls").hidden = ctx.state.chart !== "map" && !ctx.dualMode;
    ctx.$(".zoom-readout").hidden = ctx.state.chart !== "map" && !ctx.dualMode;
    ctx.$(".map-metrics").hidden = ["scatter", "ternary", "small"].includes(
      ctx.state.chart,
    );
    ctx.$("#brush-toggle").hidden = ctx.state.chart !== "ternary";
    ctx.$("#brush-toggle").classList.toggle("active", ctx.state.brushEnabled);
    ctx.$("#clear-brush").hidden = !ctx.state.brushed.length;
    ctx.$("#clear-brush").textContent =
      "已框選 " + ctx.state.brushed.length + " 地區 ×";
    ctx.$("#candidate-filter").hidden =
      ["scatter", "ternary", "small"].includes(ctx.state.chart) ||
      ctx.$("#candidate-filter").hidden;
    ctx.$("#map-context").textContent =
      ctx.isLeg() && ctx.state.chart === "map"
        ? "僅行政區定位。73個選區結果請切換分布圖或選取左側選區。"
        : "";
    ctx.$("#pin").disabled = !ctx.state.key;
    ctx
      .$("#pin")
      .classList.toggle("pinned", ctx.state.pins.includes(ctx.state.key));
    ctx.$("#pin").textContent = ctx.state.pins.includes(ctx.state.key)
      ? "✓ 已加入"
      : "＋ 比較";
    ctx.renderNationalStable();
    ctx.renderList();
    ctx.renderDetailStable();
    ctx.renderLegend();
    ctx.renderDrawer();
    ctx.updateMap();
    if (ctx.state.chart !== "map") ctx.drawScatter();
  }
  function national() {
    if (ctx.CFG[ctx.state.e].pres) return ctx.rec("00000/000");
    const rs = Object.values(ctx.records).filter(
      (r) => ctx.valid(r) && r.town === "000",
    );
    const counts = {};
    rs.forEach((r) => {
      const c = ctx.winner(r);
      counts[c.party] = (counts[c.party] || 0) + 1;
    });
    let cast = rs.reduce((s, r) => s + r.cast, 0),
      eligible = rs.reduce((s, r) => s + r.eligible, 0);
    return {
      candidates: Object.entries(counts)
        .map(([party, votes]) => ({
          party,
          name: party,
          votes,
          share: (votes / rs.length) * 100,
        }))
        .sort((a, b) => b.votes - a.votes),
      turnout: (cast / eligible) * 100,
      total: rs.length,
      cast,
    };
  }
  function renderNational() {
    const cfg = ctx.CFG[ctx.state.e],
      r = ctx.national();
    ctx.$("#score-year").textContent = cfg.year;
    ctx.$("#score-title").textContent = "全國 · " + cfg.title;
    ctx.$("#score-date").textContent =
      cfg.date + " · " + (cfg.pres ? "全國結果" : r.total + " 席");
    ctx.$("#national-turnout").textContent = ctx.pct(r.turnout);
    ctx.$("#national-total").textContent = cfg.pres
      ? ctx.fmt(r.total) + " 張有效票"
      : ctx.fmt(r.cast) + " 人投票";
    ctx.$("#national-scores").innerHTML = r.candidates
      .map(
        (c) =>
          '<button class="national-card ' +
          (ctx.state.metric === "share" && ctx.state.candidate === c.name
            ? "selected"
            : "") +
          '" style="--party:' +
          ctx.color(c.party) +
          '" data-national="' +
          ctx.esc(c.name) +
          '" ' +
          (!cfg.pres ? "disabled" : "") +
          ' title="' +
          (cfg.pres ? "查看" + ctx.esc(c.name) + "各地得票率" : "當選席次") +
          '"><span class="score-top"><span class="score-name"><i></i>' +
          ctx.esc(c.name) +
          "</span><small>" +
          ctx.esc(cfg.pres ? c.party : "當選") +
          '</small></span><span class="score-main"><strong>' +
          (cfg.pres ? c.share.toFixed(2) : c.votes) +
          "<em>" +
          (cfg.pres ? "%" : "席") +
          "</em></strong><span>" +
          (cfg.pres ? ctx.fmt(c.votes) + " 票" : ctx.pct(c.share)) +
          "</span></span></button>",
      )
      .join("");
    ctx.$$("[data-national]").forEach(
      (b) =>
        (b.onclick = () => {
          ctx.state.candidate = b.dataset.national;
          ctx.state.metric = "share";
          ctx.state.chart = "map";
          ctx.updateUI();
        }),
    );
  }
  function resultCandidates(r, seat = false) {
    return (
      '<div class="result-summary">' +
      r.candidates
        .map(
          (c) =>
            '<i style="background:' +
            ctx.color(c.party) +
            ";width:" +
            c.share +
            '%"></i>',
        )
        .join("") +
      '</div><div class="result-caption"><span>' +
      (seat ? "當選席次" : "候選人") +
      "</span><span>" +
      (seat ? "席次 / 占比" : "得票率 / 票數") +
      "</span></div>" +
      r.candidates
        .map(
          (c) =>
            '<div class="result-candidate"><div class="result-top"><span class="result-name">' +
            (c.number
              ? '<small class="ballot-number">' + c.number + "</small>"
              : "") +
            ctx.esc(c.name) +
            '</span><span class="result-share">' +
            (seat ? c.votes : c.share.toFixed(2)) +
            "<small>" +
            (seat ? "席" : "%") +
            '</small></span></div><div class="result-meta"><span>' +
            ctx.esc(c.runningMate ? "副總統 " + c.runningMate : c.party) +
            (c.elected ? '<b class="elected">當選</b>' : "") +
            "</span><span>" +
            (seat ? ctx.pct(c.share) : ctx.fmt(c.votes) + " 票") +
            '</span></div><div class="result-bar"><i style="background:' +
            ctx.color(c.party) +
            ";width:" +
            c.share +
            '%"></i></div></div>',
        )
        .join("")
    );
  }
  function renderDetail() {
    if (
      !ctx.isLeg() &&
      !ctx.state.key &&
      !ctx.state.county &&
      !ctx.state.brushed.length
    ) {
      ctx.renderNationalOverview();
      return;
    }
    let r = ctx.state.key
      ? ctx.rec()
      : ctx.CFG[ctx.state.e].pres
        ? ctx.state.county
          ? ctx.records[ctx.state.county + "/000"]
          : ctx.rec()
        : null;
    const aggregate = !r;
    ctx.$("#detail-title").textContent = ctx.state.key
      ? ctx.areaName(r)
      : ctx.state.county
        ? ctx.data.counties[ctx.state.county]
        : "全臺";
    ctx.$("#detail-scope").textContent = ctx.state.key
      ? ctx.isLeg()
        ? "區域立委 · 選區結果"
        : r.town === "000"
          ? "縣市結果"
          : "鄉鎮市區結果"
      : "全國概況";
    if (aggregate) {
      const rs = Object.values(ctx.records).filter(
        (r) =>
          ctx.valid(r) &&
          r.town === "000" &&
          (!ctx.state.county || r.county === ctx.state.county),
      );
      let n = {};
      rs.forEach((r) => {
        let p = ctx.winner(r).party;
        n[p] = (n[p] || 0) + 1;
      });
      r = {
        total: rs.length,
        turnout:
          (rs.reduce((s, r) => s + r.cast, 0) /
            rs.reduce((s, r) => s + r.eligible, 0)) *
          100,
        candidates: Object.entries(n)
          .map(([p, n]) => ({
            name: p,
            party: p,
            votes: n,
            share: (n / rs.length) * 100,
          }))
          .sort((a, b) => b.votes - a.votes),
      };
      ctx.$("#detail-stats").innerHTML =
        '<div class="detail-stat"><small>當選席次</small><strong>' +
        r.total +
        ' <em>席</em></strong></div><div class="detail-stat"><small>投票率</small><strong>' +
        ctx.pct(r.turnout) +
        "</strong></div>";
      ctx.$("#detail-result").innerHTML =
        ctx.resultCandidates(r, true) +
        (ctx.isLeg() && ctx.state.county
          ? rs
              .map(
                (x) =>
                  '<button class="district-button" data-district="' +
                  ctx.keyOf(x) +
                  '"><strong>第' +
                  Number(x.district) +
                  "選區</strong><span>" +
                  ctx.esc(x.candidates[0].name) +
                  " ↗</span></button>",
              )
              .join("")
          : "");
      ctx
        .$$("[data-district]")
        .forEach(
          (b) => (b.onclick = () => ctx.selectRegion(b.dataset.district)),
        );
      ctx.$("#detail-chart").innerHTML = "";
    } else {
      ctx.$("#detail-stats").innerHTML =
        '<div class="detail-stat"><small>有效票數</small><strong>' +
        ctx.fmt(r.total) +
        '</strong></div><div class="detail-stat"><small>投票率</small><strong>' +
        ctx.pct(r.turnout) +
        "</strong></div>";
      ctx.$("#detail-result").innerHTML = ctx.resultCandidates(r);
      const gap = r.candidates[0].votes - (r.candidates[1]?.votes || 0);
      ctx.$("#detail-chart").innerHTML =
        '<div class="chart-caption"><span>前兩名差距</span><span>' +
        ctx.fmt(gap) +
        ' 票</span></div><div class="margin-callout"><strong>' +
        r.margin.toFixed(2) +
        '</strong><span>百分點</span></div><div class="margin-axis"><i style="left:' +
        Math.min(r.margin / 30, 1) * 100 +
        '%"></i></div><div class="margin-axis-labels"><span>0 · 接近</span><span>15</span><span>30+</span></div>';
    }

    ctx.$("#detail-note").textContent = ctx.isLeg()
      ? "僅含區域立委 · 不含原住民、不分區"
      : ctx.state.e === "mayor" && ctx.state.county === "10020"
        ? "選舉日期 2022.12.18 · 重行選舉"
        : ctx.state.key
          ? "當選標記依整場選舉 · 地區得票非當選判定"
          : "來源：中央選舉委員會 · 最終結果";
  }
  function renderNationalOverview() {
    const rs = ctx.scoped(),
      national = ctx.records["00000/000"],
      townLevel = rs.some((r) => r.town !== "000"),
      nearest = ctx.d3.least(rs, (r) => ctx.marginOf(r)),
      largest = ctx.d3.greatest(rs, (r) => r.total),
      maxima = national.candidates.map((c) => ({
        candidate: c,
        r: ctx.d3.greatest(rs, (r) => ctx.shareOf(r, c.name)),
      }));
    ctx.$("#detail-scope").textContent = "全國摘要在上方 · 目前分析尺度";
    ctx.$("#detail-title").textContent = "全臺觀測";
    ctx.$("#detail-stats").innerHTML =
      '<div class="detail-stat"><small>統計單位</small><strong>' +
      rs.length +
      " <em>" +
      (townLevel ? "鄉鎮" : "縣市") +
      '</em></strong></div><div class="detail-stat"><small>地區差距中位數</small><strong>' +
      ctx.d3.median(rs, ctx.marginOf).toFixed(2) +
      " <em>pp</em></strong></div>";
    function card(r, kicker, value, unit, note) {
      return (
        '<button class="overview-finding" data-overview-region="' +
        ctx.esc(ctx.keyOf(r)) +
        '"><small>' +
        kicker +
        " <span>定位 ↗</span></small><b>" +
        ctx.esc(ctx.areaName(r, true)) +
        "</b><strong>" +
        value +
        " <em>" +
        unit +
        "</em></strong><p>" +
        note +
        "</p></button>"
      );
    }
    ctx.$("#detail-result").innerHTML =
      card(
        nearest,
        "競爭最接近",
        ctx.fmt(nearest.candidates[0].votes - nearest.candidates[1].votes),
        "票",
        ctx.marginOf(nearest).toFixed(3) + " 個百分點 · 前兩名差距",
      ) +
      card(
        largest,
        "有效票最多",
        ctx.fmt(largest.total),
        "票",
        "占全國有效票 " +
          ((largest.total / national.total) * 100).toFixed(2) +
          "%",
      ) +
      '<section class="overview-maxima"><h3>各候選人最高得票率</h3>' +
      maxima
        .map(
          ({ candidate: c, r }) =>
            '<button data-overview-region="' +
            ctx.esc(ctx.keyOf(r)) +
            '"><span><i style="background:' +
            ctx.color(c.party) +
            '"></i>' +
            ctx.esc(c.name) +
            "<small>" +
            ctx.esc(ctx.areaName(r, true)) +
            "</small></span><strong>" +
            ctx.pct(ctx.shareOf(r, c.name)) +
            "</strong></button>",
        )
        .join("") +
      "</section>";
    ctx.$("#detail-chart").innerHTML =
      '<details class="overview-national"><summary>全國票數與投票資料</summary><p>有效票 ' +
      ctx.fmt(national.total) +
      " · 投票數 " +
      ctx.fmt(national.cast) +
      " · 選舉人 " +
      ctx.fmt(national.eligible) +
      "</p>" +
      national.candidates
        .map(
          (c) => "<p>" + ctx.esc(c.name) + "　" + ctx.fmt(c.votes) + " 票</p>",
        )
        .join("") +
      "</details>";
    ctx.$("#detail-note").textContent =
      "以目前尺度比較地區；最高得票率與最大票源的意義不同。";
    for (const button of ctx.$$("[data-overview-region]")) {
      button.onclick = () => ctx.selectRegion(button.dataset.overviewRegion);
      button.onpointerenter = () => {
        const key = button.dataset.overviewRegion;
        ctx.world
          ?.selectAll(".geo")
          .classed("hovering", (f) => ctx.geoKey(f) === key);
      };
      button.onpointerleave = () =>
        ctx.world?.selectAll(".geo").classed("hovering", false);
    }
  }
  function legendRamp(cs, ticks) {
    return (
      '<div class="legend-ramp">' +
      cs.map((c) => '<i style="background:' + c + '"></i>').join("") +
      '</div><div class="legend-ticks">' +
      ticks.map((t) => "<span>" + t + "</span>").join("") +
      "</div>"
    );
  }
  function renderLegend() {
    if (ctx.EXTRA_METRICS[ctx.state.metric] && ctx.state.chart === "map") {
      ctx.$("#legend").innerHTML = ctx.extraMetricLegend();
      ctx.$$("#legend .bivariate-cell").forEach((cell) => {
        cell.classList.toggle(
          "active",
          ctx.bivariateHighlightCell === cell.dataset.bi,
        );
        cell.onclick = () => ctx.toggleBivariateHighlight(cell.dataset.bi);
      });
      ctx.$("#view-description").textContent =
        ctx.EXTRA_METRICS[ctx.state.metric].title;
      return;
    }
    ctx.$("#chart-coordinate").textContent = "TAIWAN · EPSG:4326";
    if (ctx.state.chart === "hex" || ctx.state.chart === "bubble") {
      ctx.renderAlternativeLegend();
      return;
    }
    const name = ctx.state.level === "town" ? "鄉鎮市區" : "縣市";
    let html = "";
    if (ctx.state.chart === "scatter") {
      html =
        '<div class="legend-title">圓面積＝有效票數 · 色彩＝得票最多者政黨</div>';
      ctx.$("#view-description").textContent =
        "投票率 × 前兩名差距 · 點選圓點查看結果";
    } else if (ctx.isLeg()) {
      html =
        '<div class="legend-title">行政區定位</div><div class="legend-foot">選區邊界待核實，請以列表與分布圖閱讀結果。</div>';
      ctx.$("#view-description").textContent = "行政區位置 · 非立委選區圖";
    } else {
      const ramp = ctx.d3.range(9);
      if (ctx.state.metric === "winner")
        html =
          '<div class="legend-title">' +
          name +
          ' · 得票最多者所屬政黨</div><div class="legend-parties">' +
          Object.entries(ctx.COLORS)
            .filter(([p]) => ctx.state.e === "mayor" || p !== "無黨籍")
            .map(
              ([p, c]) =>
                '<span><i style="background:' + c + '"></i>' + p + "</span>",
            )
            .join("") +
          "</div>";
      if (ctx.state.metric === "winner")
        html =
          '<div class="legend-title">' +
          name +
          ' · 得票最多者所屬政黨</div><div class="legend-parties">' +
          ctx
            .national()
            .candidates.map(
              (c) =>
                '<span><i style="background:' +
                ctx.color(c.party) +
                '"></i>' +
                ctx.esc(c.party) +
                "</span>",
            )
            .join("") +
          "</div>";
      if (ctx.state.metric === "runner")
        html =
          '<div class="legend-title">' +
          name +
          ' · 第二名所屬政黨</div><div class="legend-parties">' +
          ctx
            .national()
            .candidates.map(
              (c) =>
                '<span><i style="background:' +
                ctx.color(c.party) +
                '"></i>' +
                ctx.esc(c.party) +
                "</span>",
            )
            .join("") +
          "</div>";
      if (ctx.state.metric === "margin")
        html =
          '<div class="legend-title">' + name + ' · 前兩名差距 · 百分點</div>' +
          ctx.legendRamp(
            ramp.map((v) =>
              ctx.d3.interpolateRgbBasis([
                "#fff3dd",
                "#f9bf76",
                "#df684b",
                "#a42f47",
              ])(v / 8),
            ),
            ["0", "10", "20", "35+"],
          );
      if (ctx.state.metric === "turnout")
        html =
          '<div class="legend-title">' + name + ' · 投票率 · %</div>' +
          ctx.legendRamp(
            ramp.map((v) => ctx.d3.interpolateRgb("#eee9f0", "#66507a")(v / 8)),
            ["30%", "50%", "70%", "85%+"],
          );
      if (ctx.state.metric === "share") {
        const c = ctx
          .rec("00000/000")
          .candidates.find((c) => c.name === ctx.state.candidate);
        html =
          '<div class="legend-title">' + name + " · " +
          ctx.esc(ctx.state.candidate) +
          "得票率 · %</div>" +
          ctx.legendRamp(
            ramp.map((v) =>
              ctx.d3.interpolateRgb("#e6edf3", ctx.color(c?.party))(v / 8),
            ),
            ["0%", "20%", "40%", "65%+"],
          );
      }
      if (ctx.state.metric === "swing")
        html =
          '<div class="legend-title">' + name + " · " +
          ctx.state.swingParty +
          " · 2024 − 2020 得票率 · 百分點</div>" +
          ctx.legendRamp(
            ramp.map((v) =>
              v < 4
                ? ctx.d3.interpolateRgb("#4779b3", "#f3f4f5")(v / 4)
                : ctx.d3.interpolateRgb("#f3f4f5", "#d8803b")((v - 4) / 4),
            ),
            ["−25", "減少 ← 0 → 增加", "+25"],
          ) +
          '<div class="legend-foot">同代碼地區比較 · 不代表個別選民轉投</div>';
      ctx.$("#view-description").textContent =
        name +
        " · " +
        {
          winner: "第一名",
          runner: "第二名",
          margin: "前兩名差距",
          share: ctx.state.candidate + " 得票率",
          turnout: "投票率",
          swing: "2020→2024 政黨得票率變化",
        }[ctx.state.metric];
    }
    ctx.$("#legend").innerHTML = html;
  }

  // A single chart dispatcher: preparation, geometry, annotations and export patterns.
  function drawScatter() {
    ctx.d3.select("#scatter").on(".zoom", null);
    if (ctx.state.chart === "map") return;
    ctx.prepareChartOptions();
    ctx.prepareStatisticsControls();
    if (ctx.state.chart === "scatter") {
      if (
        ["histogram", "ecdf", "box", "dumbbell"].includes(
          ctx.state.distribution,
        ) &&
        !ctx.isLeg()
      )
        ctx.drawStatTemplate();
      else if (ctx.state.distribution === "scatter") ctx.drawStatScatter();
      else {
        ctx.drawBeeswarm();
        ctx.decorateSwarmStatistics();
      }
    } else if (ctx.state.chart === "bubble") ctx.drawBubbleWorkspace();
    else ctx.drawAlternative();
    ctx.decorateWorkbenchChart();
    ctx.decorateChartOptions();
    ctx.addNoDataPattern(ctx.d3.select("#scatter"));
    if (ctx.dualMode) ctx.chartToolsBottom();
  }
  function renderTable() {
    const rs = ctx.sortRecords(ctx.scoped());
    ctx.$("#drawer-summary").textContent =
      (ctx.state.county ? ctx.data.counties[ctx.state.county] + " · " : "") +
      rs.length +
      " 個" +
      (ctx.isLeg() ? "選區" : ctx.state.level === "town" ? "鄉鎮市區" : "縣市");
    ctx.$("#data-rows").innerHTML = rs
      .map((r) => {
        let k = ctx.keyOf(r),
          c = r.candidates[0];
        return (
          '<tr data-table-region="' +
          k +
          '"><td><button>' +
          ctx.esc(ctx.areaName(r, true)) +
          "</button></td><td>" +
          ctx.esc(c.name) +
          '</td><td style="color:' +
          ctx.color(c.party) +
          '">' +
          ctx.esc(c.party) +
          "</td><td>" +
          ctx.pct(c.share) +
          "</td><td>" +
          ctx.fmt(r.total) +
          "</td><td>" +
          r.margin.toFixed(2) +
          " pp</td><td>" +
          ctx.pct(r.turnout) +
          '</td><td><button class="compare-add" data-add-pin="' +
          k +
          '">' +
          (ctx.state.pins.includes(k) ? "✓ 已加入" : "＋ 加入") +
          "</button></td></tr>"
        );
      })
      .join("");
    ctx.$$("[data-table-region]").forEach(
      (tr) =>
        (tr.onclick = (ev) => {
          if (!ev.target.closest("[data-add-pin]"))
            ctx.selectRegion(tr.dataset.tableRegion);
        }),
    );
    ctx
      .$$("[data-add-pin]")
      .forEach((b) => (b.onclick = () => ctx.togglePin(b.dataset.addPin)));
  }
  function togglePin(k = ctx.state.key) {
    if (!k) return;
    const i = ctx.state.pins.indexOf(k);
    if (i >= 0) ctx.state.pins.splice(i, 1);
    else {
      if (ctx.state.pins.length >= 3) {
        ctx.toast("最多比較3個地區；請先移除一個。");
        return;
      }
      ctx.state.pins.push(k);
      ctx.toast("已加入比較：" + ctx.areaName(ctx.records[k]));
    }
    ctx.updateUI();
  }
  function renderDrawer() {
    ctx.renderDrawerBase();
    ctx.renderComparisonWorkspace();
    ctx.renderComparisonExport();
  }
  function renderDrawerBase() {
    const open = !!ctx.state.drawer;
    ctx.$("#drawer").hidden = !open;
    document.body.classList.toggle("drawer-open", open);
    ctx.$("#pin-count").textContent = ctx.state.pins.length + " / 3";
    ctx.$("#compare-count").textContent = ctx.state.pins.length + " / 3";
    ctx
      .$$("[data-drawer]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.drawer === ctx.state.drawer),
      );
    ctx.$("#table-content").hidden = ctx.state.drawer !== "table";
    ctx.$("#compare-content").hidden = ctx.state.drawer !== "compare";
    ctx.$("#compare-content").innerHTML = ctx.state.pins.length
      ? ctx.state.pins
          .map((k) => {
            const r = ctx.records[k];
            return (
              '<div class="compare-card"><h3>' +
              ctx.esc(ctx.areaName(r, true)) +
              '<button data-remove-pin="' +
              k +
              '" aria-label="移除' +
              ctx.esc(ctx.areaName(r)) +
              '">×</button></h3><div class="compare-stats"><span>有效票<b>' +
              ctx.fmt(r.total) +
              "</b></span><span>投票率<b>" +
              ctx.pct(r.turnout) +
              "</b></span><span>差距<b>" +
              r.margin.toFixed(2) +
              " pp</b></span></div>" +
              r.candidates
                .slice(0, 4)
                .map(
                  (c) =>
                    '<div class="compare-candidate"><span>' +
                    ctx.esc(c.name) +
                    '</span><span class="track"><i style="background:' +
                    ctx.color(c.party) +
                    ";width:" +
                    c.share +
                    '%"></i></span><b>' +
                    ctx.pct(c.share) +
                    "</b></div>",
                )
                .join("") +
              "</div>"
            );
          })
          .join("")
      : '<div class="empty-state"><b>選取地區，加入比較</b>點選右側「＋ 比較」或資料表的「＋ 加入」，最多比較3個地區。</div>';
    ctx
      .$$("[data-remove-pin]")
      .forEach((b) => (b.onclick = () => ctx.togglePin(b.dataset.removePin)));
  }
  function openDrawer(type) {
    ctx.state.drawer = type;
    ctx.renderDrawer();
    ctx.renderTable();
  }
  function search() {
    const q = ctx.$("#search").value.trim();
    const box = ctx.$("#search-results");
    if (!q) {
      box.hidden = true;
      return;
    }
    let rs = Object.values(ctx.records)
      .filter(
        (r) =>
          ctx.valid(r) &&
          (ctx.isLeg() ? r.town === "000" : true) &&
          ctx
            .areaName(r, true)
            .replaceAll("臺", "台")
            .includes(q.replaceAll("臺", "台")),
      )
      .sort((a, b) => (a.town === "000" ? -1 : 1) - (b.town === "000" ? -1 : 1))
      .slice(0, 14);
    box.hidden = false;
    box.innerHTML = rs.length
      ? rs
          .map(
            (r) =>
              '<button data-search-key="' +
              ctx.keyOf(r) +
              '"><span>' +
              ctx.esc(ctx.areaName(r, true)) +
              "</span><small>" +
              ctx.pct(r.turnout) +
              "</small></button>",
          )
          .join("")
      : '<div class="no-data" style="padding:12px">找不到符合的地區</div>';
    ctx
      .$$("[data-search-key]")
      .forEach(
        (b) => (b.onclick = () => ctx.selectRegion(b.dataset.searchKey)),
      );
  }
  ctx.canvasScheduler = ctx.createScheduler(() => ctx.reflowWorkbenchCanvas());
  ctx.canvasLayoutSignature = "";
  function reflowWorkbenchCanvas(force = false) {
    if (!ctx.data || !ctx.mapSvg) return;
    if (ctx.dualMode) ctx.applyDualLayout();
    const host = ctx.$("#map-host"),
      workspace = ctx.$(".map-workspace"),
      signature = [
        host.clientWidth,
        host.clientHeight,
        workspace.clientWidth,
        workspace.clientHeight,
        ctx.dualMode,
        ctx.dualSplit,
        ctx.dualFocus,
        ctx.$("#left-pane-head")?.clientHeight,
        ctx.$("#right-pane-head")?.clientHeight,
        ctx.$("#chart-options")?.clientHeight,
        ctx.$(".workspace-heading")?.clientHeight,
      ].join("|");
    if (!force && signature === ctx.canvasLayoutSignature) {
      workspace.dataset.layoutReady = "true";
      return;
    }
    ctx.canvasLayoutSignature = signature;
    ctx.buildMap();
    ctx.updateUI();
    workspace.dataset.layoutReady = "true";
  }
  function scheduleCanvasReflow() {
    if (!ctx.data) return;
    ctx.$(".map-workspace").dataset.layoutReady = "false";
    ctx.canvasScheduler.schedule("canvas-size");
  }
  async function init() {
    try {
      [ctx.data, ctx.topology] = await Promise.all(
        ["data.json", "towns-lod0.json"].map((u) => ctx.loadJSON(u)),
      );
      ctx.counties = ctx.topojson.feature(
        ctx.topology,
        ctx.topology.objects.counties,
      ).features;
      ctx.towns = ctx.topojson.feature(
        ctx.topology,
        ctx.topology.objects.towns,
      ).features;
      ctx.lodFeatures[0] = new Map(
        [...ctx.counties, ...ctx.towns].map((f) => [ctx.geoKey(f), f]),
      );
      const p = new URLSearchParams(location.hash.slice(1));
      if (ctx.CFG[p.get("e")]) ctx.state.e = p.get("e");
      ctx.records = ctx.data[ctx.state.e];
      ctx.state.brushed = (p.get("selection") || "")
        .split(",")
        .filter((k) => ctx.valid(ctx.records[k]))
        .slice(0, 368);
      if (p.get("distribution") === "scatter")
        ctx.state.distribution = "scatter";
      if (ctx.records[p.get("r")]) ctx.state.key = p.get("r");
      if (ctx.data.counties[p.get("c")]) ctx.state.county = p.get("c");
      if (
        ["winner", "runner", "margin", "turnout", "share"].includes(p.get("m"))
      )
        ctx.state.metric = p.get("m");
      if (["town", "county"].includes(p.get("l"))) ctx.state.level = p.get("l");
      if (
        ["scatter", "hex", "bubble", "ternary", "small"].includes(
          p.get("chart"),
        )
      )
        ctx.state.chart = p.get("chart");
      else if (ctx.isLeg()) ctx.state.chart = "hex";
      if (ctx.CFG[ctx.state.e].pres) {
        ctx.state.candidate = ctx
          .rec("00000/000")
          .candidates.some((c) => c.name === p.get("candidate"))
          ? p.get("candidate")
          : ctx.rec("00000/000").candidates[0].name;
        if (p.get("party") === "國民黨") ctx.state.swingParty = "國民黨";
      } else ctx.state.metric = "winner";
      ctx.$("#county-filter").innerHTML =
        '<option value="">全臺縣市</option>' +
        Object.entries(ctx.data.counties)
          .map(
            ([c, n]) => '<option value="' + c + '">' + ctx.esc(n) + "</option>",
          )
          .join("");
      ctx.updateUI();
      ctx.buildMap();
      const canvasObserver = new ResizeObserver(ctx.scheduleCanvasReflow);
      for (const id of ["map-host", "left-pane-head", "right-pane-head"])
        canvasObserver.observe(ctx.$("#" + id));
      canvasObserver.observe(ctx.$("#chart-options"));
      canvasObserver.observe(ctx.$(".workspace-heading"));
    } catch (e) {
      document.body.classList.remove("loading");
      document.body.setAttribute("aria-busy", "false");
      ctx.$(".toolbar").inert = false;
      ctx.$(".analysis-layout").inert = false;
      ctx.$("#detail-result").innerHTML =
        '<p class="no-data">資料載入失敗，請重新整理。</p>';
      console.error(e);
    }
  }
  ctx.$("#brush-toggle").onclick = () => {
    ctx.state.brushEnabled = !ctx.state.brushEnabled;
    ctx.updateUI();
  };
  ctx.$("#clear-brush").onclick = () => {
    ctx.state.brushed = [];
    ctx.state.key = "";
    ctx.updateUI();
  };
  ctx.$("#distribution-style").onchange = (ev) => {
    ctx.state.distribution = ev.target.value;
    ctx.drawScatter();
    ctx.updateHash();
  };
  ctx.$("#election").onchange = (ev) => ctx.setElection(ev.target.value);
  ctx.$("#county-filter").onchange = (ev) => {
    ctx.state.brushed = [];
    ctx.state.county = ev.target.value;
    ctx.state.inspection = false;
    ctx.state.key =
      ctx.state.county && !ctx.isLeg() ? ctx.state.county + "/000" : "";
    ctx.updateUI();
    ctx.state.county
      ? ctx.zoomToRegion(ctx.state.county + "/000")
      : ctx.zoomTo(ctx.d3.zoomIdentity);
  };
  ctx.$("#sort").onchange = (ev) => {
    ctx.state.sort = ev.target.value;
    ctx.renderList();
  };
  ctx.$("#search").oninput = ctx.search;
  ctx.$("#search").onkeydown = (ev) => {
    if (ev.key === "Enter") ctx.$("[data-search-key]")?.click();
    if (ev.key === "Escape") ctx.$("#search-results").hidden = true;
  };
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".search-wrap"))
      ctx.$("#search-results").hidden = true;
  });
  ctx.$$("[data-metric]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.state.metric = b.dataset.metric;
        ctx.updateUI();
      }),
  );
  ctx.$$("button[data-chart]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.state.chart = b.dataset.chart;
        ctx.updateUI();
      }),
  );
  ctx.$$("[data-level]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.state.brushed = [];
        ctx.state.level = b.dataset.level;
        ctx.updateUI();
      }),
  );
  ctx.$("#candidate-select").onchange = (ev) => {
    if (ctx.state.metric === "swing") ctx.state.swingParty = ev.target.value;
    else ctx.state.candidate = ev.target.value;
    ctx.updateUI();
  };
  ctx.$("#labels-toggle").onclick = () => {
    ctx.state.labels = !ctx.state.labels;
    ctx.updateUI();
  };
  ctx.$("#zoom-in").onclick = () =>
    ctx.mapSvg
      .transition()
      .duration(ctx.duration() / 2)
      .call(ctx.zoom.scaleBy, 1.6);
  ctx.$("#zoom-out").onclick = () =>
    ctx.mapSvg
      .transition()
      .duration(ctx.duration() / 2)
      .call(ctx.zoom.scaleBy, 1 / 1.6);
  ctx.$("#zoom-reset").onclick = () => ctx.zoomTo(ctx.d3.zoomIdentity);
  ctx.$("#zoom-selected").onclick = () =>
    ctx.state.key
      ? ctx.zoomToRegion(ctx.state.key)
      : ctx.state.county
        ? ctx.zoomToRegion(ctx.state.county + "/000")
        : ctx.toast("請先選取地區");
  ctx.$("#clear-selection").onclick = ctx.resetSelection;
  ctx.$(".brand").onclick = (ev) => {
    ev.preventDefault();
    ctx.resetSelection();
  };
  ctx.$("#pin").onclick = () => ctx.togglePin();
  ctx.$("#compare-open").onclick = () => ctx.openDrawer("compare");
  ctx.$("#table-open").onclick = () => ctx.openDrawer("table");
  ctx
    .$$("[data-drawer]")
    .forEach((b) => (b.onclick = () => ctx.openDrawer(b.dataset.drawer)));
  ctx.$("#drawer-close").onclick = () => ctx.openDrawer(null);
  ctx.$$("[data-sort]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.state.sort = b.dataset.sort;
        ctx.$("#sort").value = ctx.state.sort;
        ctx.renderList();
      }),
  );
  ctx.$("#download").onclick = () => ctx.download();
  ctx.$("#detail-export").onclick = () => ctx.download(true);
  ctx.$("#methods-open").onclick = () => ctx.$("#methods").showModal();
  ctx.$("#methods-close").onclick = () => ctx.$("#methods").close();
  document.addEventListener("keydown", (ev) => {
    if (
      ev.ctrlKey ||
      ev.metaKey ||
      ev.target.matches("input,select,textarea") ||
      document.querySelector("dialog[open]")
    )
      return;
    if (ev.key === "/") {
      ev.preventDefault();
      ctx.$("#search").focus();
    }
    if (ev.key === "Escape") {
      ctx.openDrawer(null);
      ctx.$("#search-results").hidden = true;
    }
    if (ev.key === "0") ctx.zoomTo(ctx.d3.zoomIdentity);
    if (ev.key === "+" || ev.key === "=") ctx.$("#zoom-in").click();
    if (ev.key === "-") ctx.$("#zoom-out").click();
  });
}
