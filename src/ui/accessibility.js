/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    announceAnalysisState,
    presentAccessibility,
    csvTable,
    renderComparisonExport,
    addNoDataPattern,
    resetElectionAnalysis,
  });
  // A persistent live region reports committed analysis state without moving focus.
  document.body.insertAdjacentHTML(
    "beforeend",
    '<p id="analysis-status" class="accessibility-only" role="status" aria-live="polite" aria-atomic="true"></p>',
  );
  ctx
    .$("#table-content table")
    .insertAdjacentHTML(
      "afterbegin",
      '<caption class="accessibility-only">目前分析範圍的選舉結果。地區、候選人及政黨均以文字列示；票數、得票率和差距不依賴顏色辨識。</caption>',
    );
  ctx.accessibilityTimer = 0;
  function announceAnalysisState() {
    const election = ctx.$("#election").selectedOptions[0]?.textContent || "",
      chart =
        ctx.$('button[data-chart="' + ctx.state.chart + '"]')?.textContent ||
        "",
      scope = ctx.$("#scope-summary").textContent.replace(/\s+/g, " ").trim(),
      region = ctx.rec();
    const detail =
      ctx.state.key && region
        ? ctx.areaName(region, true) +
          "；" +
          region.candidates
            .slice(0, 3)
            .map(
              (c) =>
                c.name +
                " " +
                c.party +
                " " +
                ctx.fmt(c.votes) +
                "票，" +
                ctx.pct(c.share),
            )
            .join("；")
        : "";
    const filter = ctx.filterActive ? ctx.$("#filter-summary").textContent : "";
    const summary = [election, chart, scope, detail, filter]
      .filter(Boolean)
      .join("。");
    clearTimeout(ctx.accessibilityTimer);
    ctx.accessibilityTimer = setTimeout(() => {
      const status = ctx.$("#analysis-status");
      if (status.textContent !== summary) status.textContent = summary;
    }, 180);
  }
  function presentAccessibility() {
    ctx.announceAnalysisState();
    if (ctx.data) {
      document.body.classList.remove("loading");
      document.body.setAttribute("aria-busy", "false");
      ctx.$(".toolbar").inert = false;
      ctx.$(".analysis-layout").inert = false;
    }
    ctx.$$("button[data-chart]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.chart === ctx.state.chart);
      b.title = b.disabled
        ? b.dataset.chart === "map" && ctx.dualMode
          ? "雙視圖已顯示地圖；可使用放大地圖"
          : "此圖適用於三組全國相同候選人的總統選舉"
        : "";
    });
    ctx
      .$$("button[data-level]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.level === ctx.state.level),
      );
    for (const id of ["dual-view", "conditions-open"])
      ctx.$("#" + id).title = ctx.isLeg() ? "目前提供總統選舉的跨地區分析" : "";
    ctx.$("#map-tooltip").setAttribute("role", "tooltip");
  }
  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "Escape")
        ev.atlasOverlay =
          !!document.querySelector("dialog[open]") ||
          !ctx.$("#conditions").hidden ||
          !ctx.$("#groups-panel").hidden ||
          document.body.classList.contains("list-open") ||
          !!ctx.state.drawer ||
          ev.target.matches?.("input,select,textarea");
    },
    true,
  );
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      ctx.setConditionsOpen(false);
      if (!ctx.$("#groups-panel").hidden) ctx.setGroupsOpen(false);
      if (!ev.atlasOverlay) {
        if (ctx.state.inspection) {
          ctx.clearInspection();
          return;
        }
        ctx.filterActive = false;
        for (const k of ["share", "turnout", "margin"]) {
          ctx.filterSpec[k] = "";
          ctx.$("#filter-" + k).value = "";
        }
        document.body.classList.remove("empty-filter");
        ctx.selectedMember = "";
        ctx.lastDetail = "";
        ctx.resetSelection();
      }
    }
  });
  document.addEventListener("change", () => ctx.updateHash());
  document.addEventListener("click", () => ctx.updateHash());
  document.addEventListener(
    "keydown",
    (ev) => {
      if (!["Enter", " "].includes(ev.key)) return;
      for (const attr of ["data-region-key", "data-member-id"]) {
        const key = ev.target.getAttribute?.(attr);
        if (key)
          setTimeout(
            () =>
              document
                .querySelector("[" + attr + '="' + CSS.escape(key) + '"]')
                ?.focus(),
            0,
          );
      }
    },
    true,
  );
  function csvTable(header, rows, filename) {
    const csv =
      "\ufeff" +
      [header, ...rows]
        .map((r) =>
          r
            .map((value) => {
              let text = String(value ?? "");
              if (typeof value === "string" && /^[=+@-]/.test(text))
                text = "'" + text;
              return '"' + text.replaceAll('"', '""') + '"';
            })
            .join(","),
        )
        .join("\r\n");
    ctx.saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
  }
  ctx
    .$("#contribution-dialog .dialog-header")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="export-contribution">匯出貢獻CSV</button>',
    );
  ctx.$("#export-contribution").onclick = () =>
    ctx.csvTable(
      [
        "地區ID",
        "地區",
        "候選人A",
        "候選人B",
        "A票數",
        "全國貢獻(%)",
        "累積貢獻(%)",
        "A-B淨領先票",
        "較全國優勢(pp)",
      ],
      ctx
        .contributionRows()
        .map((d) => [
          ctx.keyOf(d.r),
          ctx.areaName(d.r, true),
          ctx.$("#contribution-a").value,
          ctx.$("#contribution-b").value,
          d.av,
          d.contribution,
          d.cumulative,
          d.net,
          d.advantage,
        ]),
      "臺灣選舉-貢獻分析.csv",
    );
  function renderComparisonExport() {
    if (
      ctx.state.drawer === "compare" &&
      (ctx.state.pins.length || ctx.aggregateCurrentSelection())
    ) {
      ctx
        .$("#compare-content")
        .insertAdjacentHTML(
          "beforeend",
          '<button id="export-comparison">匯出目前比較CSV</button>',
        );
      ctx.$("#export-comparison").onclick = () => {
        const rs = ctx.comparisonRecords();
        ctx.csvTable(
          [
            "地區ID",
            "地區",
            "候選人",
            "政黨",
            "票數",
            "得票率",
            "有效票",
            "投票率",
            "前兩名差距(pp)",
          ],
          rs.flatMap((r) =>
            r.candidates.map((c) => [
              r.aggregateName ? "selection" : ctx.keyOf(r),
              r.aggregateName || ctx.areaName(r, true),
              c.name,
              c.party,
              c.votes,
              (c.votes / r.total) * 100,
              r.total,
              ctx.turnoutOf(r),
              ctx.marginOf(r),
            ]),
          ),
          "臺灣選舉-地區比較.csv",
        );
      };
    }
  }
  function addNoDataPattern(svg) {
    const defs = svg
        .selectAll("defs.no-data-defs")
        .data([0])
        .join("defs")
        .attr("class", "no-data-defs"),
      id = svg.attr("id") + "-missing";
    const pattern = defs
      .selectAll("pattern")
      .data([0])
      .join("pattern")
      .attr("id", id)
      .attr("width", 6)
      .attr("height", 6)
      .attr("patternUnits", "userSpaceOnUse");
    pattern
      .selectAll("rect")
      .data([0])
      .join("rect")
      .attr("width", 6)
      .attr("height", 6)
      .attr("fill", "#e0e4e7");
    pattern
      .selectAll("path")
      .data([0])
      .join("path")
      .attr("d", "M-1,1L1,-1M0,6L6,0M5,7L7,5")
      .attr("stroke", "#adb7bf")
      .attr("stroke-width", 1);
  }

  function resetElectionAnalysis() {
    ctx.$("#filter-summary").textContent = "尚未套用條件";
    ctx.selectedMember = "";
    ctx.filterActive = false;
    ctx.conditionBase = [];
    ctx.conditionHighlight = [];
    ctx.dualMode = false;
    ctx.dualFocus = "both";
    ctx.groupSelection = { a: [], b: [] };
    ctx.setGroupsOpen(false);
    ctx.setConditionsOpen(false);
    ctx.applyDualLayout();
    document.body.classList.remove("empty-filter");
    for (const k of ["share", "turnout", "margin"]) {
      ctx.filterSpec[k] = "";
      ctx.$("#filter-" + k).value = "";
    }
  }
}
