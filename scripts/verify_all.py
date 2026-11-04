"""Regression checks for active analysis data and shared-arc LOD assets."""
import json,collections,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def read(p):return json.loads((root/p).read_text(encoding='utf-8'))
data=read('dist/data.json');assert set(data)=={'president','legislator','counties'}
history=read('dist/history.json')['elections'];assert [e['year'] for e in history]==[1996,2000,2004,2008,2012,2016,2020,2024]
for e in history:
 assert sum(c['votes'] for c in e['candidates'])==e['validVotes'] and sum(c['elected'] for c in e['candidates'])==1
 assert abs(e['turnout']-100*e['cast']/e['eligible'])<1e-9
assert {e['year']:e['candidates'][0]['votes'] for e in history if e['year'] in [2008,2012,2024]}=={2008:7659014,2012:6891139,2024:5586019}
village_counts=[0,0];village_totals=collections.defaultdict(lambda:collections.Counter())
for file in (root/'dist/villages').glob('*.json'):
 shard=json.loads(file.read_text(encoding='utf-8'));village_counts[0]+=len(shard['features']);village_counts[1]+=len(shard['special'])
 assert all(not f['properties']['synthetic'] and f['geometry'] for f in shard['features'])
 assert all(r['synthetic'] for r in shard['special'])
 for r in [f['properties'] for f in shard['features']]+shard['special']:
  assert sum(r['votes'].values())==r['valid'];total=village_totals[r['county']+'/'+r['town']]
  for field in ['valid','cast','eligible']:total[field]+=r[field]
  for number,votes in r['votes'].items():total['candidate:'+number]+=votes
assert village_counts==[7727,11] and len(village_totals)==368
for key,total in village_totals.items():
 r=data['president'][key];assert total['valid']==r['total'] and total['cast']==r['cast'] and total['eligible']==r['eligible']
 assert all(total['candidate:'+c['number']]==c['votes'] for c in r['candidates'])
towns=[r for r in data['president'].values() if r['town']!='000' and r['county'] in data['counties']]
assert len(towns)==368
for election in ['president','legislator']:
 for r in data[election].values():
  assert sum(c['votes'] for c in r['candidates'])==r['total']
  if r.get('eligible'):assert abs(r['turnout']-r['cast']/r['eligible']*100)<.006
  for c in r['candidates']:assert abs(c['share']-c['votes']/r['total']*100)<.006
selected=[r for r in towns if next(c['votes'] for c in r['candidates'] if c['name']=='柯文哲')/r['total']*100>=30 and r['cast']/r['eligible']*100>=70 and (r['candidates'][0]['votes']-r['candidates'][1]['votes'])/r['total']*100<=5]
assert len(selected)==24 and sum(r['total'] for r in selected)==1896160
house=read('dist/parliament.json');assert len(house['members'])==113
assert house['counts']=={'民進黨':51,'國民黨':52,'無黨籍':2,'民眾黨':8}
assert len({m['id'] for m in house['members']})==113
districts=read('dist/districts-2024.json');assert len(districts['features'])==73
assert districts['metadata']['mappedVillageCount']==7727 and districts['metadata']['unmatchedRegularVillageCount']==0
assert {f['properties']['key'] for f in districts['features']}=={key for key,r in data['legislator'].items() if r['town']=='000' and r['county'] in data['counties']}
for file in (root/'src').rglob('*.js'):
 assert not re.search(r'''(?<!\$)\$\(['"][^'"]+['"]\)\.forEach''',file.read_text(encoding='utf-8')),file
original=read('dist/towns.json')
def endpoints(arc):return tuple(arc[0]),(sum(p[0] for p in arc),sum(p[1] for p in arc))
for tier in [0,1]:
 lod=read(f'dist/towns-lod{tier}.json');assert lod['objects']==original['objects'];assert len(lod['arcs'])==len(original['arcs']);assert lod['transform']==original['transform']
 assert all(endpoints(a)==endpoints(b) for a,b in zip(lod['arcs'],original['arcs']))
 assert sum(map(len,lod['arcs']))<sum(map(len,original['arcs']))
print('PASS: election arithmetic; precise 24-region filter; 113 seats; 73 spatial district joins; shared-arc LOD; collection selector guard')

# The UI dispatcher must remain explicit instead of acquiring new wrapper layers.
for source in (root/'src').rglob('*.js'):
 assert not __import__('re').search(r'(updateUI|drawScatter|buildMap|updateLabels|parseRoute|routeString|download|updateHash|renderDetail|renderDrawer|scoped|overviewRecords|listRecords|sortRecords|fill|selectRegion|setElection|renderList|renderFinding|wireChart|showTooltip|zoomToRegion|drawSeatArc)\s*=\s*function',source.read_text(encoding='utf-8')),source.name
