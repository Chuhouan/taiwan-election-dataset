"""Independently reconcile visible village ENP/HHI and desktop label geometry."""
import json
from pathlib import Path
from urllib.parse import parse_qs,urlparse
root=Path(__file__).resolve().parents[1]
checks=json.loads((root/'tests/fixtures/village-competition-browser.json').read_text(encoding='utf-8'))
total=0;seen_sizes=set()
for check in checks:
    route=parse_qs(urlparse(check.get('url','')).fragment)
    election=route.get('e',['president'])[0];county=route.get('village-county',['63000'])[0]
    if election=='legislator':
        district=route['village-district'][0].replace(':','-').replace('/000','')
        units=json.loads((root/'dist/legislator-villages'/(district+'.json')).read_text(encoding='utf-8'))['units']
    else:
        data=json.loads((root/'dist/villages'/(county+'.json')).read_text(encoding='utf-8'))
        units={r['properties']['id']:r['properties'] for r in data['features']}|{r['id']:r for r in data['special']}
    for observed in check['values']:
        u=units[observed['id']];assert u['valid']>0
        hhi=sum((votes/u['valid'])**2 for votes in u['votes'].values())
        expected=1/hhi if observed['metric']=='enp' else hhi
        assert abs(expected-observed['value'])<1e-12,(observed,expected)
        total+=1
    assert abs(check['font']-14)<.001 and check['legendTop']>=check['mapBottom']
    if 'width' in check:seen_sizes.add(check['width'])
assert seen_sizes=={1280,1440,1920}
print(f'PASS: {total} visible village metric values match raw candidate votes; 3 desktop sizes retain 14px labels and separate legends')
