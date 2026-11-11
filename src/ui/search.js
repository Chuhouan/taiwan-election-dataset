export const searchText = (s) => String(s).replaceAll("臺", "台").replace(/[\s·第選區縣市]/g, "").toLowerCase();
export function installSearch(ctx) {
  const input = ctx.$("#search"), box = ctx.$("#search-results");
  const searchText = (text) => normalizeSearchText(ctx.normalizeSearchText?.(text) || text);
  input.placeholder = "搜尋地區、候選人或功能";
  input.setAttribute("aria-label", input.placeholder);
  const actions = [
    ["地理分布", "map", "比較各地支持版圖"], ["等權格網", "hex", "每格一地區，等權比較"],
    ["票數規模", "bubble", "用圓面積比較有效票"], ["三方競爭", "ternary", "觀察三位候選人的得票組合"],
    ["候選人並列比較", "small", "同一色階比較支持度與差值"], ["統計分布", "scatter", "比較差距、分布和變數關係"],
  ];
  const tools = [["票源與貢獻", "contribution-open", "比較票源集中與淨領先"],
    ["條件篩選", "conditions-open", "以得票率、投票率及差距組合條件"],
    ["A/B 群組比較", "groups-open", "比較兩組地區的加總結果"],
    ["資料與方法", "methods-open", "查閱來源、分母和術語"],
    ["收藏與最近檢視", "saved-views-open", "還原本機保存的分析"],
    ["歷屆選舉", "history-open", "比較歷屆全國結果"]];
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
    section("地區", records.filter((r) => searchText(ctx.areaName(r, true)).includes(query))
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
    const modes = [
      ["版圖模式", "territory"],
      ["支持度模式", "support"],
      ["差值模式", "difference"],
      ["規模模式", "scale"],
      ["雙變量模式", "bivariate"],
      ["歷史變化", "history-change"],
    ];
    const modeItems = modes
        .filter(([label]) => searchText(label).includes(query))
        .map(([label, mode]) => ({
          label,
          detail: mode === "history-change" ? "開啟歷史變化視圖" : "切換地圖模式",
          action: () => {
            if (mode === "history-change" && ctx.goToProductMode)
              ctx.goToProductMode("history", { "history-region": "swipe", "history-a": "2020", "history-b": "2024",
                "history-county": ctx.state.county || "63000" });
            else if (mode === "history-change") location.hash =
                "#e=president&history-a=2020&history-b=2024&history-county=" +
                (ctx.state.county || "63000");
            else {
              ctx.state.chart = "map";
              ctx.setMapMode(mode);
            }
          },
        }));
    section("分析工具", [
      ...modeItems,
      ...actions.filter(([label, chart]) => searchText(label).includes(query) && (!ctx.isLeg() || chart !== "ternary")).map(([label, chart, detail]) => ({ label, detail, action: () => {
        if (ctx.goToProductMode) ctx.goToProductMode(chart === "map" ? "map" : "chart", { chart });
        else { ctx.state.chart = chart; ctx.updateUI(); }
      } })),
      ...tools.filter(([label, id]) => searchText(label).includes(query) && !ctx.$("#" + id)?.disabled &&
        !(ctx.goToProductMode && id === "saved-views-open")).map(([label, id, detail]) => ({
        label, detail,
        action: () => {
          if (ctx.goToProductMode && id === "methods-open")
            location.assign(new URL("about/", document.baseURI));
          else ctx.$("#" + id)?.click();
        },
      })),
    ]);
    if (!box.childElementCount) box.textContent = "找不到符合的地區、候選人或功能。";
  };
  input.oninput = show;
  input.onkeydown = (event) => {
    if (event.key === "Enter") box.querySelector("button")?.click();
    if (event.key === "Escape") box.hidden = true;
  };
}

const normalizeSearchText = searchText;
