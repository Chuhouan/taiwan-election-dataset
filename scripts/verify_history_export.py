import csv,xml.etree.ElementTree as E
from pathlib import Path
from fixtures import artifact
rows=list(csv.DictReader((artifact('臺灣總統1996-2024全國結果.csv')).open(encoding='utf-8-sig')))
assert len(rows)==25 and len({r['年份'] for r in rows})==8
root=E.parse(artifact('臺灣總統歷屆-winner.svg')).getroot();assert len(root.findall('{http://www.w3.org/2000/svg}svg'))==1
assert '中央選舉委員會' in ''.join(root.itertext())
print('PASS: eight-election / 25-candidate CSV; standalone SVG includes chart and source')
