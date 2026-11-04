"""Contest-level historical archive. Never join historical geography by names.

Only source aggregate rows at the candidate registration scope are retained.
Candidate flags, not vote rank, determine elected status in multi-member races.
"""
import codecs, csv, hashlib, json, re, sys
from collections import defaultdict
from pathlib import Path
from archive_evidence import apply_evidence

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'votedata/votedata/voteData'
OUT = ROOT / 'dist/archive'
CODEBOOK = {'C1':'縣市長','D1':'鄉鎮市長','D2':'原住民區長','R1':'鄉鎮市民代表（區域）','R2':'鄉鎮市民代表（平原）','R3':'原住民區民代表','T1':'議員（區域）','T2':'議員（平地原住民）','T3':'議員（山地原住民）','V1':'村里長'}
TERM_YEAR = {'3屆立委':1995,'4屆立委':1998,'5屆立委':2001,'9任總統':1996}

def rows(path):
    with path.open('rb') as stream: sample=stream.read(4096)
    try: codecs.getincrementaldecoder('utf-8-sig')().decode(sample,final=False); encoding='utf-8-sig'
    except UnicodeDecodeError: encoding='cp950'
    with path.open(encoding=encoding,newline='') as stream:
        for row in csv.reader(stream):
            if row: yield [v.strip().lstrip("'") if v.strip().startswith("'") and v.strip()[1:].isdigit() else v.strip() for v in row]

def file_for(folder, prefix, required=True):
    exact = folder / (prefix+'.csv')
    if exact.exists(): return exact
    matches = sorted(folder.glob(prefix+'_*.csv'))
    if len(matches)==1: return matches[0]
    if required: raise ValueError(f'{prefix}: {len(matches)} canonical files')

def number(value):
    return int(value.strip() or '0')

def scope(row):
    return tuple((str(number(v)) if v.isdigit() else v).zfill(n) for v,n in zip(row[:5],[2,3,2,3,4]))

def zero(value): return not value.strip('0 ')

def classify(relative):
    parts = relative.parts; text = '/'.join(parts); leaf = parts[-1]
    match = re.search(r'(?:19|20)\d{2}', text)
    year = int(match[0]) if match else TERM_YEAR.get(parts[0])
    if '2022-' in parts[0]:
        office = CODEBOOK[parts[1]]
        if leaf in ['prv','city']: office = ('直轄市' if leaf=='prv' else '縣市') + office.removeprefix('縣市')
        return year, office, '地方'
    subtype = '（山地原住民）' if any(s in text for s in ['山原','山地']) else '（平地原住民）' if any(s in text for s in ['平原','平地']) else '（原住民）' if '原住民' in text else '（區域）'
    if '總統' in leaf or parts[0].endswith('任總統'): return year,'總統副總統','中央'
    if '不分區' in leaf: return year,'立委（政黨票）','中央'
    if '國代' in text or '國大代表' in text: return year,'國大代表'+('（政黨票）' if '任務型' in text else subtype),'中央'
    if '立委' in text or '立法委員' in text: return year,'立法委員'+subtype+('補選' if '補選' in text else ''),'中央'
    if '省長' in text: return year,'臺灣省長','地方'
    if '省議員' in text: return year,'臺灣省議員'+subtype,'地方'
    if '區長' in leaf: return year,'原住民區長','地方'
    if '區民代表' in leaf: return year,'原住民區民代表','地方'
    if '代表' in leaf or '民代表' in parts[0]: return year,'鄉鎮市民代表'+('（平原）' if '平原' in text else '（區域）'),'地方'
    if '村里長' in leaf or leaf=='里長': return year,'村里長','地方'
    if '鄉鎮市長' in leaf or '鄉鎮長' in leaf: return year,'鄉鎮市長','地方'
    if '議員' in leaf or ('議員' in parts[0] and leaf in ['區域','山原','平原','平原2','原住民']): return year,('直轄市議員' if '直轄市' in text or '五都' in text else '縣市議員')+subtype,'地方'
    if '市長' in leaf or '市長' in parts[0]: return year,('直轄市長' if '直轄市' in text or '五都' in text else '縣市長'),'地方'
    return year,leaf,'待分類'

