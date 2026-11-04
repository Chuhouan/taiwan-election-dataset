"""Explicit 2024 regional district membership, including separately labelled special groups."""
import csv,json,collections,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData/2024總統立委/區域立委';data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'));names={}
with (source/'elbase.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if len(r)>5 and r[4].strip('0 '):names[r[0]+r[1]+'/'+r[3]+'/'+r[4]]=r[5]
lookup={}
with (source/'elctks.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if not r[4].strip('0 ') or r[5].strip('0 '):continue
  key=r[0]+r[1]+':'+r[2]+'/000';unit=r[0]+r[1]+'/'+r[3]+'/'+r[4];record={'id':unit,'name':names[unit],'code':r[4],'town':r[3],'townName':data['president'][r[0]+r[1]+'/'+r[3]]['name'],'special':not r[4].isdigit()};lookup.setdefault(key,{})[unit]=record
assert len(lookup)==73 and set(lookup)=={k for k,r in data['legislator'].items() if r['county'] in data['counties'] and r['town']=='000'};allids=[unit for units in lookup.values() for unit in units];assert len(allids)==len(set(allids))==7738
result={}
for key,units in lookup.items():
 grouped=collections.defaultdict(list)
 for unit in units.values():grouped[unit['town']].append(unit)
 result[key]={'towns':[{'code':town,'name':items[0]['townName'],'units':sorted(items,key=lambda r:r['code'])} for town,items in sorted(grouped.items())],'regular':sum(not r['special'] for r in units.values()),'special':sum(r['special'] for r in units.values())}
payload={'metadata':{'election_id':'legislator:2024','assignment_source':'CEC 2024 regional legislator elctks.csv / elbase.csv','source_sha256':hashlib.sha256((source/'elctks.csv').read_bytes()).hexdigest(),'method':'投票所屬鄉鎮村里清單，不等於測量界線；特殊或合併統計組另標，未推估邊界。'},'districts':result};(root/'dist/district-membership.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print('PASS: 73 districts; 7738 distinct units; official raw names and town membership')
