export function installDownloads(ctx) {
  ctx.$("#export-scope").hidden = true;
  document.body.insertAdjacentHTML("beforeend", '<dialog id="csv-dialog" class="saved-views-dialog"><header class="filter-title"><h2>匯出選舉結果 CSV</h2><button id="csv-close" aria-label="關閉資料匯出">×</button></header><p>選擇這次下載的資料集合。固定檢視與條件高亮不會自動縮小分析範圍。</p><form id="csv-form"><fieldset class="csv-scope-options"><legend>資料範圍</legend><label><input type="radio" name="csv-scope" value="range" required><span>目前分析集合<small id="csv-range-description"></small></span></label><label><input type="radio" name="csv-scope" value="selected"><span>單一固定檢視<small id="csv-selected-description"></small></span></label><label><input type="radio" name="csv-scope" value="all"><span>全臺目前層級<small id="csv-all-description"></small></span></label></fieldset><p>UTF-8 BOM 編碼；包含原始票數、得票率、分母及來源版本。政黨席次與區域票數依各自選制分開輸出。</p><button type="submit" id="csv-confirm">下載 CSV</button></form></dialog>');
  const open = (selected = false) => {
    const rs = ctx.scoped(), full = Object.values(ctx.records).filter((r) => ctx.valid(r) && (ctx.isLeg() ? r.town === "000" : ctx.state.level === "town" ? r.town !== "000" : r.town === "000")),
      parliament = ctx.isLeg() && ctx.state.chart === "small";
    ctx.$("#csv-range-description").textContent = parliament ? "目前國會模式的席次資料" : rs.length + " 個地區，所有候選人結果";
    ctx.$("#csv-all-description").textContent = parliament ? ctx.fullParliament ? "完整國會 113 席，依席次類型分列" : "區域立委 73 選區；不含政黨不分區及原住民席次" : full.length + " 個地區，忽略目前縣市或條件篩選";
    ctx.$("#csv-selected-description").textContent = ctx.selectedMember ? "目前檢視的當選席位" : ctx.state.key ? ctx.areaName(ctx.rec(), true) : "尚未固定檢視地區";
    ctx.$('#csv-form input[value="selected"]').disabled = !ctx.state.key && !ctx.selectedMember;
    for (const radio of ctx.$$('#csv-form input[name="csv-scope"]')) radio.checked = selected && radio.value === "selected";
    ctx.$("#csv-dialog").showModal();
  };
  ctx.$("#download").onclick = () => open();
  ctx.$("#detail-export").onclick = () => open(true);
  ctx.$("#csv-close").onclick = () => ctx.$("#csv-dialog").close();
  ctx.$("#csv-form").onsubmit = (event) => {
    event.preventDefault();
    const mode = ctx.$('#csv-form input[name="csv-scope"]:checked')?.value;
    if (!mode) return;
    ctx.$("#export-scope").value = mode;
    ctx.$("#csv-dialog").close(); ctx.updateHash(); ctx.download(mode === "selected");
  };
}
