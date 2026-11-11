/** src/charts/small-maps.js — explicit visualization service dependencies. */
export function install(ctx) {
  Object.assign(ctx, { drawSmallIslands, drawSmallMultiples });
  function drawSmallIslands(layer, paths, pw, ph) {
    const iw = Math.min(78, pw * 0.22),
      ih = Math.max(58, Math.min(112, (ph - 18) / 3)),
      ids = ["09007", "09020", "10016"];
    ids.forEach((id, j) => {
      const county = ctx.counties.find((f) => f.properties.COUNTYCODE === id),
        top = j * (ih + 6),
        fs = ctx.towns.filter((f) => f.properties.COUNTYCODE === id);
      layer
        .append("text")
        .attr("x", 4)
        .attr("y", top + 13)
        .attr("class", "ternary-tick")
        .text(county.properties.COUNTYNAME);
      if (id === "09007") {
        const parts = fs.map((f, i) => ({
          f,
          path: ctx.d3.geoPath(
            ctx.d3.geoMercator().fitExtent(
              [
                [
                  4 + ((i % 2) * iw) / 2,
                  top + 20 + (Math.floor(i / 2) * (ih - 22)) / 2,
                ],
                [
                  iw / 2 - 2 + ((i % 2) * iw) / 2,
                  top + 20 + ((Math.floor(i / 2) + 1) * (ih - 22)) / 2 - 4,
                ],
              ],
              f,
            ),
          ),
        }));
        paths[id] = (f) =>
          f.properties.TOWNCODE
            ? parts.find((p) => ctx.geoKey(p.f) === ctx.geoKey(f)).path(f)
            : parts.map((p) => p.path(p.f)).join("");
      } else if (id === "09020") {
        const split = (remote) => ({
            ...county,
            geometry: {
              type: "MultiPolygon",
              coordinates: (county.geometry.type === "MultiPolygon"
                ? county.geometry.coordinates
                : [county.geometry.coordinates]
              ).filter((p) => p[0][0][0] > 119 === remote),
            },
          }),
          main = split(false),
          remote = split(true),
          a = ctx.d3.geoPath(
            ctx.d3.geoMercator().fitExtent(
              [
                [4, top + 22],
                [iw * 0.71, top + ih - 5],
              ],
              main,
            ),
          ),
          b = ctx.d3.geoPath(
            ctx.d3.geoMercator().fitExtent(
              [
                [iw * 0.79, top + 30],
                [iw - 2, top + ih - 13],
              ],
              remote,
            ),
          );
        paths[id] = (f) =>
          f.properties.TOWNCODE
            ? f.properties.TOWNNAME === "烏坵鄉"
              ? b(f)
              : a(f)
            : (a(main) || "") + (b(remote) || "");
      } else {
        const outer = ["望安鄉", "七美鄉"],
          main = fs.filter((f) => !outer.includes(f.properties.TOWNNAME)),
          a = ctx.d3.geoPath(
            ctx.d3.geoMercator().fitExtent(
              [
                [4, top + 22],
                [iw * 0.7, top + ih - 4],
              ],
              { type: "FeatureCollection", features: main },
            ),
          ),
          parts = outer.map((name, i) => {
            const f = fs.find((f) => f.properties.TOWNNAME === name);
            return {
              f,
              path: ctx.d3.geoPath(
                ctx.d3.geoMercator().fitExtent(
                  [
                    [iw * 0.78, top + 24 + (i * (ih - 26)) / 2],
                    [iw - 2, top + 24 + ((i + 1) * (ih - 26)) / 2 - 5],
                  ],
                  f,
                ),
              ),
            };
          });
        paths[id] = (f) =>
          f.properties.TOWNCODE
            ? parts.find((p) => ctx.geoKey(p.f) === ctx.geoKey(f))?.path(f) ||
              a(f)
            : main.map((f) => a(f)).join("") +
              parts.map((p) => p.path(p.f)).join("");
      }
    });
  }

  function drawSmallMultiples(
    target = null,
    dimensions = null,
    publication = false,
  ) {
    const host = dimensions || ctx.chartDimensions(),
      cw = host.width,
      ch = publication ? host.height : Math.max(host.height, 420),
      svg = (target || ctx.d3.select("#scatter")).attr(
        "viewBox",
        `0 0 ${cw} ${ch}`,
      );
    svg.selectAll("*").remove();
    if (!publication) ctx.altMode = "small";
    const national = ctx.records["00000/000"],
      scope =
        ctx.aggregateCurrentSelection() ||
        ctx.records[(ctx.state.county || "00000") + "/000"],
      cs = national.candidates.slice();
    if (ctx.smallMaps.reverse) cs.reverse();
    const panels = cs.map((c) => ({ name: c.name, party: c.party }));
    if (ctx.smallMaps.difference)
      panels.push({
        name: ctx.smallMaps.a + " − " + ctx.smallMaps.b,
        difference: true,
      });
    const header = publication ? 0 : ctx.chartToolsBottom() + 16,
      pw = cw / panels.length,
      top = header + 110,
      bottom = ch - 44,
      ph = Math.max(90, bottom - top),
      ids = ["09007", "09020", "10016"],
      fc = (features) => ({ type: "FeatureCollection", features }),
      main = ctx.state.county
        ? ctx.counties.filter(
            (f) => f.properties.COUNTYCODE === ctx.state.county,
          )
        : ctx.counties.filter((f) => !ids.includes(f.properties.COUNTYCODE)),
      features = (ctx.state.level === "town" ? ctx.towns : ctx.counties).filter(
        (f) =>
          !ctx.state.county || f.properties.COUNTYCODE === ctx.state.county,
      ),
      defs = svg.append("defs");
    const differenceScale = ctx.d3
        .scaleLinear()
        .domain([-50, 0, 50])
        .range(["#a55335", "#f6f6f4", "#326d85"])
        .clamp(true),
      relativeScale = ctx.d3
        .scaleLinear()
        .domain([-25, 0, 25])
        .range(["#b9773b", "#f8f9fa", "#366c74"])
        .clamp(true);
    const value = (r, p) =>
        !r || !r.total
          ? null
          : p.difference
            ? ctx.shareOf(r, ctx.smallMaps.a) - ctx.shareOf(r, ctx.smallMaps.b)
            : ctx.shareOf(r, p.name) -
              (ctx.relativeMaps ? ctx.shareOf(national, p.name) : 0),
      layers = [],
      readouts = [];
    function hover(key) {
      svg
        .selectAll(".small-geo")
        .classed("small-hover", (f) => ctx.geoKey(f) === key);
      for (let i = 0; i < panels.length; i++) {
        const r = ctx.records[key];
        readouts[i].text(
          r
            ? ctx.areaName(r, true) +
                "  " +
                value(r, panels[i]).toFixed(2) +
                (panels[i].difference || ctx.relativeMaps ? " pp" : "%")
            : publication
              ? "離島獨立比例 · 同尺度比較"
              : "離島分幅比例不同 · 三圖同步縮放",
        );
      }
    }
    panels.forEach((p, i) => {
      const x = i * pw,
        g = svg
          .append("g")
          .attr("class", "small-panel")
          .attr("data-candidate", p.name),
        clipId = (publication ? "publication-small-clip-" : "small-clip-") + i;
      if (i)
        g.append("line")
          .attr("x1", x)
          .attr("x2", x)
          .attr("y1", header + 8)
          .attr("y2", bottom + 25)
          .attr("stroke", "#dde5ee");
      g.append("text")
        .attr("x", x + pw / 2)
        .attr("y", header + 20)
        .attr("text-anchor", "middle")
        .attr("class", "small-name")
        .attr("fill", p.difference ? "#326d85" : ctx.color(p.party))
        .style("font-size", p.difference ? "15px" : null)
        .text(p.difference ? p.name : p.name + " · 全國 " + ctx.pct(ctx.shareOf(national, p.name)));
      g.append("text")
        .attr("x", x + pw / 2)
        .attr("y", header + 50)
        .attr("text-anchor", "middle")
        .attr("class", "small-percent")
        .style("font-size", "25px")
        .text(
          p.difference || ctx.relativeMaps
            ? value(scope || national, p).toFixed(2) + " pp"
            : ctx.pct(ctx.shareOf(scope || national, p.name)),
        );
      g.append("text")
        .attr("class", "small-scope-caption")
        .attr("x", x + pw / 2)
        .attr("y", header + 96)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "#536575")
        .text(
          p.difference
            ? "A − B 百分點差"
            : ctx.relativeMaps
              ? "範圍 − 全國基準"
              : ctx.state.brushed.length
                ? "範圍加權得票率"
                : ctx.state.county
                  ? "縣市得票率"
                  : "全國得票率",
        );
      const rampId =
          (publication ? "publication-small-ramp-" : "small-ramp-") + i,
        rampWidth = Math.min(100, pw * 0.3),
        ramp = defs.append("linearGradient").attr("id", rampId),
        rampColors = p.difference
          ? ["#a55335", "#f6f6f4", "#326d85"]
          : ctx.relativeMaps
            ? ["#b9773b", "#f8f9fa", "#366c74"]
            : ["#e8eef4", ctx.color(p.party)];
      rampColors.forEach((c, j) =>
        ramp
          .append("stop")
          .attr("offset", j / (rampColors.length - 1))
          .attr("stop-color", c),
      );
      g.append("rect")
        .attr("x", x + pw / 2 - rampWidth / 2)
        .attr("y", header + 59)
        .attr("width", rampWidth)
        .attr("height", 7)
        .attr("fill", "url(#" + rampId + ")");
      for (const [dx, text, anchor] of [
        [
          -rampWidth / 2 - 8,
          p.difference ? "≤−50 pp" : ctx.relativeMaps ? "−25 pp" : "0%",
          "end",
        ],
        [
          rampWidth / 2 + 8,
          p.difference ? "≥+50 pp" : ctx.relativeMaps ? "+25 pp" : "65%+",
          "start",
        ],
      ])
        g.append("text")
          .attr("x", x + pw / 2 + dx)
          .attr("y", header + 80)
          .attr("font-size", 12)
          .attr("fill", "#627581")
          .attr("text-anchor", anchor)
          .text(text);
      if (p.difference || ctx.relativeMaps)
        g.append("text")
          .attr("class", "small-zero-label")
          .attr("x", x + pw / 2)
          .attr("y", header + 80)
          .attr("text-anchor", "middle")
          .attr("font-size", 12)
          .attr("fill", "#536575")
          .text("0");
      defs
        .append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", pw - 12)
        .attr("height", ph);
      const viewport = g
          .append("g")
          .attr("transform", `translate(${x + 6},${top})`)
          .attr("clip-path", "url(#" + clipId + ")"),
        layer = viewport.append("g").attr("class", "small-map-layer");
      viewport
        .insert("rect", ":first-child")
        .attr("width", pw - 12)
        .attr("height", ph)
        .attr("fill", "transparent");
      layers.push(layer);
      const projection = ctx.d3.geoMercator().fitExtent(
          [
            [Math.min(90, pw * 0.24), 5],
            [pw - 20, ph - 8],
          ],
          fc(main),
        ),
        paths = {};
      main.forEach(
        (f) => (paths[f.properties.COUNTYCODE] = ctx.d3.geoPath(projection)),
      );
      if (!ctx.state.county) ctx.drawSmallIslands(layer, paths, pw, ph);
      layer
        .selectAll(".small-geo")
        .data(features)
        .join("path")
        .attr("class", "small-geo")
        .attr("data-region-key", ctx.geoKey)
        .attr("d", (f) => paths[f.properties.COUNTYCODE](f))
        .attr("fill", (f) => {
          const r = ctx.records[ctx.geoKey(f)];
          if (!r || !r.total) return "url(#scatter-missing)";
          const v = value(r, p);
          return p.difference
            ? differenceScale(v)
            : ctx.relativeMaps
              ? relativeScale(v)
              : ctx.d3.interpolateRgb(
                  "#e8eef4",
                  ctx.color(p.party),
                )(Math.min(v / 65, 1));
        })
        .attr("opacity", (f) =>
          ctx.state.brushed.length && !ctx.state.brushed.includes(ctx.geoKey(f))
            ? 0.12
            : 1,
        )
        .attr("stroke", (f) =>
          ctx.geoKey(f) === ctx.state.key ? "#172331" : "#fff",
        )
        .attr("stroke-width", (f) =>
          ctx.geoKey(f) === ctx.state.key ? 2 : 0.4,
        )
        .attr("vector-effect", "non-scaling-stroke")
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr(
          "aria-label",
          (f) =>
            ctx.areaName(ctx.records[ctx.geoKey(f)], true) +
            " " +
            p.name +
            " " +
            (value(ctx.records[ctx.geoKey(f)], p)?.toFixed(2) ?? "無資料") +
            (p.difference || ctx.relativeMaps ? "pp" : "%"),
        )
        .on("pointermove", (ev, f) => {
          hover(ctx.geoKey(f));
          ctx.chartTip(ev, ctx.records[ctx.geoKey(f)]);
        })
        .on("pointerleave", () => {
          hover(ctx.state.key || "");
          ctx.$("#map-tooltip").hidden = true;
        })
        .on("click", (_, f) => ctx.selectRegion(ctx.geoKey(f), false))
        .on("keydown", (ev, f) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ctx.selectRegion(ctx.geoKey(f), false);
          }
        });
      readouts.push(
        g
          .append("text")
          .attr("x", x + pw / 2)
          .attr("y", bottom + 21)
          .attr("text-anchor", "middle")
          .attr("class", "small-readout")
          .style("font-size", "12px"),
      );
      if (publication) {
        const [k, tx, ty] = ctx.smallMaps.camera;
        layer.attr(
          "transform",
          ctx.d3.zoomIdentity.translate(tx * (pw - 12), ty * ph).scale(k),
        );
        return;
      }
      const zoomer = ctx.d3
        .zoom()
        .scaleExtent([1, 12])
        .extent([
          [0, 0],
          [pw - 12, ph],
        ])
        .on("zoom", (ev) => {
          const t = ev.transform;
          ctx.smallMaps.camera = [t.k, t.x / (pw - 12), t.y / ph];
          for (const l of layers) l.attr("transform", t);
          svg.selectAll(".small-panel").each(function () {
            const target = ctx.d3.select(this).select(".small-zoom");
            if (!target.empty()) target.property("__zoom", t);
          });
          if (ev.sourceEvent) ctx.updateHash();
        });
      viewport.attr("class", "small-zoom").call(zoomer);
      const [k, tx, ty] = ctx.smallMaps.camera;
      viewport.call(
        zoomer.transform,
        ctx.d3.zoomIdentity.translate(tx * (pw - 12), ty * ph).scale(k),
      );
    });
    hover(ctx.state.key || "");
    if (publication) return;
    ctx.$("#legend").innerHTML =
      (ctx.relativeMaps
        ? '<div class="legend-title">共同色階 · 地區 − 全國得票率 · ±25 個百分點</div>'
        : '<div class="legend-title">共同色階 · 各地候選人得票率 · 0–65%+</div>') +
      (ctx.smallMaps.difference
        ? '<div class="small-diff-ramp"><span>B 較高 ≤−50</span><i></i><span>≥+50 A 較高（百分點）</span></div>'
        : "");
    ctx.$("#view-description").textContent =
      "同步縮放、平移與讀數 · " +
      (ctx.smallMaps.difference ? "含 A−B 百分點差值" : "同投影、共同色階");
    ctx.$("#chart-coordinate").textContent = "SMALL MULTIPLES / SHARED CAMERA";
  }
}
