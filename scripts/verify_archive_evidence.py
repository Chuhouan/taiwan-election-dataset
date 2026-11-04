from fixtures import artifact
"""Check official date matches, raw flag preservation and the Taitung correction."""
import csv,json
from pathlib import Path
from archive_evidence import EVIDENCE
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'dist/archive-catalog.json').read_text(encoding='utf-8'))
assert all(entry['year'] is not None for entry in catalog['entries'])
by_directory={entry['sources'][0]['directory']:entry for entry in catalog['entries']}
for directory,evidence in EVIDENCE.items():
    entry=by_directory[directory]
    asset=json.loads((root/'dist/archive'/(entry['id']+'.json')).read_text(encoding='utf-8'))
    assert entry['year']==int(evidence['election_date'][:4])
    assert entry['election_date']==asset['election_date']==evidence['election_date']
    assert entry['date_source']==asset['date_source']==evidence['date_source']
    candidates=asset['contests'][0]['candidates'];votes={c['name']:c['votes'] for c in candidates}
    for name,value in evidence['match_votes'].items():assert votes[name]==value
taitung=json.loads((root/'dist/archive/a889284f95bfe0b.json').read_text(encoding='utf-8'))['contests'][0]
assert taitung['electedCount']==2  # Original CSV, not silently rewritten.
assert taitung['officialResult']['elected_names']==['賴坤成']
assert taitung['officialResult']['announcement_date']=='2010-01-15'
assert {c['name']:c['electedFlag'] for c in taitung['candidates']}=={'賴坤成':'*','鄺麗貞':'*','洪銘堅':''}
file=artifact('歷史選舉-2010-立法委員（區域）補選.csv')
if file.exists():
    exported=list(csv.DictReader(file.open(encoding='utf-8-sig')))
    assert len(exported)==3 and sum(r['來源當選標記']=='*' for r in exported)==2
    assert sum(r['公告核對當選']=='是' for r in exported)==1
    assert all(r['投票日期']=='2010-01-09' and r['公告核對來源']==taitung['officialResult']['source'] for r in exported)
print('PASS: 9 official date matches; all catalog years known; Taitung official winner and original double flag stay distinct in data/CSV')
