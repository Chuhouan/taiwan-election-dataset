export function installReadingPage(ctx) {
  const esc = ctx.esc;
  const main = ctx.$(".analysis-layout");
  main.id = "exploration";
  main.insertAdjacentHTML("beforebegin", `<section class="analysis-state" aria-label="分析狀態">
    <div class="analysis-state-line">
      <div class="analysis-state-summary"></div>
      <div class="analysis-state-tools">
        <details id="analysis-state-more" hidden><summary aria-controls="analysis-state-readouts">範圍詳情</summary></details>
        <details class="chapter-menu"><summary>頁面章節</summary>
          <nav class="reading-nav" aria-label="頁面章節"><button data-section="exploration">01 地圖探索</button><button data-section="region-results">02 結果比較</button><button data-section="competition-section">03 競爭分布</button><button data-section="region-directory">04 地區索引</button></nav>
        </details>
      </div>
    </div>
    <div id="analysis-state-readouts" class="analysis-state-readouts" hidden>
      <div id="range-readout" class="range-readout" hidden>
        <div><b>各地第一名票數合計占有效票</b> <strong id="range-lead-share"></strong></div>
        <p id="range-lead-method"></p>
      </div>
      <div id="inspection-readout" hidden></div>
    </div>
  </section>`);
  ctx.$(".analysis-state-summary").append(ctx.$("#scope-summary"), ctx.$("#selection-bar"));
  const readouts = ctx.$(".analysis-state-readouts"), more = ctx.$("#analysis-state-more");
  readouts.append(ctx.$("#ab-strip"));
  more.ontoggle = () => { readouts.hidden = !more.open; };
  ctx.presentAnalysisState = () => {
    const hasInspection = ctx.renderSelectionRibbon?.();
    more.hidden = ctx.$("#range-readout").hidden && !hasInspection && ctx.$("#ab-strip").hidden;
    if (more.hidden) more.open = false;
    readouts.hidden = !more.open;
  };
  main.insertAdjacentHTML("afterend", `<div class="reading-page"><section id="region-results" class="reading-section"><header><span class="section-number">02 / RESULTS</span><div><h2 id="reading-result-title">結果比較</h2><p id="reading-result-note"></p></div></header><div id="reading-results"></div></section><section id="competition-section" class="reading-section"><header><span class="section-number">03 / COMPETITION</span><div><h2>勝負之間，差了多少？</h2><p id="reading-distribution-note"></p></div><div class="reading-modes"><button data-reading-metric="margin" class="active">領先百分點</button><button data-reading-metric="votes">領先票數</button><button data-reading-metric="share">第一名得票率</button></div></header><div id="reading-distribution-legend" class="reading-parties"></div><div id="reading-distribution"></div><p class="reading-method">每一柱為同一區間的地區數，依地區第一名政黨堆疊；地區等權，並非選票規模。懸浮可讀取精確數量。</p><div id="reading-close-races"></div></section><section id="region-directory" class="reading-section"><header><span class="section-number">04 / REGIONS</span><div><h2>從一個地方開始</h2><p>進入縣市結果，查看當地候選人與競爭結構。</p></div></header><div id="reading-counties"></div></section><footer class="reading-source">資料：中央選舉委員會 · 2024 最終結果。比率依原始票數計算，地區統計不推論個別選民行為。<button id="reading-methods">資料與方法 ↗</button></footer></div>`);
  let metric = "margin";
  for (const button of ctx.$$("[data-section]")) button.onclick = () => {
    ctx.$(".chapter-menu").open = false;
    ctx.$("#" + button.dataset.section).scrollIntoView({ behavior: "smooth", block: "start" });
  };
  document.addEventListener("pointerdown", (event) => {
    const menu = ctx.$(".chapter-menu");
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  ctx.$('#reading-methods').onclick = () => ctx.$('#methods-open').click();
  for (const b of ctx.$$('[data-reading-metric]')) b.onclick = () => { metric=b.dataset.readingMetric; render(); };
  ctx.presentReadingPage = render;
  function render() {
    if (!ctx.data) return;
    const rs=ctx.scoped(), selected=ctx.state.key && ctx.records[ctx.state.key], national=ctx.records['00000/000'];
    const r=selected || ((ctx.filterActive || ctx.state.brushed.length) && !rs.length ? null : ctx.aggregateCurrentSelection?.() || (ctx.state.county ? ctx.records[ctx.state.county+'/000'] : national));
    const area = ctx.state.county ? ctx.data.counties[ctx.state.county] : "全臺";
    const title = selected ? ctx.areaName(selected, true) :
      ctx.filterActive || ctx.state.brushed.length ? area + "目前分析範圍" : area;
    ctx.$('#reading-result-title').textContent=title+' · '+(ctx.isLeg()?'立委結果':'總統選舉結果');
    const hasBenchmark = !ctx.isLeg() && r && r !== national;
    ctx.$('#reading-result-note').textContent = ctx.isLeg() && !selected
      ? "區域選區按當選席次統計；各選區候選人分開計票。"
      : hasBenchmark
        ? "實線：目前結果 · 細線：全國。差值以同一候選人的得票率相減。"
        : "得票率以候選人票數除以有效票。";
    if (ctx.isLeg()&&!selected) {
      const parties=ctx.d3.rollups(rs,v=>v.length,d=>d.candidates[0].party).sort((a,b)=>b[1]-a[1]);
      ctx.$('#reading-results').innerHTML=parties.map(([p,n])=>`<div class="reading-result-row"><div><b>${esc(p)}</b><small>區域選區當選席次</small></div><div class="reading-track"><i style="width:${rs.length?n/rs.length*100:0}%;background:${ctx.color(p)}"></i></div><strong>${n}<small>席 / ${rs.length}</small></strong></div>`).join('');
    } else ctx.$('#reading-results').innerHTML=(r?.candidates||[]).map(c=>{
      const share = c.votes / r.total * 100;
      const nationalCandidate = hasBenchmark ? national.candidates.find((entry) => entry.name === c.name) : null;
      const base = nationalCandidate ? 100 * nationalCandidate.votes / national.total : null;
      const comparison = base === null ? "" : `<small class="reading-benchmark">全國 ${ctx.pct(base)} · ${ctx.sign(share - base)} 個百分點</small>`;
      return `<div class="reading-result-row"><div><b>${esc(c.name)}</b><small>${esc(c.party)}</small></div><div class="reading-track"><i style="width:${share}%;background:${ctx.color(c.party)}"></i>${base===null?'':`<em style="left:${base}%" title="全國 ${ctx.pct(base)}"></em>`}</div><strong>${ctx.pct(share)}<small>${ctx.fmt(c.votes)} 票</small>${comparison}</strong></div>`;
    }).join('') || '<p>目前範圍沒有可用結果。</p>';
    ctx.$('#reading-distribution-note').textContent = "目前分析範圍 · " + rs.length + (ctx.isLeg() ? " 個選區" : " 個地區");
    ctx.$('#reading-distribution-legend').innerHTML=[...new Set(rs.map(d=>d.candidates[0].party))].map(p=>`<span><i style="background:${ctx.color(p)}"></i>${esc(p)}</span>`).join('');
    const val=d=>metric==='votes'?d.candidates[0].votes-(d.candidates[1]?.votes||0):metric==='share'?d.candidates[0].votes/d.total*100:ctx.marginOf(d);
    const max=metric==='share'?100:Math.max(metric==='votes'?10:5,ctx.d3.max(rs,val)||0);
    const x=ctx.d3.scaleLinear().domain([0,max]).nice().range([56,1100]);
    const bins=ctx.d3.bin().value(val).domain(x.domain()).thresholds(x.ticks(20))(rs);
    const y=ctx.d3.scaleLinear().domain([0,Math.max(1,ctx.d3.max(bins,b=>b.length)||0)]).nice().range([270,25]);
    const svg=ctx.d3.create('svg').attr('viewBox','0 0 1140 320').attr('role','img').attr('aria-label',metric==='votes'?'地區領先票數分布':metric==='share'?'第一名得票率分布':'地區領先百分點分布');
    svg.append('g').attr('class','reading-grid').attr('transform','translate(56,0)').call(ctx.d3.axisLeft(y).ticks(4).tickSize(-1044));
    for(const bin of bins){ let count=0; for(const [party,n] of ctx.d3.rollups(bin,v=>v.length,d=>d.candidates[0].party)){
      svg.append('rect').attr('x',x(bin.x0)+1).attr('y',y(count+n)).attr('width',Math.max(0,x(bin.x1)-x(bin.x0)-2)).attr('height',y(count)-y(count+n)).attr('fill',ctx.color(party)).attr('opacity',.85).append('title').text(`${bin.x0.toLocaleString()}–${bin.x1.toLocaleString()} ${metric==='votes'?'票':metric==='share'?'%':'個百分點'} · ${party} ${n} 個地區`);count+=n;
    }}
    svg.append('g').attr('transform','translate(0,270)').call(ctx.d3.axisBottom(x).ticks(8).tickFormat(d=>metric==='votes'?ctx.d3.format('~s')(d):d+(metric==='share'?'%':' pp')));
    svg.append('text').attr('x',56).attr('y',14).text('地區數');
    svg.append('text').attr('x',1100).attr('y',311).attr('text-anchor','end').text(
      metric === "votes" ? "前兩名差距（票）" : metric === "share" ? "第一名得票率（%）" : "前兩名差距（百分點）",
    );
    ctx.$('#reading-distribution').replaceChildren(svg.node());
    for(const b of ctx.$$('[data-reading-metric]')) b.classList.toggle('active',b.dataset.readingMetric===metric);
    ctx.$('#reading-close-races').innerHTML=`<div class="reading-race-heading"><h3>競爭最接近的地區</h3><button id="reading-rank-open" type="button">查看完整排名 ↗</button></div><div class="reading-races">`+rs.slice().sort((a,b)=>ctx.marginOf(a)-ctx.marginOf(b)).slice(0,6).map(d=>`<button data-reading-region="${ctx.keyOf(d)}" aria-label="查看${esc(ctx.areaName(d,true))}結果"><span>${esc(ctx.areaName(d,true))}</span><b>${ctx.marginOf(d).toFixed(2)}<small> 個百分點</small></b><small>${ctx.fmt(d.candidates[0].votes-(d.candidates[1]?.votes||0))} 票</small></button>`).join('')+'</div>';
    ctx.$("#reading-rank-open").onclick = () => {
      ctx.state.sort = "margin";
      if (!document.body.classList.contains("list-open")) ctx.$("#list-toggle").click();
      ctx.updateUI();
      ctx.$("#exploration").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    ctx.$('#reading-counties').innerHTML=Object.entries(ctx.data.counties).map(([code,name])=>`<button data-reading-county="${code}"><span>${esc(name)}</span><span>↗</span></button>`).join('');
    for(const b of ctx.$$('[data-reading-region]')) b.onclick=()=>{ctx.selectRegion(b.dataset.readingRegion,false);ctx.$('#region-results').scrollIntoView({behavior:'smooth'});};
    for(const b of ctx.$$('[data-reading-county]')) b.onclick=()=>{const code=b.dataset.readingCounty; if(ctx.isLeg()){ctx.state.county=code;ctx.state.key='';ctx.updateUI();}else{ctx.state.county=code;ctx.state.level='town';ctx.selectRegion(code+'/000',false);}ctx.$('#exploration').scrollIntoView({behavior:'smooth'});};
  }
}
