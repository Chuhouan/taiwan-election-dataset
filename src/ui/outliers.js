import { findOutliers } from "../data/outliers.js";
export function installOutliers(ctx) {
  ctx.$(".research-menu-items").insertAdjacentHTML("beforeend", '<div class="research-section"><strong>分布探索</strong><button id="outliers-open">離群地區</button></div>');
  document.body.insertAdjacentHTML("beforeend", '<dialog id="outliers-dialog" class="saved-views-dialog"><header class="filter-title"><h2>離群地區探索</h2><button id="outliers-close" aria-label="關閉離群探索">×</button></header><p>依目前分析集合的地區等權分布找出極端值。離群只描述數值位置，不表示錯誤、舞弊或個別選民行為。</p><div class="outlier-tools"><label>指標<select id="outlier-metric"><option value="share">候選人得票率</option><option value="margin">領先差距</option><option value="turnout">投票率</option></select></label><label>候選人<select id="outlier-candidate"><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select></label><label>方法<select id="outlier-method"><option value="iqr">四分位距 IQR · 1.5 倍</option><option value="z">Z 分數 · 3 個樣本標準差</option></select></label></div><p id="outlier-summary"></p><table class="analysis-table"><thead><tr><th>地區</th><th>數值</th><th>分布位置</th><th>Z 分數</th></tr></thead><tbody id="outlier-rows"></tbody></table></dialog>');
  function render() {
    const metric = ctx.$("#outlier-metric").value, candidate = ctx.$("#outlier-candidate").value,
      read = (r) => metric === "share" ? ctx.shareOf(r, candidate) : metric === "margin" ? ctx.marginOf(r) : ctx.turnoutOf(r),
      result = findOutliers(ctx.scoped().map((r) => ({ key: ctx.keyOf(r), value: read(r), name: ctx.areaName(r, true) })), ctx.$("#outlier-method").value),
      unit = metric === "margin" ? "pp" : "%";
    ctx.$("#outlier-candidate").disabled = metric !== "share";
    ctx.$("#outlier-summary").textContent = result.n < 4 ? "目前範圍少於 4 個可用地區，不判定離群。" : `${result.n} 個可用地區 · ${result.rows.length} 個離群值 · 下界 ${result.lower.toFixed(2)}${unit}／上界 ${result.upper.toFixed(2)}${unit}。嚴格低於下界或高於上界才列入。`;
    const host = ctx.$("#outlier-rows"); host.replaceChildren();
    for (const row of result.rows) {
      const tr = document.createElement("tr"), td = document.createElement("td"), button = document.createElement("button");
      button.textContent = row.name; button.onclick = () => { ctx.selectRegion(row.key); ctx.$("#outliers-dialog").close(); };
      td.append(button); tr.append(td);
      for (const value of [row.value.toFixed(2) + unit, row.direction, row.z.toFixed(2)]) { const cell = document.createElement("td"); cell.textContent = value; tr.append(cell); }
      host.append(tr);
    }
  }
  ctx.$("#outliers-open").onclick = () => {
    const leg = ctx.isLeg();
    ctx.$('#outlier-metric option[value="share"]').disabled = leg;
    if (leg && ctx.$("#outlier-metric").value === "share") ctx.$("#outlier-metric").value = "margin";
    ctx.$("#outlier-candidate").closest("label").hidden = leg;
    ctx.$("#outlier-candidate").value = ctx.state.candidate; render(); ctx.$("#outliers-dialog").showModal();
  };
  for (const id of ["outlier-metric", "outlier-candidate", "outlier-method"]) ctx.$("#" + id).onchange = render;
  ctx.$("#outliers-close").onclick = () => ctx.$("#outliers-dialog").close();
}
