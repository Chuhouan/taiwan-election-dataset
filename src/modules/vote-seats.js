/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    voteSeatSystem,
    voteSeatEntries,
    voteSeatDrawEntries,
    selectVoteSeat,
    renderVoteSeats,
    openVoteSeats,
    voteSeatExportXML,
    parseVoteSeatRoute,
    serializeVoteSeatRoute,
  });
  /* Vote-seat comparisons deliberately use one electoral category at a time. */
  ctx.voteSeatState = {
    system: "list",
    denominator: "all",
    expanded: false,
    party: "",
  };
  ctx
    .$(".research-menu-items")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="vote-seat-open">票席結構</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="vote-seat-dialog" aria-labelledby="vote-seat-title"><header class="history-header"><div><span>2024 第11屆立委 · 各類選票分開觀察</span><h2 id="vote-seat-title">票數與席次的比例</h2></div><div class="history-downloads"><button id="vote-seat-csv">CSV</button><button id="vote-seat-svg">SVG</button><button id="vote-seat-png">PNG</button><button id="vote-seat-close" aria-label="關閉票席結構">×</button></div></header><div class="vote-seat-toolbar"><label>席次類別<select id="vote-seat-system"><option value="list">不分區34席</option><option value="regional">區域73席</option><option value="plain">平地原住民3席</option><option value="mountain">山地原住民3席</option></select></label><label>得票分母<select id="vote-seat-denominator"><option value="all">該類別全部有效票</option><option value="qualified">僅獲分配政黨的有效政黨票</option></select></label><label><input id="vote-seat-expanded" type="checkbox">展開全部政黨</label></div><div class="vote-seat-body"><div id="vote-seat-summary" class="vote-seat-summary"></div><div class="vote-seat-symbols"><span>● 得票占比</span><span>○ 席次占比</span><span>差值＝席次占比 − 得票占比（pp）</span></div><svg id="vote-seat-chart" role="group" aria-label="同一類選票的政黨票席比例對照"></svg><div id="vote-seat-readout" class="vote-seat-readout" aria-live="polite"></div><details class="vote-seat-method"><summary>分母、門檻與統計限制</summary><p id="vote-seat-method"></p><p>區域73席、不分區34席、平地及山地各3席分開比較；不同選票的選舉人範圍與選制不同，不使用同一票數分母解釋完整113席。無黨籍是候選人合計類別，並非同一政黨。票席差是描述性對照，不直接評斷選舉公平或推論投票行為。</p><a href="https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=159&pid=8" target="_blank" rel="noopener">立法院席次與選制說明 ↗</a></details><footer class="history-source">資料：中選會2024最終結果、政黨席次分配及當選名單；按選票類別核對票數與席次。<a href="https://web.cec.gov.tw/central/article/41421" target="_blank" rel="noopener">當選公告 ↗</a></footer></div></dialog>`,
  );
  function voteSeatSystem() {
    return ctx.parliamentData.analysis.systems[ctx.voteSeatState.system];
  }
  function voteSeatEntries() {
    const s = ctx.voteSeatSystem(),
      qualified =
        ctx.voteSeatState.system === "list" &&
        ctx.voteSeatState.denominator === "qualified",
      denominator = qualified ? s.qualifiedVotes : s.validVotes;
    return s.parties
      .filter((p) => !qualified || p.qualified)
      .map((p) => ({
        ...p,
        voteShare: (p.votes / denominator) * 100,
        seatShare: (p.seats / s.seats) * 100,
        gap: (p.seats / s.seats) * 100 - (p.votes / denominator) * 100,
        denominator,
      }));
  }
  function voteSeatDrawEntries() {
    const entries = ctx.voteSeatEntries();
    if (ctx.voteSeatState.expanded) return entries;
    const seated = entries.filter((p) => p.seats),
      others = entries.filter((p) => !p.seats);
    if (others.length)
      seated.push({
        party: "未獲席政黨合計（" + others.length + "）",
        votes: ctx.d3.sum(others, (p) => p.votes),
        seats: 0,
        voteShare: ctx.d3.sum(others, (p) => p.voteShare),
        seatShare: 0,
        gap: -ctx.d3.sum(others, (p) => p.voteShare),
        synthetic: true,
        denominator: entries[0].denominator,
      });
    return seated;
  }
  function selectVoteSeat(p) {
    ctx.voteSeatState.party = p.party;
    const s = ctx.voteSeatSystem();
    ctx.$("#vote-seat-readout").innerHTML =
      "<strong>" +
      ctx.esc(p.party) +
      "</strong><div><b>" +
      ctx.fmt(p.votes) +
      " 票</b><span>得票占比 " +
      ctx.pct(p.voteShare) +
      " · 分母 " +
      ctx.fmt(p.denominator) +
      "</span></div><div><b>" +
      p.seats +
      "／" +
      s.seats +
      " 席</b><span>席次占比 " +
      ctx.pct(p.seatShare) +
      " · 差值 " +
      ctx.sign(p.gap) +
      " pp</span></div>";
    ctx.d3
      .select("#vote-seat-chart")
      .selectAll(".vote-seat-row")
      .classed("selected", (d) => d.party === p.party);
    ctx.updateHash();
  }
  function renderVoteSeats() {
    if (!ctx.parliamentData?.analysis) return;
    const s = ctx.voteSeatSystem(),
      state = ctx.voteSeatState;
    if (state.system !== "list") state.denominator = "all";
    ctx.$("#vote-seat-system").value = state.system;
    ctx.$("#vote-seat-denominator").value = state.denominator;
    ctx.$("#vote-seat-denominator").disabled = state.system !== "list";
    ctx.$("#vote-seat-expanded").checked = state.expanded;
    const entries = ctx.voteSeatEntries(),
      rows = ctx.voteSeatDrawEntries(),
      qualified = state.system === "list" && state.denominator === "qualified",
      width = 1260,
      top = 70,
      height = Math.max(315, rows.length * 35 + 120),
      left = 315,
      right = 1035,
      x = ctx.d3
        .scaleLinear()
        .domain([
          0,
          Math.max(
            50,
            Math.ceil(
              ctx.d3.max(rows, (p) => Math.max(p.voteShare, p.seatShare)) / 10,
            ) * 10,
          ),
        ])
        .range([left, right]),
      svg = ctx.d3.select("#vote-seat-chart");
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).style("height", "auto");
    ctx.$("#vote-seat-summary").innerHTML =
      "<div><small>" +
      ctx.esc(s.title) +
      " · 得票分母</small><strong>" +
      ctx.fmt(qualified ? s.qualifiedVotes : s.validVotes) +
      " <em>有效票</em></strong></div><div><small>席次分母</small><strong>" +
      s.seats +
      " <em>席</em></strong></div><div><small>獲席類別</small><strong>" +
      entries.filter((p) => p.seats).length +
      " <em>個政黨／類別</em></strong></div>";
    svg
      .append("g")
      .attr("class", "history-axis")
      .attr("transform", "translate(0,35)")
      .call(
        ctx.d3
          .axisTop(x)
          .ticks(5)
          .tickSize(-(height - 90))
          .tickFormat((v) => v + "%"),
      )
      .call((g) => g.select(".domain").remove());
    svg
      .append("text")
      .attr("x", 20)
      .attr("y", 35)
      .attr("font-size", 13)
      .attr("fill", "#627783")
      .text("政黨／候選人類別");
    svg
      .append("text")
      .attr("x", width - 20)
      .attr("y", 35)
      .attr("text-anchor", "end")
      .attr("font-size", 13)
      .attr("fill", "#627783")
      .text("席次占比 − 得票占比");
    if (state.system === "list" && !qualified) {
      svg
        .append("line")
        .attr("x1", x(5))
        .attr("x2", x(5))
        .attr("y1", 45)
        .attr("y2", height - 45)
        .attr("stroke", "#9d824f")
        .attr("stroke-dasharray", "4 3");
      svg
        .append("text")
        .attr("x", x(5) + 5)
        .attr("y", height - 25)
        .attr("font-size", 12)
        .attr("fill", "#8b734a")
        .text("5%政黨票門檻");
    }
    const row = svg
      .append("g")
      .selectAll("g")
      .data(rows, (p) => p.party)
      .join("g")
      .attr("class", "vote-seat-row")
      .attr("data-party", (p) => p.party)
      .attr("data-votes", (p) => p.votes)
      .attr("data-vote-share", (p) => p.voteShare)
      .attr("data-seat-share", (p) => p.seatShare)
      .attr("data-gap", (p) => p.gap)
      .attr("transform", (_, i) => `translate(0,${top + i * 35})`)
      .attr("role", "button")
      .attr("tabindex", (_, i) => (i ? -1 : 0))
      .attr(
        "aria-label",
        (p) =>
          p.party +
          " 得票 " +
          ctx.pct(p.voteShare) +
          " 席次 " +
          ctx.pct(p.seatShare) +
          " 差 " +
          ctx.sign(p.gap) +
          " 百分點",
      )
      .on("click", (_, p) => ctx.selectVoteSeat(p))
      .on("keydown", (ev, p) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.selectVoteSeat(p);
        }
      });
    row
      .append("rect")
      .attr("x", 10)
      .attr("y", -19)
      .attr("width", width - 20)
      .attr("height", 33)
      .attr("fill", "transparent");
    row
      .append("text")
      .attr("x", 20)
      .attr("y", 4)
      .attr("font-size", 14)
      .attr("fill", "#324e60")
      .text((p) => (p.party === "無黨籍" ? "無黨籍（候選人合計）" : p.party));
    row
      .append("line")
      .attr("x1", (p) => x(p.voteShare))
      .attr("x2", (p) => x(p.seatShare))
      .attr("stroke", "#b9c7cf")
      .attr("stroke-width", 3);
    row
      .append("circle")
      .attr("cx", (p) => x(p.voteShare))
      .attr("r", 5)
      .attr("fill", (p) => ctx.COLORS[p.party] || "#78909c");
    row
      .append("circle")
      .attr("cx", (p) => x(p.seatShare))
      .attr("r", 6)
      .attr("fill", "#fff")
      .attr("stroke", (p) => ctx.COLORS[p.party] || "#78909c")
      .attr("stroke-width", 2.5);
    row
      .append("text")
      .attr("x", width - 20)
      .attr("y", 4)
      .attr("text-anchor", "end")
      .attr("font-size", 15)
      .attr("fill", "#324e60")
      .text((p) => ctx.sign(p.gap) + " pp");
    ctx.$("#vote-seat-method").textContent =
      state.system === "list"
        ? (qualified
            ? "目前只顯示獲分配席次的政黨，得票分母重新計為這些政黨有效票合計；這是門檻後口徑。"
            : "目前得票占比以全部有效政黨票為分母，包括未達5%門檻政黨；席次占比以34席為分母。") +
          "席次直接使用中選會公布分配與名單，不在此重建分配模擬。"
        : state.system === "regional"
          ? "各黨區域候選人票數按73選區合計；席次占比以73席為分母。不包含政黨票或原住民選票，未提名選區沒有該黨候選人票。"
          : "同一原住民類別的候選人票數按政黨合計；席次分母為該類別3席，當選資訊依中選會標記。平地與山地選票不混合。";
    ctx.selectVoteSeat(rows.find((p) => p.party === state.party) || rows[0]);
    svg.attr("data-ready", "true");
  }
  async function openVoteSeats() {
    if (!ctx.isLeg()) return;
    const dialog = ctx.$("#vote-seat-dialog");
    if (!dialog.open) dialog.showModal();
    if (!ctx.parliamentData) {
      ctx.$("#vote-seat-chart").removeAttribute("data-ready");
      ctx.$("#vote-seat-readout").textContent = "載入立委各類選票與席次資料…";
      try {
        await ctx.loadParliamentData();
      } catch {
        ctx.$("#vote-seat-readout").textContent =
          "資料載入失敗，請關閉後重新開啟。";
        return;
      }
    }
    if (dialog.open && ctx.isLeg()) ctx.renderVoteSeats();
  }
  ctx.$("#vote-seat-open").onclick = ctx.openVoteSeats;
  ctx.$("#vote-seat-close").onclick = () => {
    ctx.$("#vote-seat-dialog").close();
    ctx.updateHash();
  };
  ctx
    .$("#vote-seat-dialog")
    .addEventListener("cancel", () => requestAnimationFrame(ctx.updateHash));
  for (const key of ["system", "denominator"])
    ctx.$("#vote-seat-" + key).onchange = (ev) => {
      ctx.voteSeatState[key] = ev.target.value;
      ctx.voteSeatState.party = "";
      ctx.renderVoteSeats();
    };
  ctx.$("#vote-seat-expanded").onchange = (ev) => {
    ctx.voteSeatState.expanded = ev.target.checked;
    ctx.renderVoteSeats();
  };
  ctx.$("#vote-seat-csv").onclick = () => {
    const s = ctx.voteSeatSystem();
    ctx.csvTable(
      [
        "選舉",
        "席次類別",
        "政黨或候選人類別",
        "得票數",
        "得票分母",
        "得票分母口徑",
        "得票占比(%)",
        "席次",
        "席次分母",
        "席次占比(%)",
        "票席差(pp)",
        "來源版本",
      ],
      ctx
        .voteSeatEntries()
        .map((p) => [
          "2024立委",
          s.title,
          p.party,
          p.votes,
          p.denominator,
          ctx.voteSeatState.denominator,
          p.voteShare,
          p.seats,
          s.seats,
          p.seatShare,
          p.gap,
          "CEC 2024 final",
        ]),
      "臺灣2024-票席結構-" + ctx.voteSeatState.system + ".csv",
    );
  };
  function voteSeatExportXML() {
    if (!ctx.parliamentData?.analysis) return null;
    return ctx.standaloneSVGPanel(
      ctx.$("#vote-seat-chart"),
      "2024 立委 · " + ctx.voteSeatSystem().title + " · 票席結構",
      "● 得票占比；○ 席次占比。分母：" +
        (ctx.voteSeatState.denominator === "qualified"
          ? "獲分配政黨有效票"
          : "該類別全部有效票") +
        "；差值為席次占比減得票占比（pp）。",
    );
  }
  ctx.$("#vote-seat-svg").onclick = () => {
    const xml = ctx.voteSeatExportXML();
    if (xml)
      ctx.saveBlob(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        "臺灣2024票席結構-" + ctx.voteSeatSystem().title + ".svg",
      );
  };
  ctx.$("#vote-seat-png").onclick = () => {
    const xml = ctx.voteSeatExportXML();
    if (xml)
      ctx.downloadPNG(xml, "臺灣2024票席結構-" + ctx.voteSeatSystem().title);
  };
  function parseVoteSeatRoute(p) {
    if (!ctx.isLeg() || !p.has("seat-analysis")) {
      if (ctx.$("#vote-seat-dialog").open) ctx.$("#vote-seat-dialog").close();
      return;
    }
    ctx.voteSeatState.system = ["regional", "plain", "mountain"].includes(
      p.get("seat-analysis"),
    )
      ? p.get("seat-analysis")
      : "list";
    ctx.voteSeatState.denominator =
      p.get("seat-denominator") === "qualified" ? "qualified" : "all";
    ctx.voteSeatState.expanded = p.get("seat-expanded") === "1";
    ctx.voteSeatState.party = p.get("seat-party") || "";
    requestAnimationFrame(ctx.openVoteSeats);
  }
  function serializeVoteSeatRoute(p) {
    if (!ctx.$("#vote-seat-dialog").open) return;
    p.set("seat-analysis", ctx.voteSeatState.system);
    p.set("seat-denominator", ctx.voteSeatState.denominator);
    if (ctx.voteSeatState.expanded) p.set("seat-expanded", "1");
    if (ctx.voteSeatState.party) p.set("seat-party", ctx.voteSeatState.party);
  }
  document.addEventListener("keydown", (ev) => {
    if (
      !ev.target.closest?.("#vote-seat-chart [role=button]") ||
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(ev.key)
    )
      return;
    const nodes = ctx.$$("#vote-seat-chart [role=button]"),
      i = nodes.indexOf(ev.target),
      next =
        ev.key === "Home"
          ? 0
          : ev.key === "End"
            ? nodes.length - 1
            : (i +
                (["ArrowLeft", "ArrowUp"].includes(ev.key) ? -1 : 1) +
                nodes.length) %
              nodes.length;
    ev.preventDefault();
    ev.target.tabIndex = -1;
    nodes[next].tabIndex = 0;
    nodes[next].focus();
  });
}
