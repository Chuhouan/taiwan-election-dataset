import { describeScope } from "../data/scope.js";
import "../styles/desktop-experience.css";

const questions = {
  map: "各地的支持版圖有何不同？", hex: "每個地區等權，版圖會如何改變？",
  bubble: "哪些地區的有效票最多？", ternary: "三位候選人在哪些地方勢均力敵？",
  small: "同一地區，候選人的支持度差多少？", scatter: "地區之間的差異如何分布？",
};
const mapReading = {
  winner: "顏色為各地第一名政黨，色彩不表示領先幅度",
  runner: "顏色為各地第二名政黨",
  share: "候選人的有效票占比，顏色越深占比越高",
  margin: "前兩名得票率之差，單位為百分點",
  turnout: "投票數占選舉人數，單位為 %",
  bivariate: "橫向為得票率、縱向為投票率，色塊對應兩個區間",
};
const arrangements = {
  geo: "近似地理排列", party: "按各地第一名政黨排列",
  margin: "按領先差距排列", votes: "按有效票排列",
  rank: "按有效票排序", pack: "緊密排列，位置不表示地理",
  bar: "按各地第一名政黨分組",
};
const distributions = {
  swarm: "每點一地區 · 橫軸為前兩名差距（百分點）",
  histogram: "橫軸為得票率 · 每柱是 5 個百分點區間的地區數",
  ecdf: "橫軸為得票率 · 縱軸為低於或等於該值的地區占比",
  box: "每箱一縣市 · 縱軸為縣內地區得票率",
  dumbbell: "每列一地區 · 兩點為兩位候選人的得票率",
};

