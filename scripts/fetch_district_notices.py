import hashlib,json,sys
from pathlib import Path
import requests,pdfplumber
ROOT=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
folder=ROOT/'docs/sources';folder.mkdir(exist_ok=True)
sources={2020:'https://web.cec.gov.tw/api/file/7cd04cb7-f961-48b3-a62d-44241fec9b38.pdf',2024:'https://www.cec.gov.tw/api/file/fcd27893-3766-411f-8b48-faef3bb992c9.pdf'}
audit=[]
for year,url in sources.items():
    p=folder/f'cec-districts-{year}.pdf'
    if not p.exists():
        response=requests.get(url,timeout=40);response.raise_for_status();assert response.content.startswith(b'%PDF');p.write_bytes(response.content)
    with pdfplumber.open(p) as pdf:
        pages=[page.extract_text(layout=False) or '' for page in pdf.pages]
        (folder/f'cec-districts-{year}.txt').write_text('\n\f\n'.join(pages),encoding='utf-8')
        audit.append({'year':year,'url':url,'pages':len(pages),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
        print(year,len(pages),'pages',len(''.join(pages)),'characters')
(folder/'cec-districts-source-manifest.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
