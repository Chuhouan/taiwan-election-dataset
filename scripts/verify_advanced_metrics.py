import json, math
from pathlib import Path
r=json.loads(Path('dist/data.json').read_text(encoding='utf-8'))['president']['63000/010'];cs={c['name']:c['votes'] for c in r['candidates']};n=json.loads(Path('dist/data.json').read_text(encoding='utf-8'))['president']['00000/000'];nv=next(c['votes'] for c in n['candidates'] if c['name']=='賴清德');h=sum((c['votes']/r['total'])**2 for c in r['candidates']);share=cs['賴清德']/r['total']*100;expected={'leadVotes':r['candidates'][0]['votes']-r['candidates'][1]['votes'],'advantage':share-nv/n['total']*100,'difference':(cs['賴清德']-cs['侯友宜'])/r['total']*100,'validVotes':r['total'],'competitive':(r['candidates'][0]['votes']-r['candidates'][1]['votes'])/r['total']*100,'enp':1/h,'concentration':h,'bivariate':share}
actual=json.loads(Path('tests/fixtures/advanced-metrics-browser.json').read_text(encoding='utf-8'))
for row in actual:assert math.isclose(row['value'],expected[row['mode']],rel_tol=1e-12,abs_tol=1e-12),(row,expected[row['mode']])
print('PASS: eight map metrics agree with independently computed raw votes')