def build_folder(folder):
    relative=folder.relative_to(SOURCE); year,office,category=classify(relative)
    files={k:file_for(folder,k) for k in ['elbase','elcand','elctks','elprof','elpaty']}
    parties=dict(rows(files['elpaty'])); bases={scope(r):r[5] for r in rows(files['elbase']) if len(r)>5}
    registrations=defaultdict(dict)
    for row in rows(files['elcand']):
        if len(row)<15 or (len(row)>15 and row[15]=='Y'): continue
        key=scope(row); ballot=str(number(row[5]))
        assert ballot not in registrations[key],(relative,key,ballot)
        registrations[key][ballot]=row
    tickets=defaultdict(dict)
    for row in rows(files['elctks']):
        if len(row)<10 or not zero(row[5]): continue
        key=scope(row); ballot=str(number(row[6]))
        assert ballot not in tickets[key],(relative,key,ballot,'duplicate aggregate')
        tickets[key][ballot]=row
    profiles={scope(r):r for r in rows(files['elprof']) if len(r)>=10 and zero(r[5])}
    allocation_file=file_for(folder,'elretks',False)
    allocations={r[0]:number(r[4]) for r in rows(allocation_file) if len(r)>=5} if allocation_file else {}
    if allocation_file: files['elretks']=allocation_file
    national = '總統' in office or '政黨票' in office or ('立法委員' in office and '原住民' in office)
    contests=[]; issues=[]
    without_district=lambda key:key[:2]+('00',)+key[3:]
    local_registration_counts=defaultdict(int)
    for key in registrations: local_registration_counts[without_district(key)]+=1
    ticket_scope_groups=defaultdict(list)
    for key in tickets: ticket_scope_groups[without_district(key)].append(key)
    for key,candidates in sorted(registrations.items()):
        ticket_key=key
        # Some official releases register a sole contest as district 01 but
        # publish its aggregate as 00. Only an unambiguous same-place registration
        # permits this code correspondence; never pool multiple district races.
        aggregate_key=without_district(key)
        if not tickets.get(key) and local_registration_counts[aggregate_key]==1 and set(tickets.get(aggregate_key,{}))==set(candidates):
            ticket_key=aggregate_key
        if not tickets.get(ticket_key) and local_registration_counts[aggregate_key]==1:
            alternatives=[k for k in ticket_scope_groups[aggregate_key] if set(tickets[k])==set(candidates)]
            if len(alternatives)==1: ticket_key=alternatives[0]
        if not tickets.get(key) and national and key[:2]==('00','000'):
            alternatives=[k for k,v in tickets.items() if k[:2]==('00','000') and set(v)==set(candidates)]
            if len(alternatives)==1: ticket_key=alternatives[0]
        t=tickets.get(ticket_key,{})
        profile_key=ticket_key
        if profile_key not in profiles and local_registration_counts[aggregate_key]==1 and aggregate_key in profiles:
            profile_key=aggregate_key
        if profile_key not in profiles and national and key[:2]==('00','000'):
            profile_key=('00','000','00','000','0000')
        p=profiles.get(profile_key)
        if set(t)!=set(candidates):
            issues.append({'scope':list(key),'reason':'缺少同口徑候選人總票或概況','candidateCount':len(candidates),'ticketCount':len(t),'hasProfile':bool(p)})
            continue
        total=sum(number(r[7]) for r in t.values())
        valid,invalid,cast,eligible=map(number,p[6:10]) if p else (total,None,None,None)
        checks=[]
        if not p: checks.append('缺少同口徑概況；僅呈現候選人票數合計，投票率與選舉人數不推估')
        else:
            if total!=valid: checks.append('候選人加總不等於概況有效票')
            if valid+invalid!=cast: checks.append('有效加無效不等於投票數')
            if cast>eligible: checks.append('投票數超過選舉人數')
        countykey=key[:2]+('00','000','0000'); townkey=key[:2]+('00',key[3],'0000')
        county=bases.get(countykey,'全國' if key[:2]==('00','000') else ''.join(key[:2]))
        town=bases.get(townkey,'') if key[3]!='000' else ''
        unit=bases.get(key,'')
        if not unit and (key[4]!='0000' or (key[3]!='000' and local_registration_counts[aggregate_key]==1)):
            unit=bases.get(aggregate_key,'')
        name=' · '.join(dict.fromkeys(v for v in [county,town,unit] if v))
        if national and key[:2]==('00','000'): name='全國'
        elif key[2]!='00' and not unit: name+=' · 第'+str(int(key[2]))+'選區'
        results=[]
        for ballot,c in candidates.items():
            r=t[ballot]; votes=number(r[7]); flag=r[9] or c[14]
            results.append({'ballot':int(ballot),'name':c[6],'party':parties.get(c[7],c[7]),'partyCode':c[7],'votes':votes,'share':votes/valid*100 if valid else None,'elected':flag in ['*','!'],'electedFlag':flag,'seats':allocations.get(c[7]) if allocations else None})
        results.sort(key=lambda r:(-r['votes'],r['ballot']))
        contests.append({'id':':'.join(key),'scope':list(key),'ticketScope':list(ticket_key),'profileScope':list(profile_key) if p else None,'scopeCorrespondence':'原始同碼' if key==ticket_key==profile_key else '同地點唯一登記選舉區之彙總碼對應；保留原碼並核對票數','name':name,'county':county,'town':town,'validVotes':valid,'validVotesBasis':'elprof' if p else 'candidate_sum','invalidVotes':invalid,'cast':cast,'eligible':eligible,'turnout':cast/eligible*100 if eligible else None,'electedCount':sum(r['elected'] for r in results),'allocatedSeats':sum(r['seats'] or 0 for r in results) if allocations else None,'verified':not checks,'issues':checks,'candidates':results})
        if checks: issues.append({'scope':list(key),'reason':'；'.join(checks)})
    entry_id='a'+hashlib.sha256(str(relative).replace('\\','/').encode()).hexdigest()[:14]
    provenance={'directory':str(relative).replace('\\','/'),'sha256':{k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in files.items()}}
    return {'id':entry_id,'year':year,'office':office,'category':category,'title':str(relative).replace('\\',' / '),'sources':[provenance],'boundary_version':None,'comparability_status':'原始歷史選區／行政區口徑；跨屆區域對應未核驗，禁止直接相減','verification_status':'逐選舉區核對原始候選人總票、有效票及投票分母；異常逐項保留','contests':contests,'issues':issues}

