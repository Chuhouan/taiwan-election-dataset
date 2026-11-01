"""Verify scope and captured browser evidence against source-derived data."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'dist/data.json').read_text(encoding='utf-8'))
assert set(data) == {'president', 'legislator', 'counties'}
brush = json.loads((root / 'docs/v3-brush-check.json').read_text(encoding='utf-8'))
assert len(brush['keys']) == len(set(brush['keys'])) == 218
assert all(data['president'][k]['town'] != '000' for k in brush['keys'])
assert sum(data['president'][k]['total'] for k in brush['keys']) == int(brush['total'].replace(',', ''))
bubbles = json.loads((root / 'docs/v3-bubble-check.json').read_text(encoding='utf-8'))
assert len(bubbles) == 22
ratios = []
for mark in bubbles:
    assert mark['votes'] == data['president'][mark['key']]['total']
    ratios.append(mark['radius'] ** 2 / mark['votes'])
assert max(ratios) - min(ratios) < 1e-9
print('PASS: 2 elections; brush aggregate; 22 proportional bubble areas')
