/** Explicit module installer; dependencies are supplied by the application context. */
import { describeScope } from "../data/scope.js";
import { zipFiles } from "../core/zip.js";
import { drawPublicationBubbles } from "../charts/publication-bubbles.js";
import { applyPartySymbols } from "../charts/party-symbols.js";
import { geographyEvidence } from "../data/geography-evidence.js";
import { withDayPalette } from "../ui/theme.js";

export function install(ctx) {
  Object.assign(ctx, {
    exportPanelClone,
    shareSummary,
    publicationGraphic,
    exportedSVG: (...args) => withDayPalette(() => exportedSVG(...args)),
    saveBlob,
    standaloneSVGPanel: (...args) => withDayPalette(() => standaloneSVGPanel(...args)),
    updatePublication,
    downloadPNG,
  });
  ctx
    .$(".app-header nav")
    .insertAdjacentHTML(
      "beforeend",
      '<button id="copy-link">複製分析連結</button><select id="image-export" aria-label="圖像匯出"><option value="">圖像匯出</option><option value="svg">SVG向量圖</option><option value="png">PNG高解析圖</option><option value="svg-map">SVG · 地圖</option><option value="svg-chart">SVG · 統計圖</option><option value="png-map">PNG · 地圖</option><option value="png-chart">PNG · 統計圖</option><option value="publication">出版版式與預覽…</option></select>',
    );
  ctx.$("#copy-link").onclick = async () => {
    ctx.updateHash();
    const summary = shareSummary();
    try {
      await navigator.clipboard.writeText(location.href);
      ctx.toast("已複製：" + summary);
    } catch {
      ctx.toast("請從網址列複製連結 · " + summary);
    }
  };
  function shareSummary() {
    const election = ctx.$("#election").selectedOptions[0]?.textContent?.trim() || "選舉分析";
    const chart = ctx.$(`[data-chart="${ctx.state.chart}"]`)?.textContent?.trim() || ctx.state.chart;
    const metric = ctx.$(`#metric-mode option[value="${ctx.state.metric}"]`)?.textContent?.trim() || ctx.state.metric;
    const scope = describeScope(ctx),
      highlight = scope.highlighted === null ? "" : ` · 高亮 ${scope.highlighted}`;
    return `${election} · ${scope.area} · ${metric} · ${chart} · ${scope.kind} ${scope.count}／${scope.total}${highlight}`;
  }
  function exportPanelClone(source) {
    const copy = source.cloneNode(true),
      src = [source, ...source.querySelectorAll("*")],
      dest = [copy, ...copy.querySelectorAll("*")];
    src.forEach((el, i) => {
      const cs = getComputedStyle(el);
      for (const name of [
        "fill",
        "fill-opacity",
        "stroke",
        "stroke-width",
        "stroke-opacity",
        "stroke-linejoin",
        "stroke-dasharray",
        "vector-effect",
        "font-family",
        "font-size",
        "font-weight",
        "letter-spacing",
        "text-anchor",
        "opacity",
        "paint-order",
        "display",
        "visibility",
        "filter",
      ])
        dest[i].style.setProperty(
          name,
          cs
            .getPropertyValue(name)
            .replace(/url\(["']?[^#]*#([^"')]+)["']?\)/g, "url(#$1)"),
        );
    });
    copy.style.display = "block";
    copy.style.opacity = "1";
    copy.removeAttribute("hidden");
    copy.setAttribute("role", "img");
    copy.removeAttribute("aria-description");
    for (const element of copy.querySelectorAll("[tabindex],[role=button]")) {
      element.removeAttribute("tabindex");
      if (element.getAttribute("role") === "button")
        element.removeAttribute("role");
    }
    return copy;
  }
  function publicationGraphic(panel, width, height) {
    if (
      !(
        panel.map &&
        !ctx.isLeg() &&
        !ctx.state.county &&
        !ctx.state.key &&
        ctx.transform.k === 1
      ) &&
      !(ctx.state.chart === "ternary" && !panel.map) &&
      !(ctx.state.chart === "hex" && !panel.map) &&
      !(ctx.state.chart === "bubble" && !panel.map) &&
      !(ctx.state.chart === "small" && !ctx.isLeg() && !panel.map) &&
      !(
        ctx.state.chart === "scatter" &&
        ctx.state.distribution === "scatter" &&
        !panel.map
      )
    )
      return null;
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:fixed;left:-20000px;top:0;opacity:0;pointer-events:none";
    document.body.append(wrapper);
    const svg = ctx.d3
        .select(wrapper)
        .append("svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`),
      legend = panel.legend.cloneNode(true);
    legend.removeAttribute("id");
    wrapper.append(legend);
    if (!panel.map && ctx.state.chart !== "ternary") {
      if (ctx.state.chart === "hex") ctx.drawPublicationHex(svg, width, height);
      else if (ctx.state.chart === "bubble") drawPublicationBubbles(ctx, svg, legend, width, height);
      else if (ctx.state.chart === "small")
        ctx.drawSmallMultiples(svg, { width, height }, true);
      else ctx.drawStatScatter(svg, { width, height }, true);
      for (const node of svg.node().querySelectorAll("[data-region-key]")) {
        const key = node.dataset.regionKey;
        node.classList.toggle("group-a", ctx.groupSelection.a.includes(key));
        node.classList.toggle("group-b", ctx.groupSelection.b.includes(key));
        node.classList.toggle(
          "condition-highlight",
          ctx.hasConditions() &&
            ctx.filterSpec.mode === "highlight" &&
            ctx.conditionHighlight.includes(key),
        );
        node.classList.toggle(
          "condition-muted",
          ctx.hasConditions() &&
            ctx.filterSpec.mode === "highlight" &&
            !ctx.conditionHighlight.includes(key),
        );
      }
      applyPartySymbols(ctx, svg.node(), false);
      return { wrapper, source: svg.node(), legend };
    }
    if (!panel.map) {
      ctx.drawTernary(svg, { width, height }, true);
      if (ctx.chartOptions.densityMode === "contour") {
        const nodes = svg.selectAll(".ternary-dot").data(),
          density = ctx.d3
            .contourDensity()
            .x((d) => d.x)
            .y((d) => d.y)
            .size([Math.ceil(width), Math.ceil(height)])
            .weight((d) =>
              ctx.chartOptions.densityWeight === "votes" ? d.r.total : 1,
            )
            .bandwidth(15)
            .thresholds(5)(nodes);
        svg
          .select(".ternary-content")
          .insert("g", ".ternary-dot")
          .attr("class", "density-layer")
          .selectAll("path")
          .data(density)
          .join("path")
          .attr("d", ctx.d3.geoPath())
          .attr("fill", "#687787")
          .attr("fill-opacity", 0.07)
          .attr("stroke", "#687787")
          .attr("stroke-opacity", 0.2);
      }
      ctx.decorateTernaryMarks(svg, legend);
      svg
        .selectAll("[data-region-key]")
        .classed("group-a", (d) => ctx.groupSelection.a.includes(d.key))
        .classed("group-b", (d) => ctx.groupSelection.b.includes(d.key))
        .classed(
          "condition-highlight",
          (d) =>
            ctx.hasConditions() &&
            ctx.filterSpec.mode === "highlight" &&
            ctx.conditionHighlight.includes(d.key),
        )
        .classed(
          "condition-muted",
          (d) =>
            ctx.hasConditions() &&
            ctx.filterSpec.mode === "highlight" &&
            !ctx.conditionHighlight.includes(d.key),
        );
      if (ctx.chartOptions.densityMode !== "hexbin") {
        const palette = ctx.countyColorScale(),
          entries =
            ctx.chartOptions.ternaryColor === "county"
              ? Object.entries(ctx.data.counties).map(([key, name]) => ({
                  name,
                  fill: palette(key),
                }))
              : ctx.records["00000/000"].candidates.map((c) => ({
                  name: c.name,
                  fill: ctx.color(c.party),
                }));
        legend.insertAdjacentHTML(
          "beforeend",
          '<div class="legend-parties">' +
            entries
              .map(
                (d) =>
                  '<span><i style="background:' +
                  d.fill +
                  '"></i>' +
                  ctx.esc(d.name) +
                  "</span>",
              )
              .join("") +
            "</div>",
        );
      }
      const foot = legend.querySelector(".legend-foot");
      if (foot)
        foot.textContent = foot.textContent.replace(
          /局部顯示 \d+ 個/,
          "局部顯示 " + svg.attr("data-visible-count") + " 個",
        );
      applyPartySymbols(ctx, svg.node(), false);
      return { wrapper, source: svg.node(), legend };
    }
    const ids = ["09007", "09020", "10016"],
      main = (ctx.publicationCounties||ctx.counties).filter((f) => !ids.includes(f.properties.COUNTYCODE)),
      iw = Math.min(180, width * 0.27),
      ih = Math.min(150, (height - 80) / 3),
      start = (height - (ih * 3 + 36)) / 2,
      projection = ctx.d3.geoMercator().fitExtent(
        [
          [iw + 30, 16],
          [width - 16, height - 20],
        ],
        { type: "FeatureCollection", features: main },
      ),
      path = ctx.d3.geoPath(projection),
      paths = {};
    main.forEach((f) => (paths[f.properties.COUNTYCODE] = path));
    ids.forEach((id, i) => {
      const f = (ctx.publicationCounties||ctx.counties).find((f) => f.properties.COUNTYCODE === id),
        y = start + i * (ih + 18),
        r = ctx.records[id + "/000"],
        c = r.candidates[0];
      paths[id] = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [12, y + 28],
            [iw - 12, y + ih - 22],
          ],
          f,
        ),
      );
      svg
        .append("line")
        .attr("x1", 0)
        .attr("x2", iw)
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", "#cad6dd");
      svg
        .append("text")
        .attr("x", 4)
        .attr("y", y + 18)
        .attr("font-size", 12)
        .attr("fill", "#526575")
        .text(f.properties.COUNTYNAME + " · 分幅");
      svg
        .append("text")
        .attr("x", 4)
        .attr("y", y + ih - 3)
        .attr("font-size", 12)
        .attr("fill", "#526575")
        .text(c.name + " " + ctx.pct((c.votes / r.total) * 100));
    });
    // Separate the remote Wuqiu, Matsu townships and Penghu outer islands at publication size.
    const kin = (ctx.publicationCounties||ctx.counties).find((f) => f.properties.COUNTYCODE === "09020"),
      ky = start + ih + 18,
      split = (f, remote) => ({
        ...f,
        geometry: {
          type: "MultiPolygon",
          coordinates: (f.geometry.type === "MultiPolygon"
            ? f.geometry.coordinates
            : [f.geometry.coordinates]
          ).filter((p) => p[0][0][0] > 119 === remote),
        },
      }),
      kinMain = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [9, ky + 28],
            [iw * 0.72, ky + ih - 25],
          ],
          split(kin, false),
        ),
      ),
      kinRemote = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [iw * 0.8, ky + 30],
            [iw - 7, ky + ih - 25],
          ],
          split(kin, true),
        ),
      );
    paths["09020"] = (f) =>
      f.properties.TOWNNAME === "烏坵鄉"
        ? kinRemote(f)
        : f.properties.TOWNNAME
          ? kinMain(f)
          : (kinMain(split(f, false)) || "") +
            (kinRemote(split(f, true)) || "");
    svg
      .append("text")
      .attr("x", iw * 0.77)
      .attr("y", ky + ih - 18)
      .attr("font-size", 12)
      .attr("fill", "#526575")
      .text("烏坵");
    const matsu = (ctx.publicationTowns||ctx.towns).filter((f) => f.properties.COUNTYCODE === "09007"),
      mp = {};
    matsu.forEach((f, i) => {
      const x = 8 + (i * iw) / 4;
      mp[ctx.geoKey(f)] = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [x, start + 30],
            [x + iw / 4 - 10, start + ih - 26],
          ],
          f,
        ),
      );
    });
    paths["09007"] = (f) =>
      f.properties.TOWNCODE
        ? mp[ctx.geoKey(f)](f)
        : matsu.map((t) => mp[ctx.geoKey(t)](t)).join("");
    const penghu = (ctx.publicationTowns||ctx.towns).filter((f) => f.properties.COUNTYCODE === "10016"),
      py = start + 2 * (ih + 18),
      remoteNames = ["望安鄉", "七美鄉"],
      phMain = penghu.filter(
        (f) => !remoteNames.includes(f.properties.TOWNNAME),
      ),
      phPath = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [9, py + 28],
            [iw * 0.7, py + ih - 22],
          ],
          { type: "FeatureCollection", features: phMain },
        ),
      ),
      pp = {};
    phMain.forEach((f) => (pp[ctx.geoKey(f)] = phPath));
    remoteNames.forEach((name, i) => {
      const f = penghu.find((t) => t.properties.TOWNNAME === name);
      pp[ctx.geoKey(f)] = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [iw * 0.77, py + 28 + (i * (ih - 50)) / 2],
            [iw - 9, py + 28 + ((i + 1) * (ih - 50)) / 2 - 8],
          ],
          f,
        ),
      );
    });
    paths["10016"] = (f) =>
      f.properties.TOWNCODE
        ? pp[ctx.geoKey(f)](f)
        : penghu.map((t) => pp[ctx.geoKey(t)](t)).join("");
    const features = ctx.state.level === "town" ? (ctx.publicationTowns||ctx.towns) : (ctx.publicationCounties||ctx.counties);
    svg
      .append("g")
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("d", (f) => paths[f.properties.COUNTYCODE](f))
      .attr("fill", (f) => ctx.fill(ctx.records[ctx.geoKey(f)], ctx.geoKey(f)))
      .attr("fill-opacity", ctx.geoOpacity)
      .attr("stroke", "#fff")
      .attr("stroke-width", ctx.state.level === "town" ? 0.4 : 1)
      .classed("group-a", (f) => ctx.groupSelection.a.includes(ctx.geoKey(f)))
      .classed("group-b", (f) => ctx.groupSelection.b.includes(ctx.geoKey(f)))
      .classed(
        "condition-highlight",
        (f) =>
          ctx.hasConditions() &&
          ctx.filterSpec.mode === "highlight" &&
          ctx.conditionHighlight.includes(ctx.geoKey(f)),
      )
      .classed(
        "condition-muted",
        (f) =>
          ctx.hasConditions() &&
          ctx.filterSpec.mode === "highlight" &&
          !ctx.conditionHighlight.includes(ctx.geoKey(f)),
      );
    svg
      .append("g")
      .selectAll("path")
      .data(main)
      .join("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.2);
    if (ctx.state.labels) {
      const occupied = [];
      for (const f of main) {
        const [cx, cy] = path.centroid(f),
          text = svg
            .append("text")
            .attr("x", cx)
            .attr("y", cy)
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("font-family", "Microsoft JhengHei, sans-serif")
            .attr("font-weight", 600)
            .attr("fill", "#354957")
            .attr("paint-order", "stroke")
            .attr("stroke", "#fff")
            .attr("stroke-width", 3)
            .text(f.properties.COUNTYNAME),
          bw = text.node().getComputedTextLength() + 8;
        let visible = false;
        for (const dy of [0, -18, 18, -32, 32]) {
          const box = [cx - bw / 2, cy + dy - 12, cx + bw / 2, cy + dy + 4];
          if (
            box[0] < iw + 10 ||
            box[2] > width - 10 ||
            box[1] < 12 ||
            box[3] > height - 16 ||
            occupied.some(
              (b) =>
                box[0] < b[2] &&
                box[2] > b[0] &&
                box[1] < b[3] &&
                box[3] > b[1],
            )
          )
            continue;
          text.attr("y", cy + dy);
          occupied.push(box);
          visible = true;
          break;
        }
        if (!visible) text.remove();
      }
    }
    const a = projection.invert([width - 140, height - 22]),
      b = projection.invert([width - 40, height - 22]),
      distance = ctx.d3.geoDistance(a, b) * 6371,
      magnitude = 10 ** Math.floor(Math.log10(distance)),
      nice =
        [5, 2, 1].map((v) => v * magnitude).find((v) => v <= distance) ||
        magnitude / 2,
      length = (100 * nice) / distance;
    svg
      .append("path")
      .attr("d", `M${width - 140},${height - 18}v5h${length}v-5`)
      .attr("fill", "none")
      .attr("stroke", "#526575");
    svg
      .append("text")
      .attr("x", width - 140)
      .attr("y", height - 25)
      .attr("fill", "#526575")
      .attr("font-size", 12)
      .text("本島 " + nice + " km");
    if (ctx.mapEncoding === "symbols") {
      const rows = features.map((f) => ({ f, key: ctx.geoKey(f), r: ctx.records[ctx.geoKey(f)] })).filter((d) => ctx.valid(d.r)),
        radius = ctx.d3.scaleSqrt().domain([0, ctx.d3.max(rows, (d) => d.r.total) || 1]).range([0, 30]);
      const anchor = (d) => {
        const p = paths[d.f.properties.COUNTYCODE];
        if (p.centroid) return p.centroid(d.f);
        const shape = svg.selectAll("path").filter((f) => f === d.f).node(), box = shape.getBBox();
        return [box.x + box.width / 2, box.y + box.height / 2];
      };
      svg.append("g").attr("class", "publication-vote-symbols").selectAll("circle").data(rows.sort((a, b) => b.r.total - a.r.total)).join("circle")
        .attr("cx", (d) => anchor(d)[0]).attr("cy", (d) => anchor(d)[1]).attr("r", (d) => radius(d.r.total))
        .attr("fill", (d) => ctx.color(d.r.candidates[0].party)).attr("fill-opacity", .70);
    }
    return { wrapper, source: svg.node(), legend };
  }
  function exportedSVG(part = "current", format = null) {
    const combined = ctx.dualMode && part === "current",
      mapOnly = part === "map" || (!ctx.dualMode && ctx.state.chart === "map"),
      panels = combined
        ? [
            {
              source: ctx.$("#map"),
              legend: ctx.$("#dual-map-legend"),
              map: true,
            },
            { source: ctx.$("#scatter"), legend: ctx.$("#legend"), map: false },
          ]
        : [
            {
              source: mapOnly ? ctx.$("#map") : ctx.$("#scatter"),
              legend:
                mapOnly && ctx.dualMode
                  ? ctx.$("#dual-map-legend")
                  : ctx.$("#legend"),
              map: mapOnly,
            },
          ],
      nativeWidth = ctx.d3.sum(panels, (p) =>
        Number(p.source.getAttribute("viewBox").split(" ")[2]),
      ),
      width = format?.width || Math.max(800, nativeWidth),
      height =
        format?.height ||
        Math.max(
          850,
          Number(panels[0].source.getAttribute("viewBox").split(" ")[3]) + 310,
        ),
      ns = "http://www.w3.org/2000/svg",
      root = document.createElementNS(ns, "svg");
    root.setAttribute("xmlns", ns);
    root.setAttribute("width", width);
    root.setAttribute("height", height);
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    root.setAttribute("data-analysis-state", ctx.routeString());
    root.setAttribute("data-source-version", ctx.dataVersionLabel());
    root.setAttribute("data-application-version", ctx.applicationVersion);
    root.setAttribute(
      "data-publication-profile",
      format?.profile || "research",
    );
    function add(tag, attrs = {}, parent = root) {
      const node = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      parent.append(node);
      return node;
    }
    add("rect", { width: "100%", height: "100%", fill: "#fff" });
    const defs = add("defs");
    function textAt(text, x, y, size = 14, fill = "#172331", parent = root) {
      const node = add(
        "text",
        {
          x,
          y,
          "font-family": "Microsoft JhengHei, PingFang TC, Noto Sans TC, sans-serif",
          "font-size": size,
          fill,
        },
        parent,
      );
      node.textContent = text;
      return node;
    }
    const canvas = document.createElement("canvas"),
      paint = canvas.getContext("2d");
    function lines(text, max, size) {
      paint.font = size + "px Microsoft JhengHei, sans-serif";
      const result = [];
      let line = "";
      for (const c of String(text).replace(/\s+/g, " ")) {
        if (line && paint.measureText(line + c).width > max) {
          result.push(line);
          line = c;
        } else line += c;
      }
      if (line) result.push(line);
      return result;
    }
    function wrapped(text, x, y, max, size = 13, color = "#526575") {
      const ls = lines(text, max, size);
      ls.forEach((line, i) => textAt(line, x, y + i * (size + 5), size, color));
      return ls.length * (size + 5);
    }
    const profile = format?.profile || "research",
      titleSize = profile === "social" ? 36 : 25;
    const fullHouse =
        ctx.isLeg() && ctx.state.chart === "small" && ctx.fullParliament,
      viewName = {
        map: "地理分布",
        hex: "等單位結果",
        bubble: "有效票規模",
        ternary: "三方競爭結構",
        small: ctx.isLeg() ? "議席結構" : "候選人得票率比較",
        scatter: {
          swarm: "競爭差距分布",
          scatter: "地區統計關聯",
          histogram: "得票率分布",
        ecdf: "地區累積分布",
          box: "縣市內部差異",
          dumbbell: "候選人比較",
        }[ctx.state.distribution],
      }[ctx.state.chart];
    wrapped(
      "臺灣選舉觀測 · 2024 " +
        (fullHouse ? "完整立法院當選席次" : ctx.CFG[ctx.state.e].title),
      32,
      38,
      width - 64,
      titleSize,
      "#172331",
    );
    wrapped(
      ctx.$("#scope-summary").textContent + " · " + viewName,
      32,
      66,
      width - 64,
      14,
    );
    const conditions = ctx.hasConditions()
      ? [
          ctx.filterSpec.share !== ""
            ? ctx.filterSpec.candidate + " ≥" + ctx.filterSpec.share + "%"
            : "",
          ctx.filterSpec.turnout !== ""
            ? "投票率 ≥" + ctx.filterSpec.turnout + "%"
            : "",
          ctx.filterSpec.margin !== ""
            ? "差距 ≤" + ctx.filterSpec.margin + "pp"
            : "",
        ]
          .filter(Boolean)
          .join(ctx.filterSpec.logic === "or" ? " 或 " : " 且 ") +
        "（" +
        ({
          replace: "篩選",
          intersection: "與基底取交集",
          union: "與基底取聯集",
          highlight: "僅高亮，未改變統計範圍",
        }[ctx.filterSpec.mode] || "篩選") +
        "）"
      : "";
    const groupNote =
      ctx.groupSelection.a.length || ctx.groupSelection.b.length
        ? (ctx.groupNames?.a || "A組") + " " +
          ctx.groupSelection.a.length +
          " 地區" +
          (ctx.groupSelection.a.length <= 3
            ? "：" +
              ctx.groupSelection.a
                .map((k) => ctx.areaName(ctx.records[k], true))
                .join("、")
            : "") +
          "（橙線）；" + (ctx.groupNames?.b || "B組") + " " +
          ctx.groupSelection.b.length +
          " 地區" +
          (ctx.groupSelection.b.length <= 3
            ? "：" +
              ctx.groupSelection.b
                .map((k) => ctx.areaName(ctx.records[k], true))
                .join("、")
            : "") +
          "（紫色虛線）"
        : "";
    const finding =
      profile === "research" ? "" : ctx.$("#finding").textContent.trim();
    const annotation = [finding, conditions, groupNote]
        .filter(Boolean)
        .join("；"),
      headerExtra = annotation
        ? wrapped(annotation, 32, 88, width - 64, 12) + 10
        : 0;
    const metadata = add("metadata");
    metadata.textContent = JSON.stringify({
      profile,
      election: ctx.state.e,
      scope: ctx.$("#scope-summary").textContent,
      route: ctx.routeString(),
      sourceVersion: ctx.dataVersionLabel(),
      applicationVersion: ctx.applicationVersion,
      boundaryVersion: ctx.siteMetadata?.boundary_version,
      geometryEvidence: geographyEvidence(ctx.isLeg() ? "district" : "administrative", ctx.siteMetadata),
      mapEncoding: ctx.mapEncoding,
      colorMode: ctx.colorMode,
      datasetRegistry: "dataset-registry.json",
      comparability:
        "Only verified A/B units; no inferred historical town or village crosswalk",
    });
    const margin = 28,
      gap = 24,
      usable = width - margin * 2 - gap * (panels.length - 1),
      ratios = panels.map(
        (p) =>
          Number(p.source.getAttribute("viewBox").split(" ")[2]) / nativeWidth,
      );
    let offset = margin;
    panels.forEach((panel, index) => {
      const pw = usable * ratios[index],
        px = offset;
      offset += pw + gap;
      let legend = panel.legend;
      let bivariate = legend.querySelector(".bivariate-matrix"),
        bubble = legend.querySelector(".bubble-scale"),
        baseLegendHeight = bivariate
          ? 220
          : bubble
            ? 180
            : !panel.map &&
                ((ctx.state.chart === "ternary" &&
                  ctx.chartOptions.ternaryColor === "county") ||
                  (ctx.state.chart === "scatter" &&
                    ctx.axes.color === "county"))
              ? 240
              : 160,
        legendHeight = baseLegendHeight + (ctx.colorMode === "accessible" ? 36 : 0),
        graphTop = 112 + headerExtra,
        legendTop = height - legendHeight - 72,
        graphHeight = Math.max(90, legendTop - graphTop - 15),
        graphic = ctx.publicationGraphic(panel, pw, graphHeight),
        source = graphic?.source || panel.source;
      legend = graphic?.legend || legend;
      bivariate = legend.querySelector(".bivariate-matrix");
      bubble = legend.querySelector(".bubble-scale");
      let box = source.getAttribute("viewBox").split(" ").map(Number),
        crop = graphic
          ? 0
          : panel.map
            ? 0
            : ctx.state.chart === "ternary"
              ? Math.min(175, box[3] / 3)
              : ctx.state.chart === "small"
                ? ctx.isLeg()
                  ? 100
                  : 180
                : ctx.state.chart === "scatter"
                  ? 170
                  : 175;
      if (!graphic && !panel.map) {
        const bounds = source.getBBox();
        if (bounds.width > 0 && bounds.height > 0) {
          box = [
            bounds.x - 16,
            bounds.y - 20,
            bounds.width + 32,
            bounds.height + 40,
          ];
          crop = 0;
        }
      }
      const copy = ctx.exportPanelClone(source);
      textAt(panel.map ? "地理分布" : viewName, px, 96 + headerExtra, 14);
      copy.setAttribute(
        "viewBox",
        `${box[0]} ${box[1] + crop} ${box[2]} ${Math.max(1, box[3] - crop)}`,
      );
      copy.setAttribute("x", px);
      copy.setAttribute("y", graphTop);
      copy.setAttribute("width", pw);
      copy.setAttribute("height", graphHeight);
      copy.setAttribute("preserveAspectRatio", "xMidYMid meet");
      root.append(copy);
      add("line", {
        x1: px,
        x2: px + pw,
        y1: legendTop - 10,
        y2: legendTop - 10,
        stroke: "#dce3e7",
      });
      let y = legendTop + 8;
      y += wrapped(
        legend.querySelector(".legend-title")?.textContent || "圖例",
        px,
        y,
        pw,
        14,
        "#172331",
      );
      const ramp = [...legend.querySelectorAll(".legend-ramp>i")],
        ticks = [...legend.querySelectorAll(".legend-ticks>*")];
      if (ramp.length) {
        const rw = Math.min(320, pw - 12);
        ramp.forEach((el, i) =>
          add("rect", {
            x: px + (i * rw) / ramp.length,
            y,
            width: rw / ramp.length + 0.5,
            height: 10,
            fill: getComputedStyle(el).backgroundColor,
          }),
        );
        y += 26;
        const tickText = ticks.map((el) => el.textContent);
        textAt(tickText[0] || "", px, y, 12);
        if (tickText.length > 2) {
          const middle = textAt(
            tickText[Math.floor(tickText.length / 2)],
            px + rw / 2,
            y,
            12,
          );
          middle.setAttribute("text-anchor", "middle");
        }
        const last = textAt(tickText.at(-1) || "", px + rw, y, 12);
        last.setAttribute("text-anchor", "end");
        y += 22;
      }
      const parties = [...legend.querySelectorAll(".legend-parties span")];
      let lx = px;
      for (let i = 0; i < parties.length; i++) {
        const el = parties[i],
          name = el.textContent.trim(),
          itemWidth = Math.max(90, name.length * 14 + 27);
        if (lx + itemWidth > px + pw && lx > px) {
          lx = px;
          y += 24;
        }
        const icon = el.querySelector("i"),
          cs = icon ? getComputedStyle(icon) : null,
          colors = cs?.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi);
        let fill = cs?.backgroundColor || "#687787";
        if (colors?.length) {
          const id = "publication-ramp-" + index + "-" + i,
            gradient = add("linearGradient", { id }, defs);
          colors.forEach((c, j) =>
            add(
              "stop",
              { offset: j / (colors.length - 1), "stop-color": c },
              gradient,
            ),
          );
          fill = "url(#" + id + ")";
        }
        add("rect", {
          x: lx,
          y: y - 10,
          width: colors?.length ? 30 : 10,
          height: 10,
          fill,
        });
        textAt(name, lx + (colors?.length ? 37 : 17), y, 12);
        lx += itemWidth;
      }
      if (parties.length) y += 22;
      if (bivariate) {
        const cells = [...bivariate.querySelectorAll("i")];
        cells.forEach((cell, i) =>
          add("rect", {
            x: px + 26 + (i % 3) * 24,
            y: y + Math.floor(i / 3) * 24,
            width: 23,
            height: 23,
            fill: getComputedStyle(cell).backgroundColor,
          }),
        );
        textAt("高", px + 6, y + 12, 11);
        textAt("低", px + 6, y + 69, 11);
        textAt("得票率 低 → 高", px + 25, y + 89, 11);
        textAt("投票率", px + 110, y + 40, 11);
        y += 108;
      }
      if (bubble) {
        const copy = ctx.exportPanelClone(bubble),
          bw = Number(bubble.getAttribute("viewBox").split(" ")[2]),
          bh = Number(bubble.getAttribute("height")),
          scale = Math.min(
            pw / box[2],
            graphHeight / Math.max(1, box[3] - crop),
          );
        copy.setAttribute("x", px);
        copy.setAttribute("y", y);
        copy.setAttribute("width", bw * scale);
        copy.setAttribute("height", bh * scale);
        root.append(copy);
        y += bh * scale + 10;
      }
      if (!panel.map && ctx.state.chart === "small" && !ctx.isLeg()) {
        if (ctx.relativeMaps) {
          const gradient = add(
            "linearGradient",
            { id: "small-relative-publication" },
            defs,
          );
          ["#b9773b", "#f8f9fa", "#366c74"].forEach((c, i) =>
            add("stop", { offset: i / 2, "stop-color": c }, gradient),
          );
          add("rect", {
            x: px,
            y,
            width: 180,
            height: 8,
            fill: "url(#small-relative-publication)",
          });
          y += 25;
          textAt("−25 pp       全國平均       +25 pp", px, y, 12);
          y += 22;
        } else
          for (const c of ctx.records["00000/000"].candidates) {
            const gradient = add(
              "linearGradient",
              { id: "small-absolute-" + c.number },
              defs,
            );
            add("stop", { offset: 0, "stop-color": "#e8eef4" }, gradient);
            add(
              "stop",
              { offset: 1, "stop-color": ctx.color(c.party) },
              gradient,
            );
            add("rect", {
              x: px,
              y: y - 10,
              width: 90,
              height: 8,
              fill: "url(#small-absolute-" + c.number + ")",
            });
            textAt(c.name + "  0–65%+", px + 102, y, 12);
            y += 20;
          }
        if (ctx.smallMaps.difference) {
          textAt(
            "差值：" +
              ctx.smallMaps.a +
              " − " +
              ctx.smallMaps.b +
              "；棕色負、藍色正，色階±50pp（端點含超出值）。",
            px,
            y,
            11,
          );
          y += 18;
        }
      }
      const densityKey=legend.querySelector('.density-key');
      if(densityKey){y+=wrapped(densityKey.textContent+'（相對平滑密度，不是區域支持率）',px,y+4,pw,12);}
      const foot = [legend.querySelector(".legend-foot")?.textContent, legend.querySelector(".party-symbol-key")?.textContent,
        legend.querySelector(".map-overlay-key")?.textContent].filter(Boolean).join("；");
      if (foot) wrapped(foot, px, y + 4, pw, 12);
      graphic?.wrapper.remove();
      if (panels.length === 2 && index === 0)
        add("line", {
          x1: px + pw + gap / 2,
          x2: px + pw + gap / 2,
          y1: 88,
          y2: height - 74,
          stroke: "#dce3e7",
        });
    });
    wrapped(
      "來源：中央選舉委員會 · 2024最終選舉結果" +
        (fullHouse ? "（非現任名單）" : ""),
      32,
      height - 49,
      width - 64,
      12,
    );
    wrapped(
      "資料版本：" +
        ctx.dataVersionDate() +
        " · " +
        (ctx.isLeg()
          ? "區域圖為2024村里歸屬合併1120928圖資，非測量界線。"
          : "行政定位：Taiwan Atlas；離島分幅比例不同。地區統計不推論個人行為。"),
      32,
      height - 27,
      width - 64,
      11,
    );
    return new XMLSerializer().serializeToString(root);
  }
  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function standaloneSVGPanel(svg, title, subtitle, options = {}) {
    const box = svg.getAttribute("viewBox").split(" ").map(Number),
      width = Math.max(800, box[2]),
      graphHeight = (box[3] * (width - 48)) / box[2],
      ns = "http://www.w3.org/2000/svg",
      root = document.createElementNS(ns, "svg"),
      copy = ctx.exportPanelClone(svg),
      measure = document.createElement("canvas").getContext("2d");
    options.cleanCopy?.(copy);
    root.setAttribute("xmlns", ns);
    root.setAttribute("data-source-version", ctx.dataVersionLabel());
    if (options.metadata) {
      const metadata = document.createElementNS(ns, "metadata");
      metadata.textContent = JSON.stringify(options.metadata);
      root.append(metadata);
    }
    function add(tag, attrs = {}, text) {
      const node = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      if (text != null) node.textContent = text;
      root.append(node);
      return node;
    }
    function lines(text, size) {
      measure.font = size + 'px "Microsoft JhengHei",sans-serif';
      const result = [];
      let line = "";
      for (const char of text) {
        if (measure.measureText(line + char).width > width - 48 && line) {
          result.push(line);
          line = char;
        } else line += char;
      }
      if (line) result.push(line);
      return result;
    }
    function label(text, y, size = 12) {
      for (const line of lines(text, size)) {
        add(
          "text",
          {
            x: 24,
            y,
            "font-family": "Microsoft JhengHei, Noto Sans TC, sans-serif",
            "font-size": size,
            fill: "#172331",
          },
          line,
        );
        y += size * 1.6;
      }
      return y;
    }
    const background = add("rect", {
      width: "100%",
      height: "100%",
      fill: "#fff",
    });
    let y = label(title, 32, 21);
    y = label(subtitle, y + 4, 12) + 10;
    for (const row of options.legend || []) {
      if (row.ramp) {
        add(
          "text",
          {
            x: 24,
            y,
            "font-family": "Microsoft JhengHei, sans-serif",
            "font-size": 12,
            fill: "#172331",
          },
          row.label,
        );
        const rx = 240,
          rw = Math.min(300, width - 310);
        row.ramp.forEach((color, i) =>
          add("rect", {
            x: rx + (rw * i) / row.ramp.length,
            y: y - 12,
            width: rw / row.ramp.length + 0.5,
            height: 10,
            fill: color,
          }),
        );
        (row.ticks || []).forEach((tick, i) =>
          add(
            "text",
            {
              x: rx + (rw * i) / (row.ticks.length - 1 || 1),
              y: y + 14,
              "font-family": "Microsoft JhengHei, sans-serif",
              "font-size": 12,
              fill: "#172331",
              "text-anchor":
                i === 0
                  ? "start"
                  : i === row.ticks.length - 1
                    ? "end"
                    : "middle",
            },
            tick,
          ),
        );
        y += 38;
      } else {
        add("rect", {
          x: 24,
          y: y - 10,
          width: 10,
          height: 10,
          fill: row.color || "#71818d",
        });
        add(
          "text",
          {
            x: 42,
            y,
            "font-family": "Microsoft JhengHei, sans-serif",
            "font-size": 12,
            fill: "#172331",
          },
          row.label,
        );
        y += 22;
      }
    }
    const graphTop = y + 6;
    copy.setAttribute("x", 24);
    copy.setAttribute("y", graphTop);
    copy.setAttribute("width", width - 48);
    copy.setAttribute("height", graphHeight);
    root.append(copy);
    y =
      label(
        "來源：中央選舉委員會 · 資料整理版本 " + ctx.dataVersionDate(),
        graphTop + graphHeight + 30,
        12,
      ) + 12;
    root.setAttribute("width", width);
    const outputHeight = Math.ceil(y);
    root.setAttribute("height", outputHeight);
    root.setAttribute("viewBox", `0 0 ${width} ${outputHeight}`);
    return new XMLSerializer().serializeToString(root);
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    '<dialog id="publication-dialog"><header><div><h2>圖表出版</h2><p>保留目前分析狀態，重新編排標題、圖例與來源。</p></div><button id="publication-close" aria-label="關閉出版預覽">×</button></header><div class="publication-toolbar"><label>樣式<select id="publication-profile"><option value="research">研究版 · 完整口徑</option><option value="publication" selected>出版版 · 關鍵發現</option><option value="social">分享版 · 強調主圖</option></select></label><label>尺寸<select id="publication-size"><option value="wide" selected>1600×900</option><option value="large">2400×1350</option><option value="share-square">2000×2000</option><option value="landscape">橫版 1600×1000</option><option value="square">正方形 1200×1200</option><option value="paper">論文／報告 1800×1200</option></select></label><label>內容<select id="publication-part"><option value="current">目前視圖／雙視圖合圖</option><option value="map">地圖</option><option value="chart">統計圖</option></select></label><button id="publication-svg">下載 SVG</button><label>PNG倍率<select id="publication-scale"><option value="1" selected>1×（標示尺寸）</option><option value="2">2×（高解析）</option></select></label><button id="publication-png">下載 PNG</button></div><div class="publication-preview"><img id="publication-image" alt="目前分析的出版圖像預覽"></div></dialog>',
  );
  ctx.publicationURL = "";
  ctx.publicationXML = "";
  function updatePublication() {
    ctx.$("#publication-batch").disabled = ctx.isLeg();
    const sizes = {
        wide: { width: 1600, height: 900 },
        large: { width: 2400, height: 1350 },
        "share-square": { width: 2000, height: 2000 },
        landscape: { width: 1600, height: 1000 },
        square: { width: 1200, height: 1200 },
        paper: { width: 1800, height: 1200 },
      },
      part = ctx.$("#publication-part").value;
    ctx.publicationXML = ctx.exportedSVG(part, {
      ...sizes[ctx.$("#publication-size").value],
      profile: ctx.$("#publication-profile").value,
    });
    if (ctx.publicationURL) URL.revokeObjectURL(ctx.publicationURL);
    ctx.publicationURL = URL.createObjectURL(
      new Blob([ctx.publicationXML], { type: "image/svg+xml;charset=utf-8" }),
    );
    ctx.$("#publication-image").src = ctx.publicationURL;
  }
  for (const id of [
    "publication-size",
    "publication-part",
    "publication-profile",
  ])
    ctx.$("#" + id).onchange = ctx.updatePublication;
  ctx.$("#publication-close").onclick = () =>
    ctx.$("#publication-dialog").close();
  ctx.$(".publication-toolbar").insertAdjacentHTML("beforeend", '<button id="publication-batch" title="目前分析集合的三張候選人得票率地圖，共用0–65%色階">三候選人地圖 ZIP</button>');
  ctx.$("#publication-batch").onclick = () => {
    if (ctx.isLeg()) { ctx.toast("批次候選人地圖目前適用總統選舉。"); return; }
    const saved = { chart: ctx.state.chart, metric: ctx.state.metric, candidate: ctx.state.candidate, brushed: ctx.state.brushed,
      county: ctx.state.county, key: ctx.state.key, inspection: ctx.state.inspection, level: ctx.state.level,
      dual: ctx.dualMode, transform: ctx.transform, encoding: ctx.mapEncoding, legend: [...ctx.$("#legend").childNodes] },
      records = ctx.scoped(), files = [];
    if (!records.length) { ctx.toast("目前集合沒有可供出版的地區。"); return; }
    try {
      Object.assign(ctx.state, { chart: "map", metric: "share", brushed: records.map(ctx.keyOf), county: "", key: "", inspection: false,
        level: records[0].town === "000" ? "county" : "town" });
      ctx.dualMode = false; ctx.transform = ctx.d3.zoomIdentity; ctx.mapEncoding = "area";
      for (const c of ctx.records["00000/000"].candidates) {
        ctx.state.candidate = c.name; ctx.renderLegend();
        const legend = ctx.$("#legend"); legend.querySelector(".legend-title").textContent = c.name + " · 得票率（共同色階0–65%）";
        const xml = ctx.exportedSVG("map", { width: 1600, height: 1000, profile: "research" });
        files.push({ name: "2024總統-" + c.name + "-得票率.svg", data: xml });
      }
      files.push({ name: "metadata.json", data: JSON.stringify({ election: "president:2024", count: records.length,
        regions: records.map(ctx.keyOf), scaleDomain: [0, 65], unit: "%", source: ctx.dataVersionLabel(), boundary: ctx.siteMetadata?.boundary_version,
        applicationVersion: ctx.applicationVersion, method: "三張圖使用同一地區集合、投影、尺寸和得票率色階，端點含超出值。" }, null, 2) });
    } finally {
      const { dual, transform, encoding, legend, ...state } = saved;
      Object.assign(ctx.state, state); ctx.dualMode = dual; ctx.transform = transform; ctx.mapEncoding = encoding; ctx.$("#legend").replaceChildren(...legend);
    }
    ctx.saveBlob(new Blob([zipFiles(files)], { type: "application/zip" }), "臺灣2024-三候選人地圖.zip");
    ctx.toast("已匯出三張共同色階地圖與來源說明；分析狀態保持原樣。");
  };
  ctx.$("#publication-svg").onclick = () =>
    ctx.saveBlob(
      new Blob([ctx.publicationXML], { type: "image/svg+xml;charset=utf-8" }),
      "臺灣選舉-出版圖.svg",
    );
  async function downloadPNG(xml, filename, scale = 2) {
    const url = URL.createObjectURL(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
      ),
      img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const paint = canvas.getContext("2d");
      paint.scale(scale, scale);
      paint.drawImage(img, 0, 0);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (blob) ctx.saveBlob(blob, filename + ".png");
    } catch {
      ctx.toast("圖像匯出失敗，請改用SVG");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  ctx.$("#publication-png").onclick = () =>
    ctx.downloadPNG(
      ctx.publicationXML,
      "臺灣選舉-" +
        ctx.$("#publication-profile").value +
        "-" +
        ctx.$("#publication-size").value,
      +ctx.$("#publication-scale").value,
    );
  ctx.$("#image-export").onchange = async (ev) => {
    const choice = ev.target.value;
    ev.target.value = "";
    if (!choice) return;
    if(!ctx.isLeg()&&(ctx.state.chart==='map'||ctx.dualMode))await ctx.ensureMapLOD(2);
    if (choice === "publication") {
      ctx.$("#publication-part option[value=map]").disabled =
        ctx.state.chart !== "map" && !ctx.dualMode;
      ctx.$("#publication-part option[value=chart]").disabled =
        ctx.state.chart === "map";
      ctx.$("#publication-part").value = "current";
      ctx.updatePublication();
      ctx.$("#publication-dialog").showModal();
      return;
    }
    const [type, part = "current"] = choice.split("-");
    if (part === "map" && ctx.state.chart !== "map" && !ctx.dualMode) {
      ctx.toast("請先切換到地圖或雙視圖");
      return;
    }
    if (part === "chart" && ctx.state.chart === "map") {
      ctx.toast("請先選擇統計圖表");
      return;
    }
    if (
      ["hex", "bubble"].includes(ctx.state.chart) &&
      ctx.$("#scatter").getAttribute("data-render-ready") === "false"
    )
      await new Promise((resolve) => {
        const el = ctx.$("#scatter"),
          observer = new MutationObserver(() => {
            if (el.getAttribute("data-render-ready") === "true") {
              observer.disconnect();
              clearTimeout(timeout);
              resolve();
            }
          }),
          timeout = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 2000);
        observer.observe(el, {
          attributes: true,
          attributeFilter: ["data-render-ready"],
        });
      });
    const xml = ctx.exportedSVG(part),
      filename =
        "臺灣選舉-" +
        ctx.state.e +
        "-" +
        (part === "current" ? ctx.state.chart : part);
    if (type === "svg") {
      ctx.saveBlob(
        new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        filename + ".svg",
      );
      return;
    }
    await ctx.downloadPNG(xml, filename);
  };
}
