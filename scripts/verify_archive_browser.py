"""Reconcile captured real-browser rows against the source-backed archive."""
import json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
root=Path(__file__).resolve().parents[1]
checks=json.loads((root/'tests/fixtures/archive-browser.json').read_text(encoding='utf-8'))
for check in checks:
    route=parse_qs(urlparse(check['url']).fragment)
    entry=route['archive'][0]
    asset=json.loads((root/'dist/archive'/(entry+'.json')).read_text(encoding='utf-8'))
    contest=next(c for c in asset['contests'] if c['id']==check['contest'])
    assert not check['overflow'] and len(check['rows'])==len(contest['candidates'])
    for observed,expected in zip(check['rows'],contest['candidates']):
        for key in ['ballot','votes','seats']:assert observed[key]==expected[key],(check['label'],key)
        assert observed['elected']==(expected['name'] in contest['officialResult']['elected_names'] if contest.get('officialResult') else expected['elected'])
        assert observed['share'] is None if expected['share'] is None else abs(observed['share']-expected['share'])<1e-10
    if contest['validVotesBasis']=='candidate_sum':assert '不推估' in check['warning']
    if any(c['electedFlag']=='?' for c in contest['candidates']):assert '同票待抽籤' in check['warning']
assert {1280,1440,1920}.issubset({c['width'] for c in checks})
print(f'PASS: {len(checks)} real-browser historical cases / 3 desktop sizes, raw votes, percentages, seats, flags and missing-profile warnings')
