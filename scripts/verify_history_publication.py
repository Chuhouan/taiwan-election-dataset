"""Inspect actual browser downloads for the three historical ballot series."""
import csv,json,xml.etree.ElementTree as ET,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
items=json.loads((ROOT/'tests/fixtures/history-series-exports.json').read_text(encoding='utf-8'))
ns={'s':'http://www.w3.org/2000/svg'};sizes={};report=[]
files={'president':'history-counties.json','mayor':'history-mayors.json','legislator-list':'history-party-list.json'}
for item in items:
    path=Path(item['path']);assert path.exists() and path.stat().st_size>100
    key=(item['kind'],item['view'])
    if item['type']=='svg':
        root=ET.parse(path).getroot();width=float(root.attrib['width']);height=float(root.attrib['height']);assert width.is_integer() and height.is_integer()
        assert list(map(float,root.attrib['viewBox'].split()))==[0,0,width,height]
        metadata=json.loads(root.find('s:metadata',ns).text);assert metadata['kind']==item['kind'] and metadata['metric']=='dpp'
        assert metadata['yearA']==(2014 if item['kind']=='mayor' else 2008) if item['view'] in ['maps','swipe'] else True
        text=''.join(root.itertext());assert '中央選舉委員會' in text and '2026-11-03' in text and '未提名' in text
        assert not any('NaN' in value or 'Infinity' in value for el in root.iter() for value in el.attrib.values())
        if item['kind']=='mayor':assert root.find('.//s:pattern[@id="history-county-missing"]',ns) is not None
        if item['view']=='swipe':
            assert root.find('.//s:clipPath[@id="history-swipe-b"]',ns) is not None and metadata['wipe']==50
            assert '拖曳' not in text and '分割位置 50%' in text
            handle=root.find('.//s:g[@class="history-swipe-handle"]',ns)
            assert handle is not None and handle.find('s:circle',ns) is None and handle.find('s:text',ns) is None
        sizes[key]=(int(width),int(height));report.append({**item,'width':int(width),'height':int(height)})
    elif item['type']=='png':
        with Image.open(path) as image:
            assert image.size==tuple(v*2 for v in sizes[key]);assert image.getbbox() is not None
            report.append({**item,'size':image.size})
    else:
        with path.open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
        assert len(rows[0])==17
        asset=json.loads((ROOT/'dist'/files[item['kind']]).read_text(encoding='utf-8'));expected={}
        for e in asset['elections']:
            for u in e['units'].values():
                if u.get('available') is False:
                    row=next(r for r in rows if r['年份']==str(e['year']) and r['統計縣市ID']==u['code']);assert row['資料狀態']=='缺資料' and all(row[k]=='' for k in ['票數','得票率','有效票','投票數','選舉人數','投票率']);continue
                for c in u['candidates']:expected[(str(e['year']),u['code'],c['name'])]=(c,u,e)
        available=[r for r in rows if r['資料狀態']=='可用'];assert len(available)==len(expected)
        for r in available:
            c,u,e=expected[(r['年份'],r['統計縣市ID'],r['候選人或政黨'])]
            assert int(r['票數'])==c['votes'] and abs(float(r['得票率'])-c['share'])<1e-8
            assert [int(r[k]) for k in ['有效票','投票數','選舉人數']]==[u[k] for k in ['validVotes','cast','eligible']]
            assert json.loads(r['來源檔SHA256'])==e['sourceSHA256']
        assert len(rows)==len(expected)+(1 if item['kind']=='mayor' else 0)
        report.append({**item,'rows':len(rows),'columns':17})
assert len(items)==27 and len(sizes)==12
(ROOT/'tests/fixtures/history-series-publication-verified.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 27 actual history downloads; 12 SVG/2x PNG pairs; source metadata, swipe clips, 3 CSVs and one explicit NA row')
