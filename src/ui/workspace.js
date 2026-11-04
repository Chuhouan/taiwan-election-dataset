export function installWorkspace(ctx) {
  const $ = ctx.$;
  const host = $("#map-host"),
    pane = $("#chart-pane");
  host.insertAdjacentHTML(
    "afterbegin",
    '<header id="left-pane-head" class="pane-head" hidden><div class="pane-title-row"><strong>地理分布</strong><div id="left-pane-focus"></div></div><div id="left-pane-tools"></div></header>',
  );
  pane.insertAdjacentHTML(
    "afterbegin",
    '<header id="right-pane-head" class="pane-head" hidden><div class="pane-title-row"><select id="pane-chart-type" aria-label="右側圖表"><option value="ternary">三方競爭</option><option value="hex">等格圖</option><option value="bubble">票數規模</option><option value="small">並列比較</option><option value="scatter">分布分析</option></select><div id="right-pane-tools"></div></div><div id="right-pane-controls"></div></header>',
  );
  $("#pane-chart-type").onchange = (event) => {
    ctx.state.chart = event.target.value;
    ctx.updateUI();
  };
  pane.insertAdjacentHTML(
    "beforeend",
    '<div id="ternary-navigation" class="ternary-navigation" hidden><span>拖曳平移 · Ctrl＋滾輪縮放</span><button type="button" data-ternary-nav="out" aria-label="縮小三方圖">−</button><button type="button" data-ternary-nav="in" aria-label="放大三方圖">＋</button><button type="button" data-ternary-nav="reset" aria-label="重設三方圖視角">⌂</button></div>',
  );
  for (const button of ctx.$$("[data-ternary-nav]"))
    button.onclick = () => ctx.ternaryZoomAction?.(button.dataset.ternaryNav);
  const split = $("#dual-controls label:first-child");
  $(".workspace-actions").prepend(split);
  split.classList.add("workspace-split");
  const nodes = [
    $(".map-toolbar .segmented.small"),
    $("#dual-metric-label"),
    $("#dual-candidate"),
    $("#dual-other-label"),
    $("#dual-map-focus"),
    $("#dual-chart-focus"),
    $("#labels-toggle"),
  ];
  const homes = nodes.map((node) => {
    const marker = document.createComment("control-home");
    node.before(marker);
    return marker;
  });
  const chartControls = ["chart-options", "distribution-filter", "axes-control",
    "stat-template-controls", "relative-control", "seat-mode-control", "swarm-neutral-label"]
    .map((id) => $("#" + id)).filter(Boolean);
  const chartHomes = chartControls.map((node) => {
    const marker = document.createComment("chart-control-home");
    node.before(marker);
    return marker;
  });
  ctx.presentPaneLayout = () => {
    const dual = ctx.dualMode;
    chartControls.forEach((node, i) => {
      if (dual) {
        if (node.parentElement !== $("#right-pane-controls"))
          $("#right-pane-controls").append(node);
      } else if (node.previousSibling !== chartHomes[i]) chartHomes[i].after(node);
    });
    $("#left-pane-head").hidden = !dual || ctx.dualFocus === "chart";
    $("#right-pane-head").hidden = !dual || ctx.dualFocus === "map";
    split.hidden = !dual;
    nodes.forEach((node, i) => {
      if (dual) {
        const target = $(i === 5 ? "#right-pane-tools" : i === 4 ? "#left-pane-focus" : "#left-pane-tools");
        if (node.parentElement !== target) target.append(node);
      } else if (node.previousSibling !== homes[i]) homes[i].after(node);
    });
    $("#pane-chart-type").value = ctx.state.chart;
    if (dual) {
      const workspace = $(".map-workspace"),
        top = $(".workspace-heading").getBoundingClientRect().bottom -
          workspace.getBoundingClientRect().top + 12;
      workspace.style.setProperty("--pane-head-top", top + "px");
    }
  };
  const eyebrow = $(".workspace-heading .eyebrow");
  eyebrow.className = "view-title";
  eyebrow.id = "view-title";
  const scope = $("#scope-summary");
  scope.classList.add("scope-context");
  const chartNames = {
    map: "地理分布",
    hex: "等權格網",
    bubble: "票數規模",
    ternary: "三方競爭",
    small: "候選人比較",
    scatter: "統計分布",
  };
  for (const button of ctx.$$("button[data-chart]"))
    button.textContent = chartNames[button.dataset.chart] || button.textContent;
  // Keep the route-compatible select as the data input; expose direct view switches.
  const old = $("#density-label"),
    mode = $("#density-mode"),
    modes = document.createElement("div");
  modes.id = "density-label";
  modes.className = "ternary-mode-controls";
  const group = document.createElement("div");
  group.className = "view-modes";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "三方圖表示方式");
  for (const [value, label] of [
    ["points", "散點"],
    ["contour", "輪廓"],
    ["hexbin", "分箱"],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.ternaryMode = value;
    button.textContent = label;
    button.onclick = () => {
      ctx.chartOptions.densityMode = value;
      ctx.chartOptions.density = value === "contour";
      ctx.updateUI();
    };
    group.append(button);
  }
  mode.hidden = true;
  modes.append(group, mode);
  old.replaceWith(modes);
  // Ternary primary controls answer view / focus. Appearance belongs to its settings dialog.
  const settings = $("#ternary-settings-form .scatter-settings-checks");
  for (const id of ["ternary-color-label", "ternary-size-label"])
    settings.append($("#" + id));
  $("#ternary-settings-open").textContent = "顯示設定";
  const metric = $("#metric-mode");
  const basic = document.createElement("optgroup");
  basic.label = "選舉結果";
  const advanced = document.createElement("optgroup");
  advanced.label = "進階研究";
  for (const option of [...metric.options])
    (["bivariate", "enp", "concentration"].includes(option.value)
      ? advanced
      : basic
    ).append(option);
  metric.append(basic, advanced);
  const menu = $(".research-menu-items");
  for (const [label, ids] of [
    ["篩選與比較", ["conditions-open", "groups-open", "dual-view"]],
    ["選票分析", ["contribution-open", "scale-open", "vote-seat-open"]],
    ["進階與製圖", ["spatial-open", "cartography-open"]],
  ]) {
    const section = document.createElement("div");
    section.className = "research-section";
    const title = document.createElement("strong");
    title.textContent = label;
    section.append(title);
    for (const id of ids) {
      const el = $("#" + id);
      if (el) section.append(el);
    }
    menu.append(section);
  }
  // A newly loaded tool takes the placeholder's exact place in the organized menu.
  ctx.presentWorkspace = () => {
    ctx.presentPaneLayout();
    ctx.presentBubbleWorkspace?.();
    $("#ternary-navigation").hidden =
      ctx.state.chart !== "ternary" ||
      ctx.state.brushEnabled ||
      (ctx.dualMode && ctx.dualFocus === "map");
    ctx.refreshLinkedMarks?.();
    $("#view-title").textContent =
      ctx.isLeg() && ctx.state.chart === "small"
        ? "立法院席次"
        : chartNames[ctx.state.chart];
    document.body.dataset.statisticalCanvas = [
      "ternary",
      "small",
      "scatter",
    ].includes(ctx.state.chart)
      ? "true"
      : "false";
    for (const button of ctx.$$("[data-ternary-mode]")) {
      const active =
        button.dataset.ternaryMode === ctx.chartOptions.densityMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const [id, label] of [
      ["spatial-open", "進階與製圖"],
      ["scale-open", "選票分析"],
      ["vote-seat-open", "選票分析"],
    ]) {
      const button = $("#" + id),
        section = [...menu.querySelectorAll(".research-section")].find(
          (s) => s.firstElementChild.textContent === label,
        );
      if (button && section && button.parentElement !== section)
        section.append(button);
    }
  };
  ctx.presentWorkspace();
}
