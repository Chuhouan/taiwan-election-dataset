import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def artifact(name):
 index=json.loads((ROOT/'tests/fixtures/artifact-index.json').read_text(encoding='utf-8'))
 if name not in index:raise FileNotFoundError('Missing packaged fixture: '+name)
 return ROOT/index[name]
