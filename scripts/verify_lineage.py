import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];registry=json.loads((root/'dist/dataset-registry.json').read_text(encoding='utf-8'));rows=registry['datasets']
assert len(rows)==264 and len({r['dataset_id'] for r in rows})==len(rows)
for r in rows:
 path=root/'dist'/r['asset'];assert hashlib.sha256(path.read_bytes()).hexdigest()==r['asset_sha256']
 assert r['comparability']['grade'] in ['A','B','C','D']
 if r['comparability']['grade'] in ['C','D']:assert not r['comparability']['direct_difference_allowed']
 assert r['source']['downloaded_at'] is None
 if 'village' in r['dataset_id']:assert r['source']['files']
print('PASS: 264 dataset lineage records; actual asset hashes; no unsupported direct differences or invented download dates')
