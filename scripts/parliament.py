"""Build election-day 2024 elected membership from original CEC candidate files."""
import csv,json,collections
from pathlib import Path
project=Path(__file__).resolve().parents[1]
source=project.parent/'votedata/votedata/voteData/2024總統立委'
def rows(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.reader(f))
parties=dict(rows(source/'區域立委/elpaty.csv'))
short={'中國國民黨':'國民黨','民主進步黨':'民進黨','台灣民眾黨':'民眾黨','無黨籍及未經政黨推薦':'無黨籍'}
members=[]
for folder,kind in [('區域立委','區域'),('平地立委','平地原住民'),('山地立委','山地原住民')]:
 for r in rows(source/folder/'elcand.csv'):
  if r[14].strip() not in ['*','!']:continue
  members.append(dict(id=kind+':'+r[0]+r[1]+':'+r[2]+':'+r[5],name=r[6],party=short.get(parties.get(r[7],r[7]),parties.get(r[7],r[7])),kind=kind,county=r[0]+r[1],district=r[2],number=r[5]))
allocated={r[0]:int(r[4]) for r in rows(source/'不分區政黨/elretks.csv')}
elected=collections.Counter()
for r in rows(source/'不分區政黨/elrepm.csv'):
 if r[9].strip() not in ['*','!']:continue
 elected[r[0]]+=1
 members.append(dict(id='不分區:'+r[0]+':'+r[1],name=r[2],party=short.get(parties[r[0]],parties[r[0]]),kind='不分區',rank=int(r[1])))
assert all(elected[p]==seats for p,seats in allocated.items())
counts=collections.Counter(m['party'] for m in members)
assert len(members)==113 and counts=={'國民黨':52,'民進黨':51,'民眾黨':8,'無黨籍':2},counts
assert collections.Counter(m['kind'] for m in members)=={'區域':73,'不分區':34,'平地原住民':3,'山地原住民':3}
payload=dict(election='2024-01-13',scope='選舉當選結果，非現任名單',majority=57,members=members,counts=dict(counts),sources=['區域立委/elcand.csv','平地立委/elcand.csv','山地立委/elcand.csv','不分區政黨/elrepm.csv','不分區政黨/elretks.csv'])
from legislative_analysis import build
payload['analysis']=build(source,members,parties,short)
(project/'dist/parliament.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Verified elected membership:',len(members),dict(counts))
