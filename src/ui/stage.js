const views = {
  map: ["地理分布", "在地圖上看各地的選舉結果", "M2 4l4-2 4 2 4-2v10l-4 2-4-2-4 2ZM6 2v10m4-8v10"],
  hex: ["等權格網", "用相同大小的格子比較地區", "M5 2h6l3 6-3 6H5L2 8Z"],
  bubble: ["票數規模", "以圓面積比較各地的有效票數", "M9 10a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm5-6a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z"],
  ternary: ["三方競爭", "觀察三位候選人的得票組合", "M8 2l6 11H2Zm0 5v3m-2-1 4 2"],
  small: ["並列比較", "用同一尺度比較候選人或席次", "M2 3h5v10H2Zm7 0h5v10H9Z"],
  scatter: ["統計分布", "比較地區差距、分布和變數關係", "M2 2v12h12M5 10h.1m2-5h.1m3 3h.1m3-5h.1"],
};

export function installStage(ctx) {
  const $ = ctx.$,
    stage = $(".map-workspace"),
    heading = $(".workspace-heading"),
    controls = $(".toolbar-actions"),
    viewTitle = $("#view-title"),
    ternaryNavigation = $("#ternary-navigation"),
    navigationHome = document.createComment("ternary-navigation-home");
  ternaryNavigation.before(navigationHome);
  stage.classList.add("chart-stage");
  heading.classList.add("chart-stage-head");
  $(".map-bottom").classList.add("chart-stage-caption");
  $("#legend").classList.add("chart-stage-legend");
  $(".toolbar").classList.add("context-bar");
  $(".search-wrap").before($("#breadcrumb"));
  controls.prepend($(".research-menu"));
  controls.append($("#copy-link"), $("#image-export"));
  $("#copy-link").textContent = "分享連結";
  for (const side of ["left", "right"]) {
    $("#" + side + "-pane-head").insertAdjacentHTML(
      "beforeend",
      '<p id="' + side + '-pane-caption" class="pane-caption"></p>',
    );
  }

  const identity = document.createElement("div");
  identity.className = "stage-identity";
  viewTitle.before(identity);
  identity.append(viewTitle);
  identity.insertAdjacentHTML("beforeend", '<span id="stage-metric" class="stage-metric" hidden></span>');

  for (const button of ctx.$$("button[data-chart]")) {
    const [label, purpose, path] = views[button.dataset.chart];
    button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span>`;
    button.dataset.purpose = purpose;
    button.classList.add("view-switch");
  }

  const settings = addDisplaySettings(ctx);
  const showInspector = installInspector(ctx);
  let previousView, animation;
  ctx.presentStage = () => {
    const { chart } = ctx.state;
    const metric = $("#stage-metric");
    let mapMetric = $("#metric-mode").selectedOptions[0]?.textContent;
    const { metric: metricId, candidate, otherCandidate, swingParty } = ctx.state;
    if (metricId === "difference") mapMetric = candidate + " − " + otherCandidate + " · 得票率差";
    if (metricId === "bivariate") mapMetric = candidate + " 得票率 × 投票率";
    if (["share", "advantage"].includes(metricId)) mapMetric = candidate + " · " + mapMetric;
    if (metricId === "swing") mapMetric = swingParty + " · " + mapMetric;
    const chartMetrics = {
      map: mapMetric,
      hex: mapMetric,
      bubble: "有效票數",
      ternary: "三位候選人的得票率",
      small: ctx.isLeg() ? "席次組成" : $("#relative-mode").selectedOptions[0]?.textContent,
      scatter: $("#distribution-style").selectedOptions[0]?.textContent,
    };
    const metricLabel = ctx.dualMode ? "共享範圍 · 獨立視角" : chartMetrics[chart];
    metric.textContent = metricLabel || "";
    metric.hidden = !metricLabel;
    presentChartCaption(ctx);
    if (chart === "ternary") {
      const focus = ctx.chartOptions.ternaryFocus;
      for (const button of ctx.$$("[data-ternary-view]")) {
        const active = (button.dataset.ternaryView === "focus") === focus;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
      const empty = ctx.filterActive && !ctx.state.brushed.length;
      const { visibleCount, totalCount } = $("#scatter").dataset;
      $("#ternary-view-count").textContent = empty || !Number(totalCount)
        ? "無符合地區"
        : !focus && visibleCount === totalCount
          ? "顯示全部 " + totalCount + " 地區"
          : "顯示 " + visibleCount + " / " + totalCount + " 地區";
    }
    $("#small-view-tab span").textContent = ctx.isLeg() ? "立法院席次" : views.small[0];
    for (const button of ctx.$$("button[data-chart]")) {
      button.setAttribute("aria-pressed", String(button.dataset.chart === chart));
      if (!button.disabled) button.title = button.dataset.purpose;
    }
    showInspector();
    ctx.presentAnalysisState?.();
    settings.present(chart);
    if (ctx.dualMode && chart === "ternary") {
      const tools = $("#right-pane-tools");
      if (ternaryNavigation.parentElement !== tools) tools.prepend(ternaryNavigation);
    } else if (ternaryNavigation.previousSibling !== navigationHome) {
      navigationHome.after(ternaryNavigation);
    }
    if (chart === previousView) return;
    if (previousView && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animation?.cancel();
      animation = $("#map-host").animate(
        [{ opacity: 0.78 }, { opacity: 1 }],
        parseFloat(getComputedStyle(stage).getPropertyValue("--motion-panel")),
      );
    }
    previousView = chart;
  };
}

function presentChartCaption(ctx) {
  const $ = ctx.$;
  const { chart, metric } = ctx.state;
  const mapFormula = ctx.metricFormula();
  let mapCaption = mapFormula;
  if (ctx.mapEncoding === "symbols") mapCaption = "圓面積代表有效票。 " + mapFormula;
  else if (metric === "winner" || metric === "runner")
    mapCaption = "顏色代表各地" + (metric === "winner" ? "第一名" : "第二名") + "的政黨。 " + mapFormula;
  const { bubbleLayout, densityMode, densityWeight, ternaryColor, ternarySize } = ctx.chartOptions;
  const ternaryWeight = densityWeight === "votes" ? "有效票加權" : "地區等權";
  const pointEncoding = (ternarySize === "votes" ? "點大小：有效票" : "點大小一致") +
    " · 顏色：" + (ternaryColor === "county" ? "所屬縣市" : "第一名政黨");
  const ternaryEncoding = densityMode === "hexbin" ? "分箱：" + ternaryWeight :
    pointEncoding + (densityMode === "contour" ? " · 密度：" + ternaryWeight : "");
  const bubbleOrder = {
    bar: "按第一名政黨分群，排行按有效票",
    geo: "按近似地理位置排列",
    rank: "按有效票排序",
    pack: "緊密排列，位置不代表地理",
  };
  const chartCaptions = {
    map: mapCaption,
    hex: "每格代表一個地區，面積相同。 " + mapFormula,
    bubble: "圓面積代表有效票 · " + bubbleOrder[bubbleLayout] + " · 顏色依圖例",
    ternary: ternaryEncoding + "。每個地區三位候選人的有效票占比合計 100%。",
    small: ctx.isLeg()
      ? ctx.fullParliament ? "每點代表一席；全院 113 席，過半門檻 57 席。" : "每點代表一席區域立委，共 73 席。"
      : "各圖使用相同地理尺度；得票率以 % 顯示，差值以百分點顯示。",
    scatter: chart === "scatter" ? distributionCaption(ctx) : "",
  };
  const mapVisible = chart === "map" || chart === "hex" || (ctx.dualMode && ctx.dualFocus !== "chart");
  const metricInfo = $("#metric-info");
  metricInfo.hidden = !mapVisible;
  if (!mapVisible) {
    $("#metric-info-popover").hidden = true;
    metricInfo.setAttribute("aria-expanded", "false");
  }
  $("#view-description").hidden = true;
  const caption = $("#metric-formula");
  caption.textContent = ctx.dualMode ? "" : chartCaptions[chart];
  caption.title = caption.textContent;
  for (const [side, note] of [["left", mapCaption], ["right", chartCaptions[chart]]]) {
    const pane = $("#" + side + "-pane-caption");
    pane.textContent = ctx.dualMode ? note : "";
    pane.title = pane.textContent;
  }
}

function distributionCaption(ctx) {
  const mode = ctx.state.distribution;
  if (mode === "scatter") {
    const axis = (key) => key === "votes" ? "有效票（票）" :
      key === "share" ? ctx.state.candidate + "得票率（%）" : ctx.labels[key].replace("pp", "百分點");
    const size = ctx.axes.size === "fixed" ? "點大小一致" : "點面積代表有效票";
    const color = ctx.scatterSettings.neutral ? "中性色" : ctx.axes.color === "county" ? "所屬縣市" : "第一名政黨";
    return "橫軸：" + axis(ctx.axes.x) + " · 縱軸：" + axis(ctx.axes.y) + " · " + size + " · 顏色：" + color;
  }
  const captions = {
    histogram: "橫軸：候選人得票率（%） · 縱軸：各區間的地區數",
    ecdf: "橫軸：候選人得票率（%） · 縱軸：低於或等於該得票率的地區占比（%）",
    box: "橫軸：縣市 · 縱軸：地區得票率（%） · 箱體為第 25 至第 75 百分位",
    dumbbell: "橫軸：候選人得票率（%） · 同一列兩點距離為得票率差（個百分點）",
  };
  return captions[mode] || "每點代表一個地區；橫軸為前兩名得票率差（個百分點）。";
}

function addDisplaySettings(ctx) {
  const $ = ctx.$,
    layout = $("#hex-layout-label"),
    labels = $("#hex-labels-label"),
    axes = $("#axes-control"),
    axesDisplay = [$("#axis-size").closest("label"), $("#axis-color").closest("label")];
  function disclose(container, items, title) {
    const details = document.createElement("details");
    details.className = "stage-settings";
    details.innerHTML = `<summary>${title}</summary><div class="stage-settings-content"></div>`;
    details.lastElementChild.append(...items);
    container.append(details);
    return details;
  }
  const hex = disclose($("#chart-options"), [labels], "顯示設定");
  layout.after(hex);
  const scatter = disclose(axes, axesDisplay, "顯示設定");
  document.addEventListener("pointerdown", (event) => {
    for (const details of [hex, scatter])
      if (details.open && !details.contains(event.target)) details.open = false;
  });
  return {
    present(chart) {
      hex.hidden = chart !== "hex";
      if (hex.hidden) hex.open = false;
      if (axes.hidden) scatter.open = false;
    },
  };
}

function installInspector(ctx) {
  const $ = ctx.$,
    inspector = $(".detail-sidebar"),
    result = $("#detail-result"),
    chart = $("#detail-chart");
  inspector.classList.add("context-inspector");
  $(".detail-heading").insertAdjacentHTML("afterend", '<div id="inspector-lead" class="inspector-lead" hidden><div><small>得票最多</small><b id="inspector-winner"></b></div><strong id="inspector-share"></strong><span id="inspector-gap"></span></div>');
  const summary = document.createElement("div");
  summary.className = "inspector-summary";
  inspector.prepend(summary);
  summary.append($(".detail-heading"), $("#inspector-lead"), $("#detail-stats"));
  result.insertAdjacentHTML("beforebegin", '<div class="inspector-tabs" role="group" aria-label="地區詳情分頁"><button data-inspector-tab="result" type="button">結果</button><button data-inspector-tab="compare" type="button">對比</button><button data-inspector-tab="structure" type="button">結構</button></div><div id="inspector-compare" class="inspector-tools" hidden><button type="button">開啟地區比較</button></div><div id="inspector-structure" class="inspector-tools" hidden><details><summary>票數口徑與來源</summary></details></div>');
  $("#inspector-structure details").append($("#detail-note"));
  $("#inspector-compare button").onclick = () => $("#compare-open").click();
  const buttons = [...inspector.querySelectorAll("[data-inspector-tab]")];
  let tab = "result", previousRegion;
  function show() {
    const region = ctx.state.key || ctx.state.county || "";
    if (region !== previousRegion) tab = "result";
    previousRegion = region;
    const r = ctx.state.key ? ctx.rec() : !ctx.isLeg() && ctx.state.county
      ? ctx.records?.[ctx.state.county + "/000"]
      : null;
    const lead = $("#inspector-lead");
    lead.hidden = !ctx.valid(r) || (ctx.isLeg() && ctx.state.chart === "small");
    if (!lead.hidden) {
      const winner = r.candidates[0];
      $("#inspector-winner").textContent = winner.name;
      $("#inspector-share").textContent = ctx.pct(100 * winner.votes / r.total);
      $("#inspector-gap").textContent = r.candidates.length > 1
        ? "領先 " + ctx.marginOf(r).toFixed(2) + " pp"
        : "";
      lead.style.setProperty("--winner-color", ctx.color(winner.party));
    }
    const hasMargin = !!chart.querySelector(".margin-callout");
    result.hidden = tab !== "result";
    chart.hidden = hasMargin ? tab !== "compare" : tab !== "structure";
    $("#inspector-compare").hidden = tab !== "compare";
    $("#inspector-structure").hidden = tab !== "structure";
    for (const button of buttons)
      button.setAttribute("aria-pressed", String(button.dataset.inspectorTab === tab));
  }
  for (const button of buttons) button.onclick = () => {
    tab = button.dataset.inspectorTab;
    show();
  };
  return show;
}
