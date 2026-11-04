import json,math
from pathlib import Path
records=json.loads(Path('dist/data.json').read_text(encoding='utf-8'))['president'];expected={g:{c['name']:c['votes']/records[k]['total']*100 for c in records[k]['candidates']} for g,k in [('A','63000/010'),('B','63000/030')]}
for d in json.loads(Path('tests/fixtures/comparison-dumbbell-browser.json').read_text(encoding='utf-8')):assert math.isclose(d['share'],expected[d['group']][d['candidate']],abs_tol=1e-12)
print('PASS: 6 comparison dumbbell endpoints agree with raw vote counts')
