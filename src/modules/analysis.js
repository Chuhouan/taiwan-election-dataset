/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    hasConditions,
    renderDualMapLegend,
    chartToolsBottom,
    chartDimensions,
    applyDualLayout,
    resizeDual,
    renderFilterPresets,
    presetFromInputs,
    saveFilterPreset,
    setConditionsOpen,
    setGroupsOpen,
    groupAggregate,
    renderGroups,
    renderGroupChart,
    updateGroupMarks,
    selectGroupTarget,
    applyConditions,
    parseAnalysisRoute,
    serializeAnalysisRoute,
    prepareAnalysisState,
    renderEmptyAnalysis,
    presentAnalysis,
    aggregateCurrentSelection,
  });
  /* Reproducible filters and linked map/statistical workspace. */
  ctx.filterSpec = {
    candidate: "柯文哲",
    share: "",
    turnout: "",
    margin: "",
    logic: "and",
    mode: "replace",
  };
  ctx.filterActive = false;
  ctx.dualMode = false;
  ctx.conditionBase = [];
  ctx.conditionHighlight = [];
  ctx.bivariateHighlightCell = "";
  ctx.filterSpec2 = { share: "", turnout: "", margin: "", logic: "and" };
  ctx.filterInter = "or";
  function groupTests(spec, candidate = ctx.filterSpec.candidate) {
    const tests = [];
    for (const field of ["share", "turnout", "margin"])
      if (spec[field] !== "" && Number.isFinite(+spec[field]))
        tests.push((r) =>
          field === "share"
            ? ctx.shareOf(r, candidate) >= +spec.share
            : field === "turnout"
              ? ctx.turnoutOf(r) >= +spec.turnout
              : ctx.marginOf(r) <= +spec.margin,
        );
    return tests;
  }
  ctx.conditionGroups = (first = ctx.filterSpec, second = ctx.filterSpec2) => {
    const evalGroup = (spec) => {
      const tests = groupTests(spec, first.candidate);
      if (!tests.length) return null;
      return (r) =>
        spec.logic === "or" ? tests.some((t) => t(r)) : tests.every((t) => t(r));
    };
    return { g1: evalGroup(first), g2: evalGroup(second) };
  };
  ctx.evaluateConditions = (first = ctx.filterSpec, second = ctx.filterSpec2, relation = ctx.filterInter) => {
    const { g1, g2 } = ctx.conditionGroups(first, second);
    const rs = Object.values(ctx.records).filter(r => ctx.valid(r) && r.town !== "000" &&
      (!ctx.state.county || r.county === ctx.state.county));
    const matches = rs.filter(r => {
      const a = g1 ? g1(r) : null, b = g2 ? g2(r) : null;
      if (a === null) return b === null || b;
      if (b === null) return a;
      return relation === "or" ? a || b : a && b;
    }).map(ctx.keyOf);
    const keys = new Set(rs.map(ctx.keyOf));
    const base = (ctx.hasConditions() ? ctx.conditionBase : ctx.state.brushed).filter(key => keys.has(key));
    const result = !g1 && !g2 ? matches : first.mode === "intersection" ? matches.filter(key => base.includes(key)) :
      first.mode === "union" ? [...new Set([...matches, ...base])] : matches;
    return { rs, matches, base, result };
  };
  function toggleBivariateHighlight(cell) {
    if (ctx.bivariateHighlightCell === cell) {
      ctx.bivariateHighlightCell = "";
      ctx.conditionHighlight = [];
      ctx.updateUI();
      return;
    }
    ctx.bivariateHighlightCell = cell;
    const [tb, sb] = cell.split("-").map(Number);
    ctx.conditionHighlight = ctx
      .scoped()
      .filter((r) => {
        const share = ctx.shareOf(r, ctx.state.candidate),
          turnout = ctx.turnoutOf(r);
        return (
          (turnout < 65 ? 0 : turnout < 75 ? 1 : 2) === tb &&
          (share < 25 ? 0 : share < 35 ? 1 : 2) === sb
        );
      })
      .map((r) => ctx.keyOf(r));
    ctx.updateUI();
  }
  ctx.toggleBivariateHighlight = toggleBivariateHighlight;
  ctx.highlightOnlyActive = () =>
    (ctx.hasConditions() && ctx.filterSpec.mode === "highlight") ||
    ctx.bivariateHighlightCell !== "";
  function hasConditions() {
    return (
      ["share", "turnout", "margin"].some((k) => ctx.filterSpec[k] !== "") ||
      ["share", "turnout", "margin"].some((k) => ctx.filterSpec2[k] !== "")
    );
  }
  const defaultDualSplit = 60;
  ctx.dualSplit = defaultDualSplit;
  ctx.dualFocus = "both";
  ctx.groupSelection = { a: [], b: [] };
  ctx.activeGroup = "a";
  ctx
    .$(".workspace-actions")
    .insertAdjacentHTML(
      "afterbegin",
      '<button id="dual-view" aria-pressed="false">雙視圖</button><button id="conditions-open" aria-expanded="false">條件篩選</button>',
    );
  ctx
    .$(".map-workspace")
    .insertAdjacentHTML(
      "beforeend",
      '<div id="dual-controls" class="dual-controls" hidden><label>分割比例<select id="dual-split"><option value="40">地圖 40 / 圖表 60</option><option value="50" selected>地圖 50 / 圖表 50</option><option value="60">地圖 60 / 圖表 40</option></select></label><button id="dual-map-focus">放大地圖</button><button id="dual-chart-focus">放大圖表</button><label id="dual-metric-label">地圖<select id="dual-metric"><option value="winner">第一名</option><option value="runner">第二名</option><option value="margin">競爭差距</option><option value="turnout">投票率</option><option value="share">候選人得票率</option></select></label><select id="dual-candidate" aria-label="地圖候選人 A" hidden><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select><label id="dual-other-label" hidden>− <select id="dual-other" aria-label="地圖比較候選人 B"><option>侯友宜</option><option>賴清德</option><option>柯文哲</option></select></label></div>',
    );
  ctx
    .$("#map-host")
    .insertAdjacentHTML(
      "beforeend",
      '<div id="dual-map-legend" class="dual-map-legend" hidden></div>',
    );
  function renderDualMapLegend() {
    const el = ctx.$("#dual-map-legend");
    el.hidden = !ctx.dualMode || ctx.dualFocus === "chart";
    if (el.hidden) return;
    if (ctx.EXTRA_METRICS[ctx.state.metric]) {
      el.innerHTML = ctx.extraMetricLegend();
      ctx.updateLabels();
      return;
    }
    const label =
      {
        winner: "第一名所屬政黨",
        runner: "第二名所屬政黨",
        margin: "前兩名差距",
        turnout: "投票率",
        share: ctx.state.candidate + "得票率",
      }[ctx.state.metric] || "選舉結果";
    let swatches = "";
    if (["winner", "runner"].includes(ctx.state.metric))
      swatches =
        '<div class="legend-parties">' +
        ctx.records["00000/000"].candidates
          .map(
            (c) =>
              '<span><i style="background:' +
              ctx.color(c.party) +
              '"></i>' +
              ctx.esc(c.party) +
              "</span>",
          )
          .join("") +
        "</div>";
    else if (ctx.state.metric === "margin")
      swatches = ctx.legendRamp(
        ctx.d3
          .range(7)
          .map((i) =>
            ctx.d3.interpolateRgbBasis([
              "#fff3dd",
              "#f9bf76",
              "#df684b",
              "#a42f47",
            ])(i / 6),
          ),
        ["0", "差距 pp", "35+"],
      );
    else if (ctx.state.metric === "turnout")
      swatches = ctx.legendRamp(
        ctx.d3
          .range(7)
          .map((i) => ctx.d3.interpolateRgb("#eee9f0", "#66507a")(i / 6)),
        ["30%", "投票率", "85%+"],
      );
    else
      swatches = ctx.legendRamp(
        ctx.d3
          .range(7)
          .map((i) =>
            ctx.d3.interpolateRgb(
              "#e6edf3",
              ctx.color(
                ctx.records["00000/000"].candidates.find(
                  (c) => c.name === ctx.state.candidate,
                )?.party,
              ),
            )(i / 6),
          ),
        ["0%", "得票率", "65%+"],
      );
    el.innerHTML =
      '<div class="legend-title">地圖 · ' +
      ctx.esc(label) +
      "</div>" +
      swatches;
    ctx.updateLabels();
  }
  function chartToolsBottom() {
    if (ctx.dualMode) {
      const workspace = ctx.$(".map-workspace").getBoundingClientRect(),
        header = ctx.$("#right-pane-head").getBoundingClientRect();
      return Math.max(0, header.bottom - workspace.top);
    }
    const origin = ctx.$(".map-workspace").getBoundingClientRect().top,
      selectors =
        ctx.state.chart === "small" && ctx.isLeg()
          ? ["#seat-mode-control"]
          : ctx.state.chart === "ternary"
            ? ["#chart-options"]
            : ctx.state.chart === "scatter"
              ? ["#distribution-filter", "#axes-control", "#stat-template-controls"]
              : ["#chart-options", "#relative-control"];
    selectors.push("#brush-toggle");
    const bottom = Math.max(
      ctx.dualMode
        ? ctx.$("#right-pane-head").getBoundingClientRect().bottom - origin
        : document.body.classList.contains("focus-mode") ? 70 : 170,
      ...selectors.map((id) => {
        const el = ctx.$(id);
        return el && !el.hidden && el.getClientRects().length
          ? el.getBoundingClientRect().bottom - origin
          : 0;
      }),
    );
    ctx
      .$(".map-workspace")
      .style.setProperty("--dual-legend-top", bottom + 10 + "px");
    return bottom;
  }
  function chartDimensions() {
    const pane = ctx.$("#chart-pane");
    return { width: pane.clientWidth, height: pane.clientHeight };
  }
  function applyDualLayout() {
    ctx.presentPaneLayout?.();
    const options = ctx.$("#chart-options");
    if (options) {
      if (ctx.dualMode) options.append(ctx.$("#brush-toggle"));
      else ctx.$(".map-workspace").append(ctx.$("#brush-toggle"));
    }
    const workspace = ctx.$(".map-workspace"),
      host = ctx.$("#map-host");
    document.body.classList.toggle("dual-view", ctx.dualMode);
    document.body.classList.toggle(
      "dual-map-focus",
      ctx.dualMode && ctx.dualFocus === "map",
    );
    document.body.classList.toggle(
      "dual-chart-focus",
      ctx.dualMode && ctx.dualFocus === "chart",
    );
    host.style.width =
      ctx.dualMode && ctx.dualFocus === "both" ? ctx.dualSplit + "%" : "";
    workspace.style.setProperty(
      "--dual-chart-width",
      ctx.dualMode && ctx.dualFocus === "both"
        ? (workspace.clientWidth * (100 - ctx.dualSplit)) / 100 + "px"
        : "100%",
    );
    workspace.style.setProperty(
      "--dual-map-offset",
      ctx.dualMode && ctx.dualFocus === "both"
        ? (workspace.clientWidth * ctx.dualSplit) / 100 + "px"
        : "0px",
    );
    ctx.$("#dual-controls").hidden = !ctx.dualMode;
    ctx.$("#dual-split").value = String(ctx.dualSplit);
    ctx.$("#dual-split").disabled = ctx.dualFocus !== "both";
    ctx.$("#dual-map-focus").textContent =
      ctx.dualFocus === "map" ? "還原雙視圖" : "放大地圖";
    ctx.$("#dual-chart-focus").textContent =
      ctx.dualFocus === "chart" ? "還原雙視圖" : "放大圖表";
  }
  function resizeDual() {
    ctx.applyDualLayout();
    ctx.reflowWorkbenchCanvas(true);
    ctx.updateHash();
  }
  ctx.$("#dual-split").onchange = (ev) => {
    ctx.dualSplit = Number(ev.target.value);
    ctx.resizeDual();
  };
  ctx.$("#dual-metric").onchange = (ev) => {
    ctx.state.metric = ev.target.value;
    ctx.updateUI();
  };
  ctx.$("#dual-candidate").onchange = (ev) => {
    ctx.state.candidate = ev.target.value;
    ctx.updateUI();
  };
  ctx.$("#dual-other").onchange = (ev) => {
    ctx.state.otherCandidate = ev.target.value;
    ctx.updateUI();
  };
  for (const [id, focus] of [
    ["dual-map-focus", "map"],
    ["dual-chart-focus", "chart"],
  ])
    ctx.$("#" + id).onclick = () => {
      ctx.dualFocus = ctx.dualFocus === focus ? "both" : focus;
      ctx.resizeDual();
    };
  ctx
    .$(".map-workspace")
    .insertAdjacentHTML(
      "beforeend",
      '<section id="conditions" class="conditions-panel" hidden><div class="filter-title"><b>組合條件</b><button id="conditions-close" aria-label="關閉條件篩選">×</button></div><label>候選人<select id="filter-candidate"><option>柯文哲</option><option>賴清德</option><option>侯友宜</option></select></label><label>候選人得票率 ≥<input id="filter-share" type="number" min="0" max="100" placeholder="不限"><span>%</span></label><label>投票率 ≥<input id="filter-turnout" type="number" min="0" max="100" placeholder="不限"><span>%</span></label><label>前兩名差距 ≤<input id="filter-margin" type="number" min="0" max="100" placeholder="不限"><span>pp</span></label><label>條件關係<select id="filter-logic"><option value="and">全部符合（AND）</option><option value="or">任一符合（OR）</option></select></label><div class="filter-actions"><button id="filter-reset">清除條件</button><button id="filter-apply">套用條件</button></div><p id="filter-summary">以原始票數計算合計，不平均地區百分比。</p></section>',
    );
  ctx.$(".analysis-layout").append(ctx.$("#conditions"));
  ctx
    .$("#filter-logic")
    .closest("label")
    .insertAdjacentHTML(
      "afterend",
      '<label>與目前選取集合<select id="filter-mode"><option value="replace">取代目前選取</option><option value="intersection">交集：兩者皆符合</option><option value="union">聯集：任一集合</option><option value="highlight">只高亮，不改變範圍</option></select></label><p>交集與聯集以按下套用前的已選地區為基底；基底會隨連結保存。</p><div class="filter-group2"><b>第二組條件（選填）</b><label>得票率 ≥<input id="filter2-share" type="number" min="0" max="100" placeholder="不限"><span>%</span></label><label>投票率 ≥<input id="filter2-turnout" type="number" min="0" max="100" placeholder="不限"><span>%</span></label><label>差距 ≤<input id="filter2-margin" type="number" min="0" max="100" placeholder="不限"><span>pp</span></label><label>組內關係<select id="filter2-logic"><option value="and">全部符合（AND）</option><option value="or">任一符合（OR）</option></select></label><label>兩組之間<select id="filter-inter"><option value="or">任一組符合（OR）</option><option value="and">兩組皆符合（AND）</option></select></label></div>',
    );
  ctx
    .$("#filter-summary")
    .insertAdjacentHTML(
      "afterend",
      '<section class="filter-presets"><label>已存條件<select id="filter-presets"><option value="">選擇條件組</option></select></label><input id="filter-preset-name" aria-label="條件組名稱" placeholder="條件組名稱" maxlength="40"><div class="filter-actions"><button id="preset-save">儲存／重新命名</button><button id="preset-copy">另存副本</button><button id="preset-delete">刪除</button></div><p>條件組僅保存在目前瀏覽器本機；套用時使用目前縣市範圍。</p></section>',
    );
  ctx.filterPresets = [];
  try {
    const saved = JSON.parse(
      localStorage.getItem("atlas-filter-presets-v1") || "[]",
    );
    if (Array.isArray(saved))
      ctx.filterPresets = saved
        .filter(
          (p) =>
            typeof p.id === "string" && typeof p.name === "string" && p.spec,
        )
        .slice(0, 50);
  } catch {}
  function renderFilterPresets(selected = "") {
    const select = ctx.$("#filter-presets");
    select.innerHTML =
      '<option value="">選擇條件組</option>' +
      ctx.filterPresets
        .map(
          (p) =>
            '<option value="' +
            ctx.esc(p.id) +
            '">' +
            ctx.esc(p.name) +
            "</option>",
        )
        .join("");
    select.value = selected;
    try {
      localStorage.setItem(
        "atlas-filter-presets-v1",
        JSON.stringify(ctx.filterPresets),
      );
    } catch {
      ctx.toast("目前瀏覽器無法儲存條件組");
    }
  }
  function presetFromInputs() {
    const spec = {};
    for (const k of Object.keys(ctx.filterSpec))
      spec[k] = ctx.$("#filter-" + k).value;
    return spec;
  }
  function saveFilterPreset(copy) {
    const selected = ctx.$("#filter-presets").value,
      name =
        ctx.$("#filter-preset-name").value.trim() ||
        "條件組 " + (ctx.filterPresets.length + 1),
      existing = !copy && ctx.filterPresets.find((p) => p.id === selected),
      preset = {
        id: existing ? existing.id : String(Date.now()),
        name: copy ? name + " 副本" : name,
        spec: ctx.presetFromInputs(),
      };
    if (existing) Object.assign(existing, preset);
    else {
      if (ctx.filterPresets.length >= 50) {
        ctx.toast("最多可儲存50組條件");
        return;
      }
      ctx.filterPresets.push(preset);
    }
    ctx.$("#filter-preset-name").value = preset.name;
    ctx.renderFilterPresets(preset.id);
    ctx.toast("條件組已儲存於本機");
  }
  ctx.$("#preset-save").onclick = () => ctx.saveFilterPreset(false);
  ctx.$("#preset-copy").onclick = () => ctx.saveFilterPreset(true);
  ctx.$("#preset-delete").onclick = () => {
    const id = ctx.$("#filter-presets").value;
    ctx.filterPresets = ctx.filterPresets.filter((p) => p.id !== id);
    ctx.$("#filter-preset-name").value = "";
    ctx.renderFilterPresets();
  };
  ctx.$("#filter-presets").onchange = (ev) => {
    const preset = ctx.filterPresets.find((p) => p.id === ev.target.value);
    if (!preset) return;
    ctx.$("#filter-preset-name").value = preset.name;
    for (const k of Object.keys(ctx.filterSpec)) {
      const value =
        preset.spec[k] ??
        (k === "mode"
          ? "replace"
          : k === "logic"
            ? "and"
            : k === "candidate"
              ? "柯文哲"
              : "");
      ctx.$("#filter-" + k).value = value;
      ctx.filterSpec[k] = ctx.$("#filter-" + k).value;
    }
    ctx.applyConditions();
    ctx.lastDetail = "";
    ctx.updateUI();
  };
  ctx.renderFilterPresets();
  function setConditionsOpen(open) {
    if (open && !ctx.$("#groups-panel").hidden) ctx.setGroupsOpen(false);
    ctx.$("#conditions").hidden = !open;
    document.body.classList.toggle("conditions-open", open);
    ctx.$("#conditions-open").setAttribute("aria-expanded", open);
    if (ctx.data && !ctx.routeApplying) ctx.scheduleCanvasReflow();
  }
  ctx
    .$(".workspace-actions")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="groups-open" aria-expanded="false">A／B 地區對照</button>',
    );
  ctx
    .$(".analysis-layout")
    .insertAdjacentHTML(
      "beforeend",
      '<aside id="groups-panel" class="groups-panel" hidden><div class="filter-title"><b>A／B 地區對照</b><button id="groups-close" aria-label="關閉地區對照">×</button></div><p>選擇編輯組別後，在地圖或圖表點選地區。高亮不改變篩選與統計範圍；每個地區只能屬於一組。</p><div class="group-actions"><button id="group-a" aria-pressed="true">編輯 A 組</button><button id="group-b" aria-pressed="false">編輯 B 組</button></div><div id="group-results"></div><div class="group-actions"><button id="groups-clear">清除兩組</button><button id="groups-export">匯出比較 CSV</button><button id="groups-svg">圖表 SVG</button></div></aside>',
    );
  function setGroupsOpen(open) {
    if (open) {
      ctx.setConditionsOpen(false);
      ctx.state.brushEnabled = false;
    }
    ctx.$("#groups-panel").hidden = !open;
    document.body.classList.toggle("groups-open", open);
    ctx.$("#groups-open").setAttribute("aria-expanded", open);
    if (ctx.data && !ctx.routeApplying) {
      ctx.updateUI();
      ctx.updateHash();
    }
  }
  ctx.$("#groups-open").onclick = () =>
    ctx.setGroupsOpen(ctx.$("#groups-panel").hidden);
  ctx.$("#groups-close").onclick = () => ctx.setGroupsOpen(false);
  for (const g of ["a", "b"])
    ctx.$("#group-" + g).onclick = () => {
      ctx.activeGroup = g;
      ctx.renderGroups();
    };
  ctx.$("#groups-clear").onclick = () => {
    ctx.groupSelection = { a: [], b: [] };
    ctx.updateUI();
  };
  ctx.$("#groups-export").onclick = () => {
    const rows = ["a", "b"].flatMap((g) => {
      const r = ctx.groupAggregate(ctx.groupSelection[g]);
      return r.candidates.map((c) => [
        g.toUpperCase(),
        ctx.groupNames?.[g] || g.toUpperCase() + " 組",
        r.count,
        r.total,
        r.cast,
        r.eligible,
        r.turnout ?? "",
        c.name,
        c.party,
        c.votes,
        c.share ?? "",
      ]);
    });
    ctx.csvTable(
      [
        "組別",
        "組別名稱",
        "地區數",
        "有效票",
        "投票數",
        "選舉人數",
        "投票率",
        "候選人",
        "政黨",
        "票數",
        "得票率",
      ],
      rows,
      "臺灣選舉-AB地區合計.csv",
    );
  };
  function groupAggregate(keys) {
    const rs = keys.map((k) => ctx.records[k]).filter(ctx.valid),
      total = ctx.d3.sum(rs, (r) => r.total),
      eligible = ctx.d3.sum(rs, (r) => r.eligible),
      cast = ctx.d3.sum(rs, (r) => r.cast);
    return {
      count: rs.length,
      total,
      eligible,
      cast,
      turnout: eligible ? (cast / eligible) * 100 : null,
      candidates: ctx.records["00000/000"].candidates
        .map((c) => ({
          name: c.name,
          party: c.party,
          votes: ctx.d3.sum(
            rs,
            (r) => r.candidates.find((x) => x.name === c.name)?.votes || 0,
          ),
        }))
        .map((c) => ({ ...c, share: total ? (c.votes / total) * 100 : null })),
    };
  }
  function renderGroups() {
    if (!ctx.data || ctx.isLeg()) return;
    for (const g of ["a", "b"])
      ctx.$("#group-" + g).setAttribute("aria-pressed", ctx.activeGroup === g);
    const a = ctx.groupAggregate(ctx.groupSelection.a),
      b = ctx.groupAggregate(ctx.groupSelection.b),
      national = ctx.records["00000/000"],
      difference = (x, y) =>
        x == null || y == null ? "—" : ctx.sign(x - y) + " 個百分點";
    const values = [
      ["地區數", a.count, b.count, a.count - b.count],
      [
        "有效票",
        ctx.fmt(a.total),
        ctx.fmt(b.total),
        ctx.fmt(a.total - b.total),
      ],
      [
        "投票率",
        a.turnout == null ? "—" : ctx.pct(a.turnout),
        b.turnout == null ? "—" : ctx.pct(b.turnout),
        difference(a.turnout, b.turnout),
      ],
      ...a.candidates.map((c, i) => [
        c.name,
        c.share == null ? "—" : ctx.pct(c.share),
        b.candidates[i].share == null ? "—" : ctx.pct(b.candidates[i].share),
        difference(c.share, b.candidates[i].share),
      ]),
    ];
    ctx.$("#group-results").innerHTML =
      '<p class="group-overlap-note">A ' + a.count + ' 地區 · B ' + b.count + ' 地區 · 重疊 0 地區。加入另一組時會從原組移出。</p>' +
      (!a.count || !b.count ? '<p class="group-empty-guidance">' +
        (!a.count && !b.count ? "先選擇 A 組，在圖上點選地區；再編輯 B 組。" : "請為" + (!a.count ? " A " : " B ") + "組加入地區，以計算組間差。") + '</p>' : "") +
      '<table class="analysis-table group-table"><caption>得票率以各組候選人票數加總 ÷ 該組有效票；投票率以投票數加總 ÷ 選舉人數加總</caption><thead><tr><th>指標</th><th>' + ctx.esc(ctx.groupNames?.a || "A 組") + '</th><th>' + ctx.esc(ctx.groupNames?.b || "B 組") + '</th><th>A−B</th></tr></thead><tbody>' +
      values
        .map(
          (row) =>
            "<tr>" +
            row
              .map((v, i) =>
                i
                  ? "<td>" + ctx.esc(String(v)) + "</td>"
                  : "<th>" + ctx.esc(v) + "</th>",
              )
              .join("") +
            "</tr>",
        )
        .join("") +
      "</tbody></table><p>比率以票數加總後計算；組別保留全部已選地區，即使其他篩選隱藏其中部分地區。全國有效票 " +
      ctx.fmt(national.total) +
      "。</p>" +
      ["a", "b"]
        .map(
          (g) =>
            '<details class="group-members"><summary>' +
            ctx.esc(ctx.groupNames?.[g] || g.toUpperCase() + " 組") +
            " 地區（" +
            ctx.groupSelection[g].length +
            "）</summary>" +
            ctx.groupSelection[g]
              .map(
                (k) =>
                  '<button data-group-remove="' +
                  ctx.esc(k) +
                  '" data-group="' +
                  g +
                  '">' +
                  ctx.esc(ctx.areaName(ctx.records[k], true)) +
                  " ×</button>",
              )
              .join("") +
            "</details>",
        )
        .join("");
    ctx.renderGroupChart(a, b, national);
    ctx.$$("[data-group-remove]").forEach(
      (button) =>
        (button.onclick = () => {
          const g = button.dataset.group;
          ctx.groupSelection[g] = ctx.groupSelection[g].filter(
            (k) => k !== button.dataset.groupRemove,
          );
          ctx.updateUI();
        }),
    );
  }
  function renderGroupChart(a, b, national) {
    const host = ctx.$("#group-results");
    host.insertAdjacentHTML(
      "afterbegin",
      '<svg id="group-chart" viewBox="0 0 270 236" role="img" aria-label="A及B組加權得票率比較，虛線為全國平均"></svg>',
    );
    const svg = ctx.d3.select("#group-chart"),
      x = ctx.d3.scaleLinear().domain([0, 100]).range([25, 235]);
    svg
      .append("text")
      .attr("x", 0)
      .attr("y", 14)
      .attr("class", "scatter-label")
      .text("A／B 加權得票率 · 虛線為全國");
    svg
      .append("g")
      .attr("class", "scatter-axis")
      .attr("transform", "translate(0,219)")
      .call(
        ctx.d3
          .axisBottom(x)
          .ticks(4)
          .tickFormat((v) => v + "%"),
      );
    a.candidates.forEach((c, i) => {
      const y = 39 + i * 59,
        other = b.candidates[i],
        baseline = ctx.shareOf(national, c.name);
      svg
        .append("text")
        .attr("x", 0)
        .attr("y", y)
        .attr("font-size", 12)
        .attr("fill", ctx.color(c.party))
        .text(c.name);
      svg
        .append("line")
        .attr("x1", x(baseline))
        .attr("x2", x(baseline))
        .attr("y1", y + 5)
        .attr("y2", y + 38)
        .attr("stroke", "#7e8c96")
        .attr("stroke-dasharray", "3 2");
      for (const [label, value, dy, fill] of [
        ["A", c.share, 10, "#d59224"],
        ["B", other.share, 26, "#842cb1"],
      ]) {
        svg
          .append("text")
          .attr("x", 0)
          .attr("y", y + dy + 7)
          .attr("font-size", 12)
          .attr("fill", fill)
          .text(label);
        svg
          .append("rect")
          .attr("class", "group-share-bar")
          .attr("data-group", label.toLowerCase())
          .attr("data-candidate", c.name)
          .attr("data-share", value ?? "")
          .attr("x", x(0))
          .attr("y", y + dy)
          .attr("width", value == null ? 0 : x(value) - x(0))
          .attr("height", 10)
          .attr("fill", fill)
          .attr("opacity", 0.7);
        svg
          .append("text")
          .attr("x", value == null ? x(0) + 5 : x(value) + 5)
          .attr("y", y + dy + 9)
          .attr("font-size", 12)
          .attr("fill", "#394856")
          .text(value == null ? "—" : value.toFixed(2) + "%");
      }
    });
  }
  ctx.$("#groups-svg").onclick = () =>
    ctx.saveBlob(
      new Blob(
        [
          ctx.standaloneSVGPanel(
            ctx.$("#group-chart"),
            "2024 總統 · A／B地區加權比較",
            (ctx.groupNames?.a || "A組") + " " +
              ctx.groupSelection.a.length +
              " 地區，" + (ctx.groupNames?.b || "B組") + " " +
              ctx.groupSelection.b.length +
              " 地區；各組先加總票數再計算比率",
          ),
        ],
        { type: "image/svg+xml;charset=utf-8" },
      ),
      "臺灣選舉-AB比較.svg",
    );
  function updateGroupMarks() {
    if (!ctx.data) return;
    ctx.renderMapGroups();
    if (ctx.isLeg()) return;
    for (const el of ctx.$$("#map .geo,#scatter [data-region-key]")) {
      const key = el.dataset.regionKey || el.dataset.key;
      el.classList.toggle("group-a", ctx.groupSelection.a.includes(key));
      el.classList.toggle("group-b", ctx.groupSelection.b.includes(key));
      const highlight =
        ctx.hasConditions() && ctx.filterSpec.mode === "highlight";
      el.classList.toggle(
        "condition-highlight",
        highlight && ctx.conditionHighlight.includes(key),
      );
      el.classList.toggle(
        "condition-muted",
        highlight && !ctx.conditionHighlight.includes(key),
      );
    }
    ctx.renderGroups();
  }
  function selectGroupTarget(ev) {
    if (ctx.$("#groups-panel").hidden || ctx.isLeg()) return;
    const el = ev.target.closest?.("#map .geo,#scatter [data-region-key]");
    if (!el) return;
    const key = el.dataset.regionKey || el.dataset.key,
      r = ctx.records[key];
    if (!ctx.valid(r)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const first = [...ctx.groupSelection.a, ...ctx.groupSelection.b][0],
      level = r.town === "000" ? "county" : "town";
    if (
      first &&
      (ctx.records[first].town === "000" ? "county" : "town") !== level
    ) {
      ctx.toast("A／B 組須使用同一層級；請先清除兩組。");
      return;
    }
    if (!first && !ctx.filterActive) ctx.state.level = level;
    const list = ctx.groupSelection[ctx.activeGroup],
      other = ctx.activeGroup === "a" ? "b" : "a",
      index = list.indexOf(key);
    if (index >= 0) list.splice(index, 1);
    else {
      list.push(key);
      ctx.groupSelection[other] = ctx.groupSelection[other].filter(
        (k) => k !== key,
      );
    }
    ctx.updateUI();
  }
  document.addEventListener("click", ctx.selectGroupTarget, true);
  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "Enter" || ev.key === " ") ctx.selectGroupTarget(ev);
    },
    true,
  );
  function applyConditions(capture = true) {
    if (!ctx.data || ctx.isLeg()) return;
    const { g1, g2 } = ctx.conditionGroups();
    ctx.filterActive = !!(g1 || g2) && ctx.filterSpec.mode !== "highlight";
    ctx.conditionHighlight = [];
    if (capture)
      ctx.conditionBase = ctx.state.brushed.filter(
        (k) => ctx.valid(ctx.records[k]) && ctx.records[k].town !== "000",
      );
    if (!g1 && !g2) {
      ctx.state.brushed = ctx.filterSpec.mode === "highlight" ? ctx.conditionBase.slice() : [];
      return;
    }
    ctx.state.level = "town";
    const { rs, matches, base, result: evaluated } = ctx.evaluateConditions();
    if (ctx.filterSpec.mode === "highlight") {
      ctx.conditionHighlight = matches;
      ctx.state.brushed = base;
    } else ctx.state.brushed = evaluated;
    if (!ctx.state.inspection) ctx.state.key = "";
    // Empty selection is explicit: never silently fall back to all regions.
    const result =
      ctx.filterSpec.mode === "highlight" ? matches : ctx.state.brushed;
    const mode = ctx.filterSpec.mode;
    const effect = {
      highlight: "僅高亮，統計範圍維持原樣",
      intersection: "分析範圍為原選取與符合條件的交集",
      union: "分析範圍包含原選取與所有符合條件的地區",
      replace: "分析範圍改為符合條件的地區",
    }[mode];
    ctx.$("#filter-summary").textContent =
      "符合 " + matches.length + " / " + rs.length + " 地區 · " + effect + "。" +
      (mode === "highlight" ? " 高亮 " : " 分析範圍 ") + result.length +
      " 地區，有效票 " + ctx.fmt(ctx.d3.sum(result, (k) => ctx.records[k].total)) + "。";
    document.body.classList.toggle(
      "empty-filter",
      ctx.filterActive && !ctx.state.brushed.length,
    );
  }
  ctx.$("#conditions-open").onclick = () =>
    ctx.setConditionsOpen(ctx.$("#conditions").hidden);
  ctx.$("#conditions-close").onclick = () => ctx.setConditionsOpen(false);
  ctx.$("#filter-apply").onclick = () => {
    const invalid = [...ctx.$("#conditions").querySelectorAll('input[type="number"]')].find(input => !input.validity.valid);
    if (invalid) { invalid.reportValidity(); return; }
    const startNewFilter = !ctx.hasConditions();
    for (const k of Object.keys(ctx.filterSpec))
      ctx.filterSpec[k] = ctx.$("#filter-" + k).value;
    for (const k of Object.keys(ctx.filterSpec2))
      ctx.filterSpec2[k] = ctx.$("#filter2-" + k).value;
    ctx.filterInter = ctx.$("#filter-inter").value;
    ctx.applyConditions(startNewFilter);
    ctx.lastDetail = "";
    ctx.updateUI();
  };
  ctx.$("#filter-reset").onclick = () => {
    const previousSelection = ctx.hasConditions() ? ctx.conditionBase.slice() : ctx.state.brushed;
    for (const k of ["share", "turnout", "margin"]) {
      ctx.filterSpec[k] = "";
      ctx.$("#filter-" + k).value = "";
      ctx.filterSpec2[k] = "";
      ctx.$("#filter2-" + k).value = "";
    }
    ctx.filterInter = "or";
    ctx.$("#filter-inter").value = "or";
    ctx.filterActive = false;
    ctx.conditionBase = [];
    ctx.conditionHighlight = [];
    ctx.state.brushed = previousSelection;
    document.body.classList.remove("empty-filter");
    ctx.lastDetail = "";
    ctx.updateUI();
  };
  ctx.$("#dual-view").onclick = () => {
    ctx.dualMode = !ctx.dualMode;
    ctx.dualFocus = "both";
    if (ctx.dualMode) {
      document.body.classList.add("detail-closed");
      if (ctx.state.chart === "map") ctx.state.chart = "ternary";
    }
    ctx.applyDualLayout();
    ctx.$("#dual-view").setAttribute("aria-pressed", ctx.dualMode);
    ctx.updateUI();
    ctx.buildMap();
    ctx.drawScatter();
  };
  function parseAnalysisRoute(p) {
    ctx.dualMode = p.get("dual") === "1" && !ctx.isLeg();
    if (ctx.dualMode && !p.has("detail"))
      document.body.classList.add("detail-closed");
    ctx.dualSplit = [40, 50, 60].includes(+p.get("split"))
      ? +p.get("split")
      : defaultDualSplit;
    ctx.dualFocus = ["map", "chart"].includes(p.get("focus"))
      ? p.get("focus")
      : "both";
    ctx.groupSelection = { a: [], b: [] };
    if (!ctx.isLeg())
      for (const g of ["a", "b"])
        ctx.groupSelection[g] = [
          ...new Set((p.get("group-" + g) || "").split(",")),
        ]
          .filter(
            (k) =>
              ctx.valid(ctx.records[k]) &&
              (ctx.state.level === "county"
                ? ctx.records[k].town === "000"
                : ctx.records[k].town !== "000") &&
              !ctx.groupSelection.a.includes(k),
          )
          .slice(0, 368);
    ctx.setGroupsOpen(p.get("groups") === "1" && !ctx.isLeg());
    ctx.applyDualLayout();
    ctx.$("#dual-view").setAttribute("aria-pressed", ctx.dualMode);
    for (const k of ["share", "turnout", "margin"])
      ctx.filterSpec[k] =
        p.has("f-" + k) && Number.isFinite(+p.get("f-" + k))
          ? String(Math.max(0, Math.min(100, +p.get("f-" + k))))
          : "";
    ctx.filterSpec.candidate = ["柯文哲", "賴清德", "侯友宜"].includes(
      p.get("f-candidate"),
    )
      ? p.get("f-candidate")
      : "柯文哲";
    ctx.filterSpec.logic = p.get("f-logic") === "or" ? "or" : "and";
    for (const k of ["share", "turnout", "margin"])
      ctx.filterSpec2[k] =
        p.has("f2-" + k) && Number.isFinite(+p.get("f2-" + k))
          ? String(Math.max(0, Math.min(100, +p.get("f2-" + k))))
          : "";
    ctx.filterSpec2.logic = p.get("f2-logic") === "or" ? "or" : "and";
    ctx.filterInter = p.get("f-inter") === "and" ? "and" : "or";
    ctx.filterSpec.mode = ["intersection", "union", "highlight"].includes(
      p.get("f-mode"),
    )
      ? p.get("f-mode")
      : "replace";
    ctx.conditionBase = (p.get("f-base") || "")
      .split(",")
      .filter(
        (k) => ctx.valid(ctx.records[k]) && ctx.records[k].town !== "000",
      );
    for (const k of Object.keys(ctx.filterSpec))
      ctx.$("#filter-" + k).value = ctx.filterSpec[k];
    for (const k of Object.keys(ctx.filterSpec2))
      ctx.$("#filter2-" + k).value = ctx.filterSpec2[k];
    ctx.$("#filter-inter").value = ctx.filterInter;
    ctx.filterActive =
      ctx.hasConditions() && ctx.filterSpec.mode !== "highlight";
    ctx.conditionHighlight = [];
    if (ctx.hasConditions()) {
      const incoming = ctx.state.brushed.slice();
      ctx.applyConditions(false);
      if (p.has("selection") && ctx.filterSpec.mode === "replace")
        ctx.state.brushed = ctx.state.brushed.filter((k) =>
          incoming.includes(k),
        );
    }
  }
  function serializeAnalysisRoute(p) {
    if (ctx.dualMode) {
      p.set("dual", "1");
      p.set("split", ctx.dualSplit);
      if (ctx.dualFocus !== "both") p.set("focus", ctx.dualFocus);
    }
    if (!ctx.isLeg()) {
      for (const g of ["a", "b"])
        if (ctx.groupSelection[g].length)
          p.set("group-" + g, ctx.groupSelection[g].join(","));
      if (!ctx.$("#groups-panel").hidden) p.set("groups", "1");
    }
    if (ctx.hasConditions()) {
      for (const [k, v] of Object.entries(ctx.filterSpec))
        if (v !== "") p.set("f-" + k, v);
      for (const [k, v] of Object.entries(ctx.filterSpec2))
        if (v !== "") p.set("f2-" + k, v);
      if (ctx.filterSpec2.logic !== "and") p.set("f2-logic", ctx.filterSpec2.logic);
      if (ctx.filterInter !== "or") p.set("f-inter", ctx.filterInter);
      if (ctx.conditionBase.length)
        p.set("f-base", ctx.conditionBase.join(","));
    }
  }
  function prepareAnalysisState() {
    if (ctx.isLeg()) {
      ctx.dualMode = false;
      ctx.filterActive = false;
      ctx.conditionHighlight = [];
      for (const key of ["share", "turnout", "margin"])
        ctx.filterSpec[key] = "";
      document.body.classList.remove("dual-view", "empty-filter");
    }
    return !(ctx.filterActive && !ctx.state.brushed.length);
  }
  function renderEmptyAnalysis() {
    document.body.dataset.chart = ctx.state.chart;
    document.body.dataset.election = ctx.state.e;
    ctx.renderScopeSummary();
    ctx.$("#finding").textContent = "目前條件沒有符合的地區。 ";
    const clear = document.createElement("button");
    clear.className = "finding-link";
    clear.textContent = "清除篩選";
    clear.onclick = () => ctx.$("#filter-reset").click();
    ctx.$("#finding").append(clear);
    ctx.$("#legend").innerHTML =
      '<div class="legend-title">篩選結果 · 無符合地區</div><div class="legend-foot">調整或清除條件後重新顯示結果。</div>';
    if (ctx.dualMode) {
      ctx.$("#dual-map-legend").hidden = false;
      ctx.$("#dual-map-legend").innerHTML =
        '<div class="legend-title">地圖 · 無符合地區</div>';
    }
    ctx.$("#detail-title").textContent = "沒有符合地區";
    ctx.$("#detail-stats").innerHTML = "";
    ctx.$("#detail-result").innerHTML = "";
    ctx.$("#detail-chart").innerHTML = "";
    ctx.$("#region-list").innerHTML = "";
    ctx.$("#list-count").textContent = "0";
    ctx.$("#scatter").innerHTML = "";
    ctx.$("#export-scope").options[1].disabled = true;
    ctx
      .$$("button[data-chart]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.chart === ctx.state.chart),
      );
    ctx.updateHash();
  }
  function presentAnalysis() {
    ctx.$(".map-workspace").dataset.mapMetric = ctx.state.metric;
    ctx.renderDualMapLegend();
    ctx.$("#dual-metric").value = ctx.state.metric;
    for (const key of Object.keys(ctx.EXTRA_METRICS))
      if (!ctx.$('#dual-metric option[value="' + key + '"]'))
        ctx
          .$("#dual-metric")
          .insertAdjacentHTML(
            "beforeend",
            '<option value="' +
              key +
              '">' +
              ctx.EXTRA_METRICS[key].title +
              "</option>",
          );
    ctx.$("#dual-metric").value = ctx.state.metric;
    ctx.$("#dual-candidate").value = ctx.state.candidate;
    ctx.$("#dual-other").value = ctx.state.otherCandidate || "侯友宜";
    ctx.$("#dual-other-label").hidden = ctx.state.metric !== "difference";
    ctx.$("#dual-candidate").hidden = ![
      "share",
      "advantage",
      "difference",
      "bivariate",
    ].includes(ctx.state.metric);
    ctx.$("button[data-chart=map]").disabled = ctx.dualMode;
    ctx.$("#dual-view").disabled = ctx.isLeg();
    ctx.$("#conditions-open").disabled = ctx.isLeg();
    if (ctx.filterActive) {
      ctx.$("#scope-summary").textContent =
        "條件篩選 · " + ctx.state.brushed.length + " 個鄉鎮市區";
      const conditions = [
        ctx.filterSpec.share !== ""
          ? ctx.filterSpec.candidate + " ≥" + ctx.filterSpec.share + "%"
          : "",
        ctx.filterSpec.turnout !== ""
          ? "投票率 ≥" + ctx.filterSpec.turnout + "%"
          : "",
        ctx.filterSpec.margin !== ""
          ? "差距 ≤" + ctx.filterSpec.margin + "pp"
          : "",
      ].filter(Boolean);
      ctx.$("#clear-brush").textContent =
        conditions.join(" · ") +
        " · " +
        ctx.filterSpec.logic.toUpperCase() +
        " · " +
        ctx.state.brushed.length +
        " 地區 ×";
      ctx.$("#clear-brush").title =
        "清除條件篩選；有效票合計 " +
        ctx.fmt(
          ctx.d3.sum(ctx.state.brushed, (k) => ctx.records[k]?.total || 0),
        );
    }
    if (ctx.hasConditions() && ctx.filterSpec.mode === "highlight") {
      ctx.$("#clear-brush").hidden = false;
      ctx.$("#clear-brush").textContent =
        "只高亮 " + ctx.conditionHighlight.length + " 地區 · 範圍未改變 ×";
      ctx.$("#scope-summary").title = "高亮不改變分析範圍與合計";
    }
    if (
      ctx.hasConditions() ||
      ctx.groupSelection.a.length ||
      ctx.groupSelection.b.length
    )
      ctx.$$("button[data-level]").forEach((b) => {
        b.disabled = true;
        b.title = "清除篩選和 A／B 組後可切換地理層級";
      });
    ctx.renderScopeSummary();
  }
  ctx.clearingBrushBefore = ctx.$("#clear-brush").onclick;
  ctx.$("#clear-brush").onclick = () =>
    ctx.hasConditions()
      ? ctx.$("#filter-reset").click()
      : ctx.clearingBrushBefore();
  function aggregateCurrentSelection() {
    if (ctx.isLeg() || !ctx.state.brushed.length) return null;
    const rs = ctx.state.brushed.map((k) => ctx.records[k]).filter(ctx.valid),
      total = ctx.d3.sum(rs, (r) => r.total),
      cast = ctx.d3.sum(rs, (r) => r.cast),
      eligible = ctx.d3.sum(rs, (r) => r.eligible);
    if (!total) return null;
    const candidates = ctx.records["00000/000"].candidates
      .map((c) => ({
        ...c,
        elected: false,
        votes: ctx.d3.sum(
          rs,
          (r) => r.candidates.find((x) => x.name === c.name)?.votes || 0,
        ),
      }))
      .sort((a, b) => b.votes - a.votes);
    candidates.forEach((c) => (c.share = (c.votes / total) * 100));
    return {
      aggregateName: "選取合計（" + rs.length + "地區）",
      total,
      cast,
      eligible,
      turnout: (cast / eligible) * 100,
      margin: ((candidates[0].votes - candidates[1].votes) / total) * 100,
      candidates,
    };
  }
}
