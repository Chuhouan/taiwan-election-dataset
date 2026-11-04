/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    presentControls,
    chartKeyboardItems,
    updateChartTabStops,
  });
  for (const [key, name] of Object.entries(ctx.EXTRA_METRICS))
    ctx
      .$(".map-metrics")
      .insertAdjacentHTML(
        "beforeend",
        '<button data-metric="' + key + '" hidden>' + name.title + "</button>",
      );
  // One metric selector replaces the repeated pill wall; only compatible options are enabled.
  ctx
    .$(".map-metrics")
    .insertAdjacentHTML(
      "afterbegin",
      '<label class="metric-selector">地圖指標<select id="metric-mode" aria-label="地圖指標"></select></label>',
    );
  ctx.$("#metric-mode").innerHTML = ctx
    .$$("button[data-metric]")
    .map(
      (b) =>
        '<option value="' +
        b.dataset.metric +
        '">' +
        b.textContent +
        "</option>",
    )
    .join("");
  ctx.$(".map-metrics").append(ctx.$("#candidate-filter"));
  ctx
    .$("#candidate-filter")
    .insertAdjacentHTML(
      "beforeend",
      '<span id="metric-other-label" hidden>− <select id="metric-other" aria-label="比較候選人B"><option>侯友宜</option><option>賴清德</option><option>柯文哲</option></select></span>',
    );
  ctx.$("#metric-other").onchange = (ev) => {
    ctx.state.otherCandidate = ev.target.value;
    ctx.updateUI();
  };
  ctx
    .$(".workspace-actions")
    .insertAdjacentHTML(
      "afterbegin",
      '<details class="research-menu"><summary id="research-summary">研究工具</summary><div class="research-menu-items" role="group" aria-label="研究工具"></div></details>',
    );
  ctx.researchMenu = ctx.$(".research-menu");
  ctx.researchItems = ctx.$(".research-menu-items");
  for (const id of [
    "dual-view",
    "conditions-open",
    "groups-open",
    "contribution-open",
  ])
    ctx.researchItems.append(ctx.$("#" + id));
  ctx.researchItems.addEventListener("click", (ev) => {
    if (ev.target.closest("button")) ctx.researchMenu.open = false;
  });
  ctx.$("#metric-mode").onchange = (ev) => {
    ctx.state.metric = ev.target.value;
    ctx.state.sort = "metric";
    ctx.updateUI();
  };
  ctx.presentationChart = "";
  function presentControls() {
    if (ctx.data) {
      if (
        !ctx.routeApplying &&
        ((ctx.presentationChart && ctx.presentationChart !== ctx.state.chart) ||
          (!ctx.presentationChart && !ctx.initialRoute.has("detail")))
      )
        document.body.classList.toggle(
          "detail-closed",
          !ctx.state.key,
        );
      ctx.presentationChart = ctx.state.chart;
      document.body.classList.toggle(
        "chart-detail-overlay",
        ctx.state.chart !== "map",
      );
      ctx
        .$("#detail-toggle")
        .setAttribute(
          "aria-expanded",
          !document.body.classList.contains("detail-closed"),
        );
    }
    document.body.classList.toggle(
      "comparison-open",
      ctx.state.drawer === "compare",
    );
    if (ctx.state.chart === "map") {
      for (const id of [
        "axes-control",
        "chart-options",
        "stat-template-controls",
        "relative-control",
        "swarm-neutral-label",
      ])
        ctx.$("#" + id).hidden = true;
    }
    ctx.$("#metric-mode").value = ctx.state.metric;
    ctx.$("#metric-other-label").hidden = ctx.state.metric !== "difference";
    ctx.$("#metric-other").value = ctx.state.otherCandidate || "侯友宜";
    for (const option of ctx.$("#metric-mode").options)
      option.disabled = ctx.$(
        'button[data-metric="' + option.value + '"]',
      ).disabled;
    ctx.$("#contribution-open").disabled = ctx.isLeg();
    ctx.$("#spatial-open").disabled = ctx.isLeg();
    ctx.$("#scale-open").disabled = ctx.isLeg();
    ctx.$("#vote-seat-open").disabled = !ctx.isLeg();
    ctx.$("#groups-open").disabled = ctx.isLeg();
    ctx.$("#village-open").hidden =
      !ctx.state.key || (ctx.isLeg() && ctx.rec()?.town !== "000");
    ctx.$("#contribution-open").title = ctx.isLeg()
      ? "票源分析目前適用總統選舉"
      : "分析候選人的票源、淨領先與地區優勢";
    ctx.$("#research-summary").textContent = ctx.dualMode
      ? "研究工具 · 雙視圖"
      : "研究工具";
    ctx.updateGroupMarks();
  }

  // A chart is one tab stop; arrow keys move between its visible regions or seats.
  function chartKeyboardItems(svg) {
    return [...svg.querySelectorAll('[role="button"][tabindex]')].filter(
      (el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          getComputedStyle(el).visibility !== "hidden"
        );
      },
    );
  }
  function updateChartTabStops() {
    for (const svg of ctx.$$("#map,#scatter,#village-map,#spatial-chart")) {
      svg.setAttribute(
        "aria-description",
        "使用方向鍵瀏覽地區，按 Enter 選取，Home 和 End 移至首尾。",
      );
      const items = ctx.chartKeyboardItems(svg);
      if (!items.length) continue;
      const focused = items.find((el) => el === document.activeElement),
        selected = items.find(
          (el) =>
            el.dataset.regionKey === ctx.state.key ||
            el.dataset.memberId === ctx.selectedMember ||
            el.classList.contains("selected"),
        );
      svg
        .querySelectorAll('[role="button"][tabindex]')
        .forEach(
          (el) =>
            (el.tabIndex = el === (focused || selected || items[0]) ? 0 : -1),
        );
    }
  }

  document.addEventListener("keydown", (ev) => {
    const svg = ev.target.closest?.(
      "#map,#scatter,#village-map,#spatial-chart",
    );
    if (!svg) return;
    if (svg.id === "village-map" && ["+", "=", "-", "0"].includes(ev.key)) {
      ev.preventDefault();
      ctx
        .$(
          "#" +
            (ev.key === "0"
              ? "village-reset"
              : ev.key === "-"
                ? "village-zoom-out"
                : "village-zoom-in"),
        )
        .click();
      return;
    }
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(ev.key) ||
      !ev.target.matches('[role="button"]')
    )
      return;
    const items = ctx.chartKeyboardItems(svg),
      index = items.indexOf(ev.target);
    if (index < 0 || !items.length) return;
    ev.preventDefault();
    const next =
      ev.key === "Home"
        ? 0
        : ev.key === "End"
          ? items.length - 1
          : (index +
              (["ArrowRight", "ArrowDown"].includes(ev.key) ? 1 : -1) +
              items.length) %
            items.length;
    items[index].tabIndex = -1;
    items[next].tabIndex = 0;
    items[next].focus();
  });

  ctx
    .$(".research-menu-items")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="cartography-open">製圖設定</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    '<dialog id="cartography-dialog" class="scatter-settings-dialog"><div class="filter-title"><h2>製圖設定</h2><button id="cartography-close" aria-label="關閉製圖設定">×</button></div><div class="cartography-options"><label>標籤密度<select id="cartography-labels"><option value="sparse">精簡 · 優先主要城市</option><option value="standard">標準 · 隨縮放顯示</option><option value="rich">詳細 · 較早顯示鄉鎮</option></select></label><label>行政邊界<select id="cartography-boundaries"><option value="county">縣市優先</option><option value="town">顯示鄉鎮界</option><option value="subtle">低對比邊界</option></select></label><label>離島分幅<select id="cartography-insets"><option value="expanded">展開</option><option value="compact">緊湊</option></select></label></div><p>標籤會避讓文字，選取及懸浮地區優先；關閉「地名」時僅保留目前檢視及懸浮標籤。離島各自投影，比例與本島不同。選區圖以官方村里歸屬合併，不是測量界線。</p><p>設定隨分析連結保存。各選舉的來源與圖資版本可在「資料與方法」查看。</p></dialog>',
  );
  ctx.$("#cartography-open").onclick = () => {
    for (const key of Object.keys(ctx.state.cartography))
      ctx.$("#cartography-" + key).value = ctx.state.cartography[key];
    ctx.$("#cartography-dialog").showModal();
  };
  ctx.$("#cartography-close").onclick = () =>
    ctx.$("#cartography-dialog").close();
  for (const key of Object.keys(ctx.state.cartography))
    ctx.$("#cartography-" + key).onchange = (ev) => {
      ctx.state.cartography[key] = ev.target.value;
      ctx.updateUI();
      ctx.buildMap();
      ctx.updateHash();
    };
}
