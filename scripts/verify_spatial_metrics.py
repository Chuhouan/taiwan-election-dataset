from fixtures import artifact
import json,math,csv
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1];rs=json.loads((root/'dist/data.json').read_text(encoding='utf-8'))['president'];graph=json.loads((root/'dist/town-adjacency.json').read_text(encoding='utf-8'))['rook'];keys=[k for k in sorted(graph) if graph[k]];lookup={k:i for i,k in enumerate(keys)};x=np.array([next(c['votes'] for c in rs[k]['candidates'] if c['number']=='2')/rs[k]['total']*100 for k in keys]);z=x-x.mean();w=np.zeros((len(keys),len(keys)))
for k in keys:
 for neighbor in graph[k]:w[lookup[k],lookup[neighbor]]=1/len(graph[k])
expected=float(len(keys)/w.sum()*(z@w@z)/(z@z));actual=json.loads((root/'tests/fixtures/spatial-moran-browser.json').read_text(encoding='utf-8'));assert actual['n']==len(keys)==356 and math.isclose(expected,actual['I'],abs_tol=1e-12)
export=list(csv.DictReader((artifact('臺灣2024-鄉鎮空間分析.csv')).open(encoding='utf-8-sig',newline='')));assert len(export)==356
for row in export:
 k=row['地區ID'];i=lookup[k];assert math.isclose(float(row['得票率']),x[i],abs_tol=1e-12);assert math.isclose(float(row['範圍內鄰接平均']),float(w[i]@x),abs_tol=1e-12)
print('PASS: independent NumPy matrix Moran I; all 356 exported rates and spatial lags')
