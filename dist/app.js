/* Taiwan Ballot Atlas — all election values come from prepared CEC CSV data. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const colors={'民進黨':'#438a72','國民黨':'#597eb2','民眾黨':'#71b7b7','無黨籍':'#ab9270'}, color=p=>colors[p]||'#9a8c9f';
const fmt=n=>Number(n||0).toLocaleString('en-US'), pct=n=>n==null?'—':n.toFixed(2)+'%';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, counties,towns,election='president',view='winner',county=null,town=null,district=null;
const config={president:{title:'總統副總統選舉',date:'2024.01.13 / 第16任',year:2024},legislator:{title:'區域立法委員選舉',date:'2024.01.13 / 第11屆',year:2024},mayor:{title:'縣市長選舉',date:'2022.11.26 / 地方公職人員選舉',year:2022}};
function record(c=county,t=town){return data[election][(c||'00000')+(election==='legislator'?':'+(district||'01'):'')+'/'+(t||'000')]}
function districts(c){return Object.values(data.legislator).filter(v=>v.town==='000'&&data.counties[v.county]&&(!c||v.county===c))}
function go(c=null,t=null,d=null){county=c;town=t;district=d;$('#search').value='';render();}
function render(){
  const cfg=config[election];$('#election-title').textContent=cfg.title;$('#election-date').textContent=cfg.date;
  $$('[data-election]').forEach(b=>{b.classList.toggle('active',b.dataset.election===election);b.setAttribute('aria-pressed',b.dataset.election===election)});
  $$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view);b.disabled=election==='legislator';b.title=election==='legislator'?'區域立委以選區結果列表呈現':''});
  $$('[data-year]').forEach(b=>b.classList.toggle('selected',+b.dataset.year===cfg.year));
  $('#breadcrumb').innerHTML='<button id="crumb-all">全臺</button>'+(county?'<span>/</span><button id="crumb-county">'+esc(data.counties[county])+'</button>':'')+(town?'<span>/</span>'+esc(record()?.name||''):'')+(district?'<span>/</span>第'+Number(district)+'選區':'');
  $('#crumb-all').onclick=()=>go();if($('#crumb-county'))$('#crumb-county').onclick=()=>go(county);
  $('#result-place').textContent=town?(record()?.name||'—'):district?'第'+Number(district)+'選區':county?data.counties[county]:'全臺';
  $('#result-level').textContent=district?'區域立委選區':town?'鄉鎮市區結果':county?'縣市結果':'全國概況';
  renderResults();drawMap();renderTable();
  const params=new URLSearchParams({e:election,v:view});if(county)params.set('c',county);if(town)params.set('t',town);if(district)params.set('d',district);history.replaceState(null,'','#'+params);
}
function renderResults(){
  const r=record();
  if(election==='legislator'&&!district || election==='mayor'&&!county){
    const rs=election==='legislator'?districts(county):Object.values(data.mayor).filter(x=>x.town==='000'&&data.counties[x.county]);
    const counts={};rs.forEach(x=>{const w=x.candidates.find(c=>c.elected)||x.candidates[0];counts[w.party]=(counts[w.party]||0)+1});
    const count=rs.length;const cast=rs.reduce((s,x)=>s+(x.cast||0),0),eligible=rs.reduce((s,x)=>s+(x.eligible||0),0);
    $('#metrics').innerHTML='<div class="metric-grid"><div><small>選出'+(election==='legislator'?'區域立委':'縣市長')+'</small><strong>'+count+' <em>席</em></strong></div><div><small>投票率'+(election==='mayor'?' · 含重行選舉':'')+'</small><strong>'+pct(eligible?cast/eligible*100:null)+'</strong></div></div>';
    $('#candidates').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([p,n])=>'<div class="candidate"><div class="candidate-top"><span class="candidate-name">'+esc(p)+'</span><span class="percent">'+n+' <small>席</small></span></div><div class="candidate-meta"><span>當選席次</span><span>'+pct(n/count*100)+'</span></div><div class="bar-track"><div style="width:'+n/count*100+'%;background:'+color(p)+'"></div></div></div>').join('')+(county?'<div class="district-list">'+rs.map(x=>'<button class="district-item" data-district="'+x.district+'">第'+Number(x.district)+'選區<span>'+esc(x.candidates[0].name)+' ↗</span></button>').join('')+'</div>':'');
    $$('[data-district]').forEach(b=>b.onclick=()=>go(county,null,b.dataset.district));
    $('#insight').innerHTML='<div class="eyebrow">閱讀提示</div>'+(election==='legislator'?'本頁為73席區域立委，不含原住民及不分區。點選縣市，再查看各選區的完整候選人結果。':'各縣市為獨立選舉。席次依當選人登記政黨統計，嘉義市含12月18日重行選舉。');
    $('#count-label').textContent=count+' 個'+(election==='legislator'?'選區':'縣市');return;
  }
  if(!r){$('#metrics').textContent='此區尚無資料';$('#candidates').innerHTML='';$('#insight').textContent='';return}
  $('#metrics').innerHTML='<div class="metric-grid"><div><small>投票率</small><strong>'+pct(r.turnout)+'</strong></div><div><small>有效票數</small><strong style="font-size:21px">'+fmt(r.total)+'</strong></div></div>';
  $('#candidates').innerHTML=r.candidates.map((c,i)=>'<div class="candidate"><div class="candidate-top"><span class="candidate-name"><small>'+ (c.number||i+1)+'</small>'+esc(c.name)+'</span><span class="percent">'+c.share.toFixed(2)+'<small>%</small></span></div><div class="candidate-meta"><span>'+esc(c.party)+(c.runningMate?' · 副總統 '+esc(c.runningMate):'')+(c.elected?'<span class="elected">✓ 當選</span>':'')+'</span><span>'+fmt(c.votes)+' 票</span></div><div class="bar-track"><div style="background:'+color(c.party)+';width:'+c.share+'%"></div></div></div>').join('');
  $('#insight').innerHTML='<div class="eyebrow">地方觀察 / THE MARGIN</div><div>前兩名相差 <strong>'+r.margin.toFixed(2)+'</strong>百分點</div><div style="color:var(--muted);font-size:10px">'+esc(r.candidates[0]?.name||'')+'在此區領先 '+fmt(r.candidates[0].votes-(r.candidates[1]?.votes||0))+' 票。'+(county==='10020'&&election==='mayor'?'本區選舉日期：2022.12.18。':'')+'</div>';
  $('#count-label').textContent='有效票口徑';
}
function fill(r){if(election==='legislator'||!r||!r.total)return '#d9e0d5';if(view==='turnout')return d3.interpolateRgb('#e2e9db','#526b4d')(Math.max(0,Math.min(1,((r.turnout||0)-35)/50)));let c=color(r.candidates[0].party);return view==='margin'?d3.interpolateRgb('#f0f0e4',c)(.15+Math.min(r.margin/30,1)*.85):d3.interpolateRgb('#e9ece0',c)(.75)}
function drawMap(){
 const svg=d3.select('#map');svg.selectAll('*').remove();$('#tooltip').style.display='none';
 const feat=county?towns.filter(f=>f.properties.COUNTYCODE===county):counties;
 const main=county?feat:feat.filter(f=>!['09007','09020','10016'].includes(f.properties.COUNTYCODE));
 const proj=d3.geoMercator().fitExtent(county?[[125,35],[735,550]]:[[300,15],[730,560]],{type:'FeatureCollection',features:main});
 const path=d3.geoPath(proj);
 function add(features,pr,group){const p=d3.geoPath(pr);const g=svg.append('g');
  g.selectAll('path').data(features).join('path').attr('class','geo').classed('selected',f=>town&&f.properties.TOWNCODE?.slice(5)===town).attr('d',p).attr('fill',f=>fill(data[election][f.properties.COUNTYCODE+'/'+(county?f.properties.TOWNCODE.slice(5):'000')])).attr('tabindex',0).attr('role','button').attr('aria-label',f=>f.properties.TOWNNAME||f.properties.COUNTYNAME).on('click',(_,f)=>county?go(county,election==='legislator'?null:f.properties.TOWNCODE.slice(5)):go(f.properties.COUNTYCODE)).on('keydown',(ev,f)=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();county?go(county,election==='legislator'?null:f.properties.TOWNCODE.slice(5)):go(f.properties.COUNTYCODE)}}).on('pointerenter',(ev,f)=>{const r=data[election][f.properties.COUNTYCODE+'/'+(county?f.properties.TOWNCODE.slice(5):'000')];const tip=$('#tooltip');tip.innerHTML='<b>'+esc(f.properties.TOWNNAME||f.properties.COUNTYNAME)+'</b><br>'+(election==='legislator'?'點選查看選區結果':r?esc(r.candidates[0].name)+' '+pct(r.candidates[0].share)+'<br>領先 '+r.margin.toFixed(2)+' 百分點':'尚無資料');tip.style.display='block';const box=$('.map-stage').getBoundingClientRect();tip.style.left=Math.min(ev.clientX-box.left+12,box.width-200)+'px';tip.style.top=Math.max(0,ev.clientY-box.top-65)+'px'}).on('pointerleave',()=>$('#tooltip').style.display='none');
  if(county||group==='main')g.selectAll('text').data(features.filter(f=>county||!['10017','10018','10020'].includes(f.properties.COUNTYCODE))).join('text').attr('class','map-label').attr('transform',f=>'translate('+p.centroid(f)+')').attr('text-anchor','middle').text(f=>f.properties.TOWNNAME||f.properties.COUNTYNAME);
 }
 add(main,proj,'main');
 if(!county){
  svg.append('path').datum(topojson.mesh(window.topology,window.topology.objects.towns,(a,b)=>a.properties.COUNTYCODE===b.properties.COUNTYCODE)).attr('d',path).attr('class','town-line');
  [['09007','連江縣',55,35],['09020','金門縣',55,180],['10016','澎湖縣',55,325]].forEach(([id,name,x,y])=>{const f=feat.filter(f=>f.properties.COUNTYCODE===id);svg.append('rect').attr('class','inset-frame').attr('x',x).attr('y',y).attr('width',135).attr('height',120);svg.append('text').attr('class','inset-title').attr('x',x+9).attr('y',y+17).text(name+' ↗');const pr=d3.geoMercator().fitExtent([[x+15,y+27],[x+120,y+105]],{type:'FeatureCollection',features:f});add(f,pr,'inset')});
 }
 $('.map-caption').style.display=county?'none':'';
 $('#legend').innerHTML=election==='legislator'?'<span><i style="background:#d9e0d5"></i>行政區定位 · 選區結果見列表</span>':view==='turnout'?'<span>較低</span><span style="width:140px;height:8px;background:linear-gradient(90deg,#e2e9db,#526b4d)"></span><span>較高 · 35–85%</span>':Object.entries(colors).filter(([p])=>election==='president'?p!=='無黨籍':p!=='民眾黨'||election==='mayor').map(([p,c])=>'<span><i style="background:'+c+'"></i>'+p+'</span>').join('')+(view==='margin'?'<span>淺 → 深：差距 0–30+ 百分點</span>':'');
 $('#map-note').textContent=election==='legislator'?'未核實選區邊界；本圖僅呈現行政區位置，請以各選區結果列表閱讀。':county?'點選鄉鎮市區查看結果 · 色彩表示地區領先，非當選判定 · 圖資為地理定位用途':'點選縣市深入鄉鎮市區 · 離島採分幅顯示，比例各自獨立 · 圖資為地理定位用途';
}
function tableRecords(){if(election==='legislator')return districts(county);return county?Object.values(data[election]).filter(r=>r.county===county&&r.town!=='000'):Object.keys(data.counties).map(c=>data[election][c+'/000']).filter(Boolean)}
function renderTable(){
 $('#region-title').textContent=county?data.counties[county]+(election==='legislator'?'的選區':'的地方輪廓'):'從一個地方開始';
 const q=$('#search').value.trim();const rs=tableRecords().filter(r=>(data.counties[r.county]+r.name+(election==='legislator'?'第'+Number(r.district)+'選區':'')).includes(q));
 $('#region-rows').innerHTML=rs.map(r=>{let c=r.candidates[0],name=election==='legislator'?data.counties[r.county]+' · 第'+Number(r.district)+'選區':county?r.name:data.counties[r.county];return '<tr data-county="'+r.county+'" data-town="'+r.town+'" data-d="'+r.district+'"><td><button aria-label="探索'+esc(name)+'">'+esc(name)+'</button></td><td><i class="party-dot" style="background:'+color(c.party)+'"></i>'+esc(c.name)+'</td><td>'+pct(c.share)+'<div class="mini-bar">'+r.candidates.map(c=>'<i style="width:'+c.share+'%;background:'+color(c.party)+'"></i>').join('')+'</div></td><td>'+r.margin.toFixed(2)+' <small>百分點</small></td><td>'+pct(r.turnout)+'</td><td>↗</td></tr>'}).join('')||'<tr><td colspan="6">找不到符合的地區。</td></tr>';
 $$('#region-rows tr[data-county]').forEach(tr=>{const action=()=>{go(tr.dataset.county,election==='legislator'?null:tr.dataset.town==='000'?null:tr.dataset.town,election==='legislator'?tr.dataset.d:null);$('#explorer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})};tr.onclick=action});
}
function download(){let rs=election==='legislator'&&!district?districts(county):election==='mayor'&&!county?tableRecords():[record()].filter(Boolean);const header=['選舉','縣市','地區','選區','候選人','政黨','票數','得票率','投票率'];let lines=[header,...rs.flatMap(r=>r.candidates.map(c=>[config[election].year+' '+config[election].title,data.counties[r.county]||'全臺',r.name,r.district,c.name,c.party,c.votes,c.share,r.turnout]))];const blob=new Blob(['\ufeff'+lines.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='選舉地圖志-'+election+'-'+(county||'全臺')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
Promise.all([fetch('data.json').then(r=>{if(!r.ok)throw Error('選舉資料載入失敗');return r.json()}),fetch('towns.json').then(r=>{if(!r.ok)throw Error('地圖載入失敗');return r.json()})]).then(([d,t])=>{data=d;window.topology=t;counties=topojson.feature(t,t.objects.counties).features;towns=topojson.feature(t,t.objects.towns).features;const p=new URLSearchParams(location.hash.slice(1));if(config[p.get('e')])election=p.get('e');if(['winner','margin','turnout'].includes(p.get('v')))view=p.get('v');if(data.counties[p.get('c')])county=p.get('c');if(county&&data[election][county+'/'+p.get('t')])town=p.get('t');if(county&&districts(county).some(r=>r.district===p.get('d')))district=p.get('d');render()}).catch(e=>{$('#candidates').textContent=e.message+'，請重新整理頁面。';$('#map-note').textContent='無法載入資料。請檢查網路連線後重新整理。'});
$$('[data-election]').forEach(b=>b.onclick=()=>{election=b.dataset.election;view='winner';go()});$$('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});$$('[data-year]').forEach(b=>b.onclick=()=>{election=b.dataset.year==='2022'?'mayor':'president';view='winner';go()});$('#reset').onclick=()=>go();$('#search').oninput=renderTable;$('#download').onclick=download;$('#about').onclick=$('#footer-about').onclick=()=>$('#methods').showModal();$('#methods .close').onclick=()=>$('#methods').close();$('#methods').addEventListener('click',e=>{if(e.target===$('#methods')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});$('.brand').onclick=e=>{e.preventDefault();if(data){election='president';view='winner';go();window.scrollTo({top:0,behavior:'smooth'})}};


