import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';
import MagicString from 'magic-string';
const order=[...readFileSync('dist/index.html','utf8').matchAll(/<script[^>]*src="([^"?]+)[^"]*"/g)].map(m=>m[1]).filter(s=>!s.startsWith('vendor/'));
const parsed=new Map(),names=new Set(['d3','topojson']);
for(const f of order){const code=readFileSync('dist/'+f,'utf8'),ast=parse(code,{ecmaVersion:'latest',ranges:true,sourceType:'script'});parsed.set(f,{code,ast});for(const n of ast.body){if(n.type==='FunctionDeclaration')names.add(n.id.name);if(n.type==='VariableDeclaration')for(const d of n.declarations){if(d.id.type!=='Identifier')throw Error('Destructuring top declaration '+f);names.add(d.id.name)}}}
const lazy=new Set(['history.js','history-counties.js','history-spatial.js','archive.js','villages.js','spatial.js','multiscale.js','vote-seats.js']);
const manifest={order,modules:{}};
mkdirSync('src/modules',{recursive:true});mkdirSync('src/styles',{recursive:true});mkdirSync('.local/pre-esm',{recursive:true});
for(const [file,{code,ast}]of parsed){writeFileSync('.local/pre-esm/'+file,code);const ms=new MagicString(code),parents=new Map();function walk(n,p){if(!n||typeof n!=='object')return;if(n.type)parents.set(n,p);for(const [k,v]of Object.entries(n))if(k!=='range')if(Array.isArray(v))v.forEach(x=>walk(x,n));else if(v&&typeof v==='object')walk(v,n)}walk(ast,null);
 const scope=analyze(ast,{ecmaVersion:2024,sourceType:'script',optimistic:true,ignoreEval:true});const seen=new Set();
 for(const sc of scope.scopes)for(const ref of sc.references){const id=ref.identifier;if(!names.has(id.name)||ref.resolved&&ref.resolved.scope.type!=='global'||seen.has(id.start))continue;seen.add(id.start);const p=parents.get(id);ms.overwrite(id.start,id.end,p?.type==='Property'&&p.shorthand?`${id.name}: ctx.${id.name}`:`ctx.${id.name}`)}
 const functions=[],variables=[];for(const n of ast.body){if(n.type==='FunctionDeclaration')functions.push(n.id.name);if(n.type==='VariableDeclaration'){const statements=n.declarations.map(d=>{variables.push(d.id.name);return `ctx.${d.id.name} = ${d.init?ms.slice(d.init.start,d.init.end):'undefined'};`}).join('\n');ms.overwrite(n.start,n.end,statements)}}
 // Bootstrap is explicit after all required services have installed.
 let body=ms.toString().replace("document.addEventListener('DOMContentLoaded',ctx.init,{once:true});",'');
 writeFileSync('src/modules/'+file,`/** Explicit module installer; dependencies are supplied by the application context. */\nexport function install(ctx) {\nObject.assign(ctx, {${functions.join(',')}});\n${body}\n}\n`);
 manifest.modules[file]={functions,variables,lazy:lazy.has(file)};
}
writeFileSync('src/module-manifest.json',JSON.stringify(manifest,null,2));
let html=readFileSync('dist/index.html','utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link rel="stylesheet"[^>]*>/g,'');html=html.replace('</head>','<script type="module" src="/src/main.js"></script></head>');writeFileSync('index.html',html);
for(const f of ['style.css','workbench.css'])writeFileSync('src/styles/'+f,readFileSync('dist/'+f));
console.log('Migrated '+order.length+' modules; '+names.size+' explicit context bindings.');
