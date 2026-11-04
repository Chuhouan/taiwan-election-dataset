"""Compare the actual 2020/2024 legal range descriptions, never district numbers alone.

Exact normalized description is evidence of the same named legal composition,
not an independently surveyed polygon. Changed descriptions remain unverified.
"""
import hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
names=json.loads((ROOT/'dist/data.json').read_text(encoding='utf-8'))['counties'];by_name={v:k for k,v in names.items()}
def extract(year):
    text=(ROOT/f'docs/sources/cec-districts-{year}.txt').read_text(encoding='utf-8')
    text=text[text.index('（一）區域選出'):text.index('（二）原住民')]
    units={};county=None;key=None
    for line in text.splitlines():
        line=line.strip()
        if not line or line.isdigit() or line=='選 舉 區 名額 備註' or line=='\f':continue
        line=re.sub(r'計\s*\d+\s*人','',line).strip()
        if not line:continue
        match=next((name for name in by_name if line.startswith(name)),None)
        if match:
            county=match;key=None;line=line[len(match):].strip()
            if line.startswith('選舉區'):
                key=by_name[county]+':01';units[key]={'county':county,'number':1,'lines':[re.sub(r'\s+1$','',line.split('：',1)[-1])]};continue
        district=re.match(r'^第\s*(\d+)\s*選舉區[：:]\s*(.*)',line)
        if district:
            assert county;number=int(district[1]);key=by_name[county]+':'+str(number).zfill(2);assert key not in units
            rest=district[2];units[key]={'county':county,'number':number,'lines':[] if rest.isdigit() else [rest]};continue
        if key and line:units[key]['lines'].append(line)
    assert len(units)==73,(year,len(units))
    for unit in units.values():
        unit['description']='\n'.join(unit.pop('lines')).strip();unit['normalized']=re.sub(r'\s+','',unit['description'])
        assert unit['normalized'] and any(suffix in unit['normalized'] for suffix in ['區','縣','市','鎮','鄉'])
    return units
if __name__=='__main__':
    old,new=extract(2020),extract(2024);assert old.keys()==new.keys();rows=[]
    for key in old:
        same=old[key]['normalized']==new[key]['normalized']
        rows.append({'key':key,'county':old[key]['county'],'number':old[key]['number'],'status':'same_description_pending_boundary_check' if same else 'changed_description_unverified','description_matches':same,'years':{'2020':old[key]['description'],'2024':new[key]['description']},'direct_difference_allowed':False,'geometry_status':'not_independently_verified','reason':'兩屆法定行政組成文字一致；仍須核對所含行政單位歷史邊界，不僅憑同名同碼認定地理相同' if same else '法定組成文字有異；尚待村里分合、改名或範圍變動證據，禁止按同號直接計算'})
    manifest=json.loads((ROOT/'docs/sources/cec-districts-source-manifest.json').read_text(encoding='utf-8'))
    result={'sources':manifest,'method':'限定2020與2024同一選舉類型；比較完整公告法定範圍文字，僅移除排版空白與獨立欄位數字。文字有異一律待核，不按同名、同碼或同號直接認定可比。此為法定描述核對，不證明歷史測量多邊形一致。','districts':rows}
    (ROOT/'docs/history-district-range-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Official descriptions:',sum(r['description_matches'] for r in rows),'identical;',sum(not r['description_matches'] for r in rows),'changed; all historical geometry comparisons remain gated')
    for row in rows:
        if not row['description_matches']:print(row['county'],row['number'],row['years']['2020'][-25:],row['years']['2024'][-25:])
