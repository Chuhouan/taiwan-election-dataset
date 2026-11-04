/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    nationalHistoryExportXML,
    historyPartyColor,
    renderHistory,
    openNationalHistory,
    parseNationalHistoryRoute,
    serializeNationalHistoryRoute,
  });
  /* National presidential history is loaded only when the reader opens it. */
  ctx.historyAsset = null;
  ctx.historyYear = 2024;
  ctx.historyMetric = "winner";
  ctx
    .$(".app-header nav")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="history-open">歷史選舉</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="history-dialog" aria-labelledby="history-title"><header class="history-header"><div><span>1996 — 2024 · 全國資料</span><h2 id="history-title">總統直選歷屆結果</h2></div><button id="history-close" aria-label="關閉歷屆總統">×</button></header><div class="history-body"><div class="history-topline"><div><b>1996—2024 年全國結果</b><p>得票率與投票率分別採用各屆有效票、選舉人數為分母。</p></div><label>觀察指標<select id="history-metric"><option value="winner">當選得票率</option><option value="turnout">投票率</option><option value="margin">前兩名差距</option><option value="structure">候選人得票結構</option></select></label></div><div id="history-years" class="history-years" aria-label="選舉年份"></div><div class="history-grid"><section class="history-chart-panel"><div class="history-chart-heading"><b id="history-chart-title"></b><span id="history-chart-unit"></span></div><svg id="history-chart" viewBox="0 0 900 430" role="img" aria-label="歷屆總統選舉全國統計圖"></svg><p id="history-method" class="history-method"></p></section><aside id="history-detail" class="history-detail"></aside></div><footer class="history-source">資料：<a href="https://db.cec.gov.tw/ElecTable" target="_blank" rel="noopener">中央選舉委員會選舉資料庫 ↗</a> · 全国票數與縣市加總核對；2008、2012、2024另抽查中選會公告。僅比較全國，未假設歷史行政區對應。</footer></div></dialog>`,
  );
  ctx
    .$("#history-close")
    .insertAdjacentHTML(
      "beforebegin",
      '<div class="history-downloads"><button id="history-csv">CSV</button><button id="history-svg">SVG</button><button id="history-png">PNG</button></div>',
    );
  ctx.$("#history-csv").onclick = () => {
    if (!ctx.historyAsset) return;
    ctx.csvTable(
      [
        "年份",
        "候選人",
        "政黨",
        "票數",
        "得票率",
        "有效票",
        "投票數",
        "選舉人數",
        "投票率",
        "全國當選",
      ],
      ctx.historyAsset.elections.flatMap((e) =>
        e.candidates.map((c) => [
          e.year,
          c.name,
          c.party,
          c.votes,
          c.share,
          e.validVotes,
          e.cast,
          e.eligible,
          e.turnout,
          c.elected ? "是" : "否",
        ]),
      ),
      "臺灣總統1996-2024全國結果.csv",
    );
  };
  function nationalHistoryExportXML() {
    if (!ctx.historyAsset) return null;
    return ctx.standaloneSVGPanel(
      ctx.$("#history-chart"),
      "臺灣總統直選 · " + ctx.$("#history-chart-title").textContent,
      "1996–2024 · 全國統計；各屆分母詳見CSV",
    );
  }
  ctx.$("#history-svg").onclick = () => {
    const xml = ctx.nationalHistoryExportXML();
    if (xml)
      ctx.saveBlob(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        "臺灣總統歷屆-" +
          ctx.$("#history-metric").selectedOptions[0].textContent +
          ".svg",
      );
  };
  ctx.$("#history-png").onclick = () => {
    const xml = ctx.nationalHistoryExportXML();
    if (xml)
      ctx.downloadPNG(
        xml,
        "臺灣總統歷屆-" +
          ctx.$("#history-metric").selectedOptions[0].textContent,
      );
  };
  function historyPartyColor(p) {
    if (p.includes("民主進步")) return "#16804f";
    if (p.includes("國民黨")) return "#2758b5";
    if (p.includes("民眾黨")) return "#36a8af";
    if (p.includes("親民黨")) return "#d3873b";
    if (p.includes("新黨")) return "#a18a37";
    return "#7b8792";
  }
  function renderHistory() {
    if (!ctx.historyAsset) return;
    const years = ctx.historyAsset.elections,
      selected = years.find((d) => d.year === ctx.historyYear) || years.at(-1);
    ctx.historyYear = selected.year;
    ctx.$("#history-years").innerHTML = years
      .map(
        (d) =>
          '<button data-history-year="' +
          d.year +
          '" aria-pressed="' +
          (d.year === ctx.historyYear) +
          '"><span>' +
          d.year +
          '</span><i style="background:' +
          ctx.historyPartyColor(d.candidates[0].party) +
          '"></i></button>',
      )
      .join("");
    ctx.$$("[data-history-year]").forEach(
      (b) =>
        (b.onclick = () => {
          ctx.historyYear = +b.dataset.historyYear;
          ctx.renderHistory();
        }),
    );
    const e = selected,
      w = e.candidates[0];
    ctx.$("#history-detail").innerHTML =
      '<div class="history-detail-year">' +
      e.year +
      "</div><h3>" +
      ctx.esc(w.name) +
      "</h3><p>" +
      ctx.esc(w.party) +
      ' · 全國當選</p><div class="history-big">' +
      ctx.pct(w.share) +
      "</div><p>" +
      ctx.fmt(w.votes) +
      " 票　／　" +
      ctx.fmt(e.validVotes) +
      ' 有效票</p><div class="history-detail-stats"><div><small>投票率</small><b>' +
      ctx.pct(e.turnout) +
      "</b></div><div><small>前兩名差距</small><b>" +
      e.margin.toFixed(2) +
      ' pp</b></div></div><div class="history-candidates">' +
      e.candidates
        .map(
          (c) =>
            '<div><span><i style="background:' +
            ctx.historyPartyColor(c.party) +
            '"></i>' +
            ctx.esc(c.name) +
            "</span><b>" +
            ctx.pct(c.share) +
            '</b></div><div class="history-track"><i style="width:' +
            c.share +
            "%;background:" +
            ctx.historyPartyColor(c.party) +
            '"></i></div>',
        )
        .join("") +
      '</div><p class="history-note">投票 ' +
      ctx.fmt(e.cast) +
      " 人／選舉人 " +
      ctx.fmt(e.eligible) +
      " 人</p>";
    const svg = ctx.d3.select("#history-chart"),
      chartWidth = Math.max(600, ctx.$("#history-chart").clientWidth),
      chartHeight = 400;
    svg.attr("viewBox", "0 0 " + chartWidth + " " + chartHeight);
    svg.selectAll("*").remove();
    const x = ctx.d3
        .scalePoint()
        .domain(years.map((d) => d.year))
        .range([85, chartWidth - 35]),
      bottom = 330,
      top = 32;
    const metric = {
      winner: "當選得票率",
      turnout: "投票率",
      margin: "前兩名差距",
      structure: "各候選人得票結構",
    }[ctx.historyMetric];
    ctx.$("#history-chart-title").textContent = metric;
    ctx.$("#history-chart-unit").textContent =
      ctx.historyMetric === "margin" ? "百分點" : "%";
    const val = (d) =>
      ctx.historyMetric === "turnout"
        ? d.turnout
        : ctx.historyMetric === "margin"
          ? d.margin
          : d.candidates[0].share;
    const ymax =
        ctx.historyMetric === "margin"
          ? Math.max(10, Math.ceil(ctx.d3.max(years, val) / 10) * 10)
          : 100,
      y = ctx.d3.scaleLinear().domain([0, ymax]).range([bottom, top]);
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", `translate(52,0)`)
      .call(
        ctx.d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(chartWidth - 87))
          .tickFormat((d) => d + (ctx.historyMetric === "margin" ? "" : "%")),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", `translate(0,${bottom})`)
      .call(ctx.d3.axisBottom(x).tickSize(0).tickPadding(14))
      .call((g) => g.select(".domain").remove());
    if (ctx.historyMetric === "structure") {
      const width = Math.min(55, ((chartWidth - 120) / years.length) * 0.64);
      for (const item of years) {
        let acc = 0;
        for (const c of item.candidates) {
          const start = acc;
          acc += c.share;
          svg
            .append("rect")
            .attr("x", x(item.year) - width / 2)
            .attr("y", y(acc))
            .attr("height", Math.max(0, y(start) - y(acc)))
            .attr("width", width)
            .attr("fill", ctx.historyPartyColor(c.party))
            .attr("stroke", "#fff")
            .append("title")
            .text(item.year + " " + c.name + " " + ctx.pct(c.share));
        }
      }
      ctx.$("#history-method").textContent =
        "每列為該屆全國有效票，色塊是候選人票數占比；政黨名稱按各屆來源記錄，無投票人轉移推論。";
    } else {
      svg
        .append("path")
        .datum(years)
        .attr("fill", "none")
        .attr("stroke", "#84949f")
        .attr("stroke-width", 2)
        .attr(
          "d",
          ctx.d3
            .line()
            .x((d) => x(d.year))
            .y((d) => y(val(d))),
        );
      svg
        .selectAll(".history-dot")
        .data(years)
        .join("circle")
        .attr("class", "history-dot")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(val(d)))
        .attr("r", (d) => (d.year === ctx.historyYear ? 8 : 6))
        .attr("fill", (d) => ctx.historyPartyColor(d.candidates[0].party))
        .attr("stroke", (d) =>
          d.year === ctx.historyYear ? "#172331" : "#fff",
        )
        .attr("stroke-width", 2);
      svg
        .selectAll(".history-value")
        .data(years)
        .join("text")
        .attr("class", "history-value")
        .attr("x", (d) => x(d.year))
        .attr("y", (d) => y(val(d)) - 14)
        .attr("text-anchor", "middle")
        .text(
          (d) =>
            val(d).toFixed(2) + (ctx.historyMetric === "margin" ? "" : "%"),
        );
      ctx.$("#history-method").textContent =
        ctx.historyMetric === "turnout"
          ? "投票率＝投票數 ÷ 選舉人數。"
          : ctx.historyMetric === "margin"
            ? "前兩名差距＝（第一名票數 − 第二名票數）÷ 有效票，以百分點表示。"
            : "當選得票率＝當選候選人票數 ÷ 該屆全國有效票；不等同全體選舉人占比。";
    }
    svg
      .selectAll(".history-target")
      .data(years)
      .join("rect")
      .attr("class", "history-target")
      .attr("x", (d) => x(d.year) - 40)
      .attr("y", top)
      .attr("width", 80)
      .attr("height", bottom - top)
      .attr("fill", "transparent")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr(
        "aria-label",
        (d) =>
          d.year +
          " 年 " +
          metric +
          " " +
          (ctx.historyMetric === "structure"
            ? "查看候選人"
            : val(d).toFixed(2)),
      )
      .on("click", (_, d) => {
        ctx.historyYear = d.year;
        ctx.renderHistory();
      })
      .on("keydown", (ev, d) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.historyYear = d.year;
          ctx.renderHistory();
        }
      });
    svg
      .attr("data-ready", "true")
      .attr("data-metric", ctx.historyMetric)
      .attr("data-year", ctx.historyYear);
    ctx.updateHash();
  }
  async function openNationalHistory() {
    ctx.presentHistoryNavigation?.("national");
    const dialog = ctx.$("#history-dialog");
    if (!dialog.open) dialog.showModal();
    if (!ctx.historyAsset) {
      ctx.$("#history-detail").textContent = "載入全國歷史資料…";
      try {
        const response = await fetch("history.json");
        if (!response.ok) throw Error("history");
        ctx.historyAsset = await response.json();
      } catch {
        ctx.$("#history-detail").textContent = "歷史資料載入失敗，請重新開啟。";
        return;
      }
    }
    ctx.renderHistory();
  }
  ctx.$("#history-open").onclick = ctx.openNationalHistory;
  ctx.$("#history-close").onclick = () => {
    ctx.$("#history-dialog").close();
    ctx.updateHash();
  };
  ctx
    .$("#history-dialog")
    .addEventListener("cancel", () => requestAnimationFrame(ctx.updateHash));
  ctx.$("#history-metric").onchange = (ev) => {
    ctx.historyMetric = ev.target.value;
    ctx.renderHistory();
  };

  function parseNationalHistoryRoute(p) {
    if (
      !p.has("national-history") ||
      p.has("history-region") ||
      p.has("archive")
    ) {
      if (ctx.$("#history-dialog").open) ctx.$("#history-dialog").close();
      return;
    }
    const year = +p.get("national-history");
    ctx.historyYear =
      year >= 1996 && year <= 2024 && (year - 1996) % 4 === 0 ? year : 2024;
    ctx.historyMetric = ["winner", "turnout", "margin", "structure"].includes(
      p.get("national-metric"),
    )
      ? p.get("national-metric")
      : "winner";
    ctx.$("#history-metric").value = ctx.historyMetric;
    requestAnimationFrame(ctx.openNationalHistory);
  }
  function serializeNationalHistoryRoute(p) {
    if (ctx.$("#history-dialog").open) {
      p.set("national-history", ctx.historyYear);
      p.set("national-metric", ctx.historyMetric);
    }
  }

  ctx.historyChartWidth = 0;
  new ResizeObserver((entries) => {
    const width = Math.round(entries[0].contentRect.width);
    if (ctx.$("#history-dialog").open && width !== ctx.historyChartWidth) {
      ctx.historyChartWidth = width;
      requestAnimationFrame(ctx.renderHistory);
    }
  }).observe(ctx.$(".history-chart-panel"));
}
