export async function presentHomeFindings(ctx, exploreURL) {
  const $ = ctx.$;
  const host = $("#home-evidence");
  let highlights = ctx.homeHighlights;
  if (!highlights?.place) {
    try {
      highlights = (await ctx.loadJSON("homepage.json")).highlights;
    } catch {
      host.textContent = "比較資料載入失敗。請重新載入頁面。";
      return;
    }
  }
  const { place, change } = highlights;
  const rate = (value) => value === null ? "未提名" : ctx.pct(value);
  const gap = (before, after) => before === null || after === null
    ? "不可比" : ctx.sign(after - before) + " 個百分點";
  const rows = (items) => items.map(({ name, values, term }) =>
    `<tr><th scope="row">${ctx.esc(name)}</th>${values.map((value) => `<td data-term="${term}">${rate(value)}</td>`).join("")}<td data-term="percentage_point">${gap(...values)}</td></tr>`
  ).join("");
  const city = place.cities, village = place.villages;
  const parties = change.partyResults.map(({ party, rates }) => ({ name: party, values: rates, term: "share" }));
  const placeRates = city.candidates.map((candidate, i) => ({
    name: candidate.name, values: [village.candidates[i].share, candidate.share], term: "share",
  }));
  $("#home-place-preview").textContent = `直轄市的區與縣轄鄉，投票率相差 ${Math.abs(city.turnout - village.turnout).toFixed(2)} 個百分點。`;
  const turnoutDelta = change.turnout[1] - change.turnout[0];
  $("#home-change-preview").textContent = `2024 全國投票率 ${rate(change.turnout[1])}，較上屆${turnoutDelta < 0 ? "下降" : "增加"} ${Math.abs(turnoutDelta).toFixed(2)} 個百分點。`;
  host.innerHTML = `
    <section id="home-place" class="home-evidence-block">
      <header><p class="home-kicker">地區對照 · 2024</p><h3>城市與鄉村的行政分組</h3>
        <p>比較直轄市的區與縣轄鄉。行政類型只作為城鄉代理，兩組都可能包含不同密度的聚落。</p></header>
      <table class="home-evidence-table">
        <thead><tr><th scope="col">讀數</th><th scope="col">縣轄鄉 · ${village.units} 鄉</th><th scope="col">直轄市的區 · ${city.units} 區</th><th scope="col">區 − 鄉</th></tr></thead>
        <tbody>${rows([...placeRates, { name: "投票率", values: [village.turnout, city.turnout], term: "turnout" }])}</tbody>
      </table>
      <p class="home-method-line">有效票分母為縣轄鄉 ${ctx.fmt(village.valid)} 票、直轄市的區 ${ctx.fmt(city.valid)} 票。投票率以各組選舉人數為分母。另有 ${place.excluded} 個行政區未納入這組對照。</p>
      <a href="${exploreURL("chart", { chart: "scatter", l: "town" })}">在分析台查看鄉鎮分布 ↗</a>
    </section>
    <section id="home-change" class="home-evidence-block">
      <header><p class="home-kicker">全國對照 · ${change.years.join(" → ")}</p><h3>與上屆相比</h3>
        <p>以各屆全國有效票比較同一政黨的總統候選人得票率。投票率依各屆選舉人數計算。</p></header>
      <table class="home-evidence-table">
        <thead><tr><th scope="col">讀數</th>${change.years.map((year) => `<th scope="col">${year}</th>`).join("")}<th scope="col">本屆 − 上屆</th></tr></thead>
        <tbody>${rows([...parties, { name: "投票率", values: change.turnout, term: "turnout" }])}</tbody>
      </table>
      <p class="home-method-line">未提名的政黨不計差值。全國總計可直接對照，鄉鎮與村里跨屆變化仍須核驗邊界。</p>
      <a href="${exploreURL("history", { "history-region": "swipe", "history-a": "2020", "history-b": "2024", "history-metric": "dpp" })}">查看可比的縣市變化 ↗</a>
    </section>`;
}
