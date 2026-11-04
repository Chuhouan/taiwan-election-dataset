"""Additional comparable whole-county series; never merge local candidate races.

Mayor: post-2014 county/city units only. Missing Chiayi 2022 stays explicitly NA.
Party list: whole-county lineage pooling of raw party ballots, distinct from
presidential or regional votes. No lower-level historical boundary claim.
"""
import hashlib,json,sys
from collections import defaultdict
from datetime import datetime,timezone,timedelta
from pathlib import Path
from archive import SOURCE,rows,file_for,number,scope,zero

ROOT=Path(__file__).resolve().parents[1]
COUNTIES=json.loads((ROOT/'dist/data.json').read_text(encoding='utf-8'))['counties']
NAMES={v:k for k,v in COUNTIES.items()}
LINEAGE={'臺北縣':'新北市','桃園縣':'桃園市','臺中縣':'臺中市','臺南縣':'臺南市','高雄縣':'高雄市'}
SOURCES=['https://db.cec.gov.tw/ElecTable','https://www.moi.gov.tw/News_toggle3.aspx?n=174&sms=9015']

def finish(unit):
    unit['available']=True
    assert sum(c['votes'] for c in unit['candidates'])==unit['validVotes']
    assert 0<=unit['validVotes']<=unit['cast']<=unit['eligible']
    unit['candidates'].sort(key=lambda c:(-c['votes'],c['name']))
    for c in unit['candidates']:c['share']=c['votes']/unit['validVotes']*100 if unit['validVotes'] else None
    unit['turnout']=unit['cast']/unit['eligible']*100 if unit['eligible'] else None
    unit['margin']=(unit['candidates'][0]['votes']-unit['candidates'][1]['votes'])/unit['validVotes']*100 if unit['validVotes'] else None
    return unit

def base(kind,title):
    return {'kind':kind,'title':title,'version':datetime.now(timezone(timedelta(hours=8))).date().isoformat(),'unit':'22縣市統計範圍','counties':COUNTIES,'elections':[],'sources':SOURCES,'boundary_status':'現今縣市形狀只作統計定位，非歷史法定測量界線；不延伸至歷史鄉鎮、村里及立委選區','comparability_status':'whole_county_same_ballot_type','share_max':100,'margin_max':100}

def mayor():
    result=base('mayor','縣市長選舉')
    result['derived_method']='僅比較2014年後完整縣市單位；沿用各屆原始候選人與政黨、票數和分母，不合併不同地方選舉的候選人。2022年本批缺嘉義市重行選舉，明示無資料。未提名某政黨的地區不填作0%支持率。'
    catalog=json.loads((ROOT/'dist/archive-catalog.json').read_text(encoding='utf-8'))
    for year in [2014,2018,2022]:
        entries=[e for e in catalog['entries'] if e['year']==year and e['office'] in ['縣市長','直轄市長']]
        assert len(entries)==2,(year,entries)
        election={'year':year,'units':{},'sourceDirectory':[],'sourceSHA256':{}}
        for entry in entries:
            asset=json.loads((ROOT/'dist/archive'/(entry['id']+'.json')).read_text(encoding='utf-8'))
            for source in asset['sources']:
                election['sourceDirectory'].append(source['directory'])
                election['sourceSHA256'].update({source['directory']+'/'+k:v for k,v in source['sha256'].items()})
            for c in asset['contests']:
                assert c['verified'] and c['electedCount']==1
                original=''.join(c['scope'][:2]);target=original if original in COUNTIES else NAMES[LINEAGE.get(c['county'],c['county'])]
                assert target not in election['units'],(year,target,'Do not pool mayor candidates')
                unit={'code':target,'name':COUNTIES[target],'originalUnits':{original:c['county']},'validVotes':c['validVotes'],'cast':c['cast'],'eligible':c['eligible'],'candidates':[{k:r[k] for k in ['name','party','votes','share','elected']} for r in c['candidates']]}
                assert unit['candidates'][0]['elected']
                election['units'][target]=finish(unit)
        missing=set(COUNTIES)-set(election['units'])
        assert missing==({'10020'} if year==2022 else set()),(year,missing)
        for code in missing:
            election['units'][code]={'code':code,'name':COUNTIES[code],'available':False,'validVotes':None,'cast':None,'eligible':None,'turnout':None,'margin':None,'candidates':[],'originalUnits':{},'missing_reason':'2022-12-18嘉義市長重行選舉不在本批CSV；未填為0票','source':'https://web.cec.gov.tw/central/article/36930'}
        election['availableCount']=22-len(missing)
        result['elections'].append(election)
    return result

