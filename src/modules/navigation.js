/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    parseRoute,
    routeString,
    updateHash,
    hydrateRoute,
    restoreMapViewport,
    restoreRoute,
    mapReservedLabelBoxes,
    updateCartographicLabels,
    updateMapLOD,
  });
  /* One serializable analysis state, including normalized camera coordinates. */
  ctx.routeApplying = false;
  ctx.routeReady = false;
  ctx.routeCamera = null;
  ctx.routeViewportPending = false;
  ctx.lastRoute = "";
  ctx.cameraTimer = undefined;
  ctx.routeDefaults = {
    e: "president",
    metric: "winner",
    level: "town",
    chart: "map",
    county: "",
    key: "",
    inspection: false,
    candidate: "賴清德",
    labels: true,
    sort: "margin",
    brushed: [],
    brushEnabled: false,
    distribution: "swarm",
    pins: [],
    drawer: null,
  };
  function parseRoute() {
    const p = new URLSearchParams(location.hash.slice(1)),
      e = ctx.CFG[p.get("e")] ? p.get("e") : "president",
      rs = ctx.data[e];
    Object.assign(ctx.state, ctx.routeDefaults, { e, brushed: [], pins: [] });
    ctx.records = rs;
    ctx.state.cartography = {
      labels: ["sparse", "rich"].includes(p.get("label-density"))
        ? p.get("label-density")
        : "standard",
      boundaries: ["town", "subtle"].includes(p.get("boundary-style"))
        ? p.get("boundary-style")
        : "county",
      insets: p.get("island-insets") === "compact" ? "compact" : "expanded",
    };
    ctx.state.chart = [
      "map",
      "hex",
      "bubble",
      "ternary",
      "small",
      "scatter",
    ].includes(p.get("chart"))
      ? p.get("chart")
      : e === "legislator"
        ? "hex"
        : "map";
    ctx.state.metric = [
      "winner",
      "runner",
      "margin",
      "turnout",
      "share",
      ...Object.keys(ctx.EXTRA_METRICS),
    ].includes(p.get("m"))
      ? p.get("m")
      : "winner";
    if (e === "legislator") {
      if (ctx.state.chart === "ternary") ctx.state.chart = "hex";
      if (!["winner", "runner", "margin", "turnout"].includes(ctx.state.metric))
        ctx.state.metric = "winner";
    }
    ctx.state.level = p.get("l") === "county" ? "county" : "town";
    ctx.state.key = ctx.valid(rs[p.get("r")]) ? p.get("r") : "";
    ctx.state.inspection = !!ctx.state.key && p.get("inspect") === "1";
    ctx.state.county = ctx.state.inspection
      ? ctx.data.counties[p.get("c")]
        ? p.get("c")
        : ""
      : ctx.state.key
        ? rs[ctx.state.key].county
        : ctx.data.counties[p.get("c")]
          ? p.get("c")
          : "";
    ctx.state.sort = ["margin", "name", "votes", "turnout"].includes(
      p.get("sort"),
    )
      ? p.get("sort")
      : "margin";
    ctx.state.labels = p.get("labels") !== "0";
    ctx.state.pins = [...new Set((p.get("pins") || "").split(","))]
      .filter((k) => ctx.valid(rs[k]))
      .slice(0, 3);
    ctx.state.brushed = [...new Set((p.get("selection") || "").split(","))]
      .filter(
        (k) =>
          ctx.valid(rs[k]) &&
          (e === "legislator" || ctx.state.level === "county"
            ? rs[k].town === "000"
            : rs[k].town !== "000"),
      )
      .slice(0, 368);
    ctx.state.distribution = [
      "swarm",
      "scatter",
      "histogram",
      "ecdf",
      "box",
      "dumbbell",
    ].includes(p.get("distribution"))
      ? p.get("distribution")
      : "swarm";
    ctx.state.drawer = ["table", "compare"].includes(p.get("drawer"))
      ? p.get("drawer")
      : null;
    ctx.$("#export-scope").value = ["range", "selected", "all"].includes(
      p.get("export"),
    )
      ? p.get("export")
      : "range";
    ctx.state.candidate =
      e === "president" &&
      rs["00000/000"].candidates.some((c) => c.name === p.get("candidate"))
        ? p.get("candidate")
        : "賴清德";
    ctx.state.otherCandidate = ["賴清德", "侯友宜", "柯文哲"].includes(
      p.get("candidate-b"),
    )
      ? p.get("candidate-b")
      : "侯友宜";
    ctx.relativeMaps = p.get("relative") === "1";
    ctx.$("#relative-mode").value = ctx.relativeMaps ? "relative" : "absolute";
    const names = rs["00000/000"]?.candidates?.map((c) => c.name) || [];
    ctx.smallMaps.difference = p.get("difference") === "1";
    ctx.smallMaps.reverse = p.get("small-reverse") === "1";
    for (const key of ["a", "b"])
      if (names.includes(p.get("small-" + key)))
        ctx.smallMaps[key] = p.get("small-" + key);
    const sc = (p.get("small-camera") || "").split(",").map(Number);
    ctx.smallMaps.camera =
      sc.length === 3 && sc.every(Number.isFinite) && sc[0] >= 1 && sc[0] <= 12
        ? sc
        : [1, 0, 0];
    ctx.$("#small-difference").checked = ctx.smallMaps.difference;
    ctx.$("#small-a").value = ctx.smallMaps.a;
    ctx.$("#small-b").value = ctx.smallMaps.b;
    document.body.classList.toggle("detail-closed", p.get("detail") === "0");
    document.body.classList.toggle("list-open", p.get("list") === "1");
    ctx.routeCamera = ctx.cameraFromRoute(p.get("camera"));
    ctx.routeViewportPending = true;
    ctx.parseAnalysisRoute(p);
    ctx.parseSeatRoute(p);
    ctx.parseMemberRoute(p);
    ctx.parseStatisticsRoute(p);
    ctx.parseComparisonRoute(p);
    ctx.parseRegionRoute(p);
    ctx.parseChartRoute(p);
    ctx.parseVillageRoute(p);
    ctx.parseCountyHistoryRoute(p);
    ctx.parseScaleRoute(p);
    ctx.parseVoteSeatRoute(p);
    ctx.parseArchiveRoute(p);
    ctx.parseNationalHistoryRoute(p);
  }
  function routeString() {
    const p = new URLSearchParams({
      e: ctx.state.e,
      m: ctx.state.metric,
      l: ctx.state.level,
      chart: ctx.state.chart,
    });
    for (const [k, v] of Object.entries({
      r: ctx.state.key,
      inspect: ctx.state.key && ctx.state.inspection ? "1" : "",
      c: ctx.state.county,
      candidate: ["share", "advantage", "difference", "bivariate"].includes(
        ctx.state.metric,
      )
        ? ctx.state.candidate
        : "",
      "candidate-b":
        ctx.state.metric === "difference" ? ctx.state.otherCandidate : "",
      selection: ctx.state.brushed.join(","),
      pins: ctx.state.pins.join(","),
      sort: ctx.state.sort,
      distribution: ctx.state.distribution,
      drawer: ctx.state.drawer || "",
      export: ctx.$("#export-scope").value,
      relative: ctx.relativeMaps ? "1" : "",
      labels: ctx.state.labels ? "" : "0",
      detail: document.body.classList.contains("detail-closed") ? "0" : "1",
      list: document.body.classList.contains("list-open") ? "1" : "",
    }))
      if (v) p.set(k, v);
    if (ctx.state.chart === "small" && !ctx.isLeg()) {
      p.set("small-a", ctx.smallMaps.a);
      p.set("small-b", ctx.smallMaps.b);
      p.set(
        "small-camera",
        ctx.smallMaps.camera.map((n) => Number(n.toFixed(5))).join(","),
      );
      if (ctx.smallMaps.difference) p.set("difference", "1");
      if (ctx.smallMaps.reverse) p.set("small-reverse", "1");
    }
    if (
      ctx.transform &&
      ctx.w &&
      ctx.h &&
      (ctx.state.chart === "map" || ctx.dualMode)
    )
      p.set(
        "camera",
        [ctx.transform.k, ctx.transform.x / ctx.w, ctx.transform.y / ctx.h]
          .map((n) => Number(n.toFixed(5)))
          .join(","),
      );
    if (ctx.state.cartography.labels !== "standard")
      p.set("label-density", ctx.state.cartography.labels);
    if (ctx.state.cartography.boundaries !== "county")
      p.set("boundary-style", ctx.state.cartography.boundaries);
    if (ctx.state.cartography.insets !== "expanded")
      p.set("island-insets", ctx.state.cartography.insets);
    ctx.serializeVillageRoute(p);
    ctx.serializeCountyHistoryRoute(p);
    ctx.serializeScaleRoute(p);
    ctx.serializeVoteSeatRoute(p);
    ctx.serializeArchiveRoute(p);
    ctx.serializeNationalHistoryRoute(p);
    ctx.serializeAnalysisRoute(p);
    ctx.serializeSeatRoute(p);
    ctx.serializeMemberRoute(p);
    ctx.serializeStatisticsRoute(p);
    ctx.serializeComparisonRoute(p);
    ctx.serializeChartRoute(p);
    return "#" + p;
  }
  function updateHash() {
    if (!ctx.routeReady || ctx.routeApplying) return;
    const next = ctx.routeString();
    if (next === ctx.lastRoute) return;
    history.replaceState(null, "", next);
    ctx.lastRoute = next;
  }
  function hydrateRoute() {
    if (!ctx.routeReady) {
      ctx.routeApplying = true;
      try {
        ctx.parseRoute();
        ctx.routeReady = true;
        ctx.routeRestored = true;
      } finally {
        ctx.routeApplying = false;
      }
    }
  }
  function restoreMapViewport() {
    if (!ctx.mapSvg || !ctx.zoom) return;
    if (ctx.routeViewportPending) {
      ctx.routeViewportPending = false;
      if (ctx.routeCamera) {
        const [k, x, y] = ctx.routeCamera;
        ctx.routeCamera = null;
        ctx.zoomTo(
          ctx.d3.zoomIdentity.translate(x * ctx.w, y * ctx.h).scale(k),
          false,
        );
      } else if (ctx.state.key && !ctx.state.inspection)
        ctx.zoomToRegion(ctx.state.key, false);
      else ctx.zoomTo(ctx.d3.zoomIdentity, false);
    }
    ctx.zoom.on("end.route", () => {
      clearTimeout(ctx.cameraTimer);
      ctx.cameraTimer = setTimeout(ctx.updateHash, 50);
    });
    ctx.updateHash();
  }
  async function restoreRoute() {
    await ctx.ensureRouteFeatures();
    if (!ctx.data) return;
    ctx.routeApplying = true;
    ctx.parseRoute();
    ctx.$("#search").value = "";
    ctx.$("#search-results").hidden = true;
    ctx.lastNational = "";
    ctx.lastDetail = "";
    ctx.updateUI();
    ctx.buildMap();
    ctx.routeApplying = false;
    ctx.lastRoute = location.hash;
  }
  window.addEventListener("hashchange", ctx.restoreRoute);
  window.addEventListener("popstate", ctx.restoreRoute);
  // User actions create history entries; camera drags update the current entry.
  document.addEventListener(
    "click",
    (ev) => {
      if (!ctx.routeReady || !ev.target.closest("button,[role=button]")) return;
      const before = location.href;
      setTimeout(() => {
        const after = location.href;
        if (after !== before) {
          history.replaceState(null, "", before);
          history.pushState(null, "", after);
          ctx.lastRoute = location.hash;
        }
      }, 0);
    },
    true,
  );
  document.addEventListener(
    "change",
    () => {
      if (!ctx.routeReady) return;
      const before = location.href;
      setTimeout(() => {
        const after = location.href;
        if (after !== before) {
          history.replaceState(null, "", before);
          history.pushState(null, "", after);
          ctx.lastRoute = location.hash;
        }
      }, 0);
    },
    true,
  );
  for (const id of ["list-toggle", "detail-toggle"])
    ctx.$("#" + id).addEventListener("click", ctx.updateHash);

  function mapReservedLabelBoxes() {
    const host = ctx.$("#map-host").getBoundingClientRect();
    return (
      ctx.dualMode
        ? ["#dual-map-legend", ".map-controls", "#left-pane-head"]
        : [
            "#legend",
            ".map-controls",
            ".workspace-heading",
            ".map-toolbar",
            ".map-metrics",
          ]
    )
      .map((selector) => ctx.$(selector))
      .filter(
        (el) => el && !el.hidden && getComputedStyle(el).display !== "none",
      )
      .map((el) => {
        const r = el.getBoundingClientRect();
        return [
          r.left - host.left - 5,
          r.top - host.top - 5,
          r.right - host.left + 5,
          r.bottom - host.top + 5,
        ];
      })
      .filter((b) => b[2] > 0 && b[0] < ctx.w && b[3] > 0 && b[1] < ctx.h);
  }
  ctx.hoveredLabelKey = "";
  function updateCartographicLabels() {
    if (!ctx.world) return;
    const threshold =
        ctx.state.cartography.labels === "rich"
          ? 1.5
          : ctx.state.cartography.labels === "sparse"
            ? 3.5
            : 2,
      detailed =
        ctx.state.level === "town" &&
        !ctx.isLeg() &&
        (ctx.transform.k >= threshold ||
          ctx.state.county ||
          ctx.state.brushed.length);
    ctx.world
      .select(".town-geometries")
      .attr(
        "display",
        ctx.state.level === "town" && !ctx.isLeg() ? "" : "none",
      );
    ctx.world
      .select(".town-geometries")
      .selectAll("path")
      .attr("display", "")
      .style(
        "stroke-width",
        ctx.state.cartography.boundaries === "town"
          ? ".7px"
          : ctx.state.cartography.boundaries === "subtle"
            ? ".25px"
            : ctx.transform.k < 2 && !ctx.state.county
              ? "0"
              : ".7px",
      );
    ctx.world
      .selectAll(".county-outline")
      .style(
        "stroke-opacity",
        ctx.state.cartography.boundaries === "subtle" ? 0.45 : 1,
      );
    ctx.world
      .select(".county-geometries")
      .attr(
        "display",
        ctx.isLeg() || ctx.state.level === "county" ? "" : "none",
      );
    if (ctx.state.chart === "map" && !ctx.isLeg())
      ctx.$("#view-description").textContent =
        (ctx.state.level === "county"
          ? "縣市統計"
          : detailed
            ? "鄉鎮市區統計"
            : "鄉鎮得票填色 · 縣市輪廓概覽") +
        " · " +
        ({
          winner: "第一名",
          runner: "第二名",
          margin: "前兩名差距",
          turnout: "投票率",
          share: ctx.state.candidate + "得票率",
        }[ctx.state.metric] ||
          ctx.EXTRA_METRICS[ctx.state.metric]?.title ||
          "選舉結果");
    // Selected labels take precedence; recompute screen-space collision on each zoom.
    ctx.world
      .selectAll(".geo-label")
      .each(function () {
        if (!this.dataset.labelWidth) {
          this.removeAttribute("display");
          this.dataset.labelWidth = this.getComputedTextLength() + 14;
        }
      })
      .attr("display", "none");
    const defaultLabels = ctx.world
        .selectAll(
          detailed && ctx.transform.k >= threshold
            ? ".town-label"
            : ".county-label",
        )
        .nodes(),
      important = ctx.world
        .selectAll(".geo-label")
        .nodes()
        .filter((n) =>
          [ctx.state.key, ctx.hoveredLabelKey].includes(ctx.geoKey(n.__data__)),
        ),
      nodes = [...new Set([...important, ...defaultLabels])].sort((a, b) => {
        const priority = ["63000", "65000", "66000", "64000", "67000", "68000"],
          rank = (n) => {
            const code = n.__data__.properties.COUNTYCODE,
              index = priority.indexOf(code);
            return ctx.geoKey(n.__data__) === ctx.state.key
              ? -30
              : ctx.geoKey(n.__data__) === ctx.hoveredLabelKey
                ? -20
                : code === ctx.state.county
                  ? -10
                  : index >= 0
                    ? index
                    : 20;
          };
        return rank(a) - rank(b);
      }),
      reserved = ctx.mapReservedLabelBoxes(),
      boxes = [...reserved],
      leaders = [];
    for (const n of nodes) {
      if (
        !ctx.state.labels &&
        ![ctx.state.key, ctx.hoveredLabelKey].includes(ctx.geoKey(n.__data__))
      )
        continue;
      const f = n.__data__;
      if (
        ctx.state.cartography.labels === "sparse" &&
        boxes.length - reserved.length >= (detailed ? 35 : 10) &&
        ctx.geoKey(f) !== ctx.state.key &&
        ctx.geoKey(f) !== ctx.hoveredLabelKey
      )
        continue;
      if (
        ctx.state.county &&
        f.properties.TOWNCODE &&
        f.properties.COUNTYCODE !== ctx.state.county
      )
        continue;
      const [x, y] = ctx.transform.apply([+n.dataset.x, +n.dataset.y]),
        bw = +n.dataset.labelWidth || n.textContent.length * 13 + 14,
        selected = ctx.geoKey(f) === ctx.state.key,
        hovered = ctx.geoKey(f) === ctx.hoveredLabelKey,
        candidates =
          selected ||
          hovered ||
          (!f.properties.TOWNCODE &&
            ["63000", "65000", "66000", "64000", "67000", "68000"].includes(
              f.properties.COUNTYCODE,
            ))
            ? [
                [0, 0],
                [0, -20],
                [0, 22],
                [-36, 0],
                [36, 0],
                [0, 40],
                [0, -40],
                [-54, -18],
                [54, 18],
                [0, 70],
                [0, 100],
                [-80, 70],
                [80, 70],
                [0, 130],
              ]
            : [
                [0, 0],
                [0, -18],
                [0, 18],
              ];
      if (!Number.isFinite(x + y)) continue;
      for (const [dx, dy] of candidates) {
        const px = x + dx,
          py = y + dy,
          box = [px - bw / 2, py - 15, px + bw / 2, py + 8];
        if (
          box[0] < 12 ||
          box[2] > ctx.w - 12 ||
          py < 30 ||
          py > ctx.h - 16 ||
          boxes.some(
            (b) =>
              box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
          )
        )
          continue;
        n.removeAttribute("display");
        n.setAttribute(
          "transform",
          `translate(${+n.dataset.x + dx / ctx.transform.k},${+n.dataset.y + dy / ctx.transform.k}) scale(${1 / ctx.transform.k})`,
        );
        n.classList.toggle("selected-label", selected || hovered);
        boxes.push(box);
        if (dx || dy)
          leaders.push({
            x: +n.dataset.x,
            y: +n.dataset.y,
            tx: +n.dataset.x + dx / ctx.transform.k,
            ty: +n.dataset.y + (dy - (dy > 0 ? 10 : -3)) / ctx.transform.k,
          });
        break;
      }
    }
    ctx.world
      .selectAll("g.label-leaders")
      .data([0])
      .join("g")
      .attr("class", "label-leaders")
      .attr("pointer-events", "none")
      .selectAll("line")
      .data(leaders)
      .join("line")
      .attr("x1", (d) => d.x)
      .attr("y1", (d) => d.y)
      .attr("x2", (d) => d.tx)
      .attr("y2", (d) => d.ty)
      .attr("stroke", "#798995")
      .attr("stroke-width", 0.8)
      .attr("vector-effect", "non-scaling-stroke");
    if (
      ctx.state.chart === "map" &&
      !ctx.isLeg() &&
      ctx.$("#legend .legend-title") &&
      ["winner", "runner"].includes(ctx.state.metric)
    )
      ctx.$("#legend .legend-title").textContent =
        (ctx.state.level === "town" ? "鄉鎮市區" : "縣市") +
        " · " +
        (ctx.state.metric === "winner" ? "第一名" : "第二名") +
        "所屬政黨";
  }

  ctx.lodFeatures = {};
  ctx.appliedLod = "";
  const lodRequests = new Map();
  ctx.ensureMapLOD = (level) => {
    if (ctx.lodFeatures[level]) return Promise.resolve(ctx.lodFeatures[level]);
    if (!lodRequests.has(level))
      lodRequests.set(
        level,
        ctx
          .loadJSON(level === 2 ? "towns.json" : "towns-lod" + level + ".json")
          .then((t) => {
            const counties = ctx.topojson.feature(
                t,
                t.objects.counties,
              ).features,
              towns = ctx.topojson.feature(t, t.objects.towns).features;
            ctx.lodFeatures[level] = new Map(
              [...counties, ...towns].map((f) => [ctx.geoKey(f), f]),
            );
            if (level === 2) {
              ctx.publicationCounties = counties;
              ctx.publicationTowns = towns;
            }
            ctx.appliedLod = "";
            if (ctx.data) ctx.updateLabels();
            return ctx.lodFeatures[level];
          })
          .catch((error) => {
            lodRequests.delete(level);
            throw error;
          }),
      );
    return lodRequests.get(level);
  };
  function updateMapLOD() {
    if (!ctx.world) return;
    const tier = ctx.transform.k < 2 ? 0 : ctx.transform.k < 5 ? 1 : 2,
      signature =
        tier +
        "|" +
        ctx.w +
        "|" +
        ctx.h +
        "|" +
        Object.keys(ctx.geoByKey).length;
    if (tier > 0 && !ctx.lodFeatures[tier])
      ctx.ensureMapLOD(tier).catch(() => {});
    const projection = ctx.geoByKey["63000/000"]?.path.projection?.();
    if (projection && ctx.mapSvg) {
      const scaleX = ctx.dualMode
          ? ctx.$(".map-workspace").classList.contains("map-compact")
            ? ctx.w - 140
            : 24
          : ctx.w - 170,
        a = projection.invert(ctx.transform.invert([scaleX, ctx.h - 34])),
        b = projection.invert(ctx.transform.invert([scaleX + 100, ctx.h - 34])),
        distance = ctx.d3.geoDistance(a, b) * 6371;
      if (Number.isFinite(distance) && distance > 0) {
        const magnitude = 10 ** Math.floor(Math.log10(distance)),
          nice =
            [5, 2, 1].map((n) => n * magnitude).find((n) => n <= distance) ||
            magnitude / 2,
          length = (100 * nice) / distance;
        const scale = ctx.mapSvg
          .selectAll(".scale-bar")
          .data([0])
          .join("g")
          .attr("class", "scale-bar")
          .attr("transform", `translate(${scaleX},${ctx.h - 24})`)
          .attr("pointer-events", "none");
        scale
          .selectAll("path")
          .data([0])
          .join("path")
          .attr("d", `M0,-5V0H${length}V-5`)
          .attr("fill", "none")
          .attr("stroke", "#465666");
        scale
          .selectAll("text")
          .data([0])
          .join("text")
          .attr("x", 0)
          .attr("y", -10)
          .attr("font-size", 12)
          .attr("fill", "#465666")
          .text("本島 " + nice + " km");
      }
    }
    if (signature === ctx.appliedLod) return;
    ctx.appliedLod = signature;
    ctx.world.selectAll(".geo,.county-outline").attr("d", (f) => {
      const entry = ctx.geoByKey[ctx.geoKey(f)];
      return entry
        ? entry.path(ctx.lodFeatures[tier]?.get(ctx.geoKey(f)) || f)
        : null;
    });
  }
}
