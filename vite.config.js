import {readFile} from "node:fs/promises";
import {resolve,sep} from "node:path";
import { defineConfig } from "vite";
export default defineConfig({
  plugins:[{name:'local-election-data',configureServer(server){server.middlewares.use(async(req,res,next)=>{const path=decodeURIComponent((req.url||'').split('?')[0]);if(!path.endsWith('.json'))return next();const base=resolve('dist'),file=resolve(base,'.'+path);if(!file.startsWith(base+sep))return next();try{const bytes=await readFile(file);res.setHeader('Content-Type','application/json; charset=utf-8');res.end(bytes);}catch{next();}})}}],
  base: "./",
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: "hidden",
    target: "es2022",
    rollupOptions: {
      output: { manualChunks: { "vendor-d3": ["d3", "topojson-client"] } },
    },
  },
  test: { include: ["tests/unit/**/*.test.js"], environment: "node" },
});
