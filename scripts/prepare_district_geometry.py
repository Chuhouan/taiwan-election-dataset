"""Derive 2024 voting-village district geometry, with unassigned land left unfilled.
Not a replacement for the legal boundary document. Every mapped village uses an
explicit 2024 CEC district assignment and an official 1120928 geometry ID.
"""
import csv,json,zipfile,io,hashlib
from pathlib import Path
import shapefile
from shapely.geometry import shape,mapping
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import make_valid
root=Path(__file__).resolve().parents[1];source=root.parent/'votedata/votedata/voteData/2024總統立委';data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'))
outer=zipfile.ZipFile(root/'docs/village-boundary-112.zip');archive=zipfile.ZipFile(io.BytesIO(outer.read(outer.namelist()[0])));geometries={};names={}
for suffix in ['VILLAGE_NLSC_1120928','Village_Sanhe']:
 prefix=next(n[:-4] for n in archive.namelist() if n.endswith(suffix+'.shp'))
 reader=shapefile.Reader(shp=io.BytesIO(archive.read(prefix+'.shp')),shx=io.BytesIO(archive.read(prefix+'.shx')),dbf=io.BytesIO(archive.read(prefix+'.dbf')),encoding='utf-8')
 for record in reader.iterShapeRecords():
  properties=record.record.as_dict();key=properties['VILLCODE']
  if not properties['VILLNAME']:continue
  geom=make_valid(shape(record.shape.__geo_interface__))
  if geom.is_empty:continue
  geometries[key]=geom;names[key]=properties['VILLNAME']
assignments={};missing={};synthetic=set()
with (source/'區域立委/elctks.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if not r[4].strip('0 ') or r[5].strip('0 '):continue
  district=r[0]+r[1]+':'+r[2]+'/000';village=r[0]+r[1]+r[3]+r[4][-3:]
  if not r[4].isdigit():synthetic.add(village);continue
  if village not in geometries:missing[village]=district;continue
  assert village not in assignments or assignments[village]==district,('split-village',village)
  assignments[village]=district
assert not missing,missing
grouped={}
for village,district in assignments.items():grouped.setdefault(district,[]).append(village)
assert len(grouped)==73
features=[]
for district,villages in sorted(grouped.items()):
 assert district in data['legislator'],district
 geom=unary_union([geometries[v] for v in villages]).simplify(.0001,preserve_topology=True)
 if geom.geom_type=='Polygon':geom=orient(geom,sign=-1)
 elif geom.geom_type=='MultiPolygon':geom=type(geom)([orient(p,sign=-1) for p in geom.geoms])
 assert geom.is_valid and not geom.is_empty,district
 features.append(dict(type='Feature',properties=dict(key=district,COUNTYCODE=district[:5],district=district.split(':')[1].split('/')[0],villageCount=len(villages)),geometry=mapping(geom)))
payload=dict(type='FeatureCollection',features=features,metadata=dict(election='2024-01-13',boundaryVersion='VILLAGE_NLSC_1120928 + provider Village_Sanhe supplement',geometrySource='https://data.gov.tw/dataset/130549',assignmentSource='CEC 2024 regional legislator elctks.csv',license='政府資料開放授權條款第1版',method='依2024中選會村里選區代碼合併官方歷史村里圖資；未編定村里和無幾何的統計組不推估填色',mappedVillageCount=len(assignments),syntheticStatisticsCount=len(synthetic),unmatchedRegularVillageCount=len(missing),boundaryArchiveSHA256=hashlib.sha256((root/'docs/village-boundary-112.zip').read_bytes()).hexdigest()))
(root/'dist/districts-2024.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(root/'docs/district-geometry-audit.json').write_text(json.dumps(payload['metadata'],ensure_ascii=False,indent=2),encoding='utf-8')
print('Verified:',len(features),'districts;',len(assignments),'mapped regular village IDs;',len(synthetic),'synthetic statistics groups; no unmatched regular village IDs')
