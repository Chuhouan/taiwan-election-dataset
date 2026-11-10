import {build} from 'vite';
import {readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {writeProductPages} from './product-pages.mjs';
const result=await build();
const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output),keep=new Set(outputs.flatMap(o=>[o.fileName,o.fileName+'.map']));
for(const name of await readdir('dist/assets'))if(/-[\w-]{8}\.(js|css)(\.map)?$/.test(name)&&!keep.has('assets/'+name))await unlink('dist/assets/'+name);
const initial=new Set(),byName=new Map(outputs.map(o=>[o.fileName,o]));
const visit=(name)=>{if(initial.has(name))return;initial.add(name);for(const dependency of byName.get(name)?.imports||[])visit(dependency);};
for(const item of outputs)if(item.isEntry)visit(item.fileName);
const files=[];for(const item of outputs)if(item.fileName.endsWith('.js')){const bytes=await readFile('dist/'+item.fileName);files.push({file:item.fileName,entry:!!item.isEntry,initial:initial.has(item.fileName),qa:item.fileName.includes('/qa-'),raw:bytes.length,gzip:gzipSync(bytes).length});}
const initialJS=files.filter(f=>f.initial).reduce((n,f)=>n+f.gzip,0);
await writeFile('docs/build-budget.json',JSON.stringify({generatedAt:new Date().toISOString(),initialJSgzip:initialJS,budgetBytes:180*1024,withinBudget:initialJS<=180*1024,files},null,2));
await writeProductPages();
console.log('Initial JS gzip: '+(initialJS/1024).toFixed(1)+' KiB; research/QA chunks lazy');
