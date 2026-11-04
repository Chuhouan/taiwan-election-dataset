"""Inspect actual browser-downloaded SVG/PNG files, not synthetic render stubs."""
import json,re,xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
date=json.loads((root/'dist/metadata.json').read_text(encoding='utf-8'))['data_updated_at']
matrices=[('publication-final-matrix.json',lambda r:(r['chart'],r['size'])),('publication-dual-final.json',lambda r:r['part']),('module-export-final.json',lambda r:r['case'])]
checks=[]
for filename,key in matrices:
    pairs={};rows=json.loads((root/'tests/fixtures'/filename).read_text(encoding='utf-8'))
    for item in rows:
        path=Path(item['path'])
        if item['type']!='svg':continue
        svg=ET.parse(path).getroot();width=float(svg.attrib['width']);height=float(svg.attrib['height'])
        assert width==int(width) and height==int(height),(path,width,height)
        assert date in ''.join(svg.itertext()) and '中央選舉委員會' in ''.join(svg.itertext()),path
        assert not re.search(r'NaN|Infinity',path.read_text(encoding='utf-8')),path
        pairs[key(item)]=(int(width),int(height))
        checks.append(item|{'matrix':filename,'dimensions':[int(width),int(height)],'sourceDate':date})
    for item in rows:
        if item['type']!='png':continue
        with Image.open(item['path']) as image:
            assert image.size==tuple(v*2 for v in pairs[key(item)]),(item,image.size,pairs[key(item)])
            checks.append(item|{'matrix':filename,'dimensions':list(image.size)})
assert len(checks)==48
(root/'tests/fixtures/publication-verified-files.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 48 actual SVG/PNG downloads, integer dimensions, exact 2x PNG, finite geometry and current source date')
