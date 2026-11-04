import csv,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData/2024總統立委';data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'));report={}
for kind,folder in [('president','總統'),('legislator','區域立委')]:
 villages=set();stations=set();villageVotes=stationVotes=0
 with (source/folder/'elctks.csv').open(encoding='utf-8-sig',newline='') as f:
  for r in csv.reader(f):
   if r[4].strip('0 ') and not r[5].strip('0 '):villages.add(tuple(r[:5]));villageVotes+=int(r[7])
   elif r[5].strip('0 '):stations.add(tuple(r[:6]));stationVotes+=int(r[7])
 expected=data['president']['00000/000']['total'] if kind=='president' else sum(r['total'] for r in data[kind].values() if r['town']=='000' and r['county'] in data['counties'])
 if villages:assert villageVotes==expected,(kind,'village',villageVotes,expected)
 assert stationVotes==expected,(kind,'station',stationVotes,expected)
 synthetic=sum(1 for key in villages if not key[4].isdigit())
 report[kind]=dict(villageStatisticUnits=len(villages),regularVillageStatisticUnits=len(villages)-synthetic,syntheticOrCombinedStatisticUnits=synthetic,stationUnits=len(stations),villageVotes=villageVotes,stationVotes=stationVotes,expectedValidVotes=expected,boundaryStatus='已取得1120928官方历史村里界及附补图；非行政村里统计组不能逐一当作村里，投票所无已核实几何',mapEnabled=(root/'dist/villages').is_dir() and (kind=='president' or (root/'dist/legislator-villages').is_dir()))
(root/'docs/fine-level-availability.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print({k:(v['villageStatisticUnits'],v['regularVillageStatisticUnits'],v['syntheticOrCombinedStatisticUnits'],v['stationUnits'],v['stationVotes']) for k,v in report.items()})
