"""Fetch a dated official archive listed by data.gov.tw dataset 130549.

Read-only source acquisition; downloaded archives are never executed or extracted
with arbitrary paths. A year label alone does not certify an election-date match.
"""
import hashlib,json,sys,zipfile
from datetime import date
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
SOURCES={'108':'https://www.land.moi.gov.tw/chhtml/DownloadGovDoc?gsno=7DD6BC&gdid=527'}
if __name__=='__main__':
    manifest=[]
    for year,url in SOURCES.items():
        destination=ROOT/'docs/sources'/f'village-boundary-{year}.zip'
        if not destination.exists():
            with requests.get(url,timeout=(15,60),stream=True) as response:
                response.raise_for_status();size=0
                with destination.open('wb') as stream:
                    for chunk in response.iter_content(1024*1024):
                        size+=len(chunk);assert size<160*1024*1024
                        stream.write(chunk)
                        if size//(4*1024*1024)!=(size-len(chunk))//(4*1024*1024):print(year,round(size/1024/1024),'MiB',flush=True)
        with zipfile.ZipFile(destination) as archive:names=[i.filename for i in archive.infolist()]
        manifest.append({'year_label':year,'url':url,'listing_source':'https://data.gov.tw/dataset/130549','retrieved_at':date.today().isoformat(),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'bytes':destination.stat().st_size,'outer_members':names,'verification_status':'downloaded; exact geometry vintage and election-date suitability pending'})
        print(year,destination.stat().st_size,'bytes;',len(names),'outer members')
    (ROOT/'docs/sources/historical-boundary-downloads.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
