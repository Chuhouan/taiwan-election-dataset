import json,re,hashlib,gzip
from pathlib import Path
root=Path(__file__).resolve().parents[1];html=(root/'dist/index.html').read_text(encoding='utf-8')
modules=re.findall(r'<script[^>]*type="module"[^>]*src="([^"]+)"',html);assert len(modules)==1
assert '<script defer' not in html
for url in re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"',html):assert (root/'dist'/url.removeprefix('./')).exists(),url
budget=json.loads((root/'docs/build-budget.json').read_text(encoding='utf-8'));assert budget['withinBudget']
assert not any('/history-' in r['file'] or '/villages-' in r['file'] or '/archive-' in r['file'] for r in budget['files'] if r['initial'])
assert sum(len(gzip.compress((root/'dist'/name).read_bytes())) for name in ['data.json','towns-lod0.json'])<300*1024
print('PASS: one ES module entry; real hashed assets; lazy research modules; initial JS and JSON budgets')
