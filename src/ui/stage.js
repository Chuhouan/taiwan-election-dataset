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
  let previousView, animation, motionFrame;
  ctx.presentStage = () => {
    const { chart } = ctx.state;
    const metric = $("#stage-metric");
    let mapMetric = ctx.state.metric === "winner" ? "各地第一名政黨" :
      ctx.state.metric === "runner" ? "各地第二名政黨" : ctx.metricDefinition().title;
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
    ctx.presentChartCaption?.();
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
    const product = document.documentElement.dataset.page === "explore";
    if (product) {
      animation?.cancel();
      cancelAnimationFrame(motionFrame);
    }
    if (previousView && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animation?.cancel();
      const target = product && chart !== "map" ? $("#scatter") : $("#map-host");
      const animate = () => {
        animation = target.animate(
          product && chart !== "map"
            ? [{ opacity: 0.7, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }]
            : [{ opacity: 0.78 }, { opacity: 1 }],
          product ? { duration: 240, easing: "cubic-bezier(.22,.61,.36,1)", id: "atlas-view-enter" }
            : parseFloat(getComputedStyle(stage).getPropertyValue("--motion-panel")),
        );
      };
      if (product) motionFrame = requestAnimationFrame(() => { motionFrame = requestAnimationFrame(animate); });
      else animate();
    }
    previousView = chart;
  };
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
