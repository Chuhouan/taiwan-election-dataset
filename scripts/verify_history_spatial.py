"""Independent NumPy weights, lags, Moran I and seeded permutation checks."""
import json,hashlib,math,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))
adj=read('dist/history-adjacency.json');town=read('dist/town-adjacency.json')
assert adj['metadata']['sourceSHA256']==hashlib.sha256((ROOT/'dist/town-adjacency.json').read_bytes()).hexdigest()
expected_edges={tuple(sorted([a[:5],b[:5]])) for a,neighbors in town['rook'].items() for b in neighbors if a[:5]!=b[:5]}
actual_edges={tuple(sorted([a,b])) for a,neighbors in adj['rook'].items() for b in neighbors}
assert actual_edges==expected_edges and len(actual_edges)==33
assert {k for k,v in adj['rook'].items() if not v}=={'09007','09020','10016'}
assets={k:read('dist/'+f) for k,f in [('president','history-counties.json'),('legislator-list','history-party-list.json'),('mayor','history-mayors.json')]}
def value(u,metric):
    if u.get('available') is False:return None
    if metric in ['turnout','margin']:return u[metric]
    c=next((c for c in u['candidates'] if c['party']=={'dpp':'民主進步黨','kmt':'中國國民黨'}[metric]),None)
    return c['votes']/u['validVotes']*100 if c else None
def calculate(x,w):
    z=x-x.mean();denominator=z@z;I=float(z@w@z/denominator);state=2024;greater=0
    for p in range(999):
        shuffled=z.copy()
        for i in range(len(z)-1,0,-1):
            state=(1664525*state+1013904223)&0xffffffff;j=state*(i+1)//4294967296
            shuffled[i],shuffled[j]=shuffled[j],shuffled[i]
        greater+=float(shuffled@w@shuffled/denominator)>=I-1e-14
    return I,(greater+1)/1000
desktop=[c for c in read('tests/fixtures/history-final-browser.json') if c['view']=='spatial']
assert len(desktop)==9
extra_path=ROOT/'tests/fixtures/history-spatial-metrics-browser.json'
extra=json.loads(extra_path.read_text(encoding='utf-8')) if extra_path.exists() else []
report=[]
for c in desktop+extra:
    kind=c['kind'];metric=c.get('metric','dpp');elections=assets[kind]['elections']
    common={k for k in adj['rook'] if all(value(e['units'][k],metric) is not None for e in elections)}
    active={k for k in common if any(n in common for n in adj['rook'][k])}
    keys=[m['county'] for m in c['marks']];assert len(keys)==len(set(keys)) and set(keys)==active
    lookup={k:i for i,k in enumerate(keys)};w=np.zeros((len(keys),len(keys)))
    for k in keys:
        neighbors=[n for n in adj['rook'][k] if n in active]
        for neighbor in neighbors:w[lookup[k],lookup[neighbor]]=1/len(neighbors)
    for e in elections:
        x=np.array([value(e['units'][k],metric) for k in keys]);I,p=calculate(x,w)
        actual=next(r for r in c['spatialYears'] if int(r['year'])==e['year'])
        assert int(actual['n'])==len(keys) and math.isclose(float(actual['I']),I,abs_tol=1e-12)
        assert math.isclose(float(actual['p']),p,abs_tol=1e-12),(kind,metric,e['year'],p,actual['p'])
    selected=next(e for e in elections if e['year']==int(c['marks'][0]['year']));x=np.array([value(selected['units'][k],metric) for k in keys]);lag=w@x
    for m in c['marks']:
        i=lookup[m['county']];assert math.isclose(float(m['value']),x[i],abs_tol=1e-12) and math.isclose(float(m['lag']),lag[i],abs_tol=1e-12)
    report.append({'kind':kind,'metric':metric,'width':c.get('width'),'n':len(keys),'years':len(elections),'commonCodes':keys})
(ROOT/'tests/fixtures/history-spatial-regression.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 33 physical county edges; independent matrix lags / Moran I / 999 seeded permutations across',len(report),'native analysis cases; fixed common samples and no island links')
