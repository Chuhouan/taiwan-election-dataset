export const searchText = (s) => String(s).replaceAll("臺", "台").replace(/[\s·第選區縣市]/g, "").toLowerCase();
export function installSearch(ctx) {
  const input = ctx.$("#search"), box = ctx.$("#search-results");
  input.placeholder = "搜尋地區、候選人或功能";
  input.setAttribute("aria-label", input.placeholder);
  const actions = [
    ["地理分布", "map"], ["等權格網", "hex"], ["票數規模", "bubble"], ["三方競爭", "ternary"], ["候選人並列比較", "small"], ["統計分布", "scatter"],
  ];
  const tools = [["票源與貢獻", "contribution-open"], ["條件篩選", "conditions-open"], ["A/B 群組比較", "groups-open"], ["資料與方法", "methods-open"], ["收藏與最近檢視", "saved-views-open"], ["歷屆選舉", "history-open"]];
  const show = () => {
    if (!ctx.data) return;
    const query = searchText(input.value.trim());
    box.replaceChildren(); box.hidden = !query;
    if (!query) return;
    const section = (name, items) => {
      if (!items.length) return;
      const title = document.createElement("strong"); title.className = "search-category"; title.textContent = name; box.append(title);
      for (const { label, detail = "", action } of items.slice(0, 8)) {
        const button = document.createElement("button"), text = document.createElement("span"), secondary = document.createElement("small");
        button.type = "button"; text.textContent = label; secondary.textContent = detail; button.append(text, secondary);
        button.onclick = () => { box.hidden = true; input.value = ""; action(); };
        box.append(button);
      }
    };
    const records = Object.values(ctx.records).filter((r) => ctx.valid(r) && (!ctx.isLeg() || r.town === "000"));
    section("地區與選區", records.filter((r) => searchText(ctx.areaName(r, true)).includes(query))
      .sort((a, b) => Number(b.town === "000") - Number(a.town === "000"))
      .map((r) => ({ label: ctx.areaName(r, true), detail: "檢視結果", action: () => ctx.selectRegion(ctx.keyOf(r)) })));
    const seen = new Set(), candidateItems = [];
    for (const r of records) for (const c of r.candidates) {
      const id = c.name + (ctx.isLeg() ? ctx.keyOf(r) : "");
      if (!searchText(c.name).includes(query) || seen.has(id)) continue;
      seen.add(id);
      candidateItems.push({ label: c.name, detail: ctx.isLeg() ? ctx.areaName(r) : c.party, action: () => {
        if (ctx.isLeg()) ctx.selectRegion(ctx.keyOf(r));
        else { ctx.state.candidate = c.name; ctx.state.metric = "share"; ctx.updateUI(); }
      } });
    }
    section("候選人", candidateItems);
    section("視圖與研究工具", [
      ...actions.filter(([label, chart]) => searchText(label).includes(query) && (!ctx.isLeg() || chart !== "ternary")).map(([label, chart]) => ({ label, detail: "切換視圖", action: () => { ctx.state.chart = chart; ctx.updateUI(); } })),
      ...tools.filter(([label, id]) => searchText(label).includes(query) && !ctx.$("#" + id)?.disabled).map(([label, id]) => ({ label, detail: "開啟功能", action: () => ctx.$("#" + id)?.click() })),
    ]);
    if (!box.childElementCount) box.textContent = "找不到符合的地區、候選人或功能。";
  };
  input.oninput = show;
  input.onkeydown = (event) => {
    if (event.key === "Enter") box.querySelector("button")?.click();
    if (event.key === "Escape") box.hidden = true;
  };
}
