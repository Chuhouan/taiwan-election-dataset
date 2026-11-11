async function C(o,l){const a=o.$,d=a("#home-evidence");let t=o.homeHighlights;if(!t?.place)try{t=(await o.loadJSON("homepage.json")).highlights}catch{d.textContent="比較資料載入失敗。請重新載入頁面。";return}const{place:p,change:n}=t;if(t.questions){const{balanced:e,topFive:s,largestChange:h}=t.questions,u=e.county+"/"+e.town;a("#home-ternary-preview").textContent=o.data.counties[e.county]+" · "+e.name+"最接近三人各得三分之一",a('[data-home-discover="distribution"]').href=l("chart",{chart:"ternary",l:"town",r:u,inspect:"1"}),a("#home-votes-preview").textContent="有效票最多的五個縣市，合計占全國 "+s.toFixed(1)+"%",a("#home-change-preview").textContent=h.name+"民進黨得票率較 2020 年 "+o.sign(h.after-h.before)+" 個百分點"}const c=e=>e===null?"未提名":o.pct(e),m=(e,s)=>e===null||s===null?"不可比":o.sign(s-e)+" 個百分點",g=e=>e.map(({name:s,values:h,term:u})=>`<tr><th scope="row">${o.esc(s)}</th>${h.map(v=>`<td data-term="${u}">${c(v)}</td>`).join("")}<td data-term="percentage_point">${m(...h)}</td></tr>`).join(""),r=p.cities,i=p.villages,y=n.partyResults.map(({party:e,rates:s})=>({name:e,values:s,term:"share"})),b=r.candidates.map((e,s)=>({name:e.name,values:[i.candidates[s].share,e.share],term:"share"}));a("#home-place-preview").textContent=`直轄市的區與縣轄鄉，投票率相差 ${Math.abs(r.turnout-i.turnout).toFixed(2)} 個百分點 · 查看行政分組對照 ↓`;const $=n.turnout[1]-n.turnout[0];t.questions||(a("#home-change-preview").textContent=`2024 全國投票率 ${c(n.turnout[1])}，較上屆${$<0?"下降":"增加"} ${Math.abs($).toFixed(2)} 個百分點。`),d.innerHTML=`
    <section id="home-place" class="home-evidence-block">
      <header><p class="home-kicker">地區對照 · 2024</p><h3>城市與鄉村的行政分組</h3>
        <p>比較直轄市的區與縣轄鄉。行政類型只作為城鄉代理，兩組都可能包含不同密度的聚落。</p></header>
      <table class="home-evidence-table">
        <thead><tr><th scope="col">讀數</th><th scope="col">縣轄鄉 · ${i.units} 鄉</th><th scope="col">直轄市的區 · ${r.units} 區</th><th scope="col">區 − 鄉</th></tr></thead>
        <tbody>${g([...b,{name:"投票率",values:[i.turnout,r.turnout],term:"turnout"}])}</tbody>
      </table>
      <p class="home-method-line">有效票分母為縣轄鄉 ${o.fmt(i.valid)} 票、直轄市的區 ${o.fmt(r.valid)} 票。投票率以各組選舉人數為分母。另有 ${p.excluded} 個行政區未納入這組對照。</p>
      <a href="${l("chart",{chart:"scatter",l:"town"})}">在分析台查看鄉鎮分布 ↗</a>
    </section>
    <section id="home-change" class="home-evidence-block">
      <header><p class="home-kicker">全國對照 · ${n.years.join(" → ")}</p><h3>與上屆相比</h3>
        <p>以各屆全國有效票比較同一政黨的總統候選人得票率。投票率依各屆選舉人數計算。</p></header>
      <table class="home-evidence-table">
        <thead><tr><th scope="col">讀數</th>${n.years.map(e=>`<th scope="col">${e}</th>`).join("")}<th scope="col">本屆 − 上屆</th></tr></thead>
        <tbody>${g([...y,{name:"投票率",values:n.turnout,term:"turnout"}])}</tbody>
      </table>
      <p class="home-method-line">未提名的政黨不計差值。全國總計可直接對照，鄉鎮與村里跨屆變化仍須核驗邊界。</p>
      ${t.questions?.largestChange?`<p class="home-method-line">${o.esc(t.questions.largestChange.name)}的民進黨得票率由 ${c(t.questions.largestChange.before)} 變為 ${c(t.questions.largestChange.after)}，差 ${m(t.questions.largestChange.before,t.questions.largestChange.after)}。</p>`:""}
      <a href="${l("history",{"history-region":"swipe","history-a":"2020","history-b":"2024","history-metric":"dpp","history-county":t.questions?.largestChange.code||"63000"})}">查看可比的縣市變化 ↗</a>
    </section>`}export{C as presentHomeFindings};
