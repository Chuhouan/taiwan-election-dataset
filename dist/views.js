/* Additional views inspired by analytical election cartography; geometry is original. */
const COUNTY_ORDER=['63000','65000','10017','68000','10018','10004','10005','66000','10007','10008','10009','10020','10010','67000','64000','10013','10002','10015','10014','10016','09020','09007'];
const COUNTY_TILES={'09007':[-1,0],'09020':[-1,2],'10016':[-1,4],'63000':[3,0],'10017':[4,0],'65000':[3,1],'68000':[2,1],'10018':[1,2],'10004':[2,2],'10005':[2,3],'10002':[4,1],'66000':[2,4],'10007':[1,4],'10008':[3,4],'10009':[0,5],'10020':[1,5],'10010':[2,5],'67000':[1,6],'64000':[2,6],'10013':[3,6],'10015':[4,3],'10014':[4,5]};
let lastNational='',lastDetail='',altMode='',altPositions=new Map();
function renderNationalStable(){if(lastNational!==state.e){renderNational();lastNational=state.e;d3.selectAll('.national-card').style('opacity',.25).transition().duration(duration()).style('opacity',1)}else $$('[data-national]').forEach(b=>b.classList.toggle('selected',state.metric==='share'&&b.dataset.national===state.candidate))}
function renderDetailStable(){const sig=state.e+'|'+state.key+'|'+state.county+'|'+state.brushed.join(',');if(sig===lastDetail)return;lastDetail=sig;if(state.brushed.length&&!state.key)renderBrushDetail();else renderDetail();d3.select('#detail-result').interrupt().style('opacity',.15).style('transform','translateY(5px)').transition().duration(Math.min(duration(),240)).style('opacity',1).style('transform','translateY(0px)')}
function overviewRecords(){if(state.brushed.length)return state.brushed.map(k=>records[k]).filter(valid);return Object.values(records).filter(r=>valid(r)&&(isLeg()?r.town==='000':state.county?r.county===state.county&&r.town!=='000':r.town==='000')&&(!state.county||r.county===state.county)).sort((a,b)=>COUNTY_ORDER.indexOf(a.county)-COUNTY_ORDER.indexOf(b.county)||Number(a.district)-Number(b.district)||Number(a.town)-Number(b.town))}
function hexPath(radius){return 'M'+d3.range(6).map(i=>[Math.cos((60*i-30)*Math.PI/180)*radius,Math.sin((60*i-30)*Math.PI/180)*radius].join(',')).join('L')+'Z'}
function chartWinner(r){return state.metric==='runner'?(r.candidates[1]||{name:'無第二名',party:'無',share:null}):r.candidates[0]}
function tileMetric(r){if(state.metric==='margin')return r.margin.toFixed(1)+' pp';if(state.metric==='turnout')return pct(r.turnout);if(state.metric==='swing'){const v=swing(keyOf(r));return v==null?'—':sign(v)+' pp'}if(state.metric==='share'){return pct(r.candidates.find(c=>c.name===state.candidate)?.share)}return pct(chartWinner(r).share)}
function renderAlternativeLegend(){
 let base=state.chart==='hex'?(isLeg()?'每格 1 選區＝1 席':overviewRecords().some(r=>r.town!=='000')?'每格 1 鄉鎮市區':'每格 1 縣市'):'圓面積 ∝ 有效票數';
 let desc=state.chart==='hex'?'等格圖 · 面積一致，並非人口或票數比例':'票數圖 · 位置經避讓調整，非精確地理座標';
 let title={winner:'第一名政黨',runner:'第二名政黨',margin:'前兩名差距',turnout:'投票率',share:state.candidate+' 得票率',swing:state.swingParty+' 得票率變化'}[state.metric];
 let body='';if(['winner','runner'].includes(state.metric)){let ps=[...new Set(overviewRecords().map(r=>state.metric==='runner'?r.candidates[1]?.party:r.candidates[0].party).filter(Boolean))];body='<div class="legend-parties">'+ps.map(p=>'<span><i style="background:'+color(p)+'"></i>'+esc(p)+'</span>').join('')+'</div>'}else{let sample=overviewRecords()[0];body=legendRamp(d3.range(7).map(i=>{if(state.metric==='margin')return d3.interpolateRgbBasis(['#fff3dd','#f9bf76','#df684b','#a42f47'])(i/6);if(state.metric==='turnout')return d3.interpolateRgb('#e0e9f3','#315e9e')(i/6);if(state.metric==='share')return d3.interpolateRgb('#e6edf3',color(sample?.candidates.find(c=>c.name===state.candidate)?.party))(i/6);return d3.interpolateRgbBasis(['#4779b3','#f3f4f5','#d8803b'])(i/6)}),state.metric==='margin'?['0','差距（百分點）','35+']:state.metric==='turnout'?['30%','投票率','85%+']:state.metric==='share'?['0%','得票率','65%+']:['−25','2024−2020（pp）','+25'])}
 $('#legend').innerHTML='<div class="legend-title">'+base+' · '+esc(title)+'</div>'+body+'<div class="legend-foot">'+desc+(state.metric==='runner'?' · 灰色＝無第二名':'')+'</div>';
 $('#view-description').textContent=desc;$('#chart-coordinate').textContent=state.chart==='hex'?'EQUAL AREA / '+overviewRecords().length+' UNITS':'VOTE-WEIGHTED / '+overviewRecords().length+' REGIONS';
}
function chartTip(ev,r){const tip=$('#map-tooltip');tip.innerHTML='<div class="tip-place">'+esc(areaName(r,true))+'</div>'+r.candidates.slice(0,3).map((c,i)=>'<div class="tip-row"><span><i style="background:'+color(c.party)+'"></i>'+ (i+1)+' '+esc(c.name)+'</span><b>'+pct(c.share)+'</b></div>').join('')+'<div class="tip-bottom"><span>'+fmt(r.total)+' 張有效票</span><span>差距 '+r.margin.toFixed(2)+' pp</span></div>';tip.hidden=false;const b=$('#map-host').getBoundingClientRect(),tw=245;tip.style.left=Math.max(8,Math.min(b.width-tw,ev.clientX-b.left+16))+'px';tip.style.top=Math.max(105,Math.min(b.height-195,ev.clientY-b.top-75))+'px'}
function wireChart(selection){selection.attr('tabindex',0).attr('role','button').attr('data-region-key',d=>d.key).attr('data-votes',d=>d.r.total).attr('aria-label',d=>areaName(d.r,true)+' '+(['hex','bubble'].includes(state.chart)?chartWinner(d.r).name+' '+tileMetric(d.r):'前兩名差距 '+d.r.margin.toFixed(2)+' 百分點')).on('pointermove',(ev,d)=>{chartTip(ev,d.r);$$('.region-row.hovering').forEach(n=>n.classList.remove('hovering'));document.querySelector('.region-row[data-region="'+(isLeg()?d.key:d.r.county+'/000')+'"]')?.classList.add('hovering')}).on('pointerleave',()=>{$('#map-tooltip').hidden=true;$$('.region-row.hovering').forEach(n=>n.classList.remove('hovering'))}).on('click',(ev,d)=>{ev.stopPropagation();selectRegion(d.key,false)}).on('keydown',(ev,d)=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();selectRegion(d.key,false)}})}
function drawAlternative(){if(state.chart==='small'){isLeg()?drawSeatArc():drawSmallMultiples();return}
 if(state.chart==='ternary'){drawTernary();return}if(state.chart==='scatter'&&state.distribution==='swarm'){drawBeeswarm();return}
 const host=$('#map-host'),cw=Math.max(400,host.clientWidth),ch=Math.max(260,host.clientHeight),svg=d3.select('#scatter').attr('viewBox',`0 0 ${cw} ${ch}`);let rs=overviewRecords();
 if(altMode!==state.chart||!svg.select('.alternative-stage').size()){svg.selectAll('*').remove();svg.append('g').attr('class','alternative-stage');altPositions=new Map();altMode=state.chart}
 const stage=svg.select('.alternative-stage');let nodes=[];
 if(state.chart==='hex'){
  const countyLayout=!isLeg()&&!state.county&&rs.every(r=>r.town==='000');
  let positions=rs.map((r,i)=>{const grid=countyLayout?COUNTY_TILES[r.county]:[i%Math.min(10,Math.max(4,Math.ceil(Math.sqrt(rs.length)*1.15))),Math.floor(i/Math.min(10,Math.max(4,Math.ceil(Math.sqrt(rs.length)*1.15))))];return {r,key:keyOf(r),ux:(grid[0]+.5*(grid[1]&1))*Math.sqrt(3),uy:grid[1]*1.5}});
  const minx=d3.min(positions,d=>d.ux)-1,maxx=d3.max(positions,d=>d.ux)+1,miny=d3.min(positions,d=>d.uy)-1,maxy=d3.max(positions,d=>d.uy)+1;
  const top=['share','swing'].includes(state.metric)?155:125,bot=ch-105;const rr=Math.max(9,Math.min((cw-90)/(maxx-minx),(bot-top)/(maxy-miny),countyLayout?40:38));
  nodes=positions.map(d=>({...d,x:cw/2+(d.ux-(minx+maxx)/2)*rr,y:(top+bot)/2+(d.uy-(miny+maxy)/2)*rr,radius:rr-2}));
 }else{
  const maxv=d3.max(rs,r=>r.total),rad=d3.scaleSqrt().domain([0,maxv]).range([0,Math.min(53,(ch-180)/6)]);
  nodes=rs.map(r=>{const anchor=geoByKey[isLeg()?r.county+'/000':keyOf(r)],p=anchor?anchor.path.centroid(anchor.f):[cw/2,ch/2];return {r,key:keyOf(r),radius:rad(r.total),x:p[0],y:p[1],ax:p[0],ay:Math.max(155,Math.min(ch-115,p[1]))}});
  // Collision-only positional adjustment; areas remain exactly proportional to votes.
  d3.forceSimulation(nodes).randomSource(d3.randomLcg(.42)).force('x',d3.forceX(d=>d.ax).strength(.2)).force('y',d3.forceY(d=>d.ay).strength(.2)).force('collision',d3.forceCollide(d=>d.radius+3).iterations(3)).stop().tick(200);
  const bx0=d3.min(nodes,d=>d.x-d.radius),bx1=d3.max(nodes,d=>d.x+d.radius),by0=d3.min(nodes,d=>d.y-d.radius),by1=d3.max(nodes,d=>d.y+d.radius);
  const fit=Math.min((cw-100)/(bx1-bx0),(ch-245)/(by1-by0));
  nodes.forEach(d=>{d.x=cw/2+(d.x-(bx0+bx1)/2)*fit;d.y=(135+ch-110)/2+(d.y-(by0+by1)/2)*fit;d.radius*=fit});
 }
 const joining=stage.selectAll('.unit').data(nodes,d=>d.key);joining.exit().transition().duration(duration()/2).style('opacity',0).remove();
 const entering=joining.enter().append('g').attr('class','unit').attr('transform',d=>{const prev=altPositions.get(d.key),geo=geoByKey[isLeg()?d.r.county+'/000':d.key],p=prev|| (geo?geo.path.centroid(geo.f):[cw/2,ch/2]);return `translate(${p[0]},${p[1]}) scale(.3)`}).style('opacity',0);
 entering.append(state.chart==='hex'?'path':'circle').attr('class','unit-shape').attr('fill',d=>fill(d.r,d.key));entering.append('text').attr('class','unit-name').attr('text-anchor','middle');entering.append('text').attr('class','unit-value').attr('text-anchor','middle');entering.append('text').attr('class','unit-candidate').attr('text-anchor','middle');
 const all=entering.merge(joining);wireChart(all);
 all.classed('selected',d=>d.key===state.key).attr('data-region-key',d=>d.key);
 all.select('.unit-shape').transition().duration(duration()).attr('d',d=>state.chart==='hex'?hexPath(d.radius):null).attr('r',d=>state.chart==='bubble'?d.radius:null).attr('fill',d=>fill(d.r,d.key)).attr('stroke',d=>d.key===state.key?'#142b48':'#fff').attr('stroke-width',d=>d.key===state.key?3:2);
 all.select('.unit-name').attr('y',d=>d.radius>25?-11:-4).style('font-size',d=>d.radius>28?'11px':'9px').text(d=>{if(isLeg())return (data.counties[d.r.county]||'').replace('臺','台').slice(0,2)+' '+Number(d.r.district);return areaName(d.r)}).style('opacity',d=>state.labels&&d.radius>=16?1:0);
 all.select('.unit-value').attr('y',d=>d.radius>25?7:8).style('font-size',d=>isLeg()&&state.chart==='hex'?'12px':d.radius>30?'17px':'11px').text(d=>state.chart==='bubble'?d3.format('.2~s')(d.r.total):tileMetric(d.r)).style('opacity',d=>d.radius>=20?1:0);
 all.select('.unit-candidate').attr('y',d=>d.radius>30?24:21).style('font-size','9px').text(d=>chartWinner(d.r).name).style('opacity',d=>state.labels&&d.radius>30?1:0);
 all.classed('light-fill',d=>!['winner','runner'].includes(state.metric));
 all.interrupt().transition().duration(duration()).delay((d,i)=>Math.min(i*5,120)).ease(d3.easeCubicInOut).attr('transform',d=>`translate(${d.x},${d.y}) scale(1)`).style('opacity',1);
 altPositions=new Map(nodes.map(d=>[d.key,[d.x,d.y]]));
}
function drawTernary(){
 const host=$('#map-host'),cw=host.clientWidth,ch=host.clientHeight,svg=d3.select('#scatter').attr('viewBox',`0 0 ${cw} ${ch}`);svg.selectAll('*').remove();altMode='ternary';
 const cs=records['00000/000'].candidates,rs=Object.values(records).filter(r=>valid(r)&&(state.level==='town'?r.town!=='000':r.town==='000')&&(!state.county||r.county===state.county)),side=Math.min(cw-150,Math.max(150,ch-260)*2/Math.sqrt(3)),th=side*Math.sqrt(3)/2,cx=cw/2,top=108;
 const vs=[[cx,top],[cx-side/2,top+th],[cx+side/2,top+th]],point=(a,b,c)=>[a*vs[0][0]+b*vs[1][0]+c*vs[2][0],a*vs[0][1]+b*vs[1][1]+c*vs[2][1]];
 const g=svg.append('g');g.append('path').attr('d','M'+vs.map(v=>v.join(',')).join('L')+'Z').attr('fill','#fff').attr('stroke','#cad7e5');
 for(let i=1;i<10;i++){let t=i/10;[[point(t,0,1-t),point(t,1-t,0)],[point(0,t,1-t),point(1-t,t,0)],[point(0,1-t,t),point(1-t,0,t)]].forEach(p=>g.append('path').attr('d','M'+p.map(v=>v.join(',')).join('L')).attr('stroke','#e3eaf2').attr('stroke-width',.8));g.append('text').attr('x',point(t,1-t,0)[0]-8).attr('y',point(t,1-t,0)[1]+3).attr('text-anchor','end').attr('class','ternary-tick').text(Math.round(t*100)+'%')}
 vs.forEach((v,i)=>{g.append('circle').attr('cx',v[0]).attr('cy',v[1]).attr('r',4).attr('fill',color(cs[i].party));g.append('text').attr('x',v[0]).attr('y',v[1]+(i===0?-20:28)).attr('text-anchor','middle').attr('class','ternary-corner').attr('fill',color(cs[i].party)).text(cs[i].name);g.append('text').attr('x',v[0]).attr('y',v[1]+(i===0?-7:43)).attr('text-anchor','middle').attr('class','ternary-tick').text(cs[i].party+' 100%')});
 const nodes=rs.map(r=>{const ps=cs.map(c=>r.candidates.find(x=>x.name===c.name)?.votes||0),sum=d3.sum(ps),[x,y]=point(...ps.map(v=>v/sum));return {r,key:keyOf(r),x,y}});
 const dots=g.selectAll('.ternary-dot').data(nodes).join('circle').attr('class','ternary-dot').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('fill',d=>color(d.r.candidates[0].party)).attr('r',d=>d.key===state.key?8:rs.length>50?3.5:6).attr('stroke',d=>d.key===state.key?'#142b48':'white').attr('stroke-width',1).attr('fill-opacity',d=>state.brushed.length&&!state.brushed.includes(d.key)?.12:.72);wireChart(dots);if(state.brushEnabled)attachTernaryBrush(svg,nodes,[[vs[1][0]-10,top-10],[vs[2][0]+10,top+th+10]]);
 g.append('text').attr('x',cx).attr('y',top+th+68).attr('class','ternary-hint').attr('text-anchor','middle').text('靠近角落＝該候選人占比更高');
 $('#legend').innerHTML='<div class="legend-title">三方得票率 · 每點一'+(state.level==='town'?'鄉鎮市區':'縣市')+'</div><div class="legend-foot">三組有效票占比合計100% · '+nodes.length+' 個地區</div>';$('#view-description').textContent='三方競爭 · 點選地區查看完整結果';$('#chart-coordinate').textContent='TERNARY / VOTE SHARE';
}
function drawBeeswarm(){
 const host=$('#map-host'),cw=host.clientWidth,ch=host.clientHeight,svg=d3.select('#scatter').attr('viewBox',`0 0 ${cw} ${ch}`);svg.selectAll('*').remove();altMode='swarm';
 const rs=scoped(),parties=[...new Set(rs.map(r=>r.candidates[0].party))],left=78,right=cw-45,top=115,bottom=ch-130,x=d3.scaleLinear().domain([0,Math.max(10,d3.max(rs,r=>r.margin)*1.06)]).nice().range([left,right]),y=d3.scalePoint().domain(parties).range([top+35,bottom-30]).padding(.5);
 const nodes=rs.map(r=>({r,key:keyOf(r),x:x(r.margin),fx:x(r.margin),y:y(r.candidates[0].party),tx:x(r.margin),ty:y(r.candidates[0].party)}));
 d3.forceSimulation(nodes).randomSource(d3.randomLcg(.42)).force('x',d3.forceX(d=>d.tx).strength(1)).force('y',d3.forceY(d=>d.ty).strength(.08)).force('collide',d3.forceCollide(5.2)).stop().tick(200);
 svg.append('g').attr('class','scatter-axis').attr('transform',`translate(0,${bottom})`).call(d3.axisBottom(x).ticks(6).tickFormat(d=>d+' pp'));
 parties.forEach(p=>{svg.append('line').attr('x1',left).attr('x2',right).attr('y1',y(p)).attr('y2',y(p)).attr('stroke','#dde5ef').attr('stroke-dasharray','3 4');svg.append('text').attr('class','swarm-party').attr('x',left-13).attr('y',y(p)+4).attr('text-anchor','end').attr('fill',color(p)).text(p)});
 const circles=svg.selectAll('.swarm-dot').data(nodes).join('circle').attr('class','swarm-dot').attr('cx',d=>x(d.r.margin)).attr('cy',d=>d.y).attr('r',d=>d.key===state.key?7:4.5).attr('fill',d=>color(d.r.candidates[0].party)).attr('stroke',d=>d.key===state.key?'#142b48':'white');wireChart(circles);
 svg.append('text').attr('class','ternary-hint').attr('x',left).attr('y',top-22).text('接近的競爭 ←');svg.append('text').attr('class','ternary-hint').attr('x',right).attr('y',top-22).attr('text-anchor','end').text('→ 較大差距');
 $('#legend').innerHTML='<div class="legend-title">每點一'+(isLeg()?'選區':state.level==='town'?'鄉鎮市區':'縣市')+' · 依第一名政黨分列</div><div class="legend-foot">橫軸＝前兩名差距，縱向僅作避讓；點大小一致。</div>';$('#view-description').textContent='競爭差距蜂群 · '+nodes.length+' 個地區';$('#chart-coordinate').textContent='BEESWARM / WINNING MARGIN';
}

