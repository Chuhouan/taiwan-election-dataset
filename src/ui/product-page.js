import { productMode, productQuery, readRoute } from "../core/product-route.js";
import { capabilityNote, electionCapabilities } from "../core/capabilities.js";

const pageNames = { map: "地圖探索", chart: "圖表比較", history: "歷史與席次", filter: "條件與 A/B" };

export function installProductPage(ctx) {
  const root = document.documentElement;
  const page = root.dataset.page;
  if (page === "legacy") return;
  const $ = ctx.$;
  const detailHeading = $("#detail-title");
  const regionalHeading = document.createElement("h2");
  regionalHeading.id = detailHeading.id;
  regionalHeading.textContent = detailHeading.textContent;
  detailHeading.replaceWith(regionalHeading);
  const mainLink = $("#product-main-link");
  const url = (path, params) => {
    const target = new URL(path, document.baseURI);
    target.search = params?.toString() || "";
    return target.href;
  };
  const exploreURL = (mode, patch = {}) => {
    const params = new URLSearchParams(ctx.data ? ctx.routeString().slice(1) : readRoute());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return url("explore/", productQuery(params, "explore", mode));
  };
  $(".brand").href = url("./");
  $(".brand").removeAttribute("aria-label");
  $(".brand").title = "返回首頁";
  mainLink.href = page === "home" ? exploreURL("map") : url("./");
  if (page !== "home") mainLink.textContent = "返回首頁";
  const title = "臺灣選舉數據分析集成網";
  const heading = page === "about" ? "關於本網" : page === "explore" ? pageNames[productMode()] : "";
  document.title = heading ? heading + "｜" + title : title;
  $(".brand b").textContent = "選舉集成網";
  $(".brand > span").textContent = "TAIWAN ELECTION DATA ATLAS";
  $(".app-header").insertAdjacentHTML("afterend", '<div class="desktop-note" role="status">分析介面適用於寬度 1024 像素以上的視窗。</div>');

  function showLoadError(status) {
    status.replaceChildren(document.createTextNode("地圖資料載入失敗。 "));
    const retry = document.createElement("button");
    retry.textContent = "重新載入";
    retry.onclick = () => location.reload();
    status.append(retry);
    status.hidden = false;
  }

  if (page === "about") {
    document.body.classList.remove("loading");
    document.body.setAttribute("aria-busy", "false");
    $(".app-header").insertAdjacentHTML("afterend", `
      <main class="atlas-about">
        <p class="home-kicker">資料與口徑</p>
        <h1>關於本網</h1>
        <p class="atlas-intro">查閱臺灣選舉結果，從全國、縣市到鄉鎮比較得票與投票情形。</p>
        <section><h2>資料來源</h2><p>選舉結果來自中央選舉委員會。行政區圖形用於結果定位，離島分幅比例不同。歷史縣市比較使用可核對的統計範圍。</p>
          <div id="about-evidence" aria-live="polite">讀取資料版本…</div>
          <p><a href="https://db.cec.gov.tw/" target="_blank" rel="noopener">中央選舉委員會選舉資料庫 ↗</a> · <a href="https://github.com/Chuhouan/taiwan-election-dataset" target="_blank" rel="noopener">原始資料與程式 ↗</a></p>
        </section>
        <section><h2>術語索引</h2><div id="knowledge-index"></div></section>
      </main>`);
    ctx.loadJSON("metadata.json").then((metadata) => {
      $("#about-evidence").textContent = "資料整理 " + metadata.data_updated_at +
        " · 行政區圖資 " + metadata.boundary_version.administrative + " · " + metadata.verification_status;
    }).catch(() => { $("#about-evidence").textContent = "資料版本載入失敗。"; });
    return;
  }

  if (page === "explore") {
    $(".app-header").insertAdjacentHTML("afterend", `
      <section class="atlas-modes">
        <h1 class="sr-only">分析台</h1>
        <nav aria-label="分析台模式">
          ${Object.entries(pageNames).map(([key, label]) =>
            '<a data-product-mode="' + key + '">' + label + '</a>').join("")}
        </nav>
        <a href="${url("about/")}">資料來源與術語 ↗</a>
      </section>`);
    root.dataset.mode = productMode();
    $(".map-workspace").insertAdjacentHTML("beforeend", '<div class="home-map-status" id="workspace-load-error" role="status" hidden></div>');
    ctx.presentProductError = () => showLoadError($("#workspace-load-error"));
    $("#copy-link").insertAdjacentHTML("afterend", '<button type="button" id="copy-summary" title="複製目前選舉、圖表與分析範圍的文字摘要">複製摘要</button>');
    $("#copy-summary").onclick = async () => {
      if (!ctx.data) return;
      const summary = ctx.shareSummary();
      try {
        await navigator.clipboard.writeText(summary);
        ctx.toast("已複製分析摘要");
      } catch {
        ctx.toast(summary);
      }
    };
    $(".atlas-modes").insertAdjacentHTML("afterend", `
      <section class="atlas-mode-tools">
        <div data-mode-tools="history">
          <button type="button" id="product-history-president">歷屆總統結果</button>
          <button type="button" id="product-history-seats">立委席次組成</button>
          <button type="button" id="product-history-counties">縣市歷史比較</button>
        </div>
        <div data-mode-tools="filter">
          <button type="button" id="product-conditions">編輯條件</button>
          <button type="button" id="product-groups">比較 A/B 分組</button>
          <span id="product-condition-status"></span>
        </div>
        <p id="product-capability-note"></p>
      </section>`);
    $("#product-history-president").onclick = () => ctx.openNationalHistory();
    $("#product-history-seats").onclick = () => location.assign(exploreURL("history", {
      e: "legislator", chart: "small", r: null, inspect: null, c: null, dual: null,
      "national-history": null, "history-region": null, archive: null,
    }));
    $("#product-history-counties").onclick = () => ctx.openCountyHistory();
    $("#product-conditions").onclick = () => $("#conditions-open").click();
    $("#product-groups").onclick = () => $("#groups-open").click();
    ctx.goToProductMode = (mode, patch) => location.assign(exploreURL(mode, patch));
    $(".research-menu-items").insertAdjacentHTML("beforeend", '<div class="research-section"><strong>圖形比較</strong><button type="button" id="product-parallel">並列比較</button></div>');
    $("#product-parallel").onclick = () => ctx.goToProductMode("chart", { chart: "small" });
    ctx.presentProductPage = () => {
      const current = productMode();
      for (const link of ctx.$$("[data-product-mode]")) {
        const mode = link.dataset.productMode;
        const election = ctx.state.e;
        const patch = mode === "chart" ? { chart: ctx.state.chart === "map" ? election === "legislator" ? "hex" : "ternary" : ctx.state.chart }
          : mode === "history" ? election === "legislator" ? { chart: "small", dual: null } : { "national-history": "2024", dual: null }
            : { chart: "map", dual: null, "national-history": null, "history-region": null, "parliament-history": null, archive: null };
        link.href = exploreURL(mode, patch);
        if (mode === current) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      $(".research-menu #research-summary").textContent = "更多分析";
      const capabilities = electionCapabilities[ctx.state.e];
      $("#product-capability-note").textContent = capabilityNote(ctx.state.e);
      $("#product-capability-note").hidden = !ctx.isLeg();
      $("#product-parallel").disabled = ctx.isLeg();
      for (const id of ["product-conditions", "product-groups"]) {
        $("#" + id).disabled = !capabilities.conditions;
        $("#" + id).title = capabilities.conditions ? "" : "此工具適用於總統選舉的共同候選人結果。";
      }
      $("#product-condition-status").textContent = ctx.hasConditions()
        ? ctx.$("#filter-summary").textContent : "設定條件縮小範圍，或用 A/B 比較兩組地區。";
      if (ctx.state.chart === "map" && (!ctx.filterActive || ctx.state.brushed.length))
        showMapReadoutKey();
    };
    return;
  }

  const stage = $(".map-workspace");
  stage.setAttribute("aria-label", "全國選舉版圖");
  stage.insertAdjacentHTML("afterbegin", '<p class="home-map-label"><span>01 / 全國版圖</span><span>各地第一名所屬政黨</span></p>');
  stage.insertAdjacentHTML("beforeend", '<div id="home-map-status" class="home-map-status" role="status">正在載入縣市版圖…</div>');
  $(".detail-sidebar").insertAdjacentHTML("beforeend", `
    <div class="home-detail-actions">
      <a id="home-detail-explore">在分析台打開 →</a>
      <button type="button" id="home-detail-close">關閉</button>
    </div>
    <div id="home-detail-towns"></div>`);
  $(".analysis-layout").insertAdjacentHTML("afterend", `
    <section class="home-discover" aria-labelledby="home-discover-title">
      <p class="home-kicker">02 / 深入選舉結果</p>
      <h2 id="home-discover-title">從全國結果走到每一個地區</h2>
      <div class="home-discover-grid">
        <a data-home-discover="closest"><span>01 · 競爭</span><strong>最接近的鄉鎮</strong><p id="home-closest"></p></a>
        <a data-home-discover="distribution"><span>02 · 分布</span><strong>各地得票差異</strong><p>比較投票率、得票率與勝負差距。</p></a>
        <a data-home-discover="votes"><span>03 · 規模</span><strong>選票集中在哪裡</strong><p>用圓面積比較各地的有效票規模。</p></a>
        <a data-home-discover="history"><span>04 · 歷史</span><strong>歷屆總統選舉</strong><p>查看 1996 年以來的全國結果與縣市比較。</p></a>
      </div>
      <details id="home-close-races"><summary>本屆前十個最接近的鄉鎮</summary><ol></ol></details>
      <footer><span id="home-geographic-result"></span><a href="${url("about/")}">關於本網 · 資料來源與術語 ↗</a></footer>
    </section>`);
  const homeStatus = $("#home-map-status");
  function showMapReadoutKey() {
    const legend = $("#legend");
    if (legend.querySelector(".atlas-legend-no-data")) return;
    legend.insertAdjacentHTML("beforeend", '<div class="atlas-legend-no-data"><i aria-hidden="true"></i><button type="button" data-term="no_data">無資料</button></div>');
  }
  const closeDetails = () => {
    ctx.clearInspection();
    ctx.state.county = "";
    document.body.classList.add("detail-closed");
    ctx.updateUI();
  };
  $("#home-detail-close").onclick = closeDetails;
  $("#map").addEventListener("click", (event) => {
    if (event.target === $("#map") && ctx.state.key) closeDetails();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && ctx.state.key && !$(".knowledge-popover")?.open)
      closeDetails();
  });
  ctx.presentProductError = () => showLoadError(homeStatus);

  let townsRequest;
  ctx.ensureHomeTowns = async () => {
    if (!ctx.homeCompact) return true;
    if (!townsRequest) townsRequest = Promise.all([
      ctx.loadJSON("data.json"), ctx.loadJSON("towns-lod0.json"),
    ]).then(([data, topology]) => {
      ctx.data = data;
      ctx.records = data[ctx.state.e];
      ctx.topology = topology;
      ctx.counties = ctx.topojson.feature(topology, topology.objects.counties).features;
      ctx.towns = ctx.topojson.feature(topology, topology.objects.towns).features;
      ctx.lodFeatures[0] = new Map([...ctx.counties, ...ctx.towns].map((feature) => [ctx.geoKey(feature), feature]));
      ctx.homeCompact = false;
      ctx.homeMapNeedsTowns = true;
      return true;
    }).catch(() => {
      townsRequest = null;
      ctx.presentProductError();
      return false;
    });
    return townsRequest;
  };
  let renderedDetail;
  function showTowns(row) {
    const host = $("#home-detail-towns");
    host.replaceChildren();
    if (!row || row.town !== "000") return;
    const list = document.createElement("details");
    const caption = document.createElement("summary");
    caption.textContent = "查看轄內鄉鎮市區";
    list.append(caption);
    host.append(list);
    list.ontoggle = async () => {
      if (!list.open || list.dataset.status) return;
      list.dataset.status = "loading";
      const entries = list.querySelector("ul") || document.createElement("ul");
      entries.textContent = "載入鄉鎮結果…";
      list.append(entries);
      if (!(await ctx.ensureHomeTowns())) {
        delete list.dataset.status;
        entries.textContent = "載入失敗，請重新開啟。";
        return;
      }
      list.dataset.status = "ready";
      entries.replaceChildren();
      for (const entry of Object.values(ctx.records).filter((r) => ctx.valid(r) && r.county === row.county && r.town !== "000")) {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.textContent = entry.name + " · " + entry.candidates[0].name + " " + ctx.pct(100 * entry.candidates[0].votes / entry.total);
        button.onclick = () => {
          ctx.state.level = "town";
          ctx.selectRegion(ctx.keyOf(entry));
          if (ctx.homeMapNeedsTowns) {
            ctx.homeMapNeedsTowns = false;
            ctx.buildMap();
          }
        };
        li.append(button);
        entries.append(li);
      }
    };
  }
  let discovered = false;
  ctx.presentProductPage = () => {
    homeStatus.hidden = true;
    showMapReadoutKey();
    mainLink.href = exploreURL("map", { detail: ctx.state.key ? "1" : null });
    $("#home-detail-explore").href = mainLink.href;
    const key = ctx.state.key;
    document.body.classList.toggle("home-has-detail", !!key);
    if (renderedDetail !== key) {
      showTowns(ctx.records[key]);
      renderedDetail = key;
    }
    if (discovered) return;
    discovered = true;
    const closest = ctx.homeHighlights?.closest ||
      Object.entries(ctx.records).filter(([, row]) => ctx.valid(row) && row.town !== "000")
        .sort(([, a], [, b]) => ctx.marginOf(a) - ctx.marginOf(b)).slice(0, 10);
    if (closest.length) $("#home-closest").textContent = ctx.areaName(closest[0][1], true) +
      " · 兩人相差 " + ctx.marginOf(closest[0][1]).toFixed(2) + " 個百分點";
    for (const [region, row] of closest) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = exploreURL("map", { r: region, l: "town", inspect: "1" });
      link.textContent = ctx.areaName(row, true) + " · " + ctx.marginOf(row).toFixed(2) + " 個百分點";
      li.append(link);
      $("#home-close-races ol").append(li);
    }
    const [nationalWinner] = ctx.national().candidates;
    const otherCount = Object.values(ctx.records).filter((row) =>
      ctx.valid(row) && row.county !== "00000" && row.town === "000" && row.candidates[0].name !== nationalWinner.name).length;
    $("#home-geographic-result").textContent = otherCount + " 個縣市由其他候選人領先。";
    $('[data-home-discover="closest"]').href = exploreURL("map", { r: closest[0]?.[0], inspect: "1", l: "town", sort: "margin" });
    $('[data-home-discover="distribution"]').href = exploreURL("chart", { chart: "scatter", l: "town" });
    $('[data-home-discover="votes"]').href = exploreURL("chart", { chart: "bubble" });
    $('[data-home-discover="history"]').href = exploreURL("history", { "national-history": "2024" });
  };
}
