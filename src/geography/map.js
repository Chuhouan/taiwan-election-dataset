/** src/geography/map.js — explicit visualization service dependencies. */
export function install(ctx) {
  Object.assign(ctx, {
    geoOpacity,
    geoKey,
    buildMap,
    buildBaseMap,
    updateMap,
    renderMapGroups,
    updateLabels,
    zoomTo,
    zoomToRegion,
    zoomAdministrativeRegion,
    showTooltip,
    renderMapTooltip,
  });
  function geoOpacity(f) {
    const base = ctx.state.brushed.length
      ? ctx.state.brushed.includes(ctx.geoKey(f)) ||
        (!f.properties.TOWNCODE &&
          ctx.state.brushed.some((k) => k.startsWith(f.properties.COUNTYCODE)))
        ? 1
        : 0.1
      : ctx.state.county &&
      f.properties.COUNTYCODE !== String(ctx.state.county)
      ? 0.28
      : 1;
    if (ctx.isLeg()) return base;
    if (ctx.mapEncoding === "margin") return base * (.22 + .78 * Math.min(1, (ctx.marginOf(ctx.records[ctx.geoKey(f)]) || 0) / 35));
    return ctx.mapEncoding === "symbols" ? base * .3 : base;
  }

  function geoKey(f) {
    return (
      f.properties.COUNTYCODE + "/" + (f.properties.TOWNCODE?.slice(5) || "000")
    );
  }

  function buildMap() {
    if (!ctx.data) return;
    ctx.appliedLod = "";
    ctx.buildBaseMap();
    ctx.restoreMapViewport();
    ctx.wireMapListHover();
    if (ctx.mapSvg) ctx.addNoDataPattern(ctx.mapSvg);
    ctx.updateDistrictGeometry();
    ctx.refreshLinkedMarks?.();
    requestAnimationFrame(() => {
      ctx.updateChartTabStops();
      ctx.updateGroupMarks();
    });
  }

  function buildBaseMap() {
    if (!ctx.data) return;
    const host = ctx.$("#map-host");
    if (host.clientWidth < 1 || host.clientHeight < 1) return;
    const compactMap = ctx.dualMode && host.clientWidth < 450,
      singleMap = !ctx.dualMode && ctx.state.chart === "map";
    const paneTop = ctx.dualMode
      ? Math.max(110, ctx.$("#left-pane-head").getBoundingClientRect().bottom - host.getBoundingClientRect().top + 16)
      : 30;
    ctx.$(".map-workspace").classList.toggle("map-compact", compactMap);
    ctx.$(".map-workspace").dataset.mapMetric = ctx.state.metric;
    const previous =
        ctx.mapSvg && ctx.zoom ? ctx.d3.zoomTransform(ctx.mapSvg.node()) : null,
      oldW = ctx.w,
      oldH = ctx.h;
    ctx.w = Math.max(300, host.clientWidth);
    ctx.h = Math.max(300, host.clientHeight);
    ctx.mapSvg = ctx.d3.select("#map").attr("viewBox", `0 0 ${ctx.w} ${ctx.h}`);
    ctx.mapSvg.selectAll("*").remove();
    ctx.world = ctx.mapSvg.append("g").attr("class", "map-world");
    ctx.geoByKey = {};
    ctx.transform = ctx.d3.zoomIdentity;
    const islandIds = ["09007", "09020", "10016"],
      fc = (features) => ({ type: "FeatureCollection", features });
    const main = ctx.counties.filter(
      (f) => !islandIds.includes(f.properties.COUNTYCODE),
    );
    const pr = ctx.d3.geoMercator().fitExtent(
      [
        [ctx.w * 0.22, compactMap ? Math.max(330, paneTop) : paneTop],
        [ctx.w * 0.87, ctx.h - 18],
      ],
      fc(main),
    );
    let paths = {};
    for (const f of main) paths[f.properties.COUNTYCODE] = ctx.d3.geoPath(pr);
    // Insets are separately projected, then participate in the same zoomable scene.
    // Frame size follows geographic complexity (island count × extent), not equal boxes.
    const ix = 24,
      iyBase = compactMap ? Math.max(330, paneTop) : ctx.dualMode ? paneTop + 15 : singleMap ? 40 : 180,
      iwBase = Math.min(190, ctx.w * 0.22),
      availH = compactMap
        ? Math.max(192, ctx.h - 380)
        : ctx.dualMode
          ? Math.max(192, ctx.h - 245)
          : Math.max(246, ctx.h - (singleMap ? 90 : 210));
    const insetMeta = islandIds.map((id) => {
      const f = ctx.counties.find((x) => x.properties.COUNTYCODE === id),
        bounds = ctx.d3.geoBounds(f),
        polys =
          f.geometry.type === "MultiPolygon"
            ? f.geometry.coordinates
            : [f.geometry.coordinates],
        wDeg = bounds[1][0] - bounds[0][0],
        hDeg = bounds[1][1] - bounds[0][1];
      return {
        id,
        f,
        islands: polys.length,
        weight: polys.length * Math.sqrt(wDeg * hDeg),
        aspect: wDeg / Math.max(1e-6, hDeg),
      };
    });
    const weightSum = ctx.d3.sum(insetMeta, (m) => m.weight) || 1;
    const insetBox = {};
    let iyCursor = iyBase;
    for (const m of insetMeta) {
      const ih = Math.max(
          compactMap ? 64 : 90,
          Math.min(150, (availH * m.weight) / weightSum),
        ),
        iw = Math.max(
          120,
          Math.min(230, iwBase * Math.max(0.85, Math.min(1.35, m.aspect / 1.1))),
        );
      insetBox[m.id] = { x: ix, y: iyCursor, w: iw, h: ih };
      iyCursor += ih + 10;
    }
    islandIds.forEach((id) => {
      const m = insetMeta.find((d) => d.id === id),
        f = m.f,
        box = insetBox[id],
        y = box.y,
        iw = box.w,
        ih = box.h;
      paths[id] = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [ix + 12, y + 27],
            [ix + iw - 12, y + ih - 20],
          ],
          f,
        ),
      );
      const group = ctx.world
        .append("g")
        .attr("class", "inset-scope")
        .attr("data-county", id)
        .attr("role", "button")
        .attr("tabindex", 0)
        .attr(
          "aria-label",
          f.properties.COUNTYNAME + "獨立分幅，點選檢視地區結果",
        )
        .on("pointermove.inset", (ev) => {
          if (!ctx.isLeg() && !ev.target.closest(".geo"))
            ctx.showTooltip(ev, ctx.records[id + "/000"], id + "/000");
        })
        .on("pointerleave.inset", () => {
          ctx.$("#map-tooltip").hidden = true;
        })
        .on("click", () => {
          if (!ctx.isLeg()) ctx.selectRegion(id + "/000");
        })
        .on("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            if (!ctx.isLeg()) ctx.selectRegion(id + "/000");
          }
        });
      group
        .append("rect")
        .attr("class", "inset-frame")
        .attr("x", ix)
        .attr("y", y)
        .attr("width", iw)
        .attr("height", ih)
        .attr("fill", "transparent");
      group
        .append("line")
        .attr("x1", ix)
        .attr("x2", ix + iw)
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", "#c9d4db")
        .attr("stroke-width", 1);
      group
        .append("text")
        .attr("class", "inset-title")
        .attr("x", ix + 4)
        .attr("y", y + 17)
        .text(f.properties.COUNTYNAME + " · 分幅");
      group
        .append("text")
        .attr("class", "inset-summary")
        .attr("data-county", id)
        .attr("x", ix + 4)
        .attr("y", y + ih - 5);
    });
    // 烏坵離金門本島較遠，獨立分幅避免全縣範圍令本島縮成幾個像素。
    const kin = ctx.counties.find((f) => f.properties.COUNTYCODE === "09020"),
      kinBox = insetBox["09020"],
      ky = kinBox.y,
      kw = kinBox.w,
      kh = kinBox.h;
    const splitKin = (f, remote) => {
      const polys =
        f.geometry.type === "MultiPolygon"
          ? f.geometry.coordinates
          : [f.geometry.coordinates];
      return {
        ...f,
        geometry: {
          type: "MultiPolygon",
          coordinates: polys.filter((p) => p[0][0][0] > 119 === remote),
        },
      };
    };
    const kinMain = ctx.d3.geoPath(
      ctx.d3.geoMercator().fitExtent(
        [
          [ix + 9, ky + 27],
          [ix + kw * 0.72, ky + kh - 10],
        ],
        splitKin(kin, false),
      ),
    );
    const kinRemote = ctx.d3.geoPath(
      ctx.d3.geoMercator().fitExtent(
        [
          [ix + kw * 0.8, ky + 32],
          [ix + kw - 7, ky + kh - 24],
        ],
        splitKin(kin, true),
      ),
    );
    const kinPath = (f) =>
      f.properties.TOWNNAME === "烏坵鄉"
        ? kinRemote(f)
        : f.properties.TOWNNAME
          ? kinMain(f)
          : (kinMain(splitKin(f, false)) || "") +
            (kinRemote(splitKin(f, true)) || "");
    kinPath.bounds = (f) =>
      f.properties.TOWNNAME === "烏坵鄉"
        ? kinRemote.bounds(f)
        : f.properties.TOWNNAME
          ? kinMain.bounds(f)
          : [
              [ix + 8, ky + 25],
              [ix + kw - 7, ky + kh - 10],
            ];
    kinPath.centroid = (f) =>
      f.properties.TOWNNAME === "烏坵鄉"
        ? kinRemote.centroid(f)
        : kinMain.centroid(splitKin(f, false));
    paths["09020"] = kinPath;
    ctx.world
      .append("text")
      .attr("class", "inset-title inset-locality")
      .attr("x", ix + kw * 0.77)
      .attr("y", ky + 27)
      .attr("font-size", 12)
      .text("烏坵");
    // 馬祖各鄉獨立放大，避免分散島群在全縣範圍縮成色點。
    const matsu = ctx.towns.filter((f) => f.properties.COUNTYCODE === "09007"),
      matsuBox = insetBox["09007"],
      mp = {};
    matsu.forEach((f, i) => {
      const x = ix + 8 + (i * matsuBox.w) / 4,
        y = matsuBox.y + 30;
      mp[ctx.geoKey(f)] = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [x, y],
            [x + matsuBox.w / 4 - 10, matsuBox.y + matsuBox.h - 27],
          ],
          f,
        ),
      );
    });
    const matsuPath = (f) =>
      f.properties.TOWNCODE
        ? mp[ctx.geoKey(f)](f)
        : matsu.map((t) => mp[ctx.geoKey(t)](t)).join("");
    matsuPath.bounds = (f) =>
      f.properties.TOWNCODE
        ? mp[ctx.geoKey(f)].bounds(f)
        : [
            [ix, matsuBox.y],
            [ix + matsuBox.w, matsuBox.y + matsuBox.h],
          ];
    matsuPath.centroid = (f) =>
      f.properties.TOWNCODE
        ? mp[ctx.geoKey(f)].centroid(f)
        : [ix + matsuBox.w / 2, matsuBox.y + matsuBox.h / 2];
    paths["09007"] = matsuPath;
    const penghu = ctx.towns.filter((f) => f.properties.COUNTYCODE === "10016"),
      penghuBox = insetBox["10016"],
      py = penghuBox.y,
      pw = penghuBox.w,
      ph = penghuBox.h,
      remoteNames = ["望安鄉", "七美鄉"],
      penghuMain = penghu.filter(
        (f) => !remoteNames.includes(f.properties.TOWNNAME),
      );
    const penghuProjection = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [ix + 9, py + 26],
            [ix + pw * 0.7, py + ph - 20],
          ],
          fc(penghuMain),
        ),
      ),
      penghuPaths = {};
    for (const f of penghuMain) penghuPaths[ctx.geoKey(f)] = penghuProjection;
    remoteNames.forEach((name, i) => {
      const f = penghu.find((t) => t.properties.TOWNNAME === name);
      penghuPaths[ctx.geoKey(f)] = ctx.d3.geoPath(
        ctx.d3.geoMercator().fitExtent(
          [
            [ix + pw * 0.77, py + 26 + (i * (ph - 46)) / 2],
            [ix + pw - 9, py + 26 + ((i + 1) * (ph - 46)) / 2 - 8],
          ],
          f,
        ),
      );
    });
    const penghuPath = (f) =>
      f.properties.TOWNCODE
        ? penghuPaths[ctx.geoKey(f)](f)
        : penghu.map((t) => penghuPaths[ctx.geoKey(t)](t)).join("");
    penghuPath.bounds = (f) =>
      f.properties.TOWNCODE
        ? penghuPaths[ctx.geoKey(f)].bounds(f)
        : [
            [ix, py],
            [ix + pw, py + ph],
          ];
    penghuPath.centroid = (f) =>
      f.properties.TOWNCODE
        ? penghuPaths[ctx.geoKey(f)].centroid(f)
        : [ix + pw / 2, py + ph / 2];
    paths["10016"] = penghuPath;
    const townGroup = ctx.world.append("g").attr("class", "town-geometries"),
      countyGroup = ctx.world.append("g").attr("class", "county-geometries");
    function bind(group, features) {
      group
        .selectAll("path")
        .data(features)
        .join("path")
        .attr("class", "geo")
        .attr("data-key", ctx.geoKey)
        .attr("d", (f) => paths[f.properties.COUNTYCODE](f))
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", (f) =>
          f.properties.TOWNNAME
            ? f.properties.COUNTYNAME + " " + f.properties.TOWNNAME
            : f.properties.COUNTYNAME,
        )
        .each(function (f) {
          ctx.geoByKey[ctx.geoKey(f)] = {
            f,
            path: paths[f.properties.COUNTYCODE],
          };
        })
        .on("pointermove", (ev, f) => {
          const key = ctx.geoKey(f);
          ctx.showTooltip(ev, ctx.records[key], key);
          if (ctx.hoveredLabelKey !== key) {
            ctx.hoveredLabelKey = key;
            ctx.updateLabels();
          }
        })
        .on("pointerleave", () => {
          ctx.$("#map-tooltip").hidden = true;
          ctx.hoveredLabelKey = "";
          ctx.updateLabels();
        })
        .on("click", (ev, f) => {
          ev.stopPropagation();
          if (ctx.isLeg()) {
            ctx.state.county = f.properties.COUNTYCODE;
            ctx.state.key = "";
            ctx.updateUI();
          } else ctx.selectRegion(ctx.geoKey(f), false);
        })
        .on("keydown", (ev, f) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            if (!ctx.isLeg()) ctx.selectRegion(ctx.geoKey(f), false);
          }
        });
    }
    bind(townGroup, ctx.towns);
    bind(countyGroup, ctx.counties);
    ctx.world
      .append("g")
      .attr("class", "county-borders")
      .selectAll("path")
      .data(ctx.counties)
      .join("path")
      .attr("class", "county-outline")
      .attr("d", (f) => paths[f.properties.COUNTYCODE](f));
    ctx.world.append("path").attr("class", "selected-outline");
    const lbl = ctx.world.append("g").attr("class", "map-labels");
    lbl
      .selectAll(".county-label")
      .data(
        ctx.counties.filter(
          (f) => !islandIds.includes(f.properties.COUNTYCODE),
        ),
      )
      .join("text")
      .attr("class", "geo-label county-label")
      .attr("text-anchor", "middle")
      .attr("data-x", (f) => paths[f.properties.COUNTYCODE].centroid(f)[0])
      .attr("data-y", (f) => paths[f.properties.COUNTYCODE].centroid(f)[1])
      .text((f) => f.properties.COUNTYNAME);
    lbl
      .selectAll(".town-label")
      .data(ctx.towns)
      .join("text")
      .attr("class", "geo-label town-label")
      .attr("text-anchor", "middle")
      .attr("data-x", (f) => paths[f.properties.COUNTYCODE].centroid(f)[0])
      .attr("data-y", (f) => paths[f.properties.COUNTYCODE].centroid(f)[1])
      .text((f) => f.properties.TOWNNAME);
    ctx.zoom = ctx.d3
      .zoom()
      .filter((ev) => (!ev.button) && (ev.type !== "wheel" || ev.ctrlKey))
      .scaleExtent([1, 28])
      .extent([
        [0, 0],
        [ctx.w, ctx.h],
      ])
      .translateExtent([
        [-ctx.w, -ctx.h],
        [ctx.w * 2, ctx.h * 2],
      ])
      .clickDistance(5)
      .on("start", () => (ctx.$("#map-tooltip").hidden = true))
      .on("zoom", (ev) => {
        ctx.transform = ev.transform;
        ctx.world.attr("transform", ctx.transform);
        ctx.$("#zoom-value").textContent = ctx.transform.k.toFixed(1) + "×";
        ctx.updateLabels();
        ctx.world.selectAll(".vote-symbol").attr("r", (d) => ctx.voteSymbolRadius(d.r.total) / ctx.transform.k);
      });
    ctx.mapSvg
      .call(ctx.zoom)
      .call(ctx.zoom.transform, ctx.d3.zoomIdentity)
      .on("dblclick.zoom", null);
    ctx.mapSvg.on("dblclick", (ev) => {
      if (ev.target.tagName === "svg") ctx.zoomTo(ctx.d3.zoomIdentity);
    });
    ctx.updateMap();
    ctx.updateLabels();
    if (previous && oldW && oldH) {
      const t = ctx.d3.zoomIdentity
        .translate((previous.x * ctx.w) / oldW, (previous.y * ctx.h) / oldH)
        .scale(previous.k);
      ctx.zoomTo(t, false);
    } else if (ctx.state.key && !ctx.state.inspection)
      ctx.zoomToRegion(ctx.state.key, false);
  }

  function updateMap() {
    if (!ctx.world) return;
    ctx.world.selectAll(".inset-scope").classed("is-inspected", function () {
      return this.dataset.county === ctx.records[ctx.state.key]?.county;
    });
    ctx.world.selectAll(".inset-summary").text(function () {
      const r = ctx.records[this.dataset.county + "/000"],
        c = r?.candidates[0];
      return !c
        ? "比例不同"
        : this.parentNode.querySelector("rect").getAttribute("width") < 130
          ? c.name + " " + Math.round((c.votes / r.total) * 100) + "%"
          : c.name +
            " " +
            ctx.pct((c.votes / r.total) * 100) +
            " · 差" +
            ctx.marginOf(r).toFixed(1) +
            "pp";
    });
    ctx.world
      .select(".town-geometries")
      .attr("display", ctx.state.level === "town" ? "" : "none");
    ctx.world
      .select(".county-geometries")
      .attr(
        "display",
        ctx.state.level === "county" || ctx.isLeg() ? "" : "none",
      );
    ctx.world
      .selectAll(".geo")
      .attr("data-metric-value", (f) =>
        ctx.EXTRA_METRICS[ctx.state.metric]
          ? ctx.extraMetricValue(ctx.records[ctx.geoKey(f)])
          : null,
      )
      .attr("fill", (f) => ctx.fill(ctx.records[ctx.geoKey(f)], ctx.geoKey(f)))
      .attr("fill-opacity", ctx.geoOpacity)
      .classed(
        "condition-highlight",
        (f) =>
          ctx.highlightOnlyActive?.() &&
          ctx.conditionHighlight.includes(ctx.geoKey(f)),
      );
    const r = ctx.state.key ? ctx.rec() : null;
    const k = r
      ? ctx.isLeg()
        ? r.county + "/000"
        : ctx.state.key
      : ctx.state.county
        ? ctx.state.county + "/000"
        : null;
    const g = ctx.geoByKey[k];
    ctx.world.select(".selected-outline").attr("d", null);
    ctx.world.selectAll(".vote-symbol-layer").remove();
    if (ctx.mapEncoding === "symbols" && !ctx.isLeg()) {
      const features = ctx.state.level === "county" ? ctx.counties : ctx.towns,
        rows = features.map((f) => ({ f, key: ctx.geoKey(f), r: ctx.records[ctx.geoKey(f)] })).filter((d) => ctx.valid(d.r)),
        max = ctx.d3.max(rows, (d) => d.r.total) || 1;
      ctx.voteSymbolRadius = ctx.d3.scaleSqrt().domain([0, max]).range([0, 32]);
      ctx.world.append("g").attr("class", "vote-symbol-layer").selectAll("circle").data(rows.sort((a, b) => b.r.total - a.r.total)).join("circle")
        .attr("class", "vote-symbol").attr("data-region-key", (d) => d.key)
        .attr("cx", (d) => ctx.geoByKey[d.key].path.centroid(d.f)[0])
        .attr("cy", (d) => ctx.geoByKey[d.key].path.centroid(d.f)[1])
        .attr("r", (d) => ctx.voteSymbolRadius(d.r.total) / ctx.transform.k)
        .attr("fill", (d) => ctx.color(d.r.candidates[0].party)).attr("fill-opacity", .75)
        .attr("vector-effect", "non-scaling-stroke")
        .on("pointermove", (event, d) => ctx.showTooltip(event, d.r, d.key))
        .on("pointerleave", () => { ctx.$("#map-tooltip").hidden = true; })
        .on("click", (_, d) => ctx.selectRegion(d.key));
    }
    ctx.updateLabels();
  }

  function renderMapGroups() {
    if (!ctx.world) return;
    const marks = ctx.isLeg() ? [] : ["a", "b"].flatMap((group) =>
      ctx.groupSelection[group].flatMap((key) => {
        const geometry = ctx.geoByKey[key];
        if (!geometry || (key.endsWith("/000") ? "county" : "town") !== ctx.state.level)
          return [];
        const [x, y] = geometry.path.centroid(geometry.f);
        return Number.isFinite(x) && Number.isFinite(y) ? [{ key, group, x, y }] : [];
      }),
    );
    ctx.world.selectAll(".map-group-layer")
      .data(marks.length ? [marks] : [])
      .join("g")
      .attr("class", "map-group-layer")
      .attr("aria-hidden", "true")
      .raise()
      .selectAll("text")
      .data((rows) => rows, (d) => d.key)
      .join("text")
      .attr("class", (d) => "map-group-mark map-group-" + d.group)
      .attr("data-group-region", (d) => d.key)
      .text((d) => d.group.toUpperCase());
    positionMapGroups();
  }

  function positionMapGroups() {
    const k = ctx.transform.k;
    ctx.world.selectAll(".map-group-mark").attr("transform", (d) =>
      `translate(${d.x},${d.y - 12 / k}) scale(${1 / k})`,
    );
  }

  function updateLabels() {
    if (!ctx.world) return;
    const k = ctx.transform.k;
    ctx.world
      .selectAll(".geo-label")
      .attr("transform", function () {
        return `translate(${this.dataset.x},${this.dataset.y}) scale(${1 / k})`;
      })
      .attr("display", "none");
    ctx.world
      .selectAll(".inset-title,.inset-summary")
      .attr("opacity", k > 2 ? 0 : 1);
    ctx.updateCartographicLabels();
    positionMapGroups();
    ctx.updateMapLOD();
    ctx.updateDistrictLabels();
  }

  function zoomTo(t, animate = true) {
    if (!ctx.mapSvg || !ctx.zoom) return;
    ctx.mapSvg.interrupt();
    (animate
      ? ctx.mapSvg
          .transition()
          .duration(ctx.duration())
          .ease(ctx.d3.easeCubicInOut)
      : ctx.mapSvg
    ).call(ctx.zoom.transform, t);
  }

  function zoomToRegion(key, animate = true) {
    if (!ctx.zoomDistrictRegion(key, animate))
      ctx.zoomAdministrativeRegion(key, animate);
  }

  function zoomAdministrativeRegion(key, animate = true) {
    const r = ctx.records[key],
      g = ctx.geoByKey[ctx.isLeg() && r ? r.county + "/000" : key];
    if (!g) return;
    let [[x0, y0], [x1, y1]] = g.path.bounds(g.f);
    let k = Math.max(
      1,
      Math.min(
        22,
        0.7 / Math.max((x1 - x0) / ctx.w, (y1 - y0) / (ctx.h - 110)),
      ),
    );
    ctx.zoomTo(
      ctx.d3.zoomIdentity
        .translate(ctx.w / 2, ctx.h / 2 + 25)
        .scale(k)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
      animate,
    );
  }

  function showTooltip(ev, r, key) {
    ctx.renderMapTooltip(ev, r, key);
    ctx.highlightRegionList(key, r);
  }

  function renderMapTooltip(ev, r, key) {
    if (!r || ctx.isLeg()) return;
    const tip = ctx.$("#map-tooltip");
    tip.innerHTML =
      '<div class="tip-place">' +
      ctx.esc(ctx.areaName(r)) +
      "<small>" +
      ctx.esc(ctx.data.counties[r.county]) +
      "</small></div>" +
      r.candidates
        .slice(0, 3)
        .map(
          (c) =>
            '<div class="tip-row"><span><i style="background:' +
            ctx.color(c.party) +
            '"></i>' +
            ctx.esc(c.name) +
            "</span><b>" +
            ctx.pct(c.share) +
            "</b></div>",
        )
        .join("") +
      '<div class="tip-bottom"><span>差距 ' +
      r.margin.toFixed(2) +
      " pp</span><span>投票率 " +
      ctx.pct(r.turnout) +
      "</span></div>";
    if (ctx.EXTRA_METRICS[ctx.state.metric]) {
      const v = ctx.extraMetricValue(r);
      tip.innerHTML +=
        '<div class="tip-bottom"><span>' +
        ctx.esc(ctx.EXTRA_METRICS[ctx.state.metric].title) +
        "</span><b>" +
        (v == null
          ? "—"
          : ctx.state.metric === "bivariate"
            ? ctx.pct(v) + " × " + ctx.pct(ctx.turnoutOf(r))
            : ["leadVotes", "validVotes"].includes(ctx.state.metric)
              ? ctx.fmt(v) + "票"
              : v.toFixed(2) + " " + ctx.EXTRA_METRICS[ctx.state.metric].unit) +
        "</b></div>";
    }
    if (ctx.state.metric === "swing") {
      const v = ctx.swing(key);
      tip.innerHTML +=
        '<div class="tip-bottom"><span>' +
        ctx.state.swingParty +
        " 2020→24</span><b>" +
        (v == null ? "—" : ctx.sign(v) + " pp") +
        "</b></div>";
    }
    tip.hidden = false;
    const b = ctx.$("#map-host").getBoundingClientRect();
    tip.style.left =
      Math.max(8, Math.min(ctx.w - 245, ev.clientX - b.left + 16)) + "px";
    tip.style.top =
      Math.max(112, Math.min(ctx.h - 210, ev.clientY - b.top - 100)) + "px";
  }
}
