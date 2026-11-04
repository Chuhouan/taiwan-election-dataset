"""Validate actual historical spatial CSV, SVG and PNG downloads."""
import csv,json,math,xml.etree.ElementTree as ET,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))
files={'president':'history-counties.json','legislator-list':'history-party-list.json','mayor':'history-mayors.json'}
items=read('tests/fixtures/history-spatial-exports.json');browser=read('tests/fixtures/history-spatial-metrics-browser.json');graph=read('dist/history-adjacency.json');ns={'s':'http://www.w3.org/2000/svg'}
def value(u,metric):
    if u.get('available') is False:return None
    if metric in ['turnout','margin']:return u[metric]
    c=next((c for c in u['candidates'] if c['party']=={'dpp':'民主進步黨','kmt':'中國國民黨'}[metric]),None)
    return 100*c['votes']/u['validVotes'] if c else None
sizes={};summary=[]
for item in items:
    path=Path(item['path']);assert path.exists() and path.stat().st_size>100
    case=next(c for c in browser if (c['kind'],c['metric'])==(item['kind'],item['metric']));stats={str(s['year']):s for s in case['spatialYears']};active={p['county'] for p in case['marks']}
    if item['type']=='csv':
        with path.open(encoding='utf-8-sig',newline='') as stream:rows=list(csv.DictReader(stream))
        asset=read('dist/'+files[item['kind']]);assert len(rows)==22*len(asset['elections']) and len(rows[0])==18
        elections={str(e['year']):e for e in asset['elections']};included=0
        for row in rows:
            e=elections[row['年份']];code=row['縣市ID'];v=value(e['units'][code],item['metric']);s=stats[row['年份']]
            assert row['本地數值']=='' if v is None else math.isclose(float(row['本地數值']),v,abs_tol=1e-10)
            assert row['單位']==('pp' if item['metric']=='margin' else '%')
            assert row['共同集合狀態']==('納入' if code in active else '排除')
            if code in active:
                neighbors=[n for n in graph['rook'][code] if n in active];lag=sum(value(e['units'][n],item['metric']) for n in neighbors)/len(neighbors)
                assert math.isclose(float(row['鄰接等權平均']),lag,abs_tol=1e-10) and not row['排除理由'];included+=1
            else:assert row['鄰接等權平均']=='' and row['排除理由']
            assert math.isclose(float(row['共同範圍Moran_I']),float(s['I']),abs_tol=1e-12) and float(row['正向單尾排列_p'])==float(s['p'])
            assert int(row['參與縣市數'])==len(active) and row['排列次數']=='999' and row['種子']=='2024'
            assert row['共同統計拓撲']==graph['metadata']['topology_id'] and row['鄰接來源SHA256']==graph['metadata']['sourceSHA256']
            assert json.loads(row['選票來源SHA256'])==e['sourceSHA256']
        summary.append({**item,'rows':len(rows),'includedRows':included,'columns':18})
    elif item['type']=='svg':
        svg=ET.parse(path).getroot();width=float(svg.attrib['width']);height=float(svg.attrib['height']);assert width.is_integer() and height.is_integer();metadata=json.loads(svg.find('s:metadata',ns).text)
        assert metadata['kind']==item['kind'] and metadata['metric']=='dpp';spatial=metadata['spatial'];assert spatial['permutations']==999 and spatial['seed']==2024
        for e in spatial['years']:
            s=stats[str(e['year'])];assert e['n']==len(active) and math.isclose(e['I'],float(s['I']),abs_tol=1e-12) and e['pUpper']==float(s['p'])
        text=''.join(svg.itertext());assert '中央選舉委員會' in text and '2026-11-03' in text and 'Rook' in text and '因果' in text
        assert not any('NaN' in v or 'Infinity' in v for node in svg.iter() for v in node.attrib.values())
        sizes[item['kind']]=(int(width),int(height));summary.append({**item,'size':[int(width),int(height)]})
    else:
        with Image.open(path) as image:assert image.size==tuple(v*2 for v in sizes[item['kind']]);summary.append({**item,'size':image.size})
assert len(items)==18 and len(sizes)==3
(ROOT/'tests/fixtures/history-spatial-publication-verified.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 12 actual 18-column CSVs / 1408 county-year rows, included and excluded; 3 metadata-rich SVG / exact 2x PNG pairs')