export function installDesktopExperience(ctx) {
  const $ = ctx.$;
  $(".analysis-state").insertAdjacentHTML("afterend", `
    <section id="chart-reading-guide" aria-labelledby="chart-question">
      <div><h2 id="chart-question"></h2><span id="chart-guide-context"></span></div>
      <p id="chart-guide-encoding"></p>
      <p id="chart-guide-hint"></p>
      <div id="chart-guide-extra" hidden></div>
    </section>`);
  $(".workspace-actions").prepend($("#dual-view"));
  $("#dual-view").textContent = "並排查看";
  $("#dual-view").title = "在同一分析範圍並排查看地圖與圖表";
  $(".detail-heading").insertAdjacentHTML("afterend", '<p id="inspection-status" hidden></p>');
  $("#detail-result").insertAdjacentHTML("afterend", `
    <div id="inspection-context" hidden><p id="inspection-baseline"></p>
      <div class="inspection-next"><button id="inspection-compare">加入地區比較</button>
        <button id="inspection-use-scope">設為分析範圍</button>
        <button id="inspection-history">查看歷史可比資料</button></div>
      <small id="inspection-history-note"></small>
    </div>`);
  $("#inspection-compare").onclick = () => {
    if (!ctx.state.pins.includes(ctx.state.key)) ctx.togglePin();
    ctx.openDrawer("compare");
  };
  $("#inspection-use-scope").onclick = () => {
    const r = ctx.records[ctx.state.key];
    if (!ctx.valid(r)) return;
    ctx.state.county = r.county;
    if (!ctx.isLeg() && r.town === "000" && ctx.state.level === "town") {
      ctx.state.brushed = [];
    } else {
      if (!ctx.isLeg()) ctx.state.level = r.town === "000" ? "county" : "town";
      ctx.state.brushed = [ctx.keyOf(r)];
    }
    if (ctx.hasConditions()) {
      if (r.town !== "000") {
        ctx.conditionBase = [ctx.keyOf(r)];
        ctx.filterSpec.mode = "intersection";
        $("#filter-mode").value = "intersection";
      }
      ctx.applyConditions(false);
    }
    ctx.lastDetail = "";
    ctx.updateUI();
  };
  $("#inspection-history").onclick = async () => {
    const r = ctx.records[ctx.state.key];
    if (!r || ctx.isLeg() || r.town !== "000") return;
    await ctx.ensureFeature("history");
    ctx.countyHistory.kind = "president";
    ctx.countyHistory.county = r.county;
    ctx.countyHistory.metric = ["winner", "turnout", "margin"].includes(ctx.state.metric) ? ctx.state.metric :
      ctx.state.candidate === "侯友宜" ? "kmt" : "dpp";
    ctx.countyHistory.a = 2020;
    ctx.countyHistory.b = 2024;
    ctx.countyHistory.view = ctx.state.metric === "winner" ? "maps" : "swipe";
    ctx.openCountyHistory();
  };
  $("#filter-summary").insertAdjacentHTML("beforebegin",
    '<p id="filter-preview" role="status" aria-live="polite"></p>');
  const preview = () => {
    if (ctx.isLeg()) return;
    const spec = Object.fromEntries(Object.keys(ctx.filterSpec).map(k => [k, $("#filter-" + k).value]));
    const second = Object.fromEntries(Object.keys(ctx.filterSpec2).map(k => [k, $("#filter2-" + k).value]));
    const fields = [...$("#conditions").querySelectorAll('input[type="number"]')];
    if (fields.some(input => !input.validity.valid)) {
      $("#filter-preview").textContent = "請輸入 0–100 之間的比率，再預覽或套用條件";
      return;
    }
    if (!["share", "turnout", "margin"].some(key => spec[key] !== "" || second[key] !== "")) {
      $("#filter-preview").textContent = spec.mode === "highlight"
        ? "尚未設定條件；目前沒有條件高亮，分析合計不變"
        : "尚未設定條件；套用後清除條件，恢復此地理範圍";
      return;
    }
    const result = ctx.evaluateConditions(spec, second, $("#filter-inter").value);
    $("#filter-preview").textContent = "預覽 · 符合 " + result.matches.length + "／" + result.rs.length +
      " 地區 · " + (spec.mode === "highlight" ? "高亮有效票 " : "套用後有效票 ") +
      ctx.fmt(ctx.d3.sum(result.result, key => ctx.records[key].total)) + " 票 · " +
      (spec.mode === "highlight" ? "只高亮，分析合計不變" : "套用後作為分析範圍");
  };
  for (const input of $("#conditions").querySelectorAll("input,select"))
    input.addEventListener("input", preview);

  function presentInspector(scope) {
    const r = ctx.records[ctx.state.key], valid = ctx.valid(r) && !ctx.selectedMember;
    $("#inspection-context").hidden = !valid;
    $("#inspection-status").hidden = !valid;
    if (!valid) return;
    $("#inspection-status").textContent = "正在查看" + ctx.areaName(r, true) + "；" +
      scope.area + "分析範圍維持 " + scope.count + " 個" + scope.unit;
    const national = ctx.isLeg() ? null : ctx.records["00000/000"];
    const delta = national && ctx.turnoutOf(r) !== null && ctx.turnoutOf(national) !== null
      ? ctx.turnoutOf(r) - ctx.turnoutOf(national) : null;
    $("#inspection-baseline").textContent = delta === null ? "候選人票數以本選區有效票為分母" :
      "本地投票率 " + ctx.pct(ctx.turnoutOf(r)) + " · 較全國 " + ctx.sign(delta) + " 個百分點";
    $("#inspection-compare").textContent = ctx.state.pins.includes(ctx.state.key) ? "查看地區比較" : "加入地區比較";
    const county = !ctx.isLeg() && r.town === "000";
    $("#inspection-use-scope").textContent = county ? "將此縣市設為分析範圍" : "將此地區設為分析範圍";
    const groups = [...ctx.groupSelection.a, ...ctx.groupSelection.b];
    const mixedLevel = !county && groups.some(key => ctx.records[key]?.town === "000");
    $("#inspection-use-scope").disabled = mixedLevel;
    $("#inspection-use-scope").title = mixedLevel ? "目前 A/B 使用縣市；清除分組後可切換鄉鎮層級" : "";
    const sameParty = ctx.state.metric === "share" && ctx.state.candidate !== "柯文哲";
    const comparable = county && (["winner", "turnout", "margin"].includes(ctx.state.metric) || sameParty);
    $("#inspection-history").hidden = !comparable;
    $("#inspection-history").textContent = sameParty ? "查看同黨歷史得票率" : "查看歷史可比資料";
    $("#inspection-history-note").textContent = comparable ? sameParty
      ? "已核驗的縣市範圍；跨屆比較同黨候選人，並非同一人"
      : "歷史使用已核驗的縣市統計範圍與相同指標" :
        county ? "目前歷史入口未提供此指標的跨屆對照" : "此層級尚無已核驗的跨屆地理對應";
  }

  function extraReading() {
    const extra = $("#chart-guide-extra");
    extra.replaceChildren();
    if (!ctx.scoped().length) { extra.hidden = true; return; }
    const { chart, distribution } = ctx.state;
    if (chart === "ternary" && ctx.ternaryObservations?.length) {
      const details = document.createElement("details"), summary = document.createElement("summary");
      summary.textContent = "本圖觀察";
      details.append(summary);
      for (const observation of ctx.ternaryObservations) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = observation.label;
        button.onclick = () => ctx.selectRegion(observation.key);
        details.append(button);
      }
      extra.append(details);
    } else if (chart === "scatter" && distribution === "box") {
      extra.innerHTML = '<svg viewBox="0 0 180 28" width="180" height="28" aria-label="箱體為四分位區間，中央線是中位數，兩端為最小與最大值"><path d="M8 14H172M8 7V21M172 7V21M55 5H125V23H55ZM90 5V23" fill="none" stroke="currentColor"/></svg><span>箱體 Q1–Q3 · 箱內線為中位數 · 鬚為最小／最大值 · 地區等權</span>';
    } else if (chart === "scatter" && distribution === "scatter" && ctx.axes.size === "votes") {
      const dots = [...$("#scatter").querySelectorAll(".scatter-dot")];
      const largest = dots.reduce((a, b) => !a || b.__data__.r.total > a.__data__.r.total ? b : a, null);
      if (largest) {
        const max = largest.__data__.r.total, radius = +largest.getAttribute("r");
        const values = [10000, 100000, 1000000].filter(value => value <= max).slice(-2);
        if (values.length < 2) values.splice(0, values.length, max / 4, max);
        extra.innerHTML = '<span>點面積＝有效票</span><svg width="180" height="64" viewBox="0 0 180 64" role="img" aria-label="與散點圖同一比例的有效票圓面積">' +
          values.map((value, i) => {
            const r = radius * Math.sqrt(value / max), x = 42 + i * 90;
            return '<circle cx="' + x + '" cy="24" r="' + r + '" fill="none" stroke="currentColor"/><text x="' + x +
              '" y="59" text-anchor="middle" fill="currentColor" font-size="11">' + ctx.fmt(value) + '票</text>';
          }).join("") + "</svg>";
      }
    }
    extra.hidden = !extra.childElementCount;
  }
  ctx.presentDesktopExperience = () => {
    if (!ctx.data) return;
    const scope = describeScope(ctx), { chart, metric } = ctx.state;
    document.title = $("#view-title").textContent + "｜臺灣選舉數據分析集成網";
    const seats = ctx.isLeg() && chart === "small";
    $("#chart-question").textContent = ctx.dualMode ? "地理與統計，並排讀取同一範圍" :
      seats ? "國會席次如何分布？" : questions[chart];
    $("#chart-guide-context").textContent = ctx.dualMode
      ? "共享選舉、分析範圍、查看地區 · 各側視角與顯示分別設定"
      : "2024 " + (ctx.isLeg() ? "立法委員" : "總統") + " · " + scope.area + " " + scope.count + " 個" + scope.unit;
    let encoding = $("#metric-formula").textContent;
    if (chart === "map") encoding = ctx.mapEncoding === "symbols" ? "圓面積為有效票，位置表示地區" :
      ctx.mapEncoding === "margin" ? "顏色為各地第一名政黨；深淺為領先差距（百分點）" :
      metric === "difference" ? ctx.state.candidate + " − " + ctx.state.otherCandidate + " · 得票率差（百分點）" :
        (["share", "advantage", "bivariate"].includes(metric) ? ctx.state.candidate + " · " : "") + (mapReading[metric] || ctx.metricDefinition().title);
    const color = metric === "winner" ? "各地第一名政黨" : metric === "runner" ? "各地第二名政黨" :
      (["share", "advantage", "bivariate"].includes(metric) ? ctx.state.candidate + " " : "") + ctx.metricDefinition().title;
    if (chart === "hex") encoding = "每格代表一個" + scope.unit + " · " + arrangements[ctx.chartOptions.hexLayout] + " · 顏色＝" + color;
    if (chart === "bubble") encoding = "圓面積＝有效票 · " + arrangements[ctx.chartOptions.bubbleLayout] + " · 顏色＝" + color;
    if (chart === "small" && !seats) encoding = (ctx.relativeMaps
      ? "共同色階 ±25 個百分點 · 各候選人的地區得票率 − 該候選人全國得票率"
      : "共同色階 0–65% · 每圖顏色為該候選人的有效票占比") +
      (ctx.smallMaps.difference ? " · 第四圖為 " + ctx.smallMaps.a + " − " + ctx.smallMaps.b + "，零中心 ±50 個百分點" : "");
    if (chart === "scatter" && ctx.state.distribution !== "scatter")
      encoding = distributions[ctx.state.distribution] + " · 地區等權" +
        (["swarm"].includes(ctx.state.distribution) ? "" : " · " + ctx.state.candidate);
    if (seats) encoding = (ctx.fullParliament ? "完整國會 113 席" : "區域類別 73 席") + " · 全院過半門檻始終為 57 席";
    $("#chart-guide-encoding").textContent = ctx.dualMode ? "左側地圖與右側圖表使用相同地區集合，編碼見各側圖例" : encoding;
    $("#chart-guide-hint").textContent = chart === "scatter" && ctx.state.distribution === "histogram"
      ? "點選柱形會將該區間地區設為分析範圍"
      : seats ? "移到席次查看當選人；點選固定詳情" : "移到圖形查看讀數；點選地區固定詳情";
    if (!scope.count) {
      $("#chart-guide-encoding").textContent = scope.pending ? "席次資料載入中" : "目前範圍沒有符合地區";
      $("#chart-guide-hint").textContent = scope.pending ? "" : "調整或清除條件後可重新顯示結果";
    }
    presentInspector(scope);
    if (!$("#conditions").hidden) preview();
    extraReading();
    const count = $("#ternary-view-count"), svg = $("#scatter");
    if (chart === "ternary" && +svg.dataset.totalCount) {
      const hidden = +svg.dataset.totalCount - +svg.dataset.visibleCount;
      if (hidden > 0) count.textContent += " · " + hidden + " 地區位於畫面外";
    }
    const small = $("#small-view-tab");
    if (small) small.title = "以共同色階並列比較候選人，並可開啟差值面板";
  };
  ctx.presentDesktopExperience();
}
