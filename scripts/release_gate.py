"""Portable release checks. Raw-source audits are explicitly separate, never silently passed."""
import argparse,json,subprocess,sys,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE_ONLY={'verify_archive.py':'original 901 CSV source tree','verify_history_series.py':'original election aggregate CSV source tree'}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--with-source',action='store_true');args=parser.parse_args();os.chdir(ROOT);report=[]
 for path in sorted((ROOT/'scripts').glob('verify_*.py')):
  if path.name in SOURCE_ONLY and not args.with_source:report.append({'script':path.name,'status':'requires_source','reason':SOURCE_ONLY[path.name]});print(path.name+': SOURCE AUDIT (not release gate)',flush=True);continue
  result=subprocess.run([sys.executable,str(path)],capture_output=True,encoding='utf-8',errors='replace');passed=result.returncode==0
  report.append({'script':path.name,'status':'pass' if passed else 'fail','output':(result.stdout+result.stderr)[-3000:]});print(path.name+': '+('PASS' if passed else 'FAIL'),flush=True)
 target=ROOT/'tests/artifacts/release-gate.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 failures=[r for r in report if r['status']=='fail'];print(str(sum(r['status']=='pass' for r in report))+' checks passed; '+str(len(failures))+' failures; '+str(sum(r['status']=='requires_source' for r in report))+' explicitly separate source audits')
 sys.exit(bool(failures))
