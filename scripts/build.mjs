import {build} from 'vite';
import {readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const result=await build();
const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output),keep=new Set(outputs.flatMap(o=>[o.fileName,o.fileName+'.map']));
for(const name of await readdir('dist/assets'))if(/-[\w-]{8}\.(js|css)(\.map)?$/.test(name)&&!keep.has('assets/'+name))await unlink('dist/assets/'+name);
const files=[];for(const item of outputs)if(item.fileName.endsWith('.js')){const bytes=await readFile('dist/'+item.fileName);files.push({file:item.fileName,entry:!!item.isEntry,initial:!!item.isEntry||item.fileName.includes('vendor-d3'),qa:item.fileName.includes('/qa-'),raw:bytes.length,gzip:gzipSync(bytes).length});}
const initialJS=files.filter(f=>f.initial).reduce((n,f)=>n+f.gzip,0),initialJSON=['data.json','towns.json'].reduce((n,file)=>n,0);
await writeFile('docs/build-budget.json',JSON.stringify({generatedAt:new Date().toISOString(),initialJSgzip:initialJS,budgetBytes:180*1024,withinBudget:initialJS<=180*1024,files},null,2));
console.log('Initial JS gzip: '+(initialJS/1024).toFixed(1)+' KiB; research/QA chunks lazy');
