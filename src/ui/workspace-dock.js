export function installWorkspaceDock(ctx) {
  const $ = ctx.$;
  const body = document.body;
  const actions = $(".workspace-actions");
  actions.insertAdjacentHTML("beforeend", `
    <button type="button" id="workspace-options" aria-controls="explore-dock" aria-expanded="false" title="調整目前視圖的進階參數">進階參數</button>
    <button type="button" id="workspace-data" aria-controls="explore-dock" aria-expanded="false" title="查看目前範圍的地區票數與比率">資料表</button>`);
  $(".analysis-layout").insertAdjacentHTML("beforeend", `
    <aside id="explore-dock" aria-label="分析台側欄" hidden>
      <header>
        <div role="group" aria-label="分析台側欄內容">
          <button type="button" data-explore-panel="parameters" aria-pressed="false">進階參數</button>
          <button type="button" data-explore-panel="data" aria-pressed="false">資料表</button>
        </div>
        <button type="button" id="explore-dock-close" aria-label="關閉分析台側欄">×</button>
      </header>
      <div id="explore-parameter-groups"></div>
      <section id="explore-table-slot" aria-label="目前範圍資料表" hidden>
        <p id="explore-table-scope" aria-live="polite"></p>
        <p id="explore-table-empty" hidden>目前範圍沒有地區可列出。可調整或清除條件。</p>
      </section>
    </aside>`);
  const dock = $("#explore-dock");
  const options = $("#workspace-options");
  const data = $("#workspace-data");
  const tableSlot = $("#explore-table-slot");
  const parameterGroups = $("#explore-parameter-groups");
  const table = $("#table-content");
  tableSlot.append(table);
  // The field elements stay live, so the existing listeners and URL codecs still own their state.
  const viewGroups = [
    ["map hex bubble", "地圖指標與編碼", ".metric-selector", ".map-encoding-switch", "#candidate-filter"],
    ["hex", "格網顯示", "#hex-labels-label"],
    ["ternary", "點與密度", "#ternary-color-label", "#ternary-size-label", "#county-context-control", "#ternary-settings-open"],
    ["scatter", "圖點與坐標", "#axis-size", "#axis-color", "#scatter-settings-open", "#stat-template-controls", "#swarm-neutral-label"],
    ["small", "差值與排列", "#small-difference", "#small-a", "#small-b", "#small-order", "#seat-focus-label"],
  ];
  for (const [views, name, ...selectors] of viewGroups) {
    const group = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = name;
    group.dataset.workspaceViews = views;
    group.append(legend);
    for (const selector of selectors) {
      const field = $(selector);
      if (!field) continue;
      group.append(field.matches("input, select") ? field.closest("label") || field : field);
    }
    parameterGroups.append(group);
  }

  let parametersOpen = false;
  let returnFocus;
  function clearOtherPanels() {
    if (!$("#conditions").hidden) ctx.setConditionsOpen(false);
    if (!$("#groups-panel").hidden) ctx.setGroupsOpen(false);
  }
  function openParameters(trigger) {
    returnFocus = trigger || options;
    clearOtherPanels();
    parametersOpen = true;
    if (ctx.state.drawer) ctx.openDrawer(null);
    present();
  }
  function openData(trigger) {
    returnFocus = trigger || data;
    clearOtherPanels();
    parametersOpen = false;
    ctx.openDrawer("table");
  }
  function close() {
    parametersOpen = false;
    if (ctx.state.drawer === "table") ctx.openDrawer(null);
    present();
    returnFocus?.focus({ preventScroll: true });
  }
  function present() {
    if (!$("#conditions").hidden || !$("#groups-panel").hidden) {
      parametersOpen = false;
      if (ctx.state.drawer === "table") {
        ctx.state.drawer = null;
        ctx.renderDrawer();
      }
    }
    const dataOpen = ctx.state.drawer === "table";
    if (dataOpen) parametersOpen = false;
    const open = dataOpen || parametersOpen;
    dock.hidden = !open;
    dock.dataset.panel = dataOpen ? "data" : "parameters";
    body.classList.toggle("explore-dock-open", open);
    body.classList.toggle("explore-dock-data", dataOpen);
    options.setAttribute("aria-expanded", String(parametersOpen));
    data.setAttribute("aria-expanded", String(dataOpen));
    for (const button of dock.querySelectorAll("[data-explore-panel]")) {
      button.setAttribute("aria-pressed", String(open && button.dataset.explorePanel === dock.dataset.panel));
    }
    parameterGroups.hidden = !parametersOpen;
    tableSlot.hidden = !dataOpen;
    for (const group of parameterGroups.children) {
      const applicable = group.dataset.workspaceViews.split(" ").includes(ctx.state.chart);
      group.hidden = !applicable || [...group.children].slice(1).every((field) => field.hidden);
    }
    if (dataOpen) {
      const regional = ctx.isLeg() && ctx.state.chart === "small";
      $("#explore-table-scope").textContent = regional
        ? "此表為區域選區結果；席次圖可另外顯示不分區與原住民席次。"
        : $("#drawer-summary").textContent + " · 點選地名可在地圖查看";
      $("#explore-table-empty").hidden = !!$("#data-rows").children.length;
    }
  }
  options.onclick = () => parametersOpen ? close() : openParameters(options);
  data.onclick = () => ctx.state.drawer === "table" ? close() : openData(data);
  $("#metric-more").onclick = () => parametersOpen ? close() : openParameters(options);
  $("#explore-dock-close").onclick = close;
  dock.querySelector('[data-explore-panel="parameters"]').onclick = () => openParameters();
  dock.querySelector('[data-explore-panel="data"]').onclick = () => openData();
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dock.hidden && !event.defaultPrevented && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      close();
    }
  }, true);
  ctx.presentWorkspaceDock = present;
  present();
}