def party_list():
    result=base('legislator-list','立委政黨票')
    result['share_max']=80;result['margin_max']=50
    result['derived_method']='同一類政黨票以原始票數與分母彙總；2008年臺中、臺南、高雄縣市按整縣市沿革加總，臺北縣與桃園縣分別對應現今新北市及桃園市。不混用區域立委或總統票；地區第一名政黨不等於席次當選結果。'
    folders={2008:'2008立委/不分區政黨',2012:'20120114-總統及立委/不分區政黨',2016:'2016總統立委/不分區政黨',2020:'2020總統立委/不分區政黨',2024:'2024總統立委/不分區政黨'}
    for year,relative in folders.items():
        folder=SOURCE/relative;files={k:file_for(folder,k) for k in ['elbase','elcand','elctks','elprof','elpaty']}
        party=dict(rows(files['elpaty']));candidates={str(number(r[5])):{'name':r[6],'party':party[r[7]],'number':str(number(r[5]))} for r in rows(files['elcand']) if len(r)>15 and r[15]!='Y'}
        names={''.join(scope(r)[:2]):r[5] for r in rows(files['elbase']) if len(r)>5 and scope(r)[2:]==('00','000','0000')}
        profiles=defaultdict(list)
        for r in rows(files['elprof']):
            if len(r)>=10 and scope(r)[3:]==('000','0000') and zero(r[5]):profiles[''.join(scope(r)[:2])].append(r)
        votes=defaultdict(dict)
        for r in rows(files['elctks']):
            if len(r)<10 or scope(r)[3:]!=('000','0000') or not zero(r[5]):continue
            area=''.join(scope(r)[:2]);ballot=str(number(r[6]))
            assert ballot not in votes[area],(year,area,ballot,'Duplicate county aggregate')
            votes[area][ballot]=number(r[7])
        units={};chosen_profiles={}
        for area,counts in votes.items():
            if area in ['00000','10000','09000']:continue
            assert set(counts)==set(candidates),(year,area,'missing party ballot')
            choices=[r for r in profiles[area] if number(r[6])==sum(counts.values())]
            assert choices,(year,area,'no matching county profile')
            assert len({tuple(r[6:10]) for r in choices})==1,(year,area,'ambiguous denominators')
            p=next((r for r in choices if scope(r)[2]=='00'),choices[0]);chosen_profiles[area]=p
            raw_name=names[area];normalized=raw_name.replace('台','臺');target=NAMES[LINEAGE.get(normalized,normalized)]
            u=units.setdefault(target,{'code':target,'name':COUNTIES[target],'originalUnits':{},'validVotes':0,'cast':0,'eligible':0,'votes':{k:0 for k in candidates}})
            assert area not in u['originalUnits'];u['originalUnits'][area]=raw_name
            u['validVotes']+=number(p[6]);u['cast']+=number(p[8]);u['eligible']+=number(p[9])
            for ballot,count in counts.items():u['votes'][ballot]+=count
        assert set(units)==set(COUNTIES)
        national=votes['00000'];assert set(national)==set(candidates)
        for ballot,count in national.items():assert sum(u['votes'][ballot] for u in units.values())==count,(year,ballot)
        national_profiles=[r for r in profiles['00000'] if number(r[6])==sum(national.values())]
        assert national_profiles and len({tuple(r[6:10]) for r in national_profiles})==1
        national_profile=national_profiles[0]
        for key,index in [('validVotes',6),('cast',8),('eligible',9)]:assert sum(u[key] for u in units.values())==number(national_profile[index]),(year,key)
        for u in units.values():
            u['candidates']=[candidates[k]|{'votes':v} for k,v in u.pop('votes').items()];finish(u)
        result['elections'].append({'year':year,'units':units,'availableCount':22,'national':{'validVotes':number(national_profile[6]),'cast':number(national_profile[8]),'eligible':number(national_profile[9]),'votes':{candidates[k]['party']:v for k,v in national.items()}},'sourceDirectory':relative,'sourceSHA256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files.values()}})
        print('Party list county totals verified',year,flush=True)
    return result

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    for filename,asset in [('history-mayors.json',mayor()),('history-party-list.json',party_list())]:
        (ROOT/'dist'/filename).write_text(json.dumps(asset,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        print(filename,len(asset['elections']),'elections;',sum(e['availableCount'] for e in asset['elections']),'available county results')