print('PASS: explicit UI/chart dispatchers; no core UI/chart function wrappers')

# Official-geometry adjacency must never silently connect missing or overlapping areas.
adjacency=json.loads((root/'dist/town-adjacency.json').read_text(encoding='utf-8'))
for kind in ['rook','queen']:
 graph=adjacency[kind];assert len(graph)==368
 for key,neighbors in graph.items():
  assert key not in neighbors and len(neighbors)==len(set(neighbors))
  for neighbor in neighbors:assert key in graph[neighbor]
 for pair in adjacency['metadata']['excluded_overlap_pairs']:assert pair['b'] not in graph[pair['a']]
 for key in adjacency['metadata']['missing_geometry_towns']:assert not graph[key]
print('PASS: symmetric 368-town adjacency; missing geometry and overlapping pairs excluded')

# Regional village data shares geometry but must retain its own candidates and voter denominators.
legislator_shards=list((root/'dist/legislator-villages').glob('*.json'));assert len(legislator_shards)==73
leg_village_count=0
for path in legislator_shards:
 payload=json.loads(path.read_text(encoding='utf-8'));district=payload['metadata']['districtKey'];reference=data['legislator'][district];units=payload['units'];leg_village_count+=len(units)
 for field,raw in [('valid','total'),('cast','cast'),('eligible','eligible')]:assert sum(u[field] for u in units.values())==reference[raw]
 for candidate in reference['candidates']:assert sum(u['votes'].get(str(int(candidate['number'])),0) for u in units.values())==candidate['votes']
assert leg_village_count==7738
print('PASS: 73 regional village shards; 7738 units; separate candidate/voter denominators reconcile')
# Historical county comparisons preserve complete source units, candidate votes, and denominators.
county_history=read('dist/history-counties.json')
assert len(county_history['elections'])==8 and set(county_history['counties'])==set(data['counties'])
for e in county_history['elections']:
 national=next(n for n in history if n['year']==e['year']);units=e['units'];assert len(units)==22
 for field,national_field in [('validVotes','validVotes'),('cast','cast'),('eligible','eligible')]:assert sum(u[field] for u in units.values())==national[national_field]
 for candidate in national['candidates']:assert sum(next(c['votes'] for c in u['candidates'] if c['name']==candidate['name']) for u in units.values())==candidate['votes']
 for u in units.values():
  assert sum(c['votes'] for c in u['candidates'])==u['validVotes'];assert abs(u['turnout']-100*u['cast']/u['eligible'])<1e-10
  for c in u['candidates']:assert abs(c['share']-100*c['votes']/u['validVotes'])<1e-10
 if e['year']<=2008:
  assert set(units['64000']['originalUnits'].values())=={'高雄縣','高雄市'}
  assert set(units['66000']['originalUnits'].values())=={'臺中縣','臺中市'}
  assert set(units['67000']['originalUnits'].values())=={'臺南縣','臺南市'}
for code,u in county_history['elections'][-1]['units'].items():
 current=data['president'][code+'/000'];assert u['validVotes']==current['total']
 for c in u['candidates']:assert c['votes']==next(x['votes'] for x in current['candidates'] if x['name']==c['name'])
print('PASS: 8 historical elections / 176 harmonized county units; raw whole-unit mergers; every candidate and denominator reconciles')

# The four legislative ballot systems must retain their own votes and seat denominators.
analysis=house['analysis'];assert set(analysis['systems'])=={'list','regional','plain','mountain'}
for name,system in analysis['systems'].items():
 assert system['seats']=={'list':34,'regional':73,'plain':3,'mountain':3}[name]
 assert sum(p['votes'] for p in system['parties'])==system['validVotes']
 assert sum(p['seats'] for p in system['parties'])==system['seats']
 for p in system['parties']:
  assert abs(p['voteShare']-p['votes']/system['validVotes']*100)<1e-10
  assert abs(p['seatShare']-p['seats']/system['seats']*100)<1e-10
  assert abs(p['gap']-(p['seatShare']-p['voteShare']))<1e-10
party_list={p['party']:p for p in analysis['systems']['list']['parties']}
assert {p:(party_list[p]['votes'],party_list[p]['seats']) for p in ['民進黨','國民黨','民眾黨']}=={'民進黨':(4982062,13),'國民黨':(4764576,13),'民眾黨':(3040615,8)}
assert analysis['systems']['list']['validVotes']==13776736
for member in house['members']:
 if member['kind']=='不分區':assert 'votes' not in member and member['partyVotes']==party_list[member['party']]['votes']
 else:assert member['votes']>=0 and abs(member['voteShare']-member['votes']/member['validVotes']*100)<1e-10
print('PASS: 4 separate legislative vote/seat systems; official party-list totals; personal and party votes remain distinct')