def main():
    OUT.mkdir(exist_ok=True); entries=[]; failures=[]; duplicates=[]; seen={}
    folders=sorted({p.parent for p in SOURCE.rglob('elcand*.csv') if 'old' not in p.relative_to(SOURCE).parts})
    for index,folder in enumerate(folders):
        if index%10==0: print(f'Archive {index}/{len(folders)}',flush=True)
        try: item=apply_evidence(build_folder(folder))
        except (ValueError,AssertionError,KeyError) as error:
            failures.append({'directory':str(folder.relative_to(SOURCE)),'error':str(error)}); continue
        # Duplicate releases require identical contest identities, names, raw votes,
        # denominators and official elected flags; folder names alone never suffice.
        fingerprint=hashlib.sha256(json.dumps([item['year'],item['office'],item['contests']],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        if fingerprint in seen:
            original=seen[fingerprint]; original['sources'].extend(item['sources']);duplicates.append({'kept':original['id'],'alias':item['sources'][0]['directory']});continue
        seen[fingerprint]=item; entries.append(item)
    catalog=[]
    for item in entries:
        asset=OUT/(item['id']+'.json')
        asset.write_text(json.dumps(item,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        catalog.append({k:item[k] for k in ['id','year','office','category','title','sources','election_date','date_source'] if k in item}|{'scopeLabel':item['contests'][0]['name'] if len(item['contests'])==1 else str(len({c['county'] for c in item['contests']}))+'個原始縣市','dataSHA256':hashlib.sha256(asset.read_bytes()).hexdigest(),'contests':len(item['contests']),'candidates':sum(len(c['candidates']) for c in item['contests']),'verifiedContests':sum(c['verified'] for c in item['contests']),'officialCorrections':sum('officialResult' in c for c in item['contests']),'issues':len(item['issues'])})
    catalog.sort(key=lambda e:(-(e['year'] or 0),e['category'],e['office'],e['title']))
    result={'entries':catalog,'codebook':CODEBOOK,'codebook_source':'2022-111年地方公職人員選舉/選舉種類代碼.xlsx','schema_source':'選舉資料庫格式.odt（101年4月19日版）','term_year_source':'https://aam.ly.gov.tw/P016001_01.do','policy':'僅載入原始選舉區結果；不合併不同選制分母。當選依來源*／!，非由名次推定；與正式公告矛盾時，另記公告核對結果並保留原始標記；!為婦女保障當選，?為來源同票待抽籤，不推定最終當選。政黨票席次以elretks為準。無可靠歷史邊界時保留清單，不套用現今地圖。年份未能核實者單獨標示。','failures':failures,'duplicates':duplicates}
    (ROOT/'dist/archive-catalog.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (ROOT/'docs/archive-audit.json').write_text(json.dumps(result|{'totals':{'entries':len(entries),'contests':sum(e['contests'] for e in catalog),'candidates':sum(e['candidates'] for e in catalog),'verifiedContests':sum(e['verifiedContests'] for e in catalog),'issues':sum(e['issues'] for e in catalog)}},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'entries':len(entries),'contests':sum(e['contests'] for e in catalog),'failures':failures,'duplicates':duplicates,'issues':[(e['sources'][0]['directory'],e['issues']) for e in catalog if e['issues']]},ensure_ascii=False))

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8'); main()
