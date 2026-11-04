"""Common statistical-county adjacency, derived from validated physical town edges.

No historical survey geometry is inferred. This explicitly fixes one topology for
the harmonized whole-county series and never connects islands by distance.
"""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'dist/town-adjacency.json';towns=json.loads(source.read_text(encoding='utf-8'))
names=json.loads((ROOT/'dist/data.json').read_text(encoding='utf-8'))['counties']
payload={'metadata':{'topology_id':'common_county_rook_1120928','definition':'將已核對的鄉鎮Rook共邊依完整縣市統計範圍合併，去除縣內邊及重複；海島不依距離或橋梁補接。這是固定共同統計範圍的空間權重，不冒充歷史法定界線。','boundary_version':towns['metadata']['boundary_version'],'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sources':['https://data.gov.tw/dataset/130549','https://www.moi.gov.tw/News_toggle3.aspx?n=174&sms=9015']},'names':names,'rook':{k:set() for k in names}}
evidence={}
for key,neighbors in towns['rook'].items():
    a=key.split('/')[0]
    for neighbor in neighbors:
        b=neighbor.split('/')[0]
        if a==b:continue
        assert a in names and b in names
        payload['rook'][a].add(b)
        pair=tuple(sorted([a,b]));evidence.setdefault('/'.join(pair),set()).add('/'.join(sorted([key,neighbor])))
for a,neighbors in payload['rook'].items():
    assert a not in neighbors
    for b in neighbors:assert a in payload['rook'][b]
payload['rook']={k:sorted(v) for k,v in payload['rook'].items()}
payload['metadata']['edges']=sum(map(len,payload['rook'].values()))//2
payload['metadata']['islands_without_edges']=[k for k,v in payload['rook'].items() if not v]
assert set(payload['metadata']['islands_without_edges'])=={'09007','09020','10016'}
payload['evidence']={k:sorted(v) for k,v in sorted(evidence.items())}
(ROOT/'dist/history-adjacency.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Common county topology:',payload['metadata']['edges'],'edges; 19 mainland / 3 island units; no inferred island links')
