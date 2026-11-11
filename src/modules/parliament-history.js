import { seatLayout } from "../charts/seat-layout.js";

const PARTY_ORDER = [
  "民進黨", "台灣基進", "時代力量", "台灣團結聯盟", "無黨團結聯盟",
  "無黨籍", "其他", "民眾黨", "親民黨", "國民黨",
];
const PARTY_COLORS = {
  民進黨: "#16804f",
  國民黨: "#2758b5",
  民眾黨: "#267b84",
  親民黨: "#cf7c30",
  時代力量: "#c9a227",
  台灣基進: "#8c4a32",
  台灣團結聯盟: "#9c6b30",
  無黨團結聯盟: "#6b7f8c",
  無黨籍: "#81613d",
  新黨: "#a18a37",
};
const KINDS = [
  ["regional", "區域"],
  ["list", "不分區"],
  ["plain", "平地原住民"],
  ["mountain", "山地原住民"],
];

/** Cross-term Legislative Yuan seats: composition comparison, not voter transfer. */
export function install(ctx) {
  Object.assign(ctx, {
    openParliamentHistory,
    renderParliamentHistory,
    parseParliamentHistoryRoute,
    serializeParliamentHistoryRoute,
    parliamentHistoryExportXML,
  });
  ctx.parliamentHistory = null;
  ctx.parliamentHistoryYear = 2024;
  ctx.parliamentHistoryView = "chamber";
  let playTimer = null;

  ctx
    .$(".research-menu-items")
    .insertAdjacentHTML("beforeend", '<button id="parliament-history-open">歷屆席次</button>');
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="parliament-history-dialog" aria-labelledby="parliament-history-title"><header class="history-header"><div><span>2008 — 2024 · 第7–11屆立委 · 各屆選舉當選結果</span><h2 id="parliament-history-title">立委席次組成與跨屆對照</h2></div><div class="history-downloads"><button id="parliament-history-csv">CSV</button><button id="parliament-history-svg">SVG</button><button id="parliament-history-png">PNG</button><button id="parliament-history-close" aria-label="關閉歷屆席次">×</button></div></header><div class="parliament-history-toolbar"><label>視圖<select id="parliament-history-view"><option value="chamber">議會席次圖</option><option value="flow">組成對照圖</option></select></label><div id="parliament-history-years" class="history-years" aria-label="選舉年份"></div><button id="parliament-history-play" aria-pressed="false">播放跨屆動畫</button></div><div class="parliament-history-body"><svg id="parliament-history-chart" viewBox="0 0 1100 560" role="img" aria-label="立委歷屆席次組成圖"></svg><aside id="parliament-history-detail" class="parliament-history-detail"></aside></div><p id="parliament-history-method" class="history-method"></p><footer class="history-source">資料：中選會各屆選舉資料庫原始候選人、政黨分配及當選名單；每屆按區域73、不分區34、平地3、山地3核對合計113席。<a href="https://db.cec.gov.tw/ElecTable" target="_blank" rel="noopener">中央選舉委員會選舉資料庫 ↗</a></footer></dialog>`,
  );

  const color = (p) => PARTY_COLORS[p] || "#9983b4";
  const orderIndex = (p) => {
    const i = PARTY_ORDER.indexOf(p);
    return i < 0 ? PARTY_ORDER.indexOf("其他") : i;
  };
  const term = () =>
    ctx.parliamentHistory?.terms.find((t) => t.year === ctx.parliamentHistoryYear) ||
    ctx.parliamentHistory?.terms.at(-1);

  function seatsOf(t) {
    const seats = [];
    for (const p of t.parties)
      for (const [key, label] of KINDS)
        for (let i = 0; i < p[key]; i++)
          seats.push({ party: p.party, kind: label, kindKey: key });
    seats.sort((a, b) => orderIndex(a.party) - orderIndex(b.party));
    return seats;
  }

  function renderYears() {
    const years = ctx.parliamentHistory.terms;
    ctx.$("#parliament-history-years").innerHTML = years
      .map(
        (t) =>
          '<button data-parliament-year="' +
          t.year +
          '" aria-pressed="' +
          (t.year === ctx.parliamentHistoryYear) +
          '"><span>' +
          t.year +
          '</span><i style="background:' +
          color(t.parties[0].party) +
          '"></i></button>',
      )
      .join("");
    ctx.$$("[data-parliament-year]").forEach((b) => {
      b.onclick = () => {
        stopPlay();
        ctx.parliamentHistoryYear = +b.dataset.parliamentYear;
        ctx.renderParliamentHistory();
      };
    });
  }

  function renderDetail(t) {
    ctx.$("#parliament-history-detail").innerHTML =
      '<div class="history-detail-year">' +
      t.year +
      " · 第" +
      t.term +
      '屆</div><p class="parliament-history-election">' +
      t.election +
      " 選舉 · 113席 · 過半 " +
      t.majority +
      '席</p><div class="parliament-history-parties">' +
      t.parties
        .map((p) => {
          const delta = previousDelta(t, p.party);
          return (
            '<div class="parliament-history-party" data-party="' +
            ctx.esc(p.party) +
            '"><div class="parliament-history-party-head"><span><i style="background:' +
            color(p.party) +
            '"></i>' +
            ctx.esc(p.party) +
            "</span><b>" +
            p.seats +
            " 席" +
            (delta == null ? "" : '<em class="' + (delta > 0 ? "up" : delta < 0 ? "down" : "") + '">' + (delta > 0 ? "+" : "") + delta + "</em>") +
            '</b></div><div class="history-track"><i style="width:' +
            (p.seats / 113) * 100 +
            "%;background:" +
            color(p.party) +
            '"></i></div><div class="parliament-history-kinds">' +
            KINDS.filter(([key]) => p[key])
              .map(([key, label]) => label + " " + p[key])
              .join(" · ") +
            "</div></div>"
          );
        })
        .join("") +
      '</div><p class="history-note">增減與上一屆同黨席次相比；無黨籍為候選人合計類別。</p>';
  }

  function previousDelta(t, party) {
    const i = ctx.parliamentHistory.terms.indexOf(t);
    if (i <= 0) return null;
    const prev = ctx.parliamentHistory.terms[i - 1].parties.find((p) => p.party === party);
    const now = t.parties.find((p) => p.party === party);
    return (now?.seats || 0) - (prev?.seats || 0);
  }

  function drawChamber(t) {
    const svg = ctx.d3.select("#parliament-history-chart"),
      width = 1100,
      height = 520;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("data-view", "chamber");
    svg.selectAll(".parliament-flow").remove();
    const seats = seatsOf(t),
      { slots, cx, cy } = seatLayout(width, height, 0, [15, 19, 23, 26, 30]);
    const nodes = seats.map((s, i) => ({ ...s, ...slots[i], index: i }));
    svg
      .selectAll(".parliament-seat")
      .data(nodes, (d) => d.index)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "parliament-seat")
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y)
            .attr("r", 0)
            .call((sel) => sel.transition().duration(400).attr("r", 9)),
        (update) => update,
      )
      .attr("data-party", (d) => d.party)
      .attr("data-kind", (d) => d.kind)
      .transition()
      .duration(650)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 9)
      .attr("fill", (d) => color(d.party))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.2);
    svg
      .selectAll(".parliament-seat")
      .select("title")
      .remove();
    svg
      .selectAll(".parliament-seat")
      .append("title")
      .text((d) => {
        const party = t.parties.find(party => party.party === d.party);
        const delta = previousDelta(t, d.party);
        return t.year + " 第" + t.term + "屆 · " + d.party + " · " + d.kind +
          " · 本屆 " + party.seats + " 席 · " +
          (delta === null ? "無可比數據" : "上屆 " + (party.seats - delta) + " 席，增減 " + (delta > 0 ? "+" : "") + delta + " 席") +
          " · " + (party.seats >= 57 ? "已達全院過半" : "距全院過半 " + (57 - party.seats) + " 席");
      });
    let majority = svg.select(".parliament-majority");
    if (majority.empty())
      majority = svg
        .append("text")
        .attr("class", "parliament-majority")
        .attr("text-anchor", "middle")
        .attr("font-size", 15)
        .attr("fill", "#536575");
    majority
      .attr("x", cx)
      .attr("y", cy - 12)
      .text(t.year + " 第" + t.term + "屆 · 113席 · 過半57席");
    let caption = svg.select(".parliament-caption");
    if (caption.empty())
      caption = svg
        .append("text")
        .attr("class", "parliament-caption")
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .attr("fill", "#687d89");
    caption
      .attr("x", cx)
      .attr("y", cy + 22)
      .text(
        t.parties.map((p) => p.party + " " + p.seats).join("　"),
      );
    svg.attr("data-ready", "true").attr("data-year", t.year);
  }

  function drawFlow() {
    const svg = ctx.d3.select("#parliament-history-chart"),
      width = 1260,
      height = 400,
      terms = ctx.parliamentHistory.terms,
      scale = 2.6,
      top = 74,
      colWidth = 118,
      step = (width - 180) / (terms.length - 1);
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("data-view", "flow");
    svg.selectAll("*").remove();
    const layouts = terms.map((t, i) => {
      let y = top;
      const blocks = t.parties
        .slice()
        .sort((a, b) => orderIndex(a.party) - orderIndex(b.party))
        .map((p) => {
          const block = { party: p.party, seats: p.seats, y0: y, y1: y + p.seats * scale };
          y = block.y1;
          return block;
        });
      return { term: t, x: 40 + i * step, blocks };
    });
    const flow = svg.append("g").attr("class", "parliament-flow");
    for (let i = 0; i < layouts.length - 1; i++) {
      const left = layouts[i],
        right = layouts[i + 1];
      for (const a of left.blocks) {
        const b = right.blocks.find((d) => d.party === a.party);
        if (!b) continue;
        const x0 = left.x + colWidth,
          x1 = right.x,
          mid = (x0 + x1) / 2;
        flow
          .append("path")
          .attr("class", "parliament-flow-link")
          .attr("data-party", a.party)
          .attr(
            "d",
            `M${x0},${a.y0} C${mid},${a.y0} ${mid},${b.y0} ${x1},${b.y0} L${x1},${b.y1} C${mid},${b.y1} ${mid},${a.y1} ${x0},${a.y1} Z`,
          )
          .attr("fill", color(a.party))
          .attr("fill-opacity", 0.28)
          .append("title")
          .text(a.party + "：" + left.term.year + " " + a.seats + "席 → " + right.term.year + " " + b.seats + "席");
      }
    }
    for (const layout of layouts) {
      const g = flow
        .append("g")
        .attr("class", "parliament-flow-column")
        .attr("data-year", layout.term.year);
      g.append("text")
        .attr("x", layout.x + colWidth / 2)
        .attr("y", 34)
        .attr("text-anchor", "middle")
        .attr("font-size", 17)
        .attr("font-weight", 600)
        .attr("fill", "#23333f")
        .text(layout.term.year);
      g.append("text")
        .attr("x", layout.x + colWidth / 2)
        .attr("y", 54)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "#687d89")
        .text("第" + layout.term.term + "屆 · 113席");
      for (const b of layout.blocks) {
        g.append("rect")
          .attr("class", "parliament-flow-block")
          .attr("data-party", b.party)
          .attr("data-seats", b.seats)
          .attr("x", layout.x)
          .attr("y", b.y0)
          .attr("width", colWidth)
          .attr("height", Math.max(1, b.y1 - b.y0 - 1.5))
          .attr("fill", color(b.party))
          .append("title")
          .text(layout.term.year + " " + b.party + " " + b.seats + "席");
        if (b.seats >= 6)
          g.append("text")
            .attr("x", layout.x + colWidth / 2)
            .attr("y", (b.y0 + b.y1) / 2 + 4)
            .attr("text-anchor", "middle")
            .attr("font-size", 14)
            .attr("fill", "#ffffff")
            .attr("stroke", "none")
            .text(b.party + " " + b.seats);
      }
    }
    svg.attr("data-ready", "true");
  }

  function renderParliamentHistory() {
    if (!ctx.parliamentHistory) return;
    const t = term();
    ctx.parliamentHistoryYear = t.year;
    ctx.$("#parliament-history-view").value = ctx.parliamentHistoryView;
    ctx.$(".parliament-history-body").dataset.view = ctx.parliamentHistoryView;
    ctx.$("#parliament-history-play").hidden = ctx.parliamentHistoryView !== "chamber";
    renderYears();
    if (ctx.parliamentHistoryView === "flow") drawFlow();
    else drawChamber(t);
    renderDetail(t);
    ctx.$("#parliament-history-method").textContent =
      ctx.parliamentHistoryView === "flow"
        ? "每欄為該屆113席的政黨組成；連線只表示同一政黨的席次數量變化，無黨籍為類別合計。這不是選民轉投、議員個人轉黨或個別席次繼承的推論。"
        : "每個圓點為一個當選席次，顏色為當選人所屬政黨；切換年份或播放可對照各屆組成變化。席次依中選會當選標記與不分區分配名單，非現任名單，也不代表投票人行為。";
    ctx.updateHash();
  }

  function stopPlay() {
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
    const b = ctx.$("#parliament-history-play");
    b.textContent = "播放跨屆動畫";
    b.setAttribute("aria-pressed", "false");
  }

  ctx.$("#parliament-history-play").onclick = () => {
    if (playTimer) {
      stopPlay();
      return;
    }
    const years = ctx.parliamentHistory.terms.map((t) => t.year);
    const b = ctx.$("#parliament-history-play");
    b.textContent = "停止播放";
    b.setAttribute("aria-pressed", "true");
    playTimer = setInterval(() => {
      const i = years.indexOf(ctx.parliamentHistoryYear);
      ctx.parliamentHistoryYear = years[(i + 1) % years.length];
      ctx.renderParliamentHistory();
    }, 1600);
  };

  async function openParliamentHistory() {
    const dialog = ctx.$("#parliament-history-dialog");
    if (!dialog.open) dialog.showModal();
    if (!ctx.parliamentHistory) {
      ctx.$("#parliament-history-detail").textContent = "載入歷屆立委席次資料…";
      try {
        const response = await fetch("parliament-history.json");
        if (!response.ok) throw Error("parliament-history");
        ctx.parliamentHistory = await response.json();
      } catch {
        ctx.$("#parliament-history-detail").textContent = "資料載入失敗，請關閉後重新開啟。";
        return;
      }
    }
    if (dialog.open) ctx.renderParliamentHistory();
  }

  ctx.$("#parliament-history-open").onclick = ctx.openParliamentHistory;
  ctx.$("#parliament-history-close").onclick = () => {
    stopPlay();
    ctx.$("#parliament-history-dialog").close();
    ctx.updateHash();
  };
  ctx.$("#parliament-history-dialog").addEventListener("cancel", () => {
    stopPlay();
    requestAnimationFrame(ctx.updateHash);
  });
  ctx.$("#parliament-history-view").onchange = (ev) => {
    stopPlay();
    ctx.parliamentHistoryView = ev.target.value;
    ctx.renderParliamentHistory();
  };

  ctx.$("#parliament-history-csv").onclick = () => {
    if (!ctx.parliamentHistory) return;
    ctx.csvTable(
      ["年份", "屆次", "選舉日期", "政黨或類別", "總席次", "區域73", "不分區34", "平地原住民3", "山地原住民3", "與上屆同黨增減", "席次分母", "來源"],
      ctx.parliamentHistory.terms.flatMap((t) =>
        t.parties.map((p) => [
          t.year,
          "第" + t.term + "屆",
          t.election,
          p.party,
          p.seats,
          p.regional,
          p.list,
          p.plain,
          p.mountain,
          previousDelta(t, p.party) ?? "",
          113,
          "CEC " + t.year + " final · " + t.sourceFolder,
        ]),
      ),
      "臺灣立委2008-2024席次組成.csv",
    );
  };

  function parliamentHistoryExportXML() {
    if (!ctx.parliamentHistory) return null;
    const t = term();
    return ctx.standaloneSVGPanel(
      ctx.$("#parliament-history-chart"),
      "立委席次組成 · " +
        (ctx.parliamentHistoryView === "flow" ? "2008–2024 第7–11屆對照" : t.year + " 第" + t.term + "屆"),
      "各屆選舉當選結果，113席；政黨組成對照不推論選民轉移。資料：中央選舉委員會。",
    );
  }
  ctx.$("#parliament-history-svg").onclick = () => {
    const xml = ctx.parliamentHistoryExportXML();
    if (xml)
      ctx.saveBlob(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        "臺灣立委歷屆席次-" + ctx.parliamentHistoryView + ".svg",
      );
  };
  ctx.$("#parliament-history-png").onclick = () => {
    const xml = ctx.parliamentHistoryExportXML();
    if (xml) ctx.downloadPNG(xml, "臺灣立委歷屆席次-" + ctx.parliamentHistoryView);
  };

  function parseParliamentHistoryRoute(p) {
    if (!p.has("parliament-history")) {
      if (ctx.$("#parliament-history-dialog").open) {
        stopPlay();
        ctx.$("#parliament-history-dialog").close();
      }
      return;
    }
    const year = +p.get("parliament-history");
    ctx.parliamentHistoryYear = [2008, 2012, 2016, 2020, 2024].includes(year) ? year : 2024;
    ctx.parliamentHistoryView = p.get("parliament-view") === "flow" ? "flow" : "chamber";
    requestAnimationFrame(ctx.openParliamentHistory);
  }
  function serializeParliamentHistoryRoute(p) {
    if (!ctx.$("#parliament-history-dialog").open) return;
    p.set("parliament-history", ctx.parliamentHistoryYear);
    p.set("parliament-view", ctx.parliamentHistoryView);
  }
}
