"""Read-only inventory of local election assets; no historical joins are inferred."""
import argparse,csv,json,re
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[2]/'votedata/votedata')
args=parser.parse_args();root=args.source.resolve();out=Path(__file__).resolve().parents[1]/'docs/data-inventory.csv'
files=list(root.rglob('*.csv'));groups={}
for p in files: groups.setdefault(p.parent,[]).append(p)
with out.open('w',encoding='utf-8-sig',newline='') as stream:
 writer=csv.writer(stream);writer.writerow(['资料目录','可识别年份','CSV文件','记录数(含表头或汇总行)','候选人文件','票数文件','资料验证','对应年份边界','跨届可比性'])
 for folder,ps in sorted(groups.items()):
  names={p.name.lower() for p in ps};years=sorted(set(re.findall(r'(?:19|20)\d{2}',str(folder.relative_to(root)))))
  for p in sorted(ps):
   try:
    with p.open(encoding='utf-8-sig',newline='') as f: count=sum(1 for _ in csv.reader(f))
   except UnicodeError:
    with p.open(encoding='cp950',errors='replace',newline='') as f: count=sum(1 for _ in csv.reader(f))
   writer.writerow([str(folder.relative_to(root)),','.join(years),p.name,count,bool(names&{'elcand.csv','cand.csv'}),bool(names&{'elctks.csv','prof.csv','elprof.csv'}),'待逐场核验','未由本次CSV清查确认','未验证，禁止直接跨届计算'])
print(f'Inventory: {len(files)} CSV files, {len(groups)} directories -> {out}')
