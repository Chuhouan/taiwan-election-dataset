"""Reconcile native-browser marks with historical source assets and layout bounds."""
import json,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
checks=json.loads((ROOT/'tests/fixtures/history-final-browser.json').read_text(encoding='utf-8'))
assets={kind:json.loads((ROOT/'dist'/name).read_text(encoding='utf-8')) for kind,name in [('president','history-counties.json'),('mayor','history-mayors.json'),('legislator-list','history-party-list.json')]}
def value(unit,metric='dpp'):
    if unit.get('available') is False or not unit['candidates']:return None
    if metric=='turnout':return unit['turnout']
    c=next((c for c in unit['candidates'] if c['party']=={'dpp':'民主進步黨','kmt':'中國國民黨'}[metric]),None)
    return c['votes']/unit['validVotes']*100 if c else None
def equal(actual,expected):
    assert actual is None if expected is None else actual is not None and abs(float(actual)-expected)<1e-8,(actual,expected)
for c in checks:
    assert c['ready']=='true' and not c['bad'] and not c['overlap']
    assert Path(c['screenshot']).exists()
    with Image.open(c['screenshot']) as image:assert image.size==(c['width'],c['height'])
    for r in c['controlBounds']:assert r['x']>=20 and r['right']<=c['width']-20 and r['bottom']<=c['plot']['y']+2
    asset=assets[c['kind']];elections={str(e['year']):e['units'] for e in asset['elections']}
    a='2014' if c['kind']=='mayor' else '2008';b='2022' if c['kind']=='mayor' else '2024'
    if c['view']=='spatial':
        graph=json.loads((ROOT/'dist/history-adjacency.json').read_text(encoding='utf-8'))['rook']
        common={code for code in graph if all(value(units[code]) is not None for units in elections.values())}
        expected_count=sum(any(neighbor in common for neighbor in graph[code]) for code in common)
    else:expected_count=len(elections)*22 if c['view']=='matrix' else 66 if c['view']=='maps' else 44 if c['view']=='swipe' else sum(value(units['63000'],m) is not None for units in elections.values() for m in ['dpp','kmt','turnout'])
    assert len(c['marks'])==expected_count,(c['kind'],c['view'])
    for mark in c['marks']:
        if c['view']=='trend':v=value(elections[mark['year']]['63000'],mark['metric'])
        elif mark['year']=='difference':
            va=value(elections[a][mark['county']]);vb=value(elections[b][mark['county']]);v=None if va is None or vb is None else vb-va
        else:v=value(elections[mark['year']][mark['county']])
        equal(mark['value'],v)
    if c['kind']=='mayor' and c['view'] in ['maps','swipe']:
        assert any(m['county']=='10020' and m['year']=='2022' and m['status']=='缺資料' and m['value'] is None for m in c['marks'])
        assert any(m['county']=='63000' and m['year']=='2014' and m['status']=='未提名此黨' and m['value'] is None for m in c['marks'])
assert len(checks)==45 and len({(c['kind'],c['view'],c['width']) for c in checks})==45
print('PASS: 45 native desktop history views; every plotted value/NA reconciles; controls stay in bounds; readouts do not cover plots')
