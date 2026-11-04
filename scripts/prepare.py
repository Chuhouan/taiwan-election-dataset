import csv,json,collections,argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='整理并核验2024选举资料')
parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[2]/'votedata/votedata',help='原始资料根目录')
ROOT=parser.parse_args().source.resolve()
OUT=Path(__file__).resolve().parents[1]/'dist'
BASE=ROOT/'voteData'
def rows(p):
    return list(csv.reader(p.read_text(encoding='utf-8-sig').splitlines()))
def party(n):
    return {'中國國民黨':'國民黨','民主進步黨':'民進黨','台灣民眾黨':'民眾黨','無黨籍及未經政黨推薦':'無黨籍','無':'無黨籍'}.get(n,n)
def load(folder,mode):
    names={}; candidates={}; profiles={}; result={}
    pats=dict(rows(folder/'elpaty.csv'))
    for r in rows(folder/'elbase.csv'):
        if r[4]=='0000' and (r[3]!='000' or r[2]=='00'): names[(r[0]+r[1],r[3])]=r[5]
    for r in rows(folder/'elcand.csv'):
        if mode=='president' and r[15].strip()=='Y': continue
        key=('all' if mode=='president' else r[0]+r[1]+(':'+r[2] if mode=='legislator' else ''))
        candidates[(key,r[5])]={'name':r[6],'number':r[5],'party':party(pats.get(r[7],'無黨籍')),'elected':r[14].strip() in ['*','!']}
    if mode=='president':
        for r in rows(folder/'elcand.csv'):
            if r[15].strip()=='Y': candidates[('all',r[5])]['runningMate']=r[6]
    for r in rows(folder/'elprof.csv'):
        if r[4].strip('0 ') or r[5].strip('0 '): continue
        key=r[0]+r[1]+(':'+r[2] if mode=='legislator' else '')+'/'+r[3]
        profiles[key]={'valid':int(r[6]),'invalid':int(r[7]),'cast':int(r[8]),'eligible':int(r[9])}
    for r in rows(folder/'elctks.csv'):
        if r[4].strip('0 ') or r[5].strip('0 '): continue
        county=r[0]+r[1]; area=county+(':'+r[2] if mode=='legislator' else '')
        ck='all' if mode=='president' else area
        c=candidates.get((ck,r[6]))
        if not c: continue
        key=area+'/'+r[3]
        if key not in result: result[key]={'county':county,'district':r[2],'town':r[3],'name':names.get((county,r[3]),names.get((county,'000'),county)), 'candidates':[],**profiles.get(key,{})}
        result[key]['candidates'].append({**c,'votes':int(r[7])})
    return result,names
data={}; allnames={}
for mode,dirs in [('president',[BASE/'2024總統立委/總統']),('legislator',[BASE/'2024總統立委/區域立委'])]:
    res={}
    for d in dirs:
        a,n=load(d,mode); res.update(a); allnames.update(n)
    data[mode]=res
for mode,res in data.items():
    for v in res.values():
        v['candidates'].sort(key=lambda c:-c['votes'])
        total=sum(c['votes'] for c in v['candidates'])
        v['total']=total
        v['turnout']=round(v.get('cast',0)/v['eligible']*100,2) if v.get('eligible') else None
        v['margin']=round((v['candidates'][0]['votes']-(v['candidates'][1]['votes'] if len(v['candidates'])>1 else 0))/total*100,2) if total else 0
        for c in v['candidates']: c['share']=round(c['votes']/total*100,2) if total else 0
data['counties']={c:n for (c,t),n in allnames.items() if t=='000' and c not in ['00000','10000','09000']}
(OUT/'data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print({k:len(v) for k,v in data.items()})
assert len(data['counties'])==22
assert [c['votes'] for c in data['president']['00000/000']['candidates']]==[5586019,4671021,3690466]
assert len([v for v in data['legislator'].values() if v['town']=='000' and v['total'] and v['county']!='00000'])==73
for mode in ['president']:
    for c in data['counties']:
        v=data[mode].get(c+'/000'); assert v,(mode,c)
        ts=[x for x in data[mode].values() if x['county']==c and x['town']!='000']
        assert sum(x['total'] for x in ts)==v['total'],(mode,c)
geo=json.loads((OUT/'towns.json').read_text(encoding='utf8'))
for feature in geo['objects']['towns']['geometries']:
    p=feature['properties']; key=p['COUNTYCODE']+'/'+p['TOWNCODE'][5:]
    for mode in ['president']: assert key in data[mode],(mode,key)
for mode in ['president','legislator']:
    for key,r in data[mode].items():
        if 'valid' in r: assert r['valid']==r['total'],(mode,key)
print('Verified: presidential totals, 22 counties, township sums, 73 constituencies.')



