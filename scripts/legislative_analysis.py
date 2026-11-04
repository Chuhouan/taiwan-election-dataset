"""2024 vote/seat comparisons, keeping four ballot systems and denominators separate."""
import csv,hashlib,collections

def build(source,members,parties,short):
 def rows(path):return list(csv.reader(path.open(encoding='utf-8-sig',newline='')))
 def party(code):return short.get(parties.get(code,code),parties.get(code,code))
 def national(folder):
  names={r[5]:r for r in rows(folder/'elcand.csv')};profile=next(r for r in rows(folder/'elprof.csv') if r[:5]==['00','000','00','000','0000'] and not r[5].strip('0 '));tickets=[r for r in rows(folder/'elctks.csv') if r[:5]==['00','000','00','000','0000'] and not r[5].strip('0 ')];assert sum(int(r[7]) for r in tickets)==int(profile[6]);return names,profile,tickets
 systems={};indigenous={}
 for folder,kind,key in [('平地立委','平地原住民','plain'),('山地立委','山地原住民','mountain')]:
  names,profile,tickets=national(source/folder);results=[]
  for r in tickets:
   c=names[r[6]];results.append({'number':r[6],'name':c[6],'party':party(c[7]),'votes':int(r[7]),'share':int(r[7])/int(profile[6])*100,'elected':r[9].strip() in ['*','!']})
  results.sort(key=lambda c:-c['votes']);assert sum(c['elected'] for c in results)==3
  for rank,c in enumerate(results,1):c['rank']=rank
  indigenous[kind]={'candidates':results,'validVotes':int(profile[6]),'cast':int(profile[8]),'eligible':int(profile[9])}
  grouped=collections.defaultdict(lambda:{'votes':0,'seats':0})
  for c in results:grouped[c['party']]['votes']+=c['votes'];grouped[c['party']]['seats']+=int(c['elected'])
  systems[key]={'title':kind+'3席','seats':3,'validVotes':int(profile[6]),'cast':int(profile[8]),'eligible':int(profile[9]),'parties':[{'party':p,**v} for p,v in grouped.items()]}
  for m in members:
   if m['kind']!=kind:continue
   c=next(c for c in results if c['number']==m['number']);assert c['name']==m['name'] and c['elected'];m.update(votes=c['votes'],voteShare=c['share'],validVotes=int(profile[6]),cast=int(profile[8]),eligible=int(profile[9]),voteRank=c['rank'])
 names,profile,tickets=national(source/'不分區政黨');alloc={r[0]:r for r in rows(source/'不分區政黨/elretks.csv')};entries=[]
 for r in tickets:
  c=names[r[6]];a=alloc[c[7]];v=int(r[7]);share=v/int(profile[6])*100;assert abs(share-float(a[1]))<.000051
  entries.append({'party':party(c[7]),'sourceParty':c[6],'number':r[6],'partyCode':c[7],'votes':v,'seats':int(a[4]),'qualified':share>=5,'officialQualifiedShare':float(a[2])})
 qualified_votes=sum(p['votes'] for p in entries if p['qualified']);assert sum(p['seats'] for p in entries)==34
 for p in entries:
  q=p['votes']/qualified_votes*100 if p['qualified'] else 0;assert abs(q-p.pop('officialQualifiedShare'))<.000051
 systems['list']={'title':'不分區34席','seats':34,'validVotes':int(profile[6]),'cast':int(profile[8]),'eligible':int(profile[9]),'qualifiedVotes':qualified_votes,'parties':entries}
 for m in members:
  if m['kind']!='不分區':continue
  p=next(p for p in entries if p['party']==m['party']);m.update(partyVotes=p['votes'],partyValidVotes=int(profile[6]),partyVoteShare=p['votes']/int(profile[6])*100,partyListSeats=p['seats'])
 # Regional contests are aggregated from exactly 73 district totals, without indigenous ballots.
 folder=source/'區域立委';candidates={(r[0]+r[1],r[2],r[5]):r for r in rows(folder/'elcand.csv')};profiles={(r[0]+r[1],r[2]):r for r in rows(folder/'elprof.csv') if r[3]=='000' and r[4]=='0000' and not r[5].strip('0 ')};regional={};grouped=collections.defaultdict(lambda:{'votes':0,'seats':0});district_votes=collections.Counter()
 for r in rows(folder/'elctks.csv'):
  if r[3]!='000' or r[4]!='0000' or r[5].strip('0 '):continue
  key=(r[0]+r[1],r[2],r[6]);c=candidates.get(key)
  if not c:continue
  profile=profiles[key[:2]];v=int(r[7]);p=party(c[7]);elected=r[9].strip() in ['*','!'];grouped[p]['votes']+=v;grouped[p]['seats']+=elected;district_votes[key[:2]]+=v;regional[key]={'votes':v,'voteShare':v/int(profile[6])*100,'validVotes':int(profile[6]),'cast':int(profile[8]),'eligible':int(profile[9])}
 assert len(district_votes)==73
 for key,v in district_votes.items():assert v==int(profiles[key][6])
 systems['regional']={'title':'區域73席','seats':73,'validVotes':sum(district_votes.values()),'cast':sum(int(profiles[key][8]) for key in district_votes),'eligible':sum(int(profiles[key][9]) for key in district_votes),'parties':[{'party':p,**v} for p,v in grouped.items()]}
 for m in members:
  if m['kind']=='區域':m.update(regional[(m['county'],m['district'],m['number'])])
 for system in systems.values():
  assert sum(p['votes'] for p in system['parties'])==system['validVotes'];assert sum(p['seats'] for p in system['parties'])==system['seats']
  for p in system['parties']:p['voteShare']=p['votes']/system['validVotes']*100;p['seatShare']=p['seats']/system['seats']*100;p['gap']=p['seatShare']-p['voteShare']
  system['parties'].sort(key=lambda p:-p['votes'])
 hashes={str(path.relative_to(source)):hashlib.sha256(path.read_bytes()).hexdigest() for folder in ['不分區政黨','區域立委','平地立委','山地立委'] for path in (source/folder).glob('*.csv')}
 return {'systems':systems,'indigenous':indigenous,'sourceSHA256':hashes,'sourceVersion':'CEC 2024 final','method':'票席差＝該類別席次占比−該類別有效票占比；區域73、不分區34、平地3及山地3分開計算。完整113席為混合選制，不使用單一選票分母。','sources':['https://db.cec.gov.tw/ElecTable','https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=159&pid=8','https://web.cec.gov.tw/central/article/41421']}
