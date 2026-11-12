import { seatLayout } from "../charts/seat-layout.js";
/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    loadParliamentData,
    renderElectedMember,
    seatInFocus,
    drawSeatArc,
    presentParliament,
    serializeSeatRoute,
    parseSeatRoute,
    presentParliamentDetail,
    download,
    serializeMemberRoute,
    parseMemberRoute,
  });
  ctx.parliamentData = null;
  ctx.parliamentLoadPromise = null;
  ctx.fullParliament = true;
  ctx.selectedMember = "";
  ctx.seatFocus = "all";
  document.body.dataset.parliamentState = "idle";
  function loadParliamentData() {
    if (ctx.parliamentData) return Promise.resolve(ctx.parliamentData);
    if (!ctx.parliamentLoadPromise) {
      document.body.dataset.parliamentState = "loading";
      ctx.parliamentLoadPromise = Promise.all([
        ctx.loadJSON("parliament.json"),
        ctx.loadJSON("parliament-history.json").catch(() => null),
      ])
        .then(([d, history]) => {
          ctx.previousParliament = history?.terms.find(term => term.year === 2020);
          ctx.parliamentData = d;
          document.body.dataset.parliamentState = "ready";
          return d;
        })
        .catch((error) => {
          ctx.parliamentLoadPromise = null;
          document.body.dataset.parliamentState = "error";
          throw error;
        });
    }
    return ctx.parliamentLoadPromise;
  }
  function renderElectedMember(member) {
    const list = member.kind === "不分區";
    ctx.$("#detail-title").textContent = member.name;
    ctx.$("#detail-scope").textContent = "2024選舉當選 · " + member.kind;
    ctx.$("#detail-stats").innerHTML =
      '<div class="detail-stat"><small>政黨</small><strong>' +
      ctx.esc(member.party) +
      '</strong></div><div class="detail-stat"><small>' +
      (list ? "原始名單順位" : "候選人票數") +
      "</small><strong>" +
      (list ? member.rank : ctx.fmt(member.votes)) +
      "</strong></div>";
    ctx.$("#detail-result").innerHTML =
      '<div class="member-detail"><b>' +
      ctx.esc(member.kind) +
      "</b>" +
      (list
        ? "<p>政黨票 " +
          ctx.fmt(member.partyVotes) +
          "／" +
          ctx.fmt(member.partyValidVotes) +
          " 有效票（" +
          ctx.pct(member.partyVoteShare) +
          "）。該黨獲配 " +
          member.partyListSeats +
          " 個不分區席次。</p><p>政黨票屬於政黨，不記作這位名單候選人的個人票。</p>"
        : "<p>候選人有效票占比 " +
          ctx.pct(member.voteShare) +
          " · 得票名次 " +
          (member.voteRank || "—") +
          "</p><p>投票 " +
          ctx.fmt(member.cast) +
          "／選舉人 " +
          ctx.fmt(member.eligible) +
          "（" +
          ctx.pct((member.cast / member.eligible) * 100) +
          "）。" +
          ctx.fmt(member.validVotes) +
          " 張有效票。</p><p>" +
          (member.kind.includes("原住民")
            ? "本類別選出3席"
            : "本區域選區選出1席") +
          "；當選標記依中選會。</p>") +
      '<a href="https://web.cec.gov.tw/central/article/41421" target="_blank" rel="noopener">中選會當選公告 ↗</a></div>';
    ctx.$("#detail-chart").innerHTML = "";
    ctx.$("#detail-note").textContent =
      "2024.01.13選舉最終結果與名單；不是現任委員名單。";
    ctx.$("#export-scope").options[1].disabled = false;
  }
  ctx
    .$(".map-workspace")
    .insertAdjacentHTML(
      "beforeend",
      '<div id="seat-mode-control" class="relative-control" hidden><label for="seat-mode">席次範圍</label><select id="seat-mode"><option value="full">完整113席</option><option value="regional">區域73席</option></select></div>',
    );
  ctx
    .$("#seat-mode-control")
    .insertAdjacentHTML(
      "beforeend",
      '<label id="seat-focus-label">聚焦類型<select id="seat-focus"><option value="all">全部席次</option><option value="區域">區域73席</option><option value="不分區">不分區34席</option><option value="原住民">原住民6席</option></select></label>',
    );
  ctx.$("#seat-focus").onchange = (ev) => {
    ctx.seatFocus = ev.target.value;
    ctx.selectedMember = "";
    ctx.state.key = "";
    ctx.lastDetail = "";
    ctx.updateUI();
  };
  function seatInFocus(m) {
    return (
      ctx.seatFocus === "all" ||
      (ctx.seatFocus === "原住民"
        ? m.kind.includes("原住民")
        : m.kind === ctx.seatFocus)
    );
  }
  ctx.$("#seat-mode").onchange = () => {
    ctx.fullParliament = ctx.$("#seat-mode").value === "full";
    ctx.updateUI();
  };

  function drawSeatArc() {
    if (!ctx.fullParliament) {
      ctx.drawRegionalSeatArc();
      return;
    }
    if (!ctx.parliamentData) {
      const host = ctx.chartDimensions(),
        svg = ctx.d3
          .select("#scatter")
          .attr("viewBox", `0 0 ${host.width} ${host.height}`)
          .attr("aria-label", "完整113席資料載入中");
      svg.selectAll("*").remove();
      svg
        .append("text")
        .attr("x", host.width / 2)
        .attr("y", host.height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .attr("fill", "#687d89")
        .text("載入完整113席當選名單…");
      return;
    }
    const host = ctx.chartDimensions(),
      cw = Math.max(300, host.width),
      ch = Math.max(350, host.height),
      svg = ctx.d3.select("#scatter").attr("viewBox", `0 0 ${cw} ${ch}`);
    const savedSeats = svg.selectAll(".seat-dot").nodes();
    for (const node of savedSeats) node.remove();
    svg.selectAll("*").remove();
    for (const node of savedSeats) svg.node().append(node);
    const order = ["民進黨", "民眾黨", "國民黨", "無黨籍"],
      rs = ctx.parliamentData.members
        .slice()
        .sort((a, b) => order.indexOf(a.party) - order.indexOf(b.party));
    const { radius, cx, cy, slots } = seatLayout(
      cw,
      ch,
      Math.max(170, ctx.chartToolsBottom()),
      [15, 19, 23, 26, 30],
    );
    const isSelected = (d) =>
      d.id === ctx.selectedMember ||
      (d.kind === "區域" &&
        ctx.state.key === d.county + ":" + d.district + "/000");
    const nodes = rs.map((m, i) => ({ ...m, ...slots[i] }));
    const circles = svg
      .selectAll(".seat-dot")
      .data(nodes, (d) => d.id)
      .join("circle")
      .attr("class", "seat-dot")
      .attr("data-member-id", (d) => d.id)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", Math.max(4, Math.min(8, radius / 30)))
      .attr("fill", d => ctx.color(d.party))
      .attr("fill-opacity", d => ctx.seatInFocus(d) ? 1 : .16)
      .attr("stroke", (d) =>
        isSelected(d)
          ? "#172331"
          : !ctx.seatInFocus(d)
            ? "#c5ced5"
            : d.kind === "不分區"
              ? "#fff"
              : d.kind === "區域"
                ? "#172331"
                : "#956b33",
      )
      .attr("stroke-width", (d) =>
        isSelected(d) ? 4 : d.kind.includes("原住民") ? 2.5 : 1,
      )
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => d.name + " " + d.party + " " + d.kind);
    circles
      .classed("selected", isSelected)
      .attr("data-seat-kind", (d) => d.kind);
    svg.selectAll(".seat-majority-gate").remove();
    const gateAngle = (slots[56].angle + slots[57].angle) / 2,
      gate = svg.append("g").attr("class", "seat-majority-gate");
    gate
      .append("line")
      .attr("x1", cx + Math.cos(gateAngle) * radius * 0.4)
      .attr("y1", cy - Math.sin(gateAngle) * radius * 0.4)
      .attr("x2", cx + Math.cos(gateAngle) * radius * 1.06)
      .attr("y2", cy - Math.sin(gateAngle) * radius * 1.06)
      .attr("stroke", "#9d824f")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5 4");
    gate
      .append("text")
      .attr("x", cx + Math.cos(gateAngle) * radius * 1.16)
      .attr("y", cy - Math.sin(gateAngle) * radius * 1.16 + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#8b734a")
      .text("過半 57");
    svg
      .insert("g", ".seat-dot")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("class", "seat-hit-area")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 12)
      .attr("fill", "transparent")
      .attr("aria-hidden", "true");
    function detail(m) {
      document.body.classList.remove("detail-closed");
      ctx.$("#detail-toggle").setAttribute("aria-expanded", "true");
      if (m.kind === "區域") {
        ctx.selectedMember = "";
        ctx.selectRegion(m.county + ":" + m.district + "/000", false);
        return;
      }
      ctx.selectedMember = m.id;
      ctx.state.key = "";
      ctx.updateUI();
      ctx.renderElectedMember(m);
      ctx.updateHash();
    }

    svg
      .selectAll(".seat-dot,.seat-hit-area")
      .on("click", (_, d) => detail(d))
      .on("keydown", (ev, d) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          detail(d);
        }
      })
      .on("pointermove", (ev, d) => {
        const tip = ctx.$("#map-tooltip");
        tip.hidden = false;
        const bounds = ctx.$("#map-host").getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(bounds.width - 245, ev.clientX - bounds.left + 16)) + "px";
        tip.style.top = Math.max(105, Math.min(bounds.height - 90, ev.clientY - bounds.top - 60)) + "px";
        const total = ctx.parliamentData.counts[d.party] || 0;
        const prior = ctx.previousParliament?.parties.find(party => party.party === d.party)?.seats || 0;
        const delta = total - prior;
        const change = ctx.previousParliament ? "較上屆 " + (delta > 0 ? "+" : "") + delta + " 席" : "無可比數據";
        tip.innerHTML =
          '<div class="tip-place">' +
          ctx.esc(d.name) +
          "</div><div>" +
          ctx.esc(d.party) +
          " · " +
          ctx.esc(d.kind) +
          "</div><div>本屆 " + total + " 席 · " + change + "</div><div>" +
          (total >= 57 ? "達全院過半門檻" : "距全院過半 " + (57 - total) + " 席") + "</div>";
      })
      .on("pointerleave", () => (ctx.$("#map-tooltip").hidden = true));
    const chosen = nodes.find(isSelected);
    svg
      .append("text")
      .attr("class", "seat-selection-title")
      .attr("x", cx)
      .attr("y", cy - 58)
      .attr("text-anchor", "middle")
      .attr("font-size", chosen ? 24 : 30)
      .attr("font-weight", 600)
      .attr("fill", "#263f50")
      .text(chosen ? chosen.name : "57 席");
    svg
      .append("text")
      .attr("class", "seat-selection-subtitle")
      .attr("x", cx)
      .attr("y", cy - 31)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .attr("fill", "#536575")
      .text(
        chosen ? chosen.party + " · " + chosen.kind : "完整113席的過半門檻",
      );
    ctx.$("#legend").innerHTML =
      '<div class="legend-title">2024當選席次 · 當選時政黨</div><div class="legend-parties">' +
      order
        .map((p) => {
          const seats = ctx.parliamentData.counts[p];
          const prior = ctx.previousParliament?.parties.find(party => party.party === p)?.seats || 0;
          const delta = seats - prior;
          const reading = "本屆 " + seats + " 席 · " + (ctx.previousParliament
            ? "上屆 " + prior + " 席，增減 " + (delta > 0 ? "+" : "") + delta + " 席"
            : "無可比數據") + " · " + (seats >= 57 ? "達全院過半" : "距全院過半 " + (57 - seats) + " 席");
          return '<span title="' + ctx.esc(reading) + '"><i style="background:' +
            ctx.color(p) +
            '"></i>' +
            p +
            " " +
            ctx.parliamentData.counts[p] +
            "</span>";
        })
        .join("") +
      '</div><div class="seat-types-key"><span><i class="seat-kind-regional"></i>區域73</span><span><i class="seat-kind-list"></i>不分區34</span><span><i class="seat-kind-indigenous"></i>原住民6</span></div><div class="legend-foot">每點一名2024當選人，非實際座次；57席為完整113席的過半門檻。</div>';
    ctx.$("#finding").classList.remove("selection-active");
    ctx.$("#finding").textContent =
      ctx.seatFocus === "all"
        ? "國民黨52席、民進黨51席、民眾黨8席、無黨籍2席；各黨均未單獨達到57席。"
        : "聚焦" +
          ctx.seatFocus +
          " " +
          ctx.parliamentData.members.filter(ctx.seatInFocus).length +
          "席；灰色為其他類型。國會摘要和57席過半門檻仍以113席為分母。";
    ctx.$("#view-description").textContent =
      "完整113席 · 點選查看當選人與席次類別";
  }
  function presentParliament() {
    const awaiting =
      ctx.isLeg() &&
      ctx.state.chart === "small" &&
      ctx.fullParliament &&
      !ctx.parliamentData;
    ctx.$("#download").disabled = awaiting;
    if (awaiting) {
      ctx.$("#scope-summary").textContent = "完整113席 · 載入中";
      ctx.$("#finding").classList.remove("selection-active");
    ctx.$("#finding").textContent = "正在載入國會當選名單與席次類別。";
      if (!ctx.parliamentLoadPromise)
        ctx
          .loadParliamentData()
          .then(() => {
            if (ctx.data && ctx.isLeg() && ctx.state.chart === "small")
              ctx.updateUI();
          })
          .catch(() => {
            if (!ctx.isLeg() || ctx.state.chart !== "small") return;
            ctx.$("#seat-mode").value = "regional";
            ctx.fullParliament = false;
            ctx.toast("完整國會名單載入失敗，已切換區域73席");
            ctx.updateUI();
          });
    }
    ctx.$("#seat-mode-control").hidden =
      !ctx.isLeg() || ctx.state.chart !== "small";
    if (ctx.isLeg()) ctx.renderNational();
    if (
      ctx.isLeg() &&
      ctx.state.chart === "small" &&
      ctx.fullParliament &&
      ctx.parliamentData
    ) {
      ctx.$("#scope-summary").textContent = "完整立法院 · 113席";
      ctx.$("#finding").classList.remove("selection-active");
    ctx.$("#finding").textContent =
        "國民黨52席、民進黨51席、民眾黨8席、無黨籍2席；各黨均未單獨達到57席。";
      ctx.$("#score-title").textContent = "全國 · 完整國會";
      ctx.$("#national-scores").innerHTML = Object.entries(
        ctx.parliamentData.counts,
      )
        .sort((a, b) => b[1] - a[1])
        .map(
          ([p, n]) =>
            '<div class="national-card"><span class="score-name"><i style="background:' +
            ctx.color(p) +
            '"></i>' +
            p +
            '</span><span class="score-main"><strong>' +
            n +
            "<em>席</em></strong></span></div>",
        )
        .join("");
      ctx.$("#national-turnout").textContent = "57 / 113";
      ctx.$(".national-turnout small").textContent = "過半門檻 / 全部席次";
    } else ctx.$(".national-turnout small").textContent = "全國投票率";
  }
  function serializeSeatRoute(p) {
    if (!ctx.fullParliament) p.set("seats", "regional");
    if (ctx.seatFocus !== "all") p.set("seat-focus", ctx.seatFocus);
  }
  function parseSeatRoute(p) {
    ctx.fullParliament = p.get("seats") !== "regional";
    ctx.$("#seat-mode").value = ctx.fullParliament ? "full" : "regional";
    const focus = p.get("seat-focus");
    ctx.seatFocus = ["區域", "不分區", "原住民"].includes(focus)
      ? focus
      : "all";
    ctx.$("#seat-focus").value = ctx.seatFocus;
  }
  function presentParliamentDetail() {
    const active =
      ctx.isLeg() &&
      ctx.state.chart === "small" &&
      ctx.fullParliament &&
      ctx.parliamentData;
    document.body.classList.toggle("full-parliament", !!active);
    if (active && !ctx.state.key) {
      ctx.$("#detail-scope").textContent = "2024.01.13 · 完整國會當選";
      ctx.$("#detail-title").textContent = "113席";
      ctx.$("#detail-stats").innerHTML =
        '<div class="detail-stat"><small>過半門檻</small><strong>57 席</strong></div><div class="detail-stat"><small>席次類別</small><strong>73 / 34 / 6</strong></div>';
      const candidates = Object.entries(ctx.parliamentData.counts)
        .sort((a, b) => b[1] - a[1])
        .map(([party, votes]) => ({
          party,
          name: party,
          votes,
          share: (votes / 113) * 100,
        }));
      ctx.$("#detail-result").innerHTML = ctx.resultCandidates(
        { candidates },
        true,
      );
      ctx.$("#detail-chart").innerHTML = "";
      ctx.$("#detail-note").textContent =
        "區域73、不分區34、原住民6 · 當選時政黨歸屬";
    }
    ctx.$("#seat-focus-label").hidden = !active;
    if (active && ctx.seatFocus !== "all") {
      const n = ctx.parliamentData.members.filter(ctx.seatInFocus).length;
      ctx.$("#scope-summary").textContent =
        "完整113席 · 聚焦" + ctx.seatFocus + " " + n + "席";
      ctx.$("#finding").classList.remove("selection-active");
    ctx.$("#finding").textContent =
        "聚焦" +
        ctx.seatFocus +
        " " +
        n +
        "席；灰色為其他類型。全國摘要與57席過半門檻仍以完整113席為分母。";
    }
    const member = active
      ? ctx.parliamentData.members.find((m) => m.id === ctx.selectedMember)
      : null;
    if (member) ctx.renderElectedMember(member);
  }

  function download(onlySelection = false) {
    const member =
      ctx.isLeg() &&
      ctx.parliamentData?.members.find((m) => m.id === ctx.selectedMember);
    if (
      member &&
      (onlySelection || ctx.$("#export-scope").value === "selected")
    ) {
      ctx.csvTable(
        [
          "姓名",
          "政黨",
          "席次類別",
          "原始名單順位",
          "候選人票數",
          "候選人得票率",
          "政黨票數",
          "政黨票得票率",
          "資料來源",
        ],
        [
          [
            member.name,
            member.party,
            member.kind,
            member.rank || "",
            member.votes ?? "",
            member.voteShare ?? "",
            member.partyVotes ?? "",
            member.partyVoteShare ?? "",
            "CEC 2024 final",
          ],
        ],
        "臺灣2024-當選人-" + member.name + ".csv",
      );
      return;
    }
    if (
      !(
        ctx.isLeg() &&
        ctx.state.chart === "small" &&
        ctx.fullParliament &&
        ctx.parliamentData
      ) ||
      onlySelection ||
      ctx.$("#export-scope").value === "selected"
    ) {
      ctx.downloadRegionResults(onlySelection);
      return;
    }
    const rows = [
      [
        "選舉日期",
        "當選人ID",
        "姓名",
        "當選時政黨",
        "席次類別",
        "名單順位",
        "縣市代碼",
        "選區",
        "候選人票數",
        "候選人得票率",
        "政黨票數",
        "政黨票得票率",
        "資料來源",
      ],
      ...ctx.parliamentData.members
        .filter(
          (m) => ctx.$("#export-scope").value === "all" || ctx.seatInFocus(m),
        )
        .map((m) => [
          "2024-01-13",
          m.id,
          m.name,
          m.party,
          m.kind,
          m.rank || "",
          m.county || "",
          m.district || "",
          m.votes ?? "",
          m.voteShare ?? "",
          m.partyVotes ?? "",
          m.partyVoteShare ?? "",
          "CEC 2024 final",
        ]),
    ];
    const csv =
      "\ufeff" +
      rows
        .map((r) =>
          r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
        )
        .join("\r\n");
    ctx.saveBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      "臺灣2024-" +
        (ctx.$("#export-scope").value === "all" || ctx.seatFocus === "all"
          ? "完整113席"
          : ctx.seatFocus) +
        "當選名單.csv",
    );
    ctx.toast("已匯出目前範圍的當選名單");
  }
  function serializeMemberRoute(p) {
    if (ctx.isLeg() && ctx.fullParliament && ctx.selectedMember)
      p.set("member", ctx.selectedMember);
  }
  function parseMemberRoute(p) {
    const requested = p.get("member") || "";
    ctx.selectedMember =
      ctx.isLeg() &&
      ctx.state.chart === "small" &&
      ctx.fullParliament &&
      !ctx.state.key
        ? requested
        : "";
  }
}