function renderBrushDetail(){
 const rs=state.brushed.map(k=>records[k]).filter(valid),tot=d3.sum(rs,r=>r.total),cast=d3.sum(rs,r=>r.cast),eligible=d3.sum(rs,r=>r.eligible);
 const cs=records['00000/000'].candidates.map(c=>({...c,votes:d3.sum(rs,r=>r.candidates.find(x=>x.name===c.name)?.votes||0)})).sort((a,b)=>b.votes-a.votes);cs.forEach(c=>c.share=c.votes/tot*100);
 const margin=(cs[0].votes-cs[1].votes)/tot*100;
 $('#detail-title').textContent=rs.length+' 個地區';$('#detail-scope').textContent='框選合計 · 同一場選舉';
 $('#detail-stats').innerHTML='<div class="detail-stat"><small>有效票合計</small><strong>'+fmt(tot)+'</strong></div><div class="detail-stat"><small>投票率</small><strong>'+pct(cast/eligible*100)+'</strong></div>';
 $('#detail-result').innerHTML=resultCandidates({candidates:cs});$('#detail-chart').innerHTML='<div class="chart-caption"><span>所選地區前兩名差距</span><span>'+fmt(cs[0].votes-cs[1].votes)+' 票</span></div><div class="margin-callout"><strong>'+margin.toFixed(2)+'</strong><span>百分點</span></div>';
 $('#detail-note').textContent='依已框選地區票數加總；未將百分比直接平均。';
}
function attachTernaryBrush(svg,nodes,extent){
 const brush=d3.brush().extent(extent).on('end',ev=>{if(!ev.sourceEvent||!ev.selection)return;const [[x0,y0],[x1,y1]]=ev.selection;state.brushed=nodes.filter(n=>n.x>=x0&&n.x<=x1&&n.y>=y0&&n.y<=y1).map(n=>n.key);state.key='';state.brushEnabled=false;updateUI();toast(state.brushed.length?'已框選 '+state.brushed.length+' 個地區；可切回地理檢視。':'此範圍沒有資料點')});
 svg.append('g').attr('class','ternary-brush').call(brush);
}
function drawSmallMultiples(){
 const host=$('#map-host'),cw=host.clientWidth,ch=Math.max(host.clientHeight,370),svg=d3.select('#scatter').attr('viewBox',`0 0 ${cw} ${ch}`);svg.selectAll('*').remove();altMode='small';
 const scope=records[(state.county||'00000')+'/000'],cs=records['00000/000'].candidates.map(c=>({...c,share:scope?.candidates.find(x=>x.name===c.name)?.share??c.share})),pw=cw/3,ids=['09007','09020','10016'],fc=fs=>({type:'FeatureCollection',features:fs});
 cs.forEach((c,i)=>{const x=i*pw,g=svg.append('g'),main=state.county?counties.filter(f=>f.properties.COUNTYCODE===state.county):counties.filter(f=>!ids.includes(f.properties.COUNTYCODE));
  if(i)g.append('line').attr('x1',x).attr('x2',x).attr('y1',85).attr('y2',ch-110).attr('stroke','#dde5ee');
  g.append('text').attr('x',x+pw/2).attr('y',77).attr('text-anchor','middle').attr('class','small-name').attr('fill',color(c.party)).text(c.name);
  g.append('text').attr('x',x+pw/2).attr('y',102).attr('text-anchor','middle').attr('class','small-percent').text(pct(c.share));
  const projection=d3.geoMercator().fitExtent([[x+57,118],[x+pw-12,ch-111]],fc(main));
  const paths={};main.forEach(f=>paths[f.properties.COUNTYCODE]=d3.geoPath(projection));
  if(!state.county)ids.forEach((id,j)=>{const f=counties.find(f=>f.properties.COUNTYCODE===id),bx=x+9,by=157+j*62,bw=40;paths[id]=d3.geoPath(d3.geoMercator().fitExtent([[bx+3,by],[bx+bw-3,by+30]],f));g.append('text').attr('x',bx+bw/2).attr('y',by+43).attr('text-anchor','middle').attr('class','ternary-tick').text(f.properties.COUNTYNAME)});
  const features=(state.level==='town'?towns:counties).filter(f=>!state.county||f.properties.COUNTYCODE===state.county),marks=g.selectAll('.small-geo').data(features).join('path').attr('class','small-geo').attr('d',f=>paths[f.properties.COUNTYCODE](f)).attr('fill',f=>{const r=records[geoKey(f)],v=r?.candidates.find(x=>x.name===c.name)?.share;return v==null?'#d3dce6':d3.interpolateRgb('#e8eef4',color(c.party))(Math.min(v/65,1))}).attr('opacity',f=>state.brushed.length&&!state.brushed.includes(geoKey(f))?.12:1).attr('stroke','#fff').attr('stroke-width',.4).attr('tabindex',0).attr('role','button').attr('aria-label',f=>(f.properties.TOWNNAME||f.properties.COUNTYNAME)+' '+c.name+' '+pct(records[geoKey(f)]?.candidates.find(x=>x.name===c.name)?.share)).on('pointermove',(ev,f)=>chartTip(ev,records[geoKey(f)])).on('pointerleave',()=>$('#map-tooltip').hidden=true).on('click',(_,f)=>selectRegion(geoKey(f),false)).on('keydown',(ev,f)=>{if(ev.key==='Enter')selectRegion(geoKey(f),false)});
 });
 $('#legend').innerHTML='<div class="legend-title">三圖同一尺度 · 得票率 0–65%+</div><div class="legend-parties">'+cs.map(c=>'<span>'+esc(c.name)+' <i style="margin-left:5px;width:45px;background:linear-gradient(90deg,#e8eef4,'+color(c.party)+')"></i></span>').join('')+'</div>';
 $('#view-description').textContent='同屏比較候選人支持分布 · 同投影、同色階範圍';$('#chart-coordinate').textContent='SMALL MULTIPLES / SHARED SCALE';
}
function drawSeatArc(){
 const host=$('#map-host'),cw=host.clientWidth,ch=Math.max(350,host.clientHeight),svg=d3.select('#scatter').attr('viewBox',`0 0 ${cw} ${ch}`);svg.selectAll('*').remove();altMode='seats';
 const rs=Object.values(records).filter(r=>valid(r)&&r.town==='000'&&(!state.county||r.county===state.county)).sort((a,b)=>['民進黨','國民黨','無黨籍'].indexOf(winner(a).party)-['民進黨','國民黨','無黨籍'].indexOf(winner(b).party));
 const R=Math.min(cw*.39,(ch-235)*.85),cx=cw/2,cy=(ch+R)/2,counts=rs.length===73?[10,13,15,17,18]:[rs.length],slots=[];
 counts.forEach((n,row)=>{const rad=R*(.44+row*.14);for(let j=0;j<n;j++){const a=Math.PI-j/(n-1||1)*Math.PI;slots.push({a,x:cx+Math.cos(a)*rad,y:cy-Math.sin(a)*rad})}});slots.sort((a,b)=>b.a-a.a);const nodes=rs.map((r,i)=>({r,key:keyOf(r),...slots[i]}));
 const dots=svg.selectAll('.seat-dot').data(nodes).join('circle').attr('class','seat-dot').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',Math.max(4,Math.min(9,R/26))).attr('fill',d=>color(winner(d.r).party)).attr('stroke',d=>d.key===state.key?'#17334e':'white').attr('stroke-width',d=>d.key===state.key?3:1.5);wireChart(dots);
 svg.append('text').attr('x',cx).attr('y',cy-55).attr('text-anchor','middle').attr('class','seat-total').text(rs.length);
 svg.append('text').attr('x',cx).attr('y',cy-28).attr('text-anchor','middle').attr('class','small-name').text('區域立委當選席次');
 $('#legend').innerHTML='<div class="legend-title">每點一席 · 僅含區域立委</div><div class="legend-foot">示意排列，非實際座次；不含原住民與不分區。</div>';
 $('#view-description').textContent='區域立委席次示意 · 點選議席查看選區結果';$('#chart-coordinate').textContent='PARLIAMENT / REGIONAL SEATS';
}
