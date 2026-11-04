import { localMoran } from "../data/local-moran.js";
export function installLocalSpatial(ctx) {
  const $ = ctx.$;
  $(".spatial-toolbar").insertAdjacentHTML("beforebegin", '<div class="spatial-tabs"><button data-spatial-view="global" class="active">全域關聯</button><button data-spatial-view="local">局部聚集 LISA</button></div>');
  $(".spatial-layout").insertAdjacentHTML("afterend", '<section id="local-spatial-panel" hidden><div class="outlier-tools"><label>條件排列次數<select id="local-permutations"><option>99</option><option selected>999</option><option>4999</option></select></label><label>隨機種子<input id="local-seed" type="number" value="2024" min="0" max="4294967295"></label><label>多重檢定<select id="local-correction"><option value="by">BY · 保守校正</option><option value="bh">BH · 非負相關假設</option></select></label><button id="local-export">完整分析 CSV</button></div><p id="local-summary"></p><div id="local-result-table"></div><details><summary>局部指標、排列與多重檢定方法</summary><p>Ii=(n−1)·zi·mean(zj)／Σz²，z為範圍內去平均值，鄰接採逐列標準化。每次保留本地數值，自其他地區無放回抽取同數量鄰居。雙尾p值比較觀測值與條件期望值的絕對距離，含加1校正；與使用不同尾數定義的套件不一定相同。預設BY校正所有有效地區，q≤0.05才標為顯著。BH依賴非負相關假設。置換有限時解析度受限，沒有顯著地區也可能是正確結果。</p><p>HH／LL／HL／LH描述相對範圍平均的組合；統計顯著、視覺連通與因果關係是不同概念。孤島不補接鄰居，篩選後使用內部子圖。</p><a href="https://pysal.org/esda/v2.9.0/source/generated/esda.Moran_Local.html" target="_blank" rel="noopener">局部 Moran 定義 ↗</a> · <a href="https://www.statsmodels.org/stable/generated/statsmodels.stats.multitest.multipletests.html" target="_blank" rel="noopener">多重檢定方法 ↗</a></details></section>');
  let result, generation = 0;
  async function render() {
    if ($("#local-spatial-panel").hidden || !ctx.spatialPayload) return;
    const ticket = ++generation;
    $("#local-summary").textContent = "計算條件排列與多重檢定…";
    await new Promise(requestAnimationFrame);
    if (ticket !== generation) return;
    const candidate = $("#spatial-candidate").value, graph = ctx.spatialPayload[$("#spatial-weights").value],
      seed = Number.isFinite(+$("#local-seed").value) ? +$("#local-seed").value >>> 0 : 2024;
    $("#local-seed").value = seed;
    result = localMoran(ctx.spatialScope.map((r) => ({ key: ctx.keyOf(r), value: ctx.shareOf(r, candidate) })), graph,
      { seed, permutations: +$("#local-permutations").value, correction: $("#local-correction").value });
    $("#local-summary").textContent = `${candidate} · ${result.n} 地區 · ${result.permutations} 次排列 · seed=${result.seed} · ${$("#spatial-weights").value} 鄰接 · ${result.correction.toUpperCase()} q≤0.05：${result.rows.filter((r) => r.significant).length} 地區。` + (result.reason || "") + ` 排除 ${result.excluded.length} 個無有效內部鄰接／數值的單位。`;
    $("#local-result-table").innerHTML = '<table class="analysis-table"><thead><tr><th>地區</th><th>得票率</th><th>鄰區平均</th><th>Ii</th><th>p</th><th>校正q</th><th>型態</th><th>鄰區</th></tr></thead><tbody>' + result.rows.slice().sort((a, b) => a.q - b.q).map((r) => '<tr><td><button data-local-key="' + ctx.esc(r.key) + '">' + ctx.esc(ctx.areaName(ctx.records[r.key], true)) + '</button></td><td>' + ctx.pct(r.value) + '</td><td>' + ctx.pct(r.lag) + '</td><td>' + r.I.toFixed(4) + '</td><td>' + r.p.toFixed(4) + '</td><td>' + r.q.toFixed(4) + '</td><td>' + (r.significant ? ctx.esc(r.quadrant) : '未達顯著') + '</td><td>' + r.neighbors.length + '</td></tr>').join("") + '</tbody></table><details><summary>排除單位清單</summary>' + result.excluded.map((key) => ctx.esc(ctx.areaName(ctx.records[key], true))).join('、') + '</details>';
    for (const button of ctx.$$('[data-local-key]')) button.onclick = () => { ctx.selectRegion(button.dataset.localKey); $("#spatial-dialog").close(); };
  }
  const setView = (local) => {
    $(".spatial-layout").hidden = local; $("#local-spatial-panel").hidden = !local;
    for (const button of ctx.$$('[data-spatial-view]')) button.classList.toggle("active", (button.dataset.spatialView === "local") === local);
    if (local) render();
  };
  for (const button of ctx.$$('[data-spatial-view]')) button.onclick = () => setView(button.dataset.spatialView === "local");
  for (const id of ["local-permutations", "local-seed", "local-correction", "spatial-weights", "spatial-candidate"]) $("#" + id).addEventListener("change", render);
  $("#spatial-dialog").addEventListener("close", () => { generation++; setView(false); });
  $("#local-export").onclick = () => {
    if (!result) return;
    ctx.csvTable(["地區ID", "得票率", "鄰區平均", "Ii", "條件期望", "p雙尾", "q校正", "象限", "顯著", "鄰區ID與等權", "排除ID", "排列次數", "種子", "校正"],
      result.rows.map((r) => [r.key, r.value, r.lag, r.I, r.expected, r.p, r.q, r.quadrant, r.significant, r.neighbors.map((k) => k + ":" + 1 / r.neighbors.length).join("|"), result.excluded.join("|"), result.permutations, result.seed, result.correction]), "臺灣選舉-局部空間關聯.csv");
  };
}
