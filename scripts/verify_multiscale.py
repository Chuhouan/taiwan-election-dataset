from fixtures import artifact
"""Independently verify browser multiscale metrics, quantiles and raw-vote aggregates."""
import csv,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'))
raw=data['president'];candidates=raw['00000/000']['candidates'];refs={}
for key,r in raw.items():
 if r['county'] in data['counties']:refs[key]={'valid':r['total'],'cast':r['cast'],'eligible':r['eligible'],'votes':{c['name']:c['votes'] for c in r['candidates']}}
village=json.loads((root/'dist/villages/63000.json').read_text(encoding='utf-8'))
for u in [f['properties'] for f in village['features']]+village['special']:
 refs[u['id']]={**{k:u[k] for k in ['valid','cast','eligible']},'votes':{c['name']:u['votes'].get(str(int(c['number'])),0) for c in candidates}}
def metric(u,name,candidate):
 if name=='turnout':return u['cast']/u['eligible']*100 if u['eligible'] else None
 if not u['valid']:return None
 if name=='share':return u['votes'].get(candidate,0)/u['valid']*100
 hhi=sum((v/u['valid'])**2 for v in u['votes'].values())
 return hhi if name=='hhi' else 1/hhi
def quantile(values,q):
 vs=sorted(values);index=(len(vs)-1)*q;lo=math.floor(index);hi=math.ceil(index);return vs[lo]+(vs[hi]-vs[lo])*(index-lo)
assert metric({'valid':3,'votes':{'a':1,'b':1,'c':1}},'enp','')==3
assert metric({'valid':10,'votes':{'a':10,'b':0,'c':0}},'hhi','')==1
checks=json.loads((root/'tests/fixtures/multiscale-browser.json').read_text(encoding='utf-8'))
for check in checks:
 groups={}
 for p in check['points']:
  assert math.isclose(metric(refs[p['id']],check['metric'],check['candidate']),p['value'],rel_tol=1e-12,abs_tol=1e-12)
  groups.setdefault(p['level'],[]).append(p)
 assert {k:len(v) for k,v in groups.items()}=={'county':22,'town':12,'village':33}
 for level,points in groups.items():
  values=[p['value'] for p in points];median=next(s['value'] for s in check['medians'] if s['level']==level);assert math.isclose(median,quantile(values,.5),rel_tol=1e-12)
  iqr=next(s for s in check['iqrs'] if s['level']==level);assert math.isclose(iqr['q1'],quantile(values,.25),rel_tol=1e-12);assert math.isclose(iqr['q3'],quantile(values,.75),rel_tol=1e-12)
  units=[refs[p['id']] for p in points];pooled={k:sum(u[k] for u in units) for k in ['valid','cast','eligible']};pooled['votes']={c['name']:sum(u['votes'][c['name']] for u in units) for c in candidates};browser=next(s['value'] for s in check['aggregates'] if s['level']==level);assert math.isclose(browser,metric(pooled,check['metric'],check['candidate']),rel_tol=1e-12)
rows=list(csv.DictReader((artifact('臺灣2024-多尺度統計.csv')).open(encoding='utf-8-sig')))
assert len(rows)==67
for row in rows:
 u=refs[row['統計單位ID']]
 for name in ['賴清德','侯友宜','柯文哲']:assert int(row[name+'票數'])==u['votes'][name]
 assert int(row['有效票'])==u['valid'];assert math.isclose(float(row['指標值']),metric(u,row['指標'],row['得票率參照候選人']),rel_tol=1e-12)
print('PASS: 4 metrics x 67 units; 12 medians/IQRs/pooled statistics; all raw candidate CSV columns')
