import { geographyEvidence } from "../data/geography-evidence.js";
let registry;
export async function openEvidence(ctx) {
  if (!document.querySelector("#evidence-dialog")) {
    document.body.insertAdjacentHTML("beforeend", '<dialog id="evidence-dialog" class="saved-views-dialog"><header class="filter-title"><h2>資料來源與證據鏈</h2><button id="evidence-close" aria-label="關閉來源">×</button></header><p>資料來源、檔案雜湊與衍生方法分開列示；有雜湊不代表歷史地理已核驗。</p><label>搜尋資料集<input id="evidence-search" placeholder="選舉、年份、縣市碼或檔名"></label><select id="evidence-dataset" aria-label="資料集"></select><section id="evidence-detail"></section></dialog>');
    ctx.$("#evidence-close").onclick = () => ctx.$("#evidence-dialog").close();
  }
  const dialog = ctx.$("#evidence-dialog");
  if (!dialog.open) dialog.showModal();
  ctx.$("#evidence-detail").textContent = "載入來源紀錄…";
  try { registry ||= await ctx.loadJSON("dataset-registry.json"); }
  catch { ctx.$("#evidence-detail").textContent = "來源紀錄載入失敗，請重試。"; return; }
  const render = () => {
    const item = registry.datasets.find((d) => d.dataset_id === ctx.$("#evidence-dataset").value), host = ctx.$("#evidence-detail");
    host.replaceChildren(); if (!item) { host.textContent = "沒有符合的資料集。"; return; }
    const row = (label, value) => {
      const heading = document.createElement("h3"), text = document.createElement("p");
      heading.textContent = label; text.textContent = value == null ? "未留存" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
      text.className = "evidence-value"; host.append(heading, text);
    };
    row("選舉與資料集", item.election_id + " · " + item.dataset_id);
    row("資料檔案", item.asset); row("檔案 SHA-256", item.asset_sha256);
    row("統計層級", item.geography_level);
    row("可比性", item.comparability?.grade + " · " + item.comparability?.reason);
    row("邊界版本與衍生方法", item.boundary || "本資料集不提供可核驗幾何對應");
    if (item.boundary) row("顯示定位圖資標記", geographyEvidence(item.geography_level.includes("district") ? "district" : item.geography_level.includes("village") ? "village" : "administrative", ctx.siteMetadata));
    row("來源檔案與雜湊", item.source); row("核對狀態", item.verification_status);
  };
  const filter = () => {
    const query = ctx.$("#evidence-search").value.trim().toLowerCase(), select = ctx.$("#evidence-dataset"); select.replaceChildren();
    for (const item of registry.datasets.filter((d) => [d.dataset_id, d.election_id, d.asset].join(" ").toLowerCase().includes(query)))
      select.append(new Option(item.election_id + " · " + item.asset + " · " + item.dataset_id, item.dataset_id));
    render();
  };
  ctx.$("#evidence-search").value = ctx.state.e === "president" ? "president:2024" : "立法委員";
  ctx.$("#evidence-search").oninput = filter;
  ctx.$("#evidence-dataset").onchange = render;
  filter();
}
