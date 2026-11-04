from fixtures import artifact
import json,csv
from pathlib import Path
root=Path(__file__).resolve().parents[1];data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'))
rows=list(csv.DictReader((artifact('臺灣2024-臺北市-村里.csv')).open(encoding='utf-8-sig')))
assert sum(int(r['票數']) for r in rows)==data['president']['63000/000']['total']
assert len(rows)==456*3
print('PASS: 456 Taipei village units reconcile with county total')
