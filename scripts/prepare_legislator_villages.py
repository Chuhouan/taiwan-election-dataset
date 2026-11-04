"""Prepare per-district regional legislator village results, sharing the verified county geometry."""
import csv,json,hashlib,collections
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData/2024總統立委/區域立委';data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'));membership=json.loads((root/'dist/district-membership.json').read_text(encoding='utf-8'));scopes=json.loads((root/'dist/district-scopes.json').read_text(encoding='utf-8'));profiles={};results=collections.defaultdict(dict)
def identity(r):return r[0]+r[1]+':'+r[2]+'/000',r[0]+r[1]+'/'+r[3]+'/'+r[4]
with (source/'elprof.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if not r[4].strip('0 ') or r[5].strip('0 '):continue
  district,key=identity(r);profiles[(district,key)]={'valid':int(r[6]),'cast':int(r[8]),'eligible':int(r[9]),'votes':{}}
with (source/'elctks.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if not r[4].strip('0 ') or r[5].strip('0 '):continue
  district,key=identity(r);unit=results[district].setdefault(key,{**profiles[(district,key)],'votes':{}});number=str(int(r[6]));assert number not in unit['votes'];unit['votes'][number]=int(r[7])
out=root/'dist/legislator-villages';out.mkdir(exist_ok=True);audit=[]
for district,units in sorted(results.items()):
 expected=data['legislator'][district];county=expected['county'];candidates=[{**c,'number':str(int(c['number']))} for c in expected['candidates']]
 assert set(units)=={u['id'] for town in membership['districts'][district]['towns'] for u in town['units']}
 geometry=json.loads((root/'dist/villages'/f'{county}.json').read_text(encoding='utf-8'));geoids={f['properties']['id'] for f in geometry['features']}|{u['id'] for u in geometry['special']};assert set(units)<=geoids
 for unit in units.values():assert sum(unit['votes'].values())==unit['valid']
 for field,reference in [('valid','total'),('cast','cast'),('eligible','eligible')]:assert sum(u[field] for u in units.values())==expected[reference],(district,field)
 for c in candidates:assert sum(u['votes'].get(c['number'],0) for u in units.values())==c['votes'],(district,c['name'])
 for town in membership['districts'][district]['towns']:
  subset=[units[u['id']] for u in town['units']];town_record=data['legislator'][district[:-3]+town['code']]
  assert sum(u['valid'] for u in subset)==town_record['total']
  for c in town_record['candidates']:assert sum(u['votes'].get(str(int(c['number'])),0) for u in subset)==c['votes']
 payload={'metadata':{'election_id':'legislator:2024','districtKey':district,'county':county,'countyName':data['counties'][county],'scopeName':scopes[district]['name'],'validVotes':expected['total'],'cast':expected['cast'],'eligible':expected['eligible'],'candidates':candidates,'source_sha256':hashlib.sha256((source/'elctks.csv').read_bytes()).hexdigest(),'verification_status':'村里有效票、投票數、選舉人數、候選人票數加總與選區一致；鄉鎮分部票數一致'},'units':units}
 path=out/(district.replace(':','-').replace('/000','')+'.json');path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8');audit.append({'district':district,'units':len(units),'valid':expected['total'],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
assert len(audit)==73 and sum(x['units'] for x in audit)==7738
(root/'docs/legislator-village-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8');print('PASS: 73 district shards, 7738 village/special units; candidate, valid, cast and eligible totals; town subparts')
