import { animateMotion } from "../core/motion.js";
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
  if (highlights.questions) {
    const { balanced, topFive, largestChange } = highlights.questions;
    const key = balanced.county + "/" + balanced.town;
    $("#home-ternary-preview").textContent = ctx.data.counties[balanced.county] + " · " + balanced.name + "最接近三人各得三分之一";
    $('[data-home-discover="distribution"]').href = exploreURL("chart", { chart: "ternary", l: "town", r: key, inspect: "1" });
    $("#home-votes-preview").textContent = "有效票最多的五個縣市，合計占全國 " + topFive.toFixed(1) + "%";
    $("#home-change-preview").textContent = largestChange.name + "民進黨得票率較 2020 年 " +
      ctx.sign(largestChange.after - largestChange.before) + " 個百分點";
  }
  const mini = (card, label, content) => {
    const link = $('[data-home-discover="' + card + '"]');
    link.querySelector(".home-mini-chart")?.remove();
    link.querySelector("strong").insertAdjacentHTML("afterend",
      '<svg class="home-mini-chart" viewBox="0 0 240 62" role="img" aria-label="' + ctx.esc(label) + '">' + content + '</svg>');
  };
  const close = highlights.closest?.[0]?.[1];
  if (close) mini("closest", ctx.areaName(close, true) + "前兩名得票率", close.candidates.slice(0,2).map((c,i) =>
    `<rect x="0" y="${i*27+3}" width="${c.votes/close.total*200}" height="9" rx="2" fill="${ctx.color(c.party)}"/><text x="130" y="${i*27+12}">${ctx.esc(c.name)} ${ctx.pct(c.votes/close.total*100)}</text>`).join(""));
  const balanced = highlights.questions?.balanced;
  if (balanced?.candidates) {
    const candidates = ctx.national().candidates.map(c => balanced.candidates.find(row => row.name === c.name));
    const [a,b,c] = candidates.map(c => c.share/100);
    mini("distribution", balanced.name + "三位候選人得票組合", `<path d="M35 1L3 57H67Z" fill="none" stroke="var(--line)"/><circle cx="${35*a+3*b+67*c}" cy="${a+57*b+57*c}" r="4" fill="var(--accent)"/>` +
      candidates.map((c,i) => `<text x="90" y="${12+i*20}" fill="${ctx.color(c.party)}">${ctx.esc(c.name)} ${ctx.pct(c.share)}</text>`).join(""));
  }
  const largest = Object.values(ctx.records).filter(r => r.county !== "00000" && r.town === "000").sort((a,b)=>b.total-a.total).slice(0,5);
  mini("votes", "有效票最多的五個縣市；圓面積與有效票成正比", largest.map((r,i) =>
    `<circle cx="${22+i*47}" cy="25" r="${20*Math.sqrt(r.total/largest[0].total)}" fill="${ctx.color(r.candidates[0].party)}" fill-opacity=".7"/><text x="${22+i*47}" y="59" text-anchor="middle">${ctx.esc(ctx.areaName(r).slice(0,2))}</text>`).join(""));
  const changeRow = highlights.questions?.largestChange;
  if (changeRow) mini("history", changeRow.name + "民進黨得票率：2020與2024原值", `<path class="mini-change-line" d="M20 ${55-changeRow.before*.5}L215 ${55-changeRow.after*.5}" fill="none" stroke="var(--accent)" stroke-width="2"/>` +
    [changeRow.before,changeRow.after].map((v,i)=>`<circle cx="${20+i*195}" cy="${55-v*.5}" r="4" fill="var(--accent)"/><text x="${i?235:0}" y="11" text-anchor="${i?'end':'start'}">${2020+i*4} · ${ctx.pct(v)}</text>`).join(""));
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      animateMotion(entry.target, "finding", [{opacity:.15,transform:"translateY(8px)"},{opacity:1,transform:"none"}], "data");
      reveal.unobserve(entry.target);
    }
  }, {threshold:.25});
  for (const svg of ctx.$$(".home-mini-chart")) reveal.observe(svg);
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
  $("#home-place-preview").textContent = `直轄市的區與縣轄鄉，投票率相差 ${Math.abs(city.turnout - village.turnout).toFixed(2)} 個百分點 · 查看行政分組對照 ↓`;
  const turnoutDelta = change.turnout[1] - change.turnout[0];
  if (!highlights.questions) $("#home-change-preview").textContent = `2024 全國投票率 ${rate(change.turnout[1])}，較上屆${turnoutDelta < 0 ? "下降" : "增加"} ${Math.abs(turnoutDelta).toFixed(2)} 個百分點。`;
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
      ${highlights.questions?.largestChange ? `<p class="home-method-line">${ctx.esc(highlights.questions.largestChange.name)}的民進黨得票率由 ${rate(highlights.questions.largestChange.before)} 變為 ${rate(highlights.questions.largestChange.after)}，差 ${gap(highlights.questions.largestChange.before, highlights.questions.largestChange.after)}。</p>` : ""}
      <a href="${exploreURL("history", { "history-region": "swipe", "history-a": "2020", "history-b": "2024", "history-metric": "dpp", "history-county": highlights.questions?.largestChange.code || "63000" })}">查看可比的縣市變化 ↗</a>
    </section>`;
}
