"""Compatibility entry: Vite is now the only CSS/JS build pipeline."""
import shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
npm=shutil.which('npm.cmd') or shutil.which('npm')
if not npm:sys.exit('Rebuilding needs Node.js; the included dist preview needs only Python 3.')
sys.exit(subprocess.call([npm,'run','build'],cwd=ROOT))
