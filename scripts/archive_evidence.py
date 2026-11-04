"""Apply separately recorded official evidence without mutating original CSV flags."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=json.loads((ROOT/'scripts/archive-evidence.json').read_text(encoding='utf-8'))

def apply_evidence(item):
    evidence=EVIDENCE.get(item['sources'][0]['directory'])
    if not evidence:return item
    assert len(item['contests'])==1
    contest=item['contests'][0];votes={r['name']:r['votes'] for r in contest['candidates']}
    for name,count in evidence['match_votes'].items():assert votes[name]==count,(item['id'],name)
    item['election_date']=evidence['election_date'];item['year']=int(item['election_date'][:4]);item['date_source']=evidence['date_source']
    if evidence.get('result_source'):item['reference_result_source']=evidence['result_source']
    if evidence.get('official_result'):
        result=evidence['official_result']
        assert set(result['elected_names']).issubset(votes)
        for key,value in result['profile'].items():assert contest[key]==value
        contest['officialResult']=result
        contest['resultVerification']='公告核對；原始CSV當選標記另行保留'
    return item

def refresh_assets():
    catalog=json.loads((ROOT/'dist/archive-catalog.json').read_text(encoding='utf-8'))
    for entry in catalog['entries']:
        file=ROOT/'dist/archive'/(entry['id']+'.json');item=apply_evidence(json.loads(file.read_text(encoding='utf-8')))
        file.write_text(json.dumps(item,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        for key in ['year','election_date','date_source']:
            if key in item:entry[key]=item[key]
        entry['scopeLabel']=item['contests'][0]['name'] if len(item['contests'])==1 else str(len({c['county'] for c in item['contests']}))+'個原始縣市'
        entry['dataSHA256']=hashlib.sha256(file.read_bytes()).hexdigest()
        entry['officialCorrections']=sum('officialResult' in c for c in item['contests'])
    catalog['entries'].sort(key=lambda e:(-(e['year'] or 0),e['category'],e['office'],e['title']))
    catalog['policy']=catalog['policy'].replace('當選依來源*／!，非由名次推定；','當選依來源*／!，非由名次推定；與正式公告矛盾時，另記公告核對結果並保留原始標記；')
    (ROOT/'dist/archive-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    audit=json.loads((ROOT/'docs/archive-audit.json').read_text(encoding='utf-8'));audit.update(catalog)
    (ROOT/'docs/archive-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Applied 9 officially dated by-elections; one formally reconciled result; original CSV flags retained')

if __name__=='__main__':refresh_assets()
