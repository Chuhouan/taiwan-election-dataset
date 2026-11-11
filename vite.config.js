import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [{
    name: "local-election-data",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = decodeURIComponent((req.url || "").split("?")[0]);
        if (["/", "/explore", "/explore/", "/about", "/about/"].includes(path)) {
          try {
            let html = await readFile(resolve("index.html"), "utf8");
            html = html.replace("<head>", '<head><base href="/" />');
            try {
              const built = await readFile(resolve("dist/index.html"), "utf8");
              const snapshot = built.match(/<section id="home-summary"[^>]*>([\s\S]*?)<\/section>/);
              if (snapshot) html = html.replace("<!-- HOME_SNAPSHOT -->", snapshot[1]);
            } catch {}
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(await server.transformIndexHtml(req.url, html));
          } catch (error) { next(error); }
          return;
        }
        if (!path.endsWith(".json")) return next();
        const base = resolve("dist"), file = resolve(base, "." + path);
        if (!file.startsWith(base + sep)) return next();
        try {
          const bytes = await readFile(file);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(bytes);
        } catch { next(); }
      });
    },
  }],
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
