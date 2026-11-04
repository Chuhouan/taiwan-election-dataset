"""Verify actual browser CSVs against ballot-specific totals and independent formulas."""
import csv,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1];house=json.loads((root/'dist/parliament.json').read_text(encoding='utf-8'));systems=house['analysis']['systems'];checks=json.loads((root/'tests/fixtures/vote-seat-browser.json').read_text(encoding='utf-8'))
# All sixteen values are sampled from the CEC national party-ballot result table.
expected=[128613,117298,44852,95078,17423,4982062,19665,353412,4764576,37615,40288,3040615,10300,69818,11746,43375]
source='https://db.cec.gov.tw/ElecTable/Election/ElecTickets?areaCode=00&cityCode=000&dataLevel=N&dataType=tickets&deptCode=000&legisId=L4&liCode=0000&prvCode=00&subjectId=L0&themeId=e753a8e7a7bcc09fa51d1aea0024a843&typeId=ELC'
assert [p['votes'] for p in sorted(systems['list']['parties'],key=lambda p:int(p['number']))]==expected
assert sum(expected)==13776736
for check in checks:
 system=systems[check['system']];qualified=check['denominator']=='qualified';denominator=system['qualifiedVotes'] if qualified else system['validVotes'];parties=[p for p in system['parties'] if not qualified or p['qualified']];assert len(check['rows'])==len(parties)
 for browser in check['rows']:
  p=next(p for p in parties if p['party']==browser['party']);assert p['votes']==browser['votes']
  for name,actual in [('voteShare',p['votes']/denominator*100),('seatShare',p['seats']/system['seats']*100),('gap',p['seats']/system['seats']*100-p['votes']/denominator*100)]:assert math.isclose(browser[name],actual,rel_tol=1e-12,abs_tol=1e-12)
 rows=list(csv.DictReader(Path(check['csvPath']).open(encoding='utf-8-sig')));assert len(rows)==len(parties)
 for row in rows:
  p=next(p for p in parties if p['party']==row['政黨或候選人類別']);assert int(row['得票分母'])==denominator;assert int(row['席次分母'])==system['seats'];assert int(row['得票數'])==p['votes'];assert int(row['席次'])==p['seats'];assert math.isclose(float(row['票席差(pp)']),p['seats']/system['seats']*100-p['votes']/denominator*100,abs_tol=1e-12)
 assert math.isclose(sum(p['voteShare'] for p in check['rows']),100,abs_tol=1e-10);assert math.isclose(sum(p['seatShare'] for p in check['rows']),100,abs_tol=1e-10)
(root/'tests/fixtures/legislative-official-samples.json').write_text(json.dumps({'source':source,'ballotOrderVotes':expected,'validVotes':sum(expected),'verified':'all 16 party-ballot counts match local CSV / generated asset'},ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 5 browser/CSV denominators; all party vote/seat shares and gaps; 16 official national party vote samples')
