"""Simplify shared TopoJSON arcs, retaining endpoints and topology identities."""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'dist'
original=json.loads((root/'towns.json').read_text(encoding='utf-8'))
def simplify(points,tol):
 keep={0,len(points)-1};stack=[(0,len(points)-1)]
 while stack:
  a,b=stack.pop();x,y=points[a];dx=points[b][0]-x;dy=points[b][1]-y;den=dx*dx+dy*dy;best=tol*tol;index=None
  for i in range(a+1,b):
   px,py=points[i];t=max(0,min(1,((px-x)*dx+(py-y)*dy)/den)) if den else 0;d=(px-x-t*dx)**2+(py-y-t*dy)**2
   if d>best:best=d;index=i
  if index is not None:keep.add(index);stack.extend([(a,index),(index,b)])
 result=[points[i] for i in sorted(keep)]
 if points[0]==points[-1] and len(result)<4:return points
 return result
decoded=[]
for arc in original['arcs']:
 x=y=0;points=[]
 for dx,dy in arc:x+=dx;y+=dy;points.append((x,y))
 decoded.append(points)
for level,tolerance in [(0,.003),(1,.0007)]:
 clone=dict(original);clone['arcs']=[];tol=tolerance/max(original['transform']['scale'])
 for points in decoded:
  reduced=simplify(points,tol);x=y=0;arc=[]
  for px,py in reduced:arc.append([px-x,py-y]);x,y=px,py
  clone['arcs'].append(arc)
 path=root/f'towns-lod{level}.json';path.write_text(json.dumps(clone,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print(path.name,path.stat().st_size)
