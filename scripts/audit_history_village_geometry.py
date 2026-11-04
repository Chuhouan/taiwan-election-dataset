"""Audit dated official geometry against active presidential statistical units.

Only exact topological equality can pass the geometric comparison gate. No
rounded-coordinate, name-only, area-weighted or population allocation is used.
"""
import hashlib,io,json,sys,zipfile
from collections import Counter
from pathlib import Path
import shapefile
from shapely.geometry import shape
from history_gid_index import cec_units,load
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
def boundary(path):
    with zipfile.ZipFile(path) as outer:
        members=[n for n in outer.namelist() if n.lower().endswith('.zip')];assert len(members)==1
        with zipfile.ZipFile(io.BytesIO(outer.read(members[0]))) as z:
            prefixes=[n[:-4] for n in z.namelist() if n.endswith('.shp')];units={}
            for prefix in prefixes:
                reader=shapefile.Reader(shp=io.BytesIO(z.read(prefix+'.shp')),shx=io.BytesIO(z.read(prefix+'.shx')),dbf=io.BytesIO(z.read(prefix+'.dbf')),encoding='utf-8')
                for record in reader.iterShapeRecords():
                    p=record.record.as_dict()
                    if not p['VILLNAME']:continue
                    key=p['VILLCODE'];assert key not in units
                    units[key]={'name':p['VILLNAME'],'townName':p['TOWNNAME'],'countyName':p['COUNTYNAME'],'geometry':shape(record.shape.__geo_interface__),'layer':prefix}
    return units,{'archiveSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'shapePrefixes':prefixes,'namedUnits':len(units),'source':'https://data.gov.tw/dataset/130549'}
def resolve_geometry(raw,units,gid):
    resolved={};bridges={}
    for key in raw:
        # The 2019 official table explicitly links administrative town 050
        # to spatial IDs 051/052 for some Kaohsiung villages. Preserve the
        # original identifier and record that bridge; never join by name.
        if key in units:resolved[key]=units[key];continue
        spatial_id=gid['units'].get(key,{}).get('gid','').replace('-','')
        if spatial_id in units:resolved[key]=units[spatial_id];bridges[key]={'geometryID':spatial_id,'gidVersion':gid['version'],'gidSHA256':gid['sha256']}
    return resolved,bridges
if __name__=='__main__':
    geometries={};source={};raw={};special={};audits=[]
    for year,path in [(2020,ROOT/'docs/sources/village-boundary-108.zip'),(2024,ROOT/'docs/village-boundary-112.zip')]:
        units,source[year]=boundary(path);raw[year],special[year]=cec_units(year);gid=load('2019M06' if year==2020 else '2023M10');geometries[year],bridges=resolve_geometry(raw[year],units,gid)
        matches=geometries[year];missing={k:v for k,v in raw[year].items() if k not in matches};name_diff={k:{'cec':raw[year][k],'shape':g['name']} for k,g in matches.items() if raw[year][k]!=g['name']};invalid=[k for k,g in matches.items() if not g['geometry'].is_valid]
        audits.append({'election':year,'source':source[year],'activeRegularUnits':len(raw[year]),'specialStatisticalGroups':special[year],'matchedGeometryIDs':len(matches),'officialGIDBridges':bridges,'missingGeometryIDs':missing,'nameDifferences':name_diff,'invalidRawGeometryIDs':invalid})
        print(year,'regular',len(raw[year]),'special',len(special[year]),'matched',len(matches),'missing',len(missing),'name differences',len(name_diff),'invalid geometry',len(invalid),flush=True)
    comparisons=[]
    for key in sorted(set(raw[2020])|set(raw[2024])):
        a,b=geometries[2020].get(key),geometries[2024].get(key);status='not_active_in_both_elections'
        if key in raw[2020] and key in raw[2024]:
            if not a or not b:status='missing_geometry'
            elif b['townName']=='那瑪夏區':status='2024_vintage_requires_october_update'
            elif not a['geometry'].is_valid or not b['geometry'].is_valid:status='invalid_source_geometry'
            elif a['name']!=raw[2020][key] or b['name']!=raw[2024][key]:status='source_name_difference_pending'
            elif a['geometry'].equals(b['geometry']):status='exact_topological_equality'
            else:status='geometry_difference_unresolved'
        comparisons.append({'id':key,'name2020':raw[2020].get(key),'name2024':raw[2024].get(key),'status':status,'directDifferenceAllowed':status=='exact_topological_equality'})
    report={'method':'僅在兩屆都有獨立常規選舉結果、官方ID與名稱配對、原始幾何有效且精確拓撲相等時通過。特殊或合併統計組不拆票；無資料不補0；不按面積／人口分攤。2024那瑪夏區112年10月釐整晚於目前1120928圖資，暫不通過。','boundarySources':source,'electionAudits':audits,'comparisonCounts':dict(Counter(r['status'] for r in comparisons)),'comparisons':comparisons}
    (ROOT/'docs/history-village-geometry-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(report['comparisonCounts'])
