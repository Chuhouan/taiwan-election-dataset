"""Check archive arithmetic and independently re-read representative raw results."""
import csv,json,re,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'votedata/votedata/voteData'
if not SOURCE.exists():
 import sys
 print('REQUIRES SOURCE: original CSV source tree; not part of the portable release gate')
 sys.exit(77)
catalog=json.loads((ROOT/'dist/archive-catalog.json').read_text(encoding='utf-8'))
assert not catalog['failures']
totals=dict(entries=0,contests=0,candidates=0,verified=0,missing_profiles=0)
samples=['2022-111年地方公職人員選舉/C1/prv','2022-111年地方公職人員選舉/T1/prv','2022-111年地方公職人員選舉/V1','2010村里長','1994直轄市長','2005任務型國代','2024總統立委/不分區政黨']
checked=[]
for entry in catalog['entries']:
    data=json.loads((ROOT/'dist/archive'/(entry['id']+'.json')).read_text(encoding='utf-8'))
    assert hashlib.sha256((ROOT/'dist/archive'/(entry['id']+'.json')).read_bytes()).hexdigest()==entry['dataSHA256']
    assert len(data['contests'])==entry['contests'];totals['entries']+=1
    for c in data['contests']:
        totals['contests']+=1;totals['candidates']+=len(c['candidates'])
        assert len({r['ballot'] for r in c['candidates']})==len(c['candidates'])
        assert all(r['votes']>=0 and isinstance(r['votes'],int) for r in c['candidates'])
        assert c['electedCount']==sum(r['elected'] for r in c['candidates'])
        for r in c['candidates']:
            assert r['elected']==(r['electedFlag'] in ['*','!'])
            assert r['share'] is None if not c['validVotes'] else abs(r['share']-r['votes']/c['validVotes']*100)<1e-10
        if c['verified']:
            totals['verified']+=1
            assert sum(r['votes'] for r in c['candidates'])==c['validVotes']
            assert c['validVotes']+c['invalidVotes']==c['cast']<=c['eligible']
            assert c['profileScope'] and not c['issues']
        if c['validVotesBasis']=='candidate_sum':
            totals['missing_profiles']+=1
            assert c['invalidVotes'] is c['cast'] is c['eligible'] is c['turnout'] is c['profileScope'] is None
            assert sum(r['votes'] for r in c['candidates'])==c['validVotes']
            assert not c['verified']
    source=data['sources'][0]['directory']
    if source not in samples: continue
    folder=SOURCE/source;file=folder/'elctks.csv'
    if not file.exists():file=next(folder.glob('elctks_*.csv'))
    raw={}
    with file.open(encoding='utf-8-sig',newline='') as stream:
        for row in csv.reader(stream):
            r=[s.strip().lstrip("'") for s in row]
            if r[5].strip('0 '):continue
            codes=tuple((str(int(v)) if v.isdigit() else v).zfill(n) for v,n in zip(r[:5],[2,3,2,3,4]))
            raw[(codes,int(r[6]))]=(int(r[7]),r[9])
    count=0
    for c in data['contests']:
        for r in c['candidates']:
            votes,flag=raw[(tuple(c['ticketScope']),r['ballot'])]
            assert r['votes']==votes
            # Some releases keep the elected flag in elcand only; blank ticket
            # flags are not used to fabricate winners by rank.
            if flag: assert r['electedFlag']==flag
            count+=1
    checked.append({'directory':source,'candidate_rows':count})
assert len(checked)==len(samples)
elected_2022={}
for e in catalog['entries']:
    if e['year']!=2022: continue
    d=json.loads((ROOT/'dist/archive'/(e['id']+'.json')).read_text(encoding='utf-8'))
    elected_2022[e['office']]=sum(c['electedCount'] for c in d['contests'])
# Executive Yuan's official 2022 overview, with Chiayi City's later rerun separate.
# https://www.ey.gov.tw/state/62879155A536D543/c78552af-72f4-45ef-bb89-a044cf2f3f1c
for office,n in {'直轄市長':6,'縣市長':15,'鄉鎮市長':198,'原住民區長':6,'原住民區民代表':50}.items():
    assert elected_2022[office]==n,(office,elected_2022[office],n)
assert sum(n for office,n in elected_2022.items() if office.startswith('直轄市議員'))==377
assert sum(n for office,n in elected_2022.items() if office.startswith('縣市議員'))==533
assert elected_2022['村里長']==7740
assert sum(n for office,n in elected_2022.items() if office.startswith('鄉鎮市民代表'))==2088
pending_2022={}
for e in catalog['entries']:
    if e['year']!=2022:continue
    d=json.loads((ROOT/'dist/archive'/(e['id']+'.json')).read_text(encoding='utf-8'))
    pending=[c for c in d['contests'] if any(r['electedFlag'] in ['?','？'] for r in c['candidates'])]
    if pending:pending_2022[e['office']]=len(pending)
assert pending_2022=={'村里長':8,'鄉鎮市民代表（區域）':1}
# The source snapshot precedes those nine tie resolutions. Do not change flags
# to force final totals; keep the source state visible and distinguish validation
# of raw votes from external validation of final elected names.
(ROOT/'tests/fixtures/archive-regression.json').write_text(json.dumps({'totals':totals,'raw_samples':checked},ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: archive arithmetic, missing-denominator semantics, official flags and raw samples',totals)
