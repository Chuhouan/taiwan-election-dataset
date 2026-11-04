/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    archiveCandidateElected,
    archiveFmt,
    archiveYearName,
    archiveCatalogEntries,
    archiveFilteredContests,
    renderArchiveCatalog,
    renderArchiveContests,
    renderArchiveDetail,
    openArchiveEntry,
    openArchive,
    archiveExportName,
    archiveExportXML,
    parseArchiveRoute,
    serializeArchiveRoute,
    archiveComparableKind,
  });
  /* Historical contest records are loaded only inside this independent workspace. */
  ctx.archiveCatalog = null;
  ctx.archiveData = null;
  ctx.archiveRequest = 0;
  ctx.archiveCache = new Map();
  ctx.archiveState = {
    year: "2022",
    category: "地方",
    office: "",
    entry: "",
    contest: "",
    query: "",
    county: "",
    page: 0,
  };
  ctx
    .$("#history-close")
    .insertAdjacentHTML(
      "beforebegin",
      '<div class="history-downloads"><button id="archive-open">中央與地方歷史 ↗</button></div>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="archive-dialog" aria-labelledby="archive-title"><header class="archive-header"><div><span>HISTORICAL ELECTION RECORDS</span><h2 id="archive-title">歷史選舉資料室</h2></div><div><button id="archive-national">總統歷屆圖表</button><button id="archive-close" aria-label="關閉歷史資料室">×</button></div></header><div class="archive-controls"><label>年份<select id="archive-year"></select></label><label>選舉層級<select id="archive-category"><option value="">全部</option><option>中央</option><option>地方</option></select></label><label>職位<select id="archive-office"></select></label><span id="archive-catalog-count"></span></div><div class="archive-workspace"><aside class="archive-catalog-panel"><div class="archive-pane-label">選擇一組選舉資料</div><div id="archive-entries"></div></aside><section class="archive-results-panel"><div class="archive-result-heading"><div><span id="archive-year-label"></span><h3 id="archive-office-label">選擇選舉資料</h3></div><div class="archive-downloads"><button id="archive-county-history" hidden>縣市跨屆比較 ↗</button><button id="archive-csv">CSV</button><button id="archive-svg">SVG</button><button id="archive-png">PNG</button></div></div><div class="archive-scope-controls"><label class="sr-only" for="archive-county">原始縣市</label><select id="archive-county"><option value="">全部原始縣市</option></select><input id="archive-search" type="search" aria-label="搜尋歷史選區、地名或候選人" placeholder="搜尋選區、地名或候選人"><span id="archive-scope-count"></span></div><div class="archive-analysis"><aside class="archive-contest-panel"><div id="archive-contests"></div><div class="archive-pager"><button id="archive-prev" aria-label="上一頁">←</button><span id="archive-page"></span><button id="archive-next" aria-label="下一頁">→</button></div></aside><section id="archive-detail" aria-live="polite"><p>按需載入歷史結果…</p></section></div></section></div><footer class="archive-footer"><span>資料：中選會原始 CSV 快照 · 保留當屆行政區、選區及當選狀態</span><details><summary>統計口徑與來源</summary><div id="archive-method"></div></details></footer></dialog>`,
  );

  function archiveCandidateElected(candidate, contest) {
    return contest.officialResult
      ? contest.officialResult.elected_names.includes(candidate.name)
      : candidate.elected;
  }
  function archiveFmt(value) {
    return value == null ? "—" : ctx.fmt(value);
  }
  function archiveYearName(year) {
    return year === "unknown" ? "年份待核實" : year + "年";
  }
  function archiveCatalogEntries() {
    return (ctx.archiveCatalog?.entries || []).filter(
      (e) =>
        (ctx.archiveState.year === "all" ||
          String(e.year || "unknown") === ctx.archiveState.year) &&
        (!ctx.archiveState.category ||
          e.category === ctx.archiveState.category) &&
        (!ctx.archiveState.office || e.office === ctx.archiveState.office),
    );
  }
  function archiveFilteredContests() {
    const q = ctx.archiveState.query.trim().replace(/台/g, "臺");
    return (ctx.archiveData?.contests || []).filter(
      (c) =>
        (!ctx.archiveState.county || c.county === ctx.archiveState.county) &&
        (!q ||
          [c.name, ...c.candidates.map((d) => d.name)]
            .join(" ")
            .replace(/台/g, "臺")
            .includes(q)),
    );
  }
  function renderArchiveCatalog() {
    const s = ctx.archiveState;
    ctx.$("#archive-year").value = s.year;
    ctx.$("#archive-category").value = s.category;
    const offices = [
      ...new Set(
        ctx.archiveCatalog.entries
          .filter(
            (e) =>
              (s.year === "all" || String(e.year || "unknown") === s.year) &&
              (!s.category || e.category === s.category),
          )
          .map((e) => e.office),
      ),
    ].sort();
    if (s.office && !offices.includes(s.office)) s.office = "";
    ctx.$("#archive-office").innerHTML =
      '<option value="">全部職位</option>' +
      offices.map((o) => "<option>" + ctx.esc(o) + "</option>").join("");
    ctx.$("#archive-office").value = s.office;
    const entries = ctx.archiveCatalogEntries();
    ctx.$("#archive-catalog-count").textContent = entries.length + " 組資料";
    ctx.$("#archive-entries").innerHTML =
      entries
        .map(
          (e) =>
            '<button class="archive-entry ' +
            (s.entry === e.id ? "active" : "") +
            '" data-archive-entry="' +
            e.id +
            '"><span>' +
            (e.election_date || ctx.archiveYearName(e.year || "unknown")) +
            " · " +
            ctx.esc(e.category) +
            "</span><b>" +
            ctx.esc(e.office) +
            "</b>" +
            (e.office.includes("補選") ||
            entries.filter((other) => other.office === e.office).length > 1
              ? "<em>" +
                ctx.esc(
                  e.scopeLabel || e.sources[0].directory.split("/").at(-1),
                ) +
                "</em>"
              : "") +
            "<small>" +
            ctx.fmt(e.contests) +
            " 選舉區 · " +
            ctx.fmt(e.candidates) +
            " 候選人／政黨" +
            (e.issues ? " · 有待核對項目" : "") +
            (e.officialCorrections ? " · 已公告核對" : "") +
            "</small></button>",
        )
        .join("") ||
      '<p class="archive-empty">這個組合沒有資料，請更換年份或職位。</p>';
    for (const b of ctx.$$("[data-archive-entry]"))
      b.onclick = () => ctx.openArchiveEntry(b.dataset.archiveEntry);
    return entries;
  }
  function renderArchiveContests() {
    if (!ctx.archiveData) return;
    const all = ctx.archiveFilteredContests(),
      pages = Math.max(1, Math.ceil(all.length / 50));
    ctx.archiveState.page = Math.min(ctx.archiveState.page, pages - 1);
    if (!all.some((c) => c.id === ctx.archiveState.contest))
      ctx.archiveState.contest = all[0]?.id || "";
    const visible = all.slice(
      ctx.archiveState.page * 50,
      ctx.archiveState.page * 50 + 50,
    );
    ctx.$("#archive-scope-count").textContent = ctx.fmt(all.length) + " 選舉區";
    ctx.$("#archive-page").textContent =
      ctx.archiveState.page + 1 + " / " + pages;
    ctx.$("#archive-prev").disabled = !ctx.archiveState.page;
    ctx.$("#archive-next").disabled = ctx.archiveState.page >= pages - 1;
    ctx.$("#archive-contests").innerHTML =
      visible
        .map(
          (c) =>
            '<button data-archive-contest="' +
            c.id +
            '" class="archive-contest ' +
            (ctx.archiveState.contest === c.id ? "active" : "") +
            '"><b>' +
            ctx.esc(c.name) +
            "</b><span>" +
            ctx.fmt(c.validVotes) +
            (c.validVotesBasis === "candidate_sum"
              ? " 票合計 · "
              : " 有效票 · ") +
            c.candidates.length +
            " 名" +
            (c.verified ? "" : " · 待核對") +
            "</span></button>",
        )
        .join("") ||
      '<p class="archive-empty">沒有符合的選舉區。清空搜尋或更換縣市。</p>';
    for (const b of ctx.$$("[data-archive-contest]"))
      b.onclick = () => {
        ctx.archiveState.contest = b.dataset.archiveContest;
        ctx.renderArchiveContests();
        ctx.updateHash();
      };
    ctx.renderArchiveDetail();
  }
  function renderArchiveDetail() {
    const c = ctx.archiveData?.contests.find(
      (c) => c.id === ctx.archiveState.contest,
    );
    if (!c) {
      ctx.$("#archive-detail").innerHTML =
        '<p class="archive-empty">沒有符合目前搜尋的選舉區。</p>';
      ctx.$("#archive-svg").disabled = true;
      ctx.$("#archive-png").disabled = true;
      return;
    }
    ctx.$("#archive-svg").disabled = false;
    ctx.$("#archive-png").disabled = false;
    const allocation = c.allocatedSeats != null,
      multi = c.officialResult
        ? c.officialResult.elected_names.length > 1
        : c.electedCount > 1,
      year = ctx.archiveData.year,
      pending = c.officialResult
        ? 0
        : c.candidates.filter((r) => ["?", "？"].includes(r.electedFlag))
            .length,
      electedCount = c.candidates.filter((r) =>
        ctx.archiveCandidateElected(r, c),
      ).length;
    ctx.$("#archive-detail").innerHTML =
      '<div class="archive-detail-title"><span>原始統計選舉區</span><h3>' +
      ctx.esc(c.name) +
      "</h3><p>" +
      ctx.esc(ctx.archiveData.office) +
      " · " +
      (ctx.archiveData.election_date ||
        ctx.archiveYearName(year || "unknown")) +
      "</p></div>" +
      (c.officialResult
        ? '<div class="archive-warning">' +
          ctx.esc(c.officialResult.note) +
          ' <a href="' +
          ctx.esc(c.officialResult.source) +
          '" target="_blank" rel="noopener">正式公告 ↗</a></div>'
        : "") +
      (pending
        ? '<div class="archive-warning">來源仍標示 ' +
          pending +
          " 位候選人同票待抽籤（?）。保留此資料快照，不推定最終當選人。</div>"
        : "") +
      (c.issues.length
        ? '<div class="archive-warning">原始資料待核對：' +
          ctx.esc(c.issues.join("；")) +
          "。不將此區納入跨區合計。</div>"
        : "") +
      '<div class="archive-stat-grid"><div><span>' +
      (c.validVotesBasis === "candidate_sum" ? "候選人票合計" : "有效票") +
      "</span><b>" +
      ctx.fmt(c.validVotes) +
      "</b></div><div><span>投票率</span><b>" +
      (c.turnout == null ? "—" : ctx.pct(c.turnout)) +
      "</b></div><div><span>" +
      (allocation
        ? "分配席次"
        : pending
          ? "來源當選狀態"
          : c.officialResult
            ? "公告核對當選"
            : "來源當選標記") +
      "</span><b>" +
      (pending
        ? "待抽籤"
        : !allocation && !electedCount
          ? "未註記"
          : ctx.fmt(allocation ? c.allocatedSeats : electedCount) +
            (allocation ? " 席" : " 人")) +
      '</b></div></div><div class="archive-chart-key">' +
      (allocation
        ? "橫條：政黨有效票占比；席次依官方分配表"
        : multi
          ? "橫條：候選人票數占比；● 當選　◆ 婦女保障當選　? 同票待抽籤"
          : "橫條：候選人票數占比；● 當選　? 來源同票待抽籤") +
      '</div><svg id="archive-chart" role="img" aria-label="' +
      ctx.esc(c.name) +
      ' 候選人得票結果"></svg><details class="archive-raw"><summary>原始票數與統計代碼</summary><p>投票數 ' +
      ctx.archiveFmt(c.cast) +
      " · 無效票 " +
      ctx.archiveFmt(c.invalidVotes) +
      " · 選舉人數 " +
      ctx.archiveFmt(c.eligible) +
      "</p><p>候選人登記：" +
      c.scope.join(" / ") +
      "<br>票數：" +
      c.ticketScope.join(" / ") +
      "<br>概況：" +
      (c.profileScope?.join(" / ") || "缺少同口徑概況") +
      "</p></details>";
    const width = Math.max(500, ctx.$("#archive-chart").clientWidth),
      left = 175,
      right = width - 170,
      axisMax = Math.min(
        100,
        Math.max(
          5,
          Math.ceil(ctx.d3.max(c.candidates, (r) => r.share || 0) / 5) * 5,
        ),
      ),
      row = allocation ? 41 : 49,
      top = 36,
      height = top + row * c.candidates.length + 30,
      svg = ctx.d3
        .select("#archive-chart")
        .attr("viewBox", "0 0 " + width + " " + height)
        .attr("data-contest", c.id)
        .attr("data-axis-max", axisMax)
        .attr("data-ready", "true"),
      x = ctx.d3.scaleLinear().domain([0, axisMax]).range([left, right]);
    svg
      .append("g")
      .attr("transform", "translate(0,22)")
      .call(
        ctx.d3
          .axisTop(x)
          .ticks(4)
          .tickFormat((d) => d + "%")
          .tickSize(0),
      )
      .call((g) => g.select(".domain").remove())
      .attr("color", "#6c7985")
      .attr("font-size", 12);
    const g = svg
      .selectAll(".archive-candidate-row")
      .data(c.candidates)
      .join("g")
      .attr("class", "archive-candidate-row")
      .attr("transform", (_, i) => "translate(0," + (top + i * row) + ")")
      .attr("data-ballot", (d) => d.ballot)
      .attr("data-votes", (d) => d.votes)
      .attr("data-share", (d) => d.share)
      .attr("data-elected", (d) => ctx.archiveCandidateElected(d, c))
      .attr("data-source-elected", (d) => d.elected)
      .attr("data-seats", (d) => d.seats);
    g.append("rect")
      .attr("x", left)
      .attr("y", 6)
      .attr("height", 18)
      .attr("width", right - left)
      .attr("fill", "#f0f3f4");
    g.append("rect")
      .attr("x", left)
      .attr("y", 6)
      .attr("height", 18)
      .attr("width", (d) => Math.max(0, x(Math.min(100, d.share || 0)) - left))
      .attr("fill", (d) => ctx.historyPartyColor(d.party));
    g.append("text")
      .attr("x", 7)
      .attr("y", allocation ? 20 : 17)
      .attr("font-size", 14)
      .attr("font-weight", (d) =>
        ctx.archiveCandidateElected(d, c) ? 650 : 450,
      )
      .attr("fill", "#263847")
      .text((d) => d.ballot + " " + d.name);
    g.append("text")
      .attr("x", 7)
      .attr("y", 35)
      .attr("font-size", 12)
      .attr("fill", "#637580")
      .text((d) =>
        allocation
          ? ""
          : d.party
              .replace("民主進步黨", "民進黨")
              .replace("中國國民黨", "國民黨")
              .replace("台灣民眾黨", "民眾黨"),
      );
    g.append("text")
      .attr("x", right + 10)
      .attr("y", 20)
      .attr("font-size", 13)
      .attr("font-weight", 600)
      .text((d) => (d.share == null ? "—" : ctx.pct(d.share)));
    g.append("text")
      .attr("x", width - 45)
      .attr("y", 20)
      .attr("font-size", 13)
      .attr("text-anchor", "end")
      .text((d) => ctx.fmt(d.votes));
    g.append("text")
      .attr("x", width - 35)
      .attr("y", 20)
      .attr("font-size", 12)
      .attr("fill", "#334958")
      .text((d) =>
        allocation
          ? d.seats == null
            ? ""
            : d.seats + "席"
          : !c.officialResult && ["?", "？"].includes(d.electedFlag)
            ? "?"
            : ctx.archiveCandidateElected(d, c)
              ? d.electedFlag === "!"
                ? "◆"
                : "●"
              : "",
      );
    g.append("title").text(
      (d) =>
        d.name +
        " · " +
        d.party +
        " · " +
        ctx.fmt(d.votes) +
        " 票 · " +
        (d.share == null ? "無有效票" : ctx.pct(d.share)) +
        (allocation
          ? " · " + (d.seats ?? 0) + "席"
          : ["?", "？"].includes(d.electedFlag)
            ? " · 來源為同票待抽籤"
            : ctx.archiveCandidateElected(d, c)
              ? " · 當選"
              : ""),
    );
    ctx.$("#archive-detail").dataset.contest = c.id;
  }
  async function openArchiveEntry(id, keep = false) {
    const entry = ctx.archiveCatalog?.entries.find((e) => e.id === id);
    if (!entry) return;
    const request = ++ctx.archiveRequest;
    ctx.archiveState.entry = id;
    if (!keep) {
      ctx.archiveState.contest = "";
      ctx.archiveState.county = "";
      ctx.archiveState.query = "";
      ctx.archiveState.page = 0;
    }
    ctx.renderArchiveCatalog();
    ctx.archiveData = null;
    ctx.$("#archive-county-history").hidden = true;
    ctx.$("#archive-csv").disabled = true;
    ctx.$("#archive-svg").disabled = true;
    ctx.$("#archive-png").disabled = true;
    ctx.$("#archive-contests").innerHTML = "";
    ctx.$("#archive-detail").innerHTML =
      '<p class="archive-empty">載入 ' + ctx.esc(entry.office) + "…</p>";
    try {
      let asset = ctx.archiveCache.get(id);
      if (!asset) {
        const r = await fetch("archive/" + id + ".json");
        if (!r.ok) throw Error("archive");
        asset = await r.json();
        ctx.archiveCache.set(id, asset);
      }
      if (request !== ctx.archiveRequest || !ctx.$("#archive-dialog").open)
        return;
      ctx.archiveData = asset;
      ctx.$("#archive-csv").disabled = false;
      ctx.$("#archive-county-history").hidden =
        !ctx.archiveComparableKind(asset);
      ctx.$("#archive-year-label").textContent =
        (asset.election_date || ctx.archiveYearName(asset.year || "unknown")) +
        " · " +
        asset.category +
        (asset.year === 2022 && asset.office === "縣市長"
          ? " · 11月26日；不含嘉義市重行選舉"
          : "");
      ctx.$("#archive-office-label").textContent = asset.office;
      ctx.$("#archive-county").innerHTML =
        '<option value="">全部原始縣市</option>' +
        [...new Set(asset.contests.map((c) => c.county))]
          .map((c) => "<option>" + ctx.esc(c) + "</option>")
          .join("");
      ctx.$("#archive-county").value = ctx.archiveState.county;
      ctx.$("#archive-search").value = ctx.archiveState.query;
      ctx.$("#archive-method").innerHTML =
        "<p>" +
        ctx.esc(ctx.archiveCatalog.policy) +
        "</p>" +
        (asset.date_source
          ? "<p>投票日期 " +
            ctx.esc(asset.election_date) +
            '：<a href="' +
            ctx.esc(asset.date_source) +
            '" target="_blank" rel="noopener">中選會日期資料 ↗</a></p>'
          : "") +
        "<p>" +
        ctx.esc(asset.comparability_status) +
        "</p>" +
        (asset.year === 2022 && asset.office === "縣市長"
          ? '<p>本批為11月26日的15縣市；嘉義市12月18日重行選舉不在這批來源中。<a href="https://web.cec.gov.tw/central/article/36930" target="_blank" rel="noopener">中選會公告 ↗</a></p>'
          : "") +
        "<p>" +
        ctx.fmt(asset.contests.filter((c) => c.verified).length) +
        "／" +
        ctx.fmt(asset.contests.length) +
        " 選舉區通過原始票數與分母檢查；" +
        asset.issues.length +
        " 個待核對項目。未配對項目不補零。</p>" +
        asset.issues
          .filter((i) => i.candidateCount != null)
          .map(
            (i) =>
              "<p>未配對：" +
              ctx.esc(i.scope.join(" / ")) +
              " · " +
              ctx.esc(i.reason) +
              "；登記" +
              i.candidateCount +
              "名，總票" +
              i.ticketCount +
              "名。未列入可下載結果。</p>",
          )
          .join("") +
        asset.sources
          .map(
            (source) =>
              "<p>來源資料夾：" +
              ctx.esc(source.directory) +
              "</p><dl>" +
              Object.entries(source.sha256)
                .map(
                  ([name, hash]) =>
                    "<dt>" + ctx.esc(name) + "</dt><dd>" + hash + "</dd>",
                )
                .join("") +
              "</dl>",
          )
          .join("") +
        '<p>字段依《選舉資料庫格式.odt》，2022職位代碼依官方《選舉種類代碼.xlsx》。<a href="https://db.cec.gov.tw/ElecTable" target="_blank" rel="noopener">中選會資料庫 ↗</a></p>';
      ctx.renderArchiveContests();
      ctx.updateHash();
    } catch {
      if (request === ctx.archiveRequest)
        ctx.$("#archive-detail").innerHTML =
          '<p class="archive-empty">載入失敗。請重新選擇這組資料。</p>';
    }
  }
  async function openArchive() {
    ctx.presentHistoryNavigation?.("archive");
    if (ctx.$("#history-dialog").open) ctx.$("#history-dialog").close();
    if (ctx.$("#county-history-dialog").open)
      ctx.$("#county-history-dialog").close();
    const dialog = ctx.$("#archive-dialog");
    if (!dialog.open) dialog.showModal();
    if (!ctx.archiveCatalog) {
      try {
        const r = await fetch("archive-catalog.json");
        if (!r.ok) throw Error("catalog");
        ctx.archiveCatalog = await r.json();
        ctx.$("#archive-year").innerHTML =
          '<option value="all">全部年份</option>' +
          [...new Set(ctx.archiveCatalog.entries.map((e) => e.year))]
            .sort((a, b) => (b || 0) - (a || 0))
            .map(
              (y) =>
                '<option value="' +
                (y || "unknown") +
                '">' +
                ctx.archiveYearName(y || "unknown") +
                "</option>",
            )
            .join("");
      } catch {
        ctx.$("#archive-detail").innerHTML =
          '<p class="archive-empty">目錄載入失敗，請重新開啟。</p>';
        return;
      }
    }
    const chosen = ctx.archiveCatalog.entries.find(
      (e) => e.id === ctx.archiveState.entry,
    );
    if (chosen && ctx.archiveState.year === "unknown")
      ctx.archiveState.year = String(chosen.year || "unknown");
    const entries = ctx.renderArchiveCatalog(),
      id = entries.some((e) => e.id === ctx.archiveState.entry)
        ? ctx.archiveState.entry
        : entries[0]?.id;
    if (id) await ctx.openArchiveEntry(id, true);
    else
      ctx.$("#archive-detail").innerHTML =
        '<p class="archive-empty">請更換年份或選舉層級。</p>';
  }
  ctx.$("#archive-open").onclick = ctx.openArchive;
  ctx.$("#archive-close").onclick = () => {
    ctx.$("#archive-dialog").close();
    ctx.archiveRequest++;
    ctx.updateHash();
  };
  ctx.$("#archive-dialog").addEventListener("cancel", () => {
    ctx.archiveRequest++;
    requestAnimationFrame(ctx.updateHash);
  });
  ctx.$("#archive-national").onclick = () => {
    ctx.$("#archive-dialog").close();
    ctx.updateHash();
    ctx.$("#history-open").click();
  };
  for (const key of ["year", "category", "office"])
    ctx.$("#archive-" + key).onchange = () => {
      ctx.archiveState[key] = ctx.$("#archive-" + key).value;
      ctx.archiveState.page = 0;
      const entries = ctx.renderArchiveCatalog();
      if (entries.length) ctx.openArchiveEntry(entries[0].id);
      else {
        ctx.$("#archive-contests").innerHTML = "";
        ctx.archiveData = null;
        ctx.$("#archive-detail").innerHTML =
          '<p class="archive-empty">這個組合沒有資料，請更換條件。</p>';
        ctx.updateHash();
      }
    };
  ctx.$("#archive-search").oninput = () => {
    ctx.archiveState.query = ctx.$("#archive-search").value;
    ctx.archiveState.page = 0;
    ctx.renderArchiveContests();
    ctx.updateHash();
  };
  ctx.$("#archive-county").onchange = () => {
    ctx.archiveState.county = ctx.$("#archive-county").value;
    ctx.archiveState.page = 0;
    ctx.renderArchiveContests();
    ctx.updateHash();
  };
  for (const [id, step] of [
    ["prev", -1],
    ["next", 1],
  ])
    ctx.$("#archive-" + id).onclick = () => {
      ctx.archiveState.page += step;
      ctx.renderArchiveContests();
      ctx.updateHash();
    };
  function archiveExportName(figure = false) {
    const c = ctx.archiveData?.contests.find(
        (c) => c.id === ctx.archiveState.contest,
      ),
      scope = figure
        ? c?.name
        : ctx.archiveState.county ||
          (ctx.archiveData?.contests.length === 1
            ? ctx.archiveData.contests[0].name
            : "");
    return (
      "歷史選舉-" +
      (ctx.archiveData?.election_date ||
        ctx.archiveData?.year ||
        "年份待核實") +
      "-" +
      ctx.archiveData?.office +
      (scope ? "-" + scope : "")
    ).replace(/[\\/:*?"<>|]/g, "-");
  }
  ctx.$("#archive-csv").onclick = () => {
    if (!ctx.archiveData) return;
    ctx.csvTable(
      [
        "資料ID",
        "年份",
        "職位",
        "原始選區",
        "地區代碼",
        "候選人號次",
        "候選人或政黨",
        "來源政黨",
        "票數",
        "得票占比",
        "票數分母",
        "無效票",
        "投票數",
        "選舉人數",
        "投票率",
        "來源當選標記",
        "官方分配席次",
        "核對狀態",
        "來源資料夾",
        "來源SHA256",
        "票數分母來源",
        "概況原碼",
        "公告核對當選",
        "公告核對來源",
        "投票日期",
      ],
      ctx
        .archiveFilteredContests()
        .flatMap((c) =>
          c.candidates.map((r) => [
            ctx.archiveData.id,
            ctx.archiveData.year || "待核實",
            ctx.archiveData.office,
            c.name,
            c.scope.join(":"),
            r.ballot,
            r.name,
            r.party,
            r.votes,
            r.share ?? "",
            c.validVotes,
            c.invalidVotes ?? "",
            c.cast ?? "",
            c.eligible ?? "",
            c.turnout ?? "",
            r.electedFlag,
            r.seats ?? "",
            c.verified ? "原始加總核對通過" : c.issues.join("；"),
            ctx.archiveData.sources.map((s) => s.directory).join("；"),
            JSON.stringify(ctx.archiveData.sources.map((s) => s.sha256)),
            c.validVotesBasis,
            c.profileScope?.join(":") || "",
            c.officialResult
              ? ctx.archiveCandidateElected(r, c)
                ? "是"
                : "否"
              : "",
            c.officialResult?.source || "",
            ctx.archiveData.election_date || "",
          ]),
        ),
      ctx.archiveExportName() + ".csv",
    );
  };
  function archiveExportXML() {
    const c = ctx.archiveData?.contests.find(
      (c) => c.id === ctx.archiveState.contest,
    );
    if (!c) return null;
    return ctx.standaloneSVGPanel(
      ctx.$("#archive-chart"),
      ctx.archiveYearName(ctx.archiveData.year || "unknown") +
        " · " +
        ctx.archiveData.office +
        " · " +
        c.name,
      "當屆原始選區；" +
        (c.validVotesBasis === "candidate_sum" ? "候選人票合計 " : "有效票 ") +
        ctx.fmt(c.validVotes) +
        "；● 當選、◆ 婦女保障、? 來源同票待抽籤；歷史邊界未套用現今地圖" +
        (c.issues.length ? "；待核對：" + c.issues.join("；") : ""),
      {
        metadata: {
          election_id: ctx.archiveData.id,
          source_version: ctx.dataVersionLabel(),
          sources: ctx.archiveData.sources,
          scope: c.scope,
          ticketScope: c.ticketScope,
          profileScope: c.profileScope,
          validVotesBasis: c.validVotesBasis,
          verified: c.verified,
          issues: c.issues,
          comparability_status: ctx.archiveData.comparability_status,
          officialResult: c.officialResult || null,
          election_date: ctx.archiveData.election_date || null,
          date_source: ctx.archiveData.date_source || null,
        },
      },
    );
  }
  ctx.$("#archive-svg").onclick = () => {
    const xml = ctx.archiveExportXML();
    if (xml)
      ctx.saveBlob(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        ctx.archiveExportName(true) + ".svg",
      );
  };
  ctx.$("#archive-png").onclick = () => {
    const xml = ctx.archiveExportXML();
    if (xml) ctx.downloadPNG(xml, ctx.archiveExportName(true));
  };
  function parseArchiveRoute(p) {
    if (!p.has("archive")) {
      if (ctx.$("#archive-dialog").open) ctx.$("#archive-dialog").close();
      return;
    }
    ctx.archiveState.entry = p.get("archive") || "";
    ctx.archiveState.year = p.get("archive-year") || "2022";
    ctx.archiveState.category = ["中央", "地方", ""].includes(
      p.get("archive-category"),
    )
      ? p.get("archive-category")
      : "";
    ctx.archiveState.office = p.get("archive-office") || "";
    ctx.archiveState.contest = p.get("archive-contest") || "";
    ctx.archiveState.county = p.get("archive-county") || "";
    ctx.archiveState.query = p.get("archive-query") || "";
    ctx.archiveState.page = Math.max(
      0,
      Math.floor(+p.get("archive-page") || 0),
    );
    requestAnimationFrame(ctx.openArchive);
  }
  function serializeArchiveRoute(p) {
    if (!ctx.$("#archive-dialog").open) return;
    for (const [k, v] of Object.entries({
      archive: ctx.archiveState.entry,
      "archive-year": ctx.archiveState.year,
      "archive-category": ctx.archiveState.category,
      "archive-office": ctx.archiveState.office,
      "archive-contest": ctx.archiveState.contest,
      "archive-county": ctx.archiveState.county,
      "archive-query": ctx.archiveState.query,
      "archive-page": ctx.archiveState.page,
    }))
      if (v !== "" && v != null) p.set(k, v);
  }

  ctx.archiveResizeWidth = 0;
  new ResizeObserver((entries) => {
    const width = Math.round(entries[0].contentRect.width);
    if (ctx.$("#archive-dialog").open && width !== ctx.archiveResizeWidth) {
      ctx.archiveResizeWidth = width;
      ctx.renderArchiveDetail();
    }
  }).observe(ctx.$(".archive-results-panel"));

  function archiveComparableKind(asset) {
    if (!asset) return null;
    const kind =
      asset.office === "總統副總統"
        ? "president"
        : asset.office === "立委（政黨票）"
          ? "legislator-list"
          : ["縣市長", "直轄市長"].includes(asset.office)
            ? "mayor"
            : null;
    return kind && ctx.COUNTY_HISTORY_TYPES[kind].years.includes(asset.year)
      ? kind
      : null;
  }
  ctx.$("#archive-county-history").onclick = () => {
    const kind = ctx.archiveComparableKind(ctx.archiveData);
    if (kind) ctx.openCountyHistoryForElection(kind, ctx.archiveData.year);
  };
}
