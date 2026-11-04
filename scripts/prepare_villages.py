"""Create county-sharded 2024 presidential village data from CEC and 1120928 boundaries."""
import collections,csv,io,json,zipfile,hashlib
from pathlib import Path
import shapefile
from shapely.geometry import shape,mapping
from shapely.geometry.polygon import orient
from shapely import make_valid
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData/2024總統立委/總統'
data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'));president=data['president'];national=president['00000/000'];candidates={c['number']:c for c in national['candidates']}
def key(row):return row[0]+row[1]+'/'+row[3]+'/'+row[4]
def village_id(row):return row[0]+row[1]+row[3]+row[4][-3:]
names={}
with (source/'elbase.csv').open(encoding='utf-8-sig',newline='') as f:
 for row in csv.reader(f):
  if len(row)>5 and row[4].strip('0 '):names[key(row)]=row[5]
results={}
with (source/'elctks.csv').open(encoding='utf-8-sig',newline='') as f:
 for row in csv.reader(f):
  if not row[4].strip('0 ') or row[5].strip('0 '):continue
  k=key(row);v=results.setdefault(k,dict(id=k,county=row[0]+row[1],town=row[3],code=row[4],name=names.get(k,''),villageId=village_id(row),synthetic=not row[4].isdigit(),votes={}))
  assert row[6] not in v['votes'];v['votes'][row[6]]=int(row[7])
with (source/'elprof.csv').open(encoding='utf-8-sig',newline='') as f:
 for row in csv.reader(f):
  if not row[4].strip('0 ') or row[5].strip('0 '):continue
  k=key(row)
  if k in results:
   r=results[k];r.update(valid=int(row[6]),cast=int(row[8]),eligible=int(row[9]));assert sum(r['votes'].values())==r['valid']
assert len(results)==7738 and all(r['name'] and 'eligible' in r for r in results.values())
for k,r in president.items():
 if r['town']=='000':continue
 children=[v for v in results.values() if v['county']==r['county'] and v['town']==r['town']]
 assert children and sum(v['valid'] for v in children)==r['total'],k
 assert sum(v['cast'] for v in children)==r['cast'] and sum(v['eligible'] for v in children)==r['eligible'],k
 for c in r['candidates']:assert sum(v['votes'].get(c['number'],0) for v in children)==c['votes'],(k,c['number'])
outer=zipfile.ZipFile(root/'docs/village-boundary-112.zip');archive=zipfile.ZipFile(io.BytesIO(outer.read(outer.namelist()[0])));geometries={}
for suffix in ['VILLAGE_NLSC_1120928','Village_Sanhe']:
 prefix=next(n[:-4] for n in archive.namelist() if n.endswith(suffix+'.shp'))
 reader=shapefile.Reader(shp=io.BytesIO(archive.read(prefix+'.shp')),shx=io.BytesIO(archive.read(prefix+'.shx')),dbf=io.BytesIO(archive.read(prefix+'.dbf')),encoding='utf-8')
 for record in reader.iterShapeRecords():
  prop=record.record.as_dict();code=prop['VILLCODE']
  if not prop['VILLNAME']:continue
  geom=make_valid(shape(record.shape.__geo_interface__)).simplify(.00005,preserve_topology=True)
  if geom.is_empty:continue
  if geom.geom_type=='Polygon':geom=orient(geom,sign=-1)
  elif geom.geom_type=='MultiPolygon':geom=type(geom)([orient(p,sign=-1) for p in geom.geoms])
  else:continue
  geometries[code]=mapping(geom)
out=root/'dist/villages';out.mkdir(exist_ok=True);metadata=[]
for county,name in data['counties'].items():
 records=[r for r in results.values() if r['county']==county];features=[];special=[]
 for r in records:
  props={**r,'townName':president[county+'/'+r['town']]['name']}
  if r['synthetic']:special.append(props);continue
  assert r['villageId'] in geometries,(county,r['villageId']);features.append(dict(type='Feature',properties=props,geometry=geometries[r['villageId']]))
 payload=dict(type='FeatureCollection',features=features,special=special,metadata=dict(election='2024-01-13',county=county,countyName=name,boundaryVersion='VILLAGE_NLSC_1120928 + Village_Sanhe',geometrySource='https://data.gov.tw/dataset/130549',method='依中選會村里代碼配對官方歷史圖資；幾何經0.00005度簡化，僅供資料視覺化，非測量界線。特殊統計組列於清單，不繪製推估範圍。',validVotes=sum(r['valid'] for r in records)))
 path=out/(county+'.json');path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8');metadata.append(dict(county=county,name=name,regular=len(features),special=len(special),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
assert sum(x['regular'] for x in metadata)==7727 and sum(x['special'] for x in metadata)==11
(root/'docs/village-shards-audit.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 22 county shards; 7727 regular polygons; 11 separate special units; candidate/cast/eligible reconcile in all towns')
