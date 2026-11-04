"""Prepare a national-only historical model without assuming administrative equivalence.
This artifact is kept in docs and is not loaded into the two-election prototype.
"""
import csv,json,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData'
folders={1996:'9任總統',2000:'2000年10任總統',2004:'2004   11任總統',2008:'2008 12任總統',2012:'20120114-總統及立委/總統',2016:'2016總統立委/總統',2020:'2020總統立委/總統',2024:'2024總統立委/總統'}
def rows(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return [[v[1:] if re.fullmatch(r"'\d+",v) else v for v in row] for row in csv.reader(f)]
def one(folder,prefix):
 matches=list(folder.glob(prefix+'*.csv'));assert len(matches)==1,(folder,prefix,matches);return matches[0]
catalog={key:[] for key in ['Election','Candidate','Party','Geography','ElectoralDistrict','Result']};parties={}
catalog['Geography']=[dict(id='TW:national',name='全國',level='national',boundaryVersion='全國統計口徑；不含行政區界線假設')]
for year,relative in folders.items():
 folder=source/relative;candidateFile=one(folder,'elcand');ticketFile=one(folder,'elctks');profileFile=one(folder,'elprof');partyFile=one(folder,'elpaty')
 party=dict(rows(partyFile));parties.update(party);candidates={r[5]:r for r in rows(candidateFile) if len(r)>15 and r[15].strip()!='Y'}
 national=[];countyTotals={};nationalProfile=None
 for r in rows(ticketFile):
  if r[3]!='000' or r[4]!='0000' or r[5].strip('0 '):continue
  area=r[0]+r[1]
  if area=='00000':national.append(r)
  elif area not in ['10000','09000']:countyTotals[area]=countyTotals.get(area,0)+int(r[7])
 for r in rows(profileFile):
  if r[0]+r[1]=='00000' and r[3]=='000' and r[4]=='0000' and not r[5].strip('0 '):nationalProfile=r;break
 assert nationalProfile is not None and national,(year,rows(profileFile)[:1],rows(ticketFile)[:1])
 total=sum(int(r[7]) for r in national);assert total==int(nationalProfile[6]);assert sum(countyTotals.values())==total,(year,total,sum(countyTotals.values()))
 election=f'president:{year}';district=election+':national'
 catalog['Party'].extend(dict(id=election+':party:'+code,name=name,sourceCode=code,electionId=election,canonicalCrossYearId=None) for code,name in sorted(party.items()))
 catalog['Election'].append(dict(id=election,year=year,kind='president',system='plurality-single-national',sourceDirectory=str(folder.relative_to(source)),sourceSHA256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [candidateFile,ticketFile,profileFile,partyFile]},validation='原始票數與全國及縣市加總相符；尚未逐屆外部官方抽樣',activePrototype=year==2024))
 catalog['ElectoralDistrict'].append(dict(id=district,electionId=election,geographyId='TW:national',seats=1))
 for r in national:
  c=candidates[r[6]];candidateId=election+':'+r[6];catalog['Candidate'].append(dict(id=candidateId,electionId=election,name=c[6],partyId=election+':party:'+c[7],ballotNumber=r[6]))
  catalog['Result'].append(dict(electionId=election,candidateId=candidateId,districtId=district,geographyId='TW:national',votes=int(r[7]),validVotes=total,cast=int(nationalProfile[8]),eligible=int(nationalProfile[9]),voteShare=int(r[7])/total*100,elected=r[9].strip() in ['*','!']))
assert len({p['id'] for p in catalog['Party']})==len(catalog['Party'])
catalog['comparabilityPolicy']={'national':'可比较各届全國官方有效票占比；须保留届次及分母','administrative':'未验证；不得因同名或同代码直接合并','district':'未验证历史选区对应','station':'仅记录不等于拥有地理边界'}
(root/'docs/history-national-model.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
print('Prepared national-only model:',len(catalog['Election']),'elections;',len(catalog['Result']),'results. No historical maps activated.')
