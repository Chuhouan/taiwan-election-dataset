"""Read official, dated ODS identifier tables without modifying the workbooks.

The output indexes identifiers per version. It is NOT proof that an unchanged
identifier has unchanged geometry, nor a spatial interpolation crosswalk.
"""
import csv,hashlib,json,sys,zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as E
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'votedata/votedata/voteData'
NS={'t':'urn:oasis:names:tc:opendocument:xmlns:table:1.0','x':'urn:oasis:names:tc:opendocument:xmlns:text:1.0'}
sys.stdout.reconfigure(encoding='utf-8')
def cells(row):
    result=[]
    for cell in row.findall('t:table-cell',NS):
        text=''.join(cell.itertext()).strip();repeat=int(cell.get('{'+NS['t']+'}number-columns-repeated','1'))
        result.extend([text]*min(repeat,8-len(result)))
        if len(result)>=8:break
    return result
def load(version):
    path=ROOT/'docs/sources'/('G97_TW_U01VI_'+version+'.ods')
    with zipfile.ZipFile(path) as archive:root=E.fromstring(archive.read('content.xml'))
    table=root.find('.//t:table',NS);rows=table.findall('t:table-row',NS);headers=cells(rows[0]);units={};ignored=0
    for row in rows[1:]:
        item=dict(zip(headers,cells(row)));county=item.get('COUNTY_ID','');town=item.get('TOWN_ID','');village=item.get('VILLAGE_ID','')
        if not county.isdigit() or not town.isdigit() or not village.isdigit():ignored+=1;continue
        county=county.zfill(5);town=town.zfill(8);village=village.zfill(3);assert town.startswith(county) and len(village)==3
        key=town+village;record={'county':county,'town':town,'village':village,'gid':item['V_ID'],'countyName':item['COUNTY'],'townName':item['TOWN'],'name':item['VILLAGE']}
        # GID is an official spatial identifier, not a string we may silently
        # reconstruct from administrative codes (notably Kaohsiung recoding).
        record['gidDiffersFromAdministrativeID']=record['gid']!=town+'-'+village
        assert key not in units,(version,key);units[key]=record
    return {'version':version,'source':'https://segis.moi.gov.tw/STATCloud/ViewDetail?messageid=4482','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'units':units,'ignored_blank_or_nonunit_rows':ignored}
def cec_units(year):
    folder=SOURCE/f'{year}總統立委/總統';result={};special=[];names={};active=set()
    with (folder/'elbase.csv').open(encoding='utf-8-sig',newline='') as stream:
        for row in csv.reader(stream):
            if len(row)<6 or not row[4].strip('0 '):continue
            names[(row[0]+row[1]+row[3],row[4])]=row[5]
    with (folder/'elctks.csv').open(encoding='utf-8-sig',newline='') as stream:
        for row in csv.reader(stream):
            if row[4].strip('0 ') and not row[5].strip('0 '):active.add((row[0]+row[1]+row[3],row[4]))
    for town,code in sorted(active):
        name=names[(town,code)]
        if not code.isdigit() or ('各里' in name and '原住民' in name):special.append({'code':town+code,'name':name,'kind':'跨村里原住民統計組' if '各里' in name and '原住民' in name else '合併或特殊統計組'});continue
        key=town+code[-3:];assert key not in result or result[key]==name;result[key]=name
    return result,special
if __name__=='__main__':
    versions={v:load(v) for v in ['2019M06','2022M03','2023M10']};audit=[]
    for year,version in [(2020,'2019M06'),(2024,'2023M10')]:
        raw,special=cec_units(year);gid=versions[version]['units'];missing={k:v for k,v in raw.items() if k not in gid};mismatch={k:{'cec':v,'official':gid[k]['name']} for k,v in raw.items() if k in gid and gid[k]['name']!=v};extra={k:v['name'] for k,v in gid.items() if k not in raw}
        row={'election':year,'version':version,'regularCECUnits':len(raw),'specialCECUnits':len(special),'gidUnits':len(gid),'matchingIDs':len(raw)-len(missing),'missing':missing,'nameMismatch':mismatch,'extraGIDs':extra,'geometryComparability':'unverified; identity-table match alone does not establish unchanged boundaries'};audit.append(row)
        print(year,version,'CEC regular',len(raw),'GID',len(gid),'missing',len(missing),'name discrepancies',len(mismatch))
    payload={'method':'逐版本原始官方GID索引；保留代碼與名稱不一致，不推定幾何不變。特殊選舉統計組另列，不冒充普通村里。','versions':versions,'electionMatchAudit':audit}
    (ROOT/'docs/history-gid-index.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (ROOT/'docs/history-gid-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
