import json,math
from pathlib import Path
rs=[r for r in json.loads(Path('dist/data.json').read_text(encoding='utf-8'))['president'].values() if r['town']!='000' and r['total']>0]
x=[r['cast']/r['eligible']*100 for r in rs];y=[(r['candidates'][0]['votes']-r['candidates'][1]['votes'])/r['total']*100 for r in rs]
mx=sum(x)/len(x);my=sum(y)/len(y);xx=sum((v-mx)**2 for v in x);yy=sum((v-my)**2 for v in y);xy=sum((a-mx)*(b-my) for a,b in zip(x,y));expected={'count':len(rs),'slope':xy/xx,'intercept':my-xy/xx*mx,'r2':xy**2/(xx*yy)};actual=json.loads(Path('tests/fixtures/scatter-regression-browser.json').read_text(encoding='utf-8'))
for k,v in expected.items():assert math.isclose(actual[k],v,rel_tol=1e-10,abs_tol=1e-10),(k,v,actual[k])
print('PASS: independent raw-vote OLS regression, n=368; slope, intercept and R-squared')
