import { describeScope } from "../data/scope.js";
import { applyPartySymbols } from "../charts/party-symbols.js";

export function installResearch(ctx) {
  const $ = ctx.$;
  ctx.contextCounty = "";
  ctx.groupNames = { a: "A 組", b: "B 組" };
  ctx.mapEncoding = "area";
  ctx.colorMode = "standard";
  ctx.$(".map-source").replaceWith(Object.assign(document.createElement("button"), { id: "source-badge", className: "map-source", textContent: "中選會 · 來源與版本 ↗" }));
  ctx.$("#source-badge").onclick = () => import("./evidence.js").then((m) => m.openEvidence(ctx));
  $(".research-menu-items").insertAdjacentHTML("beforeend", '<div class="research-section"><strong>結果資料</strong><button id="workspace-table-open">目前分析資料表</button></div>');
  $("#workspace-table-open").onclick = () => { ctx.state.drawer = "table"; ctx.updateUI(); };
  $("#metric-popover").insertAdjacentHTML("beforeend", '<div class="map-encoding-switch" role="group" aria-label="地圖表達"><button data-map-encoding="area">版圖</button><button data-map-encoding="margin">勝差</button><button data-map-encoding="symbols">票量</button></div>');
  $("#left-pane-tools").insertAdjacentHTML("beforeend", '<label id="dual-encoding-label">表達<select id="dual-map-encoding"><option value="area">版圖</option><option value="margin">勝差透明度</option><option value="symbols">票量圓</option></select></label>');
  const setEncoding = (encoding) => { ctx.mapEncoding = encoding; ctx.updateUI(); };
  for (const button of ctx.$$('[data-map-encoding]')) button.onclick = () => setEncoding(button.dataset.mapEncoding);
  $("#dual-map-encoding").onchange = (event) => setEncoding(event.target.value);
  $("#cartography-dialog .cartography-options").insertAdjacentHTML("beforeend", '<label>政黨配色<select id="color-mode"><option value="standard">標準政黨色</option><option value="accessible">高辨識替代色</option></select></label>');
  $("#color-mode").onchange = (event) => {
    ctx.colorMode = event.target.value; ctx.lastNational = ""; ctx.lastDetail = ""; ctx.updateUI();
  };
  $("#chart-options").insertAdjacentHTML("beforeend", '<label id="county-context-control" hidden>縣市對照<select id="county-context"><option value="">全臺背景</option></select></label>');
  $("#right-pane-controls").insertAdjacentHTML("afterend", '<section id="county-context-summary" class="county-context-summary" hidden></section>');
  // The same summary lives in the chart pane in single view, below its measured tools.
  $("#county-context").onchange = (event) => {
    ctx.contextCounty = event.target.value;
    ctx.updateUI();
  };
  $("#groups-panel .group-actions").insertAdjacentHTML("beforebegin", '<div class="group-names"><label>A 名稱<input id="group-name-a" maxlength="24" value="A 組"></label><label>B 名稱<input id="group-name-b" maxlength="24" value="B 組"></label></div>');
  for (const group of ["a", "b"]) $("#group-name-" + group).onchange = (event) => {
    ctx.groupNames[group] = event.target.value.trim().slice(0, 24) || group.toUpperCase() + " 組";
    ctx.updateUI();
  };
  $("#groups-panel .group-actions:last-child").insertAdjacentHTML("beforeend", '<button id="groups-members-csv">群組地區明細 CSV</button>');
  $("#groups-members-csv").onclick = () => {
    const rows = ["a", "b"].flatMap((group) => ctx.groupSelection[group].filter((key) => ctx.valid(ctx.records[key])).flatMap((key) => {
      const r = ctx.records[key];
      return r.candidates.map((c) => [group.toUpperCase(), ctx.groupNames[group], key, ctx.areaName(r, true), c.name, c.party,
        c.votes, r.total, r.cast, r.eligible, 100 * c.votes / r.total, ctx.turnoutOf(r) ?? "", ctx.dataVersionLabel()]);
    }));
    ctx.csvTable(["組別", "組名", "地區ID", "地區", "候選人", "政黨", "票數", "有效票", "投票數", "選舉人數", "得票率", "投票率", "資料版本"], rows, "臺灣選舉-群組地區明細.csv");
  };
  $(".workspace-actions").insertAdjacentHTML("beforeend", '<button id="focus-mode" aria-pressed="false">專注圖表</button>');
  $("#focus-mode").onclick = () => {
    document.body.classList.toggle("focus-mode");
    ctx.presentResearchWorkspace();
    ctx.scheduleCanvasReflow();
    ctx.updateHash();
  };
  ctx.parseResearchRoute = (p) => {
    ctx.contextCounty = ctx.data.counties[p.get("context-county")] ? p.get("context-county") : "";
    ctx.mapEncoding = ["area", "margin", "symbols"].includes(p.get("map-encoding")) ? p.get("map-encoding") : "area";
    ctx.colorMode = p.get("color-mode") === "accessible" ? "accessible" : "standard";
    $("#color-mode").value = ctx.colorMode;
    ctx.groupNames = { a: p.get("group-name-a") || "A 組", b: p.get("group-name-b") || "B 組" };
    document.body.classList.toggle("focus-mode", p.get("focus-mode") === "1");
    for (const group of ["a", "b"]) $("#group-name-" + group).value = ctx.groupNames[group];
  };
  ctx.serializeResearchRoute = (p) => {
    if (ctx.contextCounty) p.set("context-county", ctx.contextCounty);
    if (ctx.mapEncoding !== "area") p.set("map-encoding", ctx.mapEncoding);
    if (ctx.colorMode !== "standard") p.set("color-mode", ctx.colorMode);
    for (const group of ["a", "b"])
      if (ctx.groupNames[group] !== group.toUpperCase() + " 組") p.set("group-name-" + group, ctx.groupNames[group]);
    if (document.body.classList.contains("focus-mode")) p.set("focus-mode", "1");
  };
  let populated = false;
  ctx.presentResearchWorkspace = () => {
    if (!ctx.data) return;
    document.body.dataset.colorMode = ctx.colorMode;
    $("#dual-map-encoding").value = ctx.mapEncoding;
    for (const button of ctx.$$('[data-map-encoding]')) button.classList.toggle("active", button.dataset.mapEncoding === ctx.mapEncoding);
    for (const node of ctx.$$(".map-overlay-key")) node.remove();
    if (ctx.mapEncoding !== "area" && (ctx.dualMode || ctx.state.chart === "map") && !ctx.isLeg()) {
      const legend = ctx.dualMode ? $("#dual-map-legend") : $("#legend"), note = document.createElement("div");
      note.className = "map-overlay-key";
      note.textContent = ctx.mapEncoding === "margin" ? "透明度：前兩名領先差距 0–35pp，越實越懸殊。" : "圓面積 ∝ 有效票數；底色為地區結果，圓的位置不表示地理覆蓋範圍。";
      legend.append(note);
    }
    if (!populated) {
      for (const [value, name] of Object.entries(ctx.data.counties))
        $("#county-context").append(new Option(name, value));
      populated = true;
    }
    const active = !ctx.isLeg() && ctx.state.chart === "ternary";
    $("#county-context-control").hidden = !active;
    $("#county-context").value = ctx.contextCounty;
    const head = $("#county-context-summary"),
      target = ctx.dualMode ? $("#right-pane-head") : $("#chart-options");
    if (head.parentElement !== target) target.append(head);
    head.hidden = !active || !ctx.contextCounty;
    if (!head.hidden) {
      const rs = ctx.scoped().filter((r) => r.county === ctx.contextCounty),
        keys = rs.map(ctx.keyOf), result = ctx.groupAggregate(keys),
        national = ctx.records["00000/000"];
      head.replaceChildren();
      const heading = document.createElement("strong");
      heading.textContent = ctx.data.counties[ctx.contextCounty] + " · " + rs.length + " 地區 · 全臺背景保留";
      head.append(heading);
      const values = document.createElement("div");
      values.className = "context-values";
      for (const candidate of result.candidates) {
        const base = ctx.shareOf(national, candidate.name), item = document.createElement("span");
        item.textContent = candidate.name + " " + (candidate.share == null ? "無資料" : ctx.pct(candidate.share)) +
          (candidate.share == null ? "" : "（全臺 " + ctx.pct(base) + "，" + ctx.sign(candidate.share - base) + "pp）");
        values.append(item);
      }
      head.append(values);
      const actions = document.createElement("div");
      for (const group of ["a", "b"]) {
        const button = document.createElement("button");
        button.textContent = "設為 " + ctx.groupNames[group];
        button.disabled = !keys.length;
        button.onclick = () => {
          const other = group === "a" ? "b" : "a";
          ctx.groupSelection[group] = keys;
          ctx.groupSelection[other] = ctx.groupSelection[other].filter((key) => !keys.includes(key));
          ctx.updateUI();
        };
        actions.append(button);
      }
      const clear = document.createElement("button");
      clear.textContent = "取消縣市對照";
      clear.onclick = () => { ctx.contextCounty = ""; ctx.updateUI(); };
      actions.append(clear);
      head.append(actions);
    }
    for (const node of ctx.$$("#scatter [data-region-key],#scatter [data-region-keys]")) {
      const keys = (node.dataset.regionKeys || node.dataset.regionKey || "").split(","),
        inCounty = keys.some((key) => ctx.records[key]?.county === ctx.contextCounty);
      node.classList.toggle("county-context-active", active && !!ctx.contextCounty && inCounty);
      node.classList.toggle("county-context-muted", active && !!ctx.contextCounty && !inCounty);
    }
    const focused = document.body.classList.contains("focus-mode");
    $("#focus-mode").textContent = focused ? "返回探索" : "專注圖表";
    $("#focus-mode").setAttribute("aria-pressed", String(focused));
    $("#scope-summary").setAttribute("aria-label", describeScope(ctx).kind);
    applyPartySymbols(ctx, $("#scatter"));
    if (ctx.colorMode === "accessible") {
      for (const span of ctx.$$("#legend .legend-parties span,#dual-map-legend .legend-parties span")) {
        const party = ["民進黨", "國民黨", "民眾黨"].find((p) => span.textContent.includes(p)) ||
          ctx.records["00000/000"].candidates.find((c) => span.textContent.includes(c.name))?.party;
        if (party && !span.dataset.partySymbol) { const symbol = party === "民進黨" ? "●" : party === "國民黨" ? "▲" : "■"; span.dataset.partySymbol = party; span.append(" " + symbol); }
      }
      if (["ternary", "scatter"].includes(ctx.state.chart) && !$("#legend .party-symbol-key")) {
        const note = document.createElement("div"); note.className = "legend-foot party-symbol-key";
        note.textContent = "符號：民進黨●／國民黨▲／民眾黨■；相同票量採相同圖形面積。";
        $("#legend").append(note);
      }
    }
    const navigation = $("#ternary-navigation");
    if (navigation && !navigation.hidden) navigation.style.bottom = (ctx.dualMode ? Math.max(72, $("#legend").clientHeight + 22) : 72) + "px";
    ctx.refreshLinkedMarks?.();
  };
}
