import csv,json,collections
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData/2024總統立委/總統';data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'))['president'];votes=collections.defaultdict(int)
with (source/'elctks.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if r[4].strip('0 ') and not r[5].strip('0 '):votes[(r[0]+r[1]+'/'+r[3],r[6])]+=int(r[7])
errors=[]
for k,r in data.items():
 if r['town']=='000':continue
 for c in r['candidates']:
  v=votes.get((k,c['number']))
  if v!=c['votes']:errors.append((k,c['number'],v,c['votes']))
print('town mismatches',len(errors),'sample',errors[:5])
