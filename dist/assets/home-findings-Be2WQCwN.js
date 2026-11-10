async function w(e,i){const n=e.$,l=n("#home-evidence");let c=e.homeHighlights;if(!c?.place)try{c=(await e.loadJSON("homepage.json")).highlights}catch{l.textContent="比較資料載入失敗。請重新載入頁面。";return}const{place:r,change:a}=c,p=t=>t===null?"未提名":e.pct(t),$=(t,o)=>t===null||o===null?"不可比":e.sign(o-t)+" 個百分點",d=t=>t.map(({name:o,values:u,term:b})=>`<tr><th scope="row">${e.esc(o)}</th>${u.map(v=>`<td data-term="${b}">${p(v)}</td>`).join("")}<td data-term="percentage_point">${$(...u)}</td></tr>`).join(""),s=r.cities,h=r.villages,g=a.partyResults.map(({party:t,rates:o})=>({name:t,values:o,term:"share"})),y=s.candidates.map((t,o)=>({name:t.name,values:[h.candidates[o].share,t.share],term:"share"}));n("#home-place-preview").textContent=`直轄市的區與縣轄鄉，投票率相差 ${Math.abs(s.turnout-h.turnout).toFixed(2)} 個百分點。`;const m=a.turnout[1]-a.turnout[0];n("#home-change-preview").textContent=`2024 全國投票率 ${p(a.turnout[1])}，較上屆${m<0?"下降":"增加"} ${Math.abs(m).toFixed(2)} 個百分點。`,l.innerHTML=`
    <section id="home-place" class="home-evidence-block">
      <header><p class="home-kicker">地區對照 · 2024</p><h3>城市與鄉村的行政分組</h3>
        <p>比較直轄市的區與縣轄鄉。行政類型只作為城鄉代理，兩組都可能包含不同密度的聚落。</p></header>
      <table class="home-evidence-table">
        <thead><tr><th scope="col">讀數</th><th scope="col">縣轄鄉 · ${h.units} 鄉</th><th scope="col">直轄市的區 · ${s.units} 區</th><th scope="col">區 − 鄉</th></tr></thead>
        <tbody>${d([...y,{name:"投票率",values:[h.turnout,s.turnout],term:"turnout"}])}</tbody>
      </table>
      <p class="home-method-line">有效票分母為縣轄鄉 ${e.fmt(h.valid)} 票、直轄市的區 ${e.fmt(s.valid)} 票。投票率以各組選舉人數為分母。另有 ${r.excluded} 個行政區未納入這組對照。</p>
      <a href="${i("chart",{chart:"scatter",l:"town"})}">在分析台查看鄉鎮分布 ↗</a>
    </section>
    <section id="home-change" class="home-evidence-block">
      <header><p class="home-kicker">全國對照 · ${a.years.join(" → ")}</p><h3>與上屆相比</h3>
        <p>以各屆全國有效票比較同一政黨的總統候選人得票率。投票率依各屆選舉人數計算。</p></header>
      <table class="home-evidence-table">
        <thead><tr><th scope="col">讀數</th>${a.years.map(t=>`<th scope="col">${t}</th>`).join("")}<th scope="col">本屆 − 上屆</th></tr></thead>
        <tbody>${d([...g,{name:"投票率",values:a.turnout,term:"turnout"}])}</tbody>
      </table>
      <p class="home-method-line">未提名的政黨不計差值。全國總計可直接對照，鄉鎮與村里跨屆變化仍須核驗邊界。</p>
      <a href="${i("history",{"history-region":"swipe","history-a":"2020","history-b":"2024","history-metric":"dpp"})}">查看可比的縣市變化 ↗</a>
    </section>`}export{w as presentHomeFindings};
