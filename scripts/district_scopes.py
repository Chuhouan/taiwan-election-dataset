import csv,json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'));lookup={v:k for k,v in data['counties'].items()};out={}
with (root/'docs/2024-legislative-district-scope.csv').open(encoding='utf-8-sig',newline='') as stream:
 for row in csv.DictReader(stream):
  name=row['選舉區'].strip().replace(' ','');county=next(n for n in lookup if name.startswith(n));match=re.search(r'第(\d+)選舉區',name);district=int(match[1]) if match else 1;key=lookup[county]+':'+str(district).zfill(2)+'/000';assert key in data['legislator'],key
  out[key]=dict(name=name,description=row['選舉區範圍'])
assert len(out)==73
(root/'dist/district-scopes.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Verified: official scope descriptions joined to all 73 regional districts')
