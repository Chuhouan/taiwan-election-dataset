"""Self-contained local preview, editable source and reproducible release checks."""
import hashlib,json,zipfile,argparse
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--date',default=date.today().strftime('%Y%m%d'));args=parser.parse_args()
 folder=ROOT/'release';folder.mkdir(exist_ok=True);path=folder/f'Taiwan-Elections-local-{args.date}.zip'
 files=[p for base in ['dist','src','scripts','tests'] for p in (ROOT/base).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc']
 files += [ROOT/p for p in ['README.md','Start-Local.cmd','index.html','package.json','package-lock.json','vite.config.js','playwright.config.js','requirements-test.txt']]
 files += [p for p in (ROOT/'docs').glob('*') if p.suffix in ['.md','.json']]
 files += list((ROOT/'docs/screenshots').glob('*.png'))
 assert all(p.resolve().is_relative_to(ROOT.resolve()) and not p.is_symlink() for p in files)
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(set(files)):z.write(p,'election-atlas/'+p.relative_to(ROOT).as_posix())
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None;names=set(z.namelist())
  assert all('election-atlas/'+f in names for f in ['dist/index.html','src/main.js','tests/fixtures/artifact-index.json','scripts/release_gate.py','Start-Local.cmd'])
 receipt={'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'files':len(set(files)),'scope':'desktop local preview, ES module source, lockfile and self-contained release fixtures; original CSV tree and large source GIS archives are separate source audits'}
 (folder/'manifest.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(receipt))
