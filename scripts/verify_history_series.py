"""Independent county-series checks against source aggregates, never mean shares."""
import csv,hashlib,json,sys
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'votedata/votedata/voteData'
if not SOURCE.exists():
 import sys
 print('REQUIRES SOURCE: original CSV source tree; not part of the portable release gate')
 sys.exit(77)
sys.stdout.reconfigure(encoding='utf-8')
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def canonical(folder,prefix):
    p=folder/(prefix+'.csv')
    if p.exists():return p
    files=list(folder.glob(prefix+'_*.csv'));assert len(files)==1
    return files[0]
def rows(path):
    with path.open(encoding='utf-8-sig',newline='') as f:
        for row in csv.reader(f):
            if row:yield [v.strip().lstrip("'") for v in row]
def codes(r):return tuple((str(int(v)) if v.isdigit() else v).zfill(n) for v,n in zip(r[:5],[2,3,2,3,4]))
def aggregates(folder):
    tickets=defaultdict(dict);profiles=defaultdict(list)
    for r in rows(canonical(folder,'elctks')):
        s=codes(r)
        if s[3:]!=('000','0000') or r[5].strip('0 '):continue
        key=s[:3];ballot=int(r[6]);value=int(r[7])
        assert ballot not in tickets[key] or tickets[key][ballot]==value
        tickets[key][ballot]=value
    for r in rows(canonical(folder,'elprof')):
        s=codes(r)
        if s[3:]!=('000','0000') or r[5].strip('0 '):continue
        profiles[''.join(s[:2])].append(tuple(map(int,r[6:10])))
    return tickets,profiles
report=[]
for filename,years in [('history-mayors.json',[2014,2018,2022]),('history-party-list.json',[2008,2012,2016,2020,2024])]:
    asset=read(ROOT/'dist'/filename);assert [e['year'] for e in asset['elections']]==years
    count=0
    for e in asset['elections']:
        assert len(e['units'])==22
        directories=e['sourceDirectory'];directories=[directories] if isinstance(directories,str) else list(dict.fromkeys(directories))
        raw={};profiles={};names={}
        for directory in directories:
            folder=SOURCE/directory;t,p=aggregates(folder)
            for scope,v in t.items():
                if ''.join(scope[:2]) in ['00000','10000','09000']:continue
                assert scope not in raw;raw[scope]=v
            for area,v in p.items():profiles.setdefault(area,[]).extend(v)
            for r in rows(canonical(folder,'elcand')):
                if len(r)>15 and r[15]=='Y':continue
                names[(''.join(codes(r)[:2]),int(r[5]))]=r[6]
        for u in e['units'].values():
            if not u['available']:
                assert filename=='history-mayors.json' and e['year']==2022 and u['code']=='10020'
                assert all(u[k] is None for k in ['validVotes','cast','eligible','turnout','margin']) and not u['candidates'];continue
            count+=1;assert sum(c['votes'] for c in u['candidates'])==u['validVotes']
            assert 0<u['validVotes']<=u['cast']<=u['eligible']
            assert abs(u['turnout']-100*u['cast']/u['eligible'])<1e-10
            assert abs(u['margin']-100*(u['candidates'][0]['votes']-u['candidates'][1]['votes'])/u['validVotes'])<1e-10
            total=defaultdict(int);denominators=[0,0,0]
            for area in u['originalUnits']:
                choices=[v for s,v in raw.items() if ''.join(s[:2])==area]
                profiles_for_area=profiles[area]
                matches=[v for v in choices if any(sum(v.values())==p[0] for p in profiles_for_area)]
                assert matches and len({tuple(sorted(v.items())) for v in matches})==1,(filename,e['year'],area)
                v=matches[0];valid=sum(v.values());p=next(p for p in profiles_for_area if p[0]==valid)
                denominators=[x+y for x,y in zip(denominators,[p[0],p[2],p[3]])]
                for ballot,n in v.items():total[names.get((area,ballot),names.get(('00000',ballot)))]+=n
            assert denominators==[u['validVotes'],u['cast'],u['eligible']]
            assert dict(total)=={c['name']:c['votes'] for c in u['candidates']},(e['year'],u['code'])
            for c in u['candidates']:assert abs(c['share']-100*c['votes']/u['validVotes'])<1e-10
        if 'national' in e:
            n=e['national']
            for key in ['validVotes','cast','eligible']:assert sum(u[key] for u in e['units'].values())==n[key]
            assert {p:sum(c['votes'] for u in e['units'].values() for c in u['candidates'] if c['party']==p) for p in n['votes']}==n['votes']
        for name,sha in e['sourceSHA256'].items():
            path=SOURCE/name if len(directories)>1 else SOURCE/directories[0]/name
            if not path.exists():path=canonical(path.parent,path.name)
            assert hashlib.sha256(path.read_bytes()).hexdigest()==sha
    report.append({'asset':filename,'years':years,'raw_county_results':count})
mayor=read(ROOT/'dist/history-mayors.json')
assert not any(c['party']=='民主進步黨' for c in mayor['elections'][0]['units']['63000']['candidates'])
party=read(ROOT/'dist/history-party-list.json')['elections'][-1]['national']
assert party['validVotes']==13776736
assert {p:party['votes'][p] for p in ['民主進步黨','中國國民黨','台灣民眾黨']}=={'民主進步黨':4982062,'中國國民黨':4764576,'台灣民眾黨':3040615}
(ROOT/'tests/fixtures/history-series-regression.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: independent raw county vote/profile checks; mayor 65/66, party ballots 110/110; official 2024 national totals; NA and source hashes')
