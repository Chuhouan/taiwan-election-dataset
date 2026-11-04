"""Build the national presidential history asset from the audited source model."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
model=json.loads((root/'docs/history-national-model.json').read_text(encoding='utf-8'))
candidates={x['id']:x for x in model['Candidate']}; parties={x['id']:x for x in model['Party']}
years=[]
for election in model['Election']:
 rows=sorted((r for r in model['Result'] if r['electionId']==election['id']),key=lambda r:-r['votes'])
 assert rows and sum(r['elected'] for r in rows)==1 and rows[0]['elected']
 assert sum(r['votes'] for r in rows)==rows[0]['validVotes']
 values=[]
 for r in rows:
  c=candidates[r['candidateId']];values.append({'name':c['name'],'party':parties[c['partyId']]['name'],'votes':r['votes'],'share':r['voteShare'],'elected':r['elected']})
 first=rows[0];years.append({'year':election['year'],'validVotes':first['validVotes'],'cast':first['cast'],'eligible':first['eligible'],'turnout':100*first['cast']/first['eligible'],'margin':100*(rows[0]['votes']-rows[1]['votes'])/first['validVotes'],'candidates':values,'sourceDirectory':election['sourceDirectory'],'sourceSHA256':election['sourceSHA256']})
assert len(years)==8 and [x['year'] for x in years]==[1996,2000,2004,2008,2012,2016,2020,2024]
assert years[3]['candidates'][0]['votes']==7659014 and years[4]['candidates'][0]['votes']==6891139 and years[7]['candidates'][0]['votes']==5586019
asset={'version':'2026-11-02','scope':'全國有效票；跨屆不涉及行政界線','sources':['https://db.cec.gov.tw/ElecTable','https://web.cec.gov.tw/api/file/74da3d81-9ed5-4523-9afb-cd1200edf5cd.pdf','https://web.cec.gov.tw/api/file/13b6511f-e577-494e-80d9-5686631a02ad.pdf','https://web.cec.gov.tw/central/article/41422'],'elections':years}
(root/'dist/history.json').write_text(json.dumps(asset,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('PASS: eight presidential elections, national vote totals, official samples 2008/2012/2024')
