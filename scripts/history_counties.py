"""Harmonize whole county result units through documented administrative mergers.
This is a statistical crosswalk, not a claim about unchanged historical survey lines.
"""
import csv,json,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData'
folders={1996:'9任總統',2000:'2000年10任總統',2004:'2004   11任總統',2008:'2008 12任總統',2012:'20120114-總統及立委/總統',2016:'2016總統立委/總統',2020:'2020總統立委/總統',2024:'2024總統立委/總統'}
current=json.loads((root/'dist/data.json').read_text(encoding='utf-8'))['counties'];name_to_code={name:code for code,name in current.items()}
lineage={'臺北縣':'新北市','桃園縣':'桃園市','臺中縣':'臺中市','臺南縣':'臺南市','高雄縣':'高雄市'}
sources=['https://www.moi.gov.tw/News_toggle3.aspx?n=174&sms=9015','https://www.ey.gov.tw/state/62879155A536D543/f3662cb7-5806-4755-8aba-ab1d44b97d7a','https://db.cec.gov.tw/ElecTable']
def rows(path):
 return [[v[1:] if re.fullmatch(r"'\d+",v) else v for v in [c.strip() for c in row]] for row in csv.reader(path.open(encoding='utf-8-sig',newline=''))]
def one(folder,prefix):
 found=list(folder.glob(prefix+'*.csv'));assert len(found)==1,(folder,prefix);return found[0]
result={'version':'2026-11-02','unit':'22縣市統一統計範圍','comparability_status':'whole_county_lineage_aggregation','boundary_status':'現今縣市示意定位，非歷史法定界線；不支持鄉鎮村里跨屆對應','derived_method':'2010年前臺中、臺南、高雄縣市先加總票數與分母；臺北縣對應新北市、桃園縣對應桃園市；其餘保留官方縣市整體單位。沒有按面積或人口分攤。','sources':sources,'counties':current,'elections':[]};audit=[]
for year,relative in folders.items():
 folder=source/relative;paths={p:one(folder,p) for p in ['elbase','elcand','elctks','elprof','elpaty']};party=dict(rows(paths['elpaty']));candidates={r[5]:{'name':r[6],'number':r[5],'party':party[r[7]]} for r in rows(paths['elcand']) if len(r)>15 and r[15].strip()!='Y'}
 names={r[0]+r[1]:r[-1] for r in rows(paths['elbase']) if r[2]=='00' and r[3]=='000' and r[4]=='0000'}
 profiles={r[0]+r[1]:r for r in rows(paths['elprof']) if r[2]=='00' and r[3]=='000' and r[4]=='0000' and not r[5].strip('0 ')}
 units={};national={}
 for r in rows(paths['elctks']):
  if r[2]!='00' or r[3]!='000' or r[4]!='0000' or r[5].strip('0 '):continue
  code=r[0]+r[1]
  if code=='00000':national[r[6]]=int(r[7]);continue
  if code in ['10000','09000']:continue
  name=names[code];target=name_to_code[lineage.get(name,name)];profile=profiles[code]
  u=units.setdefault(target,{'code':target,'name':current[target],'originalUnits':{},'votes':{},'validVotes':0,'cast':0,'eligible':0})
  if code not in u['originalUnits']:
   u['originalUnits'][code]=name;u['validVotes']+=int(profile[6]);u['cast']+=int(profile[8]);u['eligible']+=int(profile[9])
  u['votes'][r[6]]=u['votes'].get(r[6],0)+int(r[7])
 assert set(units)==set(current),(year,set(current)-set(units));assert sum(u['validVotes'] for u in units.values())==sum(national.values())
 assert sum(u['cast'] for u in units.values())==int(profiles['00000'][8]);assert sum(u['eligible'] for u in units.values())==int(profiles['00000'][9])
 for n,v in national.items():assert sum(u['votes'].get(n,0) for u in units.values())==v,(year,n)
 for u in units.values():
  u['candidates']=sorted([{**candidates[n],'votes':v,'share':v/u['validVotes']*100} for n,v in [(n,u['votes'].get(n,0)) for n in candidates]],key=lambda c:-c['votes']);assert sum(c['votes'] for c in u['candidates'])==u['validVotes'];u.pop('votes');u['turnout']=u['cast']/u['eligible']*100;u['margin']=(u['candidates'][0]['votes']-u['candidates'][1]['votes'])/u['validVotes']*100
 result['elections'].append({'year':year,'units':units,'sourceDirectory':relative,'sourceSHA256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths.values()}})
 audit.append({'year':year,'originalCountyUnits':sum(len(u['originalUnits']) for u in units.values()),'harmonizedUnits':len(units),'validVotes':sum(u['validVotes'] for u in units.values()),'candidateSumsVerified':True})
(root/'dist/history-counties.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');(root/'docs/history-county-crosswalk.json').write_text(json.dumps({'sources':sources,'lineage':lineage,'audit':audit},ensure_ascii=False,indent=2),encoding='utf-8')
print('Verified 8 elections / 176 harmonized county units; all candidate sums and denominators reconcile.')
