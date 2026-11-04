"""Audit election village IDs/names against a specific official historical boundary release."""
import csv,json,zipfile,io,shapefile
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData/2024總統立委'
outer=zipfile.ZipFile(root/'docs/village-boundary-112.zip');archive=zipfile.ZipFile(io.BytesIO(outer.read(outer.namelist()[0])))
prefix=next(n[:-4] for n in archive.namelist() if '1120928' in n and n.endswith('.shp'))
reader=shapefile.Reader(shp=io.BytesIO(archive.read(prefix+'.shp')),shx=io.BytesIO(archive.read(prefix+'.shx')),dbf=io.BytesIO(archive.read(prefix+'.dbf')),encoding='utf-8')
boundaries={r['VILLCODE']:r for r in (record.as_dict() for record in reader.records()) if r['VILLNAME']}
supplement=next(n[:-4] for n in archive.namelist() if n.endswith('Village_Sanhe.shp'))
extra=shapefile.Reader(shp=io.BytesIO(archive.read(supplement+'.shp')),dbf=io.BytesIO(archive.read(supplement+'.dbf')),encoding='utf-8')
boundaries.update({r['VILLCODE']:r for r in (record.as_dict() for record in extra.records()) if r['VILLNAME']})
villages={};active=set()
with (source/'總統/elctks.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if r[4].strip('0 ') and not r[5].strip('0 '):active.add(r[0]+r[1]+r[3]+r[4][-3:])
with (source/'總統/elbase.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  key=r[0]+r[1]+r[3]+r[4][-3:]
  if key in active:villages[key]=r[5]
normalize=lambda n:n.replace('台','臺').strip()
missing={k:v for k,v in villages.items() if k not in boundaries};mismatch={k:[v,boundaries[k]['VILLNAME']] for k,v in villages.items() if k in boundaries and normalize(v)!=normalize(boundaries[k]['VILLNAME'])}
report=dict(election='2024-01-13',boundaryFile=Path(prefix).name,source='https://data.gov.tw/dataset/130549',sourceDownload='https://www.land.moi.gov.tw/chhtml/DownloadGovDoc?gdid=531&gsno=Z2371J',electionVillageCount=len(villages),boundaryNamedCount=len(boundaries),matchingIds=len(villages)-len(missing),missing=missing,nameMismatch=mismatch,extraBoundaryIds={k:v['VILLNAME'] for k,v in boundaries.items() if k not in villages})
(root/'docs/spatial-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Election villages:',len(villages),'named boundaries:',len(boundaries),'missing:',len(missing),'name mismatches:',len(mismatch))
print(json.dumps(dict(missing=missing,mismatch=mismatch),ensure_ascii=True))
