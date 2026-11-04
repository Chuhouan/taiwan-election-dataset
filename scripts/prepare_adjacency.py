"""Derive Rook/Queen town adjacency from unsimplified official 1120928 village polygons."""
import csv,hashlib,io,json,zipfile,collections
from pathlib import Path
import shapefile
from shapely.geometry import shape
from shapely import make_valid
from shapely.ops import unary_union
from shapely.strtree import STRtree
root=Path(__file__).resolve().parents[1];data=json.loads((root/'dist/data.json').read_text(encoding='utf-8'));source=root.parent/'votedata/votedata/voteData/2024總統立委/總統';assign={}
with (source/'elctks.csv').open(encoding='utf-8-sig',newline='') as f:
 for r in csv.reader(f):
  if not r[4].strip('0 ') or r[5].strip('0 ') or not r[4].isdigit():continue
  assign[r[0]+r[1]+r[3]+r[4][-3:]]=r[0]+r[1]+'/'+r[3]
outer=zipfile.ZipFile(root/'docs/village-boundary-112.zip');archive=zipfile.ZipFile(io.BytesIO(outer.read(outer.namelist()[0])));geometries={}
for suffix in ['VILLAGE_NLSC_1120928','Village_Sanhe']:
 prefix=next(n[:-4] for n in archive.namelist() if n.endswith(suffix+'.shp'))
 reader=shapefile.Reader(shp=io.BytesIO(archive.read(prefix+'.shp')),shx=io.BytesIO(archive.read(prefix+'.shx')),dbf=io.BytesIO(archive.read(prefix+'.dbf')),encoding='utf-8')
 for record in reader.iterShapeRecords():
  code=record.record.as_dict()['VILLCODE']
  if code in assign:geometries[code]=make_valid(shape(record.shape.__geo_interface__))
assert len(geometries)==7727
groups=collections.defaultdict(list)
for code,g in geometries.items():groups[assign[code]].append(g)
all_towns={k for k,r in data['president'].items() if r['town']!='000'};missing_towns=sorted(all_towns-set(groups));print('Mapped towns:',len(groups),'missing:',missing_towns,flush=True);keys=sorted(groups);assert len(keys)==365;merged=[unary_union(groups[k]) for k in keys];tree=STRtree(merged);queen={k:[] for k in sorted(all_towns)};rook={k:[] for k in sorted(all_towns)};overlaps=[]
for i,g in enumerate(merged):
 for j0 in tree.query(g):
  j=int(j0)
  if j<=i:continue
  h=merged[j]
  if not g.intersects(h):continue
  area=g.intersection(h).area
  if area>1e-8:
   overlaps.append({'a':keys[i],'b':keys[j],'overlap_area_degrees2':area});continue
  queen[keys[i]].append(keys[j]);queen[keys[j]].append(keys[i])
  shared=g.boundary.intersection(h.boundary).length
  if shared>1e-7:rook[keys[i]].append(keys[j]);rook[keys[j]].append(keys[i])
for graph in [queen,rook]:
 for k,ns in graph.items():
  graph[k]=sorted(ns);assert k not in ns
  for n in ns:assert k in graph[n]
metadata={'boundary_version':'VILLAGE_NLSC_1120928 + Village_Sanhe','geometry_source':'https://data.gov.tw/dataset/130549','archive_sha256':hashlib.sha256((root/'docs/village-boundary-112.zip').read_bytes()).hexdigest(),'method':'未簡化官方村里幾何依2024鄉鎮歸屬合併；Queen含共點接觸，Rook要求共有邊界長度大於1e-7度；面積重疊大於1e-8平方度的圖形對排除；不以距離、道路或橋梁補接海島及缺口。','mapped_towns':len(keys),'missing_geometry_towns':missing_towns,'queen_edges':sum(map(len,queen.values()))//2,'rook_edges':sum(map(len,rook.values()))//2,'queen_isolates':[k for k,ns in queen.items() if not ns],'rook_isolates':[k for k,ns in rook.items() if not ns],'excluded_overlap_pairs':overlaps,'overlap_pairs_above_1e8':len(overlaps),'verification_status':'368鄉鎮統計中365鄉鎮具常規村里幾何；7727常規村里配對；對稱、無自鄰接；缺少幾何及特殊統計組不補造邊界'}
(root/'dist/town-adjacency.json').write_text(json.dumps({'metadata':metadata,'queen':queen,'rook':rook},ensure_ascii=False,separators=(',',':')),encoding='utf-8');(root/'docs/town-adjacency-audit.json').write_text(json.dumps({'metadata':metadata,'overlaps':overlaps},ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(metadata,ensure_ascii=False))
