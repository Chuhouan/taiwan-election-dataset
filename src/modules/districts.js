/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    loadDistrictGeometry,
    districtColor,
    updateDistrictGeometry,
    updateDistrictLabels,
    zoomDistrictRegion,
  });
  /* 2024 CEC village assignments + official historical village geometry.
   Unassigned mainland areas remain neutral; island single-member counties use their county locator. */
  ctx.districtGeometry = null;
  ctx.districtPromise = null;
  function loadDistrictGeometry() {
    if (ctx.districtPromise) return;
    ctx.districtPromise = fetch("districts-2024.json")
      .then((r) => {
        if (!r.ok) throw Error("district geometry");
        return r.json();
      })
      .then((d) => {
        ctx.districtGeometry = d;
        if (ctx.data && ctx.isLeg() && ctx.state.chart === "map") {
          ctx.buildMap();
          ctx.updateUI();
        }
      })
      .catch(() => {
        ctx.$("#map-context").textContent =
          "選區範圍載入失敗；可使用完整結果列表與等格圖。";
      });
  }
  function districtColor(r) {
    if (!r) return "url(#map-missing)";
    if (ctx.state.metric === "runner")
      return r.candidates[1]
        ? ctx.color(r.candidates[1].party)
        : "url(#map-missing)";
    if (ctx.state.metric === "margin")
      return ctx.d3.interpolateRgbBasis([
        "#fff3dd",
        "#f9bf76",
        "#df684b",
        "#a42f47",
      ])(Math.min(r.margin / 35, 1));
    if (ctx.state.metric === "turnout")
      return ctx.d3.interpolateRgb(
        "#eee9f0",
        "#66507a",
      )(Math.max(0, Math.min(1, (r.turnout - 30) / 55)));
    return ctx.color(r.candidates[0].party);
  }
  function updateDistrictGeometry() {
    if (!ctx.world) return;
    const active = ctx.isLeg() && ctx.state.chart === "map";
    ctx.world
      .select(".district-geometries")
      .attr("display", active ? "" : "none");
    ctx.world.select(".district-labels").attr("display", active ? "" : "none");
    if (!active) return;
    if (!ctx.districtGeometry) {
      ctx.loadDistrictGeometry();
      ctx.$("#map-context").textContent = "載入2024選區範圍…";
      return;
    }
    const layer = ctx.world
      .selectAll(".district-geometries")
      .data([0])
      .join((enter) =>
        enter
          .insert("g", ".county-borders")
          .attr("class", "district-geometries"),
      )
      .attr("display", "");
    const paths = layer
      .selectAll("path")
      .data(ctx.districtGeometry.features, (f) => f.properties.key)
      .join("path")
      .attr("class", "district-geo")
      .attr("data-region-key", (f) => f.properties.key)
      .attr("d", (f) => ctx.geoByKey[f.properties.COUNTYCODE + "/000"]?.path(f))
      .attr("fill", (f) => ctx.districtColor(ctx.records[f.properties.key]))
      .attr("fill-opacity", (f) =>
        ctx.state.county && f.properties.COUNTYCODE !== String(ctx.state.county)
          ? 0.22
          : 1,
      )
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr(
        "aria-label",
        (f) =>
          ctx.areaName(ctx.records[f.properties.key], true) +
          " " +
          ctx.records[f.properties.key].candidates[0].name,
      );
    paths
      .each((f) => {
        ctx.geoByKey[f.properties.key] = {
          f,
          path: ctx.geoByKey[f.properties.COUNTYCODE + "/000"].path,
        };
      })
      .on("pointermove", (ev, f) => {
        ctx.chartTip(ev, ctx.records[f.properties.key]);
        ctx
          .$$(".region-row.hovering")
          .forEach((n) => n.classList.remove("hovering"));
        document
          .querySelector('.region-row[data-region="' + f.properties.key + '"]')
          ?.classList.add("hovering");
      })
      .on("pointerleave", () => {
        ctx.$("#map-tooltip").hidden = true;
        ctx
          .$$(".region-row.hovering")
          .forEach((n) => n.classList.remove("hovering"));
      })
      .on("click", (ev, f) => {
        ev.stopPropagation();
        ctx.selectRegion(f.properties.key);
      })
      .on("keydown", (ev, f) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.selectRegion(f.properties.key);
        }
      });
    const selected = ctx.geoByKey[ctx.state.key];
    if (selected)
      ctx.world
        .select(".selected-outline")
        .attr("d", null);
    const labels = ctx.world
      .selectAll(".district-labels")
      .data([0])
      .join("g")
      .attr("class", "district-labels");
    labels
      .selectAll("text")
      .data(ctx.districtGeometry.features, (f) => f.properties.key)
      .join("text")
      .attr("class", "district-label")
      .attr("text-anchor", "middle")
      .text(
        (f) =>
          ctx.data.counties[f.properties.COUNTYCODE].slice(0, 2) +
          " " +
          Number(f.properties.district),
      );
    ctx.$("#map-context").textContent = "";
    ctx
      .$$("button[data-metric]")
      .forEach(
        (b) =>
          (b.disabled = !["winner", "runner", "margin", "turnout"].includes(
            b.dataset.metric,
          )),
      );
    if (["winner", "runner"].includes(ctx.state.metric)) {
      const ps = [
        ...new Set(
          ctx.districtGeometry.features
            .map(
              (f) =>
                ctx.records[f.properties.key].candidates[
                  ctx.state.metric === "runner" ? 1 : 0
                ]?.party,
            )
            .filter(Boolean),
        ),
      ];
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">73區域選區 · ' +
        (ctx.state.metric === "runner" ? "第二名" : "第一名") +
        '政黨</div><div class="legend-parties">' +
        ps
          .map(
            (p) =>
              '<span><i style="background:' +
              ctx.color(p) +
              '"></i>' +
              ctx.esc(p) +
              "</span>",
          )
          .join("") +
        '</div><div class="legend-foot">中選會村里選區歸屬 × 1120928歷史圖資；簡化顯示，非法定界線測量圖。</div>';
    } else if (ctx.state.metric === "margin")
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">前兩名差距 · 百分點</div>' +
        ctx.legendRamp(
          ctx.d3
            .range(9)
            .map((i) =>
              ctx.d3.interpolateRgbBasis([
                "#fff3dd",
                "#f9bf76",
                "#df684b",
                "#a42f47",
              ])(i / 8),
            ),
          ["0", "10", "20", "35+"],
        );
    else
      ctx.$("#legend").innerHTML =
        '<div class="legend-title">區域立委投票率</div>' +
        ctx.legendRamp(
          ctx.d3
            .range(9)
            .map((i) => ctx.d3.interpolateRgb("#eee9f0", "#66507a")(i / 8)),
          ["30%", "50%", "70%", "85%+"],
        );
    ctx.$("#view-description").textContent = "2024區域立委 · 73選區村里合併圖";
    ctx.updateDistrictLabels();
  }
  function updateDistrictLabels() {
    if (
      !ctx.world ||
      !ctx.districtGeometry ||
      !ctx.isLeg() ||
      ctx.state.chart !== "map"
    )
      return;
    ctx.world.selectAll(".county-label,.town-label").attr("display", "none");
    const boxes = [];
    const nodes = ctx.world
      .selectAll(".district-label")
      .nodes()
      .sort(
        (a, b) =>
          (a.__data__.properties.key === ctx.state.key ? -1 : 0) -
          (b.__data__.properties.key === ctx.state.key ? -1 : 0),
      );
    for (const n of nodes) {
      const f = n.__data__,
        entry = ctx.geoByKey[f.properties.key];
      if (!entry) continue;
      const p = entry.path.centroid(f),
        [x, y] = ctx.transform.apply(p),
        box = [x - 30, y - 12, x + 30, y + 6];
      n.setAttribute("display", "none");
      if (
        x < 20 ||
        x > ctx.w - 20 ||
        y < 40 ||
        y > ctx.h - 18 ||
        (x < 380 && y < 175) ||
        (x > ctx.w - 330 && y < 130) ||
        (ctx.transform.k > 2 &&
          ctx.state.county &&
          f.properties.COUNTYCODE !== ctx.state.county) ||
        boxes.some(
          (b) =>
            box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
        )
      )
        continue;
      if (ctx.state.labels) {
        n.removeAttribute("display");
        n.setAttribute(
          "transform",
          `translate(${p[0]},${p[1]}) scale(${1 / ctx.transform.k})`,
        );
        boxes.push(box);
      }
    }
  }

  function zoomDistrictRegion(key, animate = true) {
    if (
      !ctx.isLeg() ||
      !ctx.districtGeometry ||
      !ctx.geoByKey[key] ||
      !key.includes(":")
    )
      return false;
    const g = ctx.geoByKey[key],
      [[x0, y0], [x1, y1]] = g.path.bounds(g.f),
      k = Math.max(
        1,
        Math.min(
          22,
          0.7 / Math.max((x1 - x0) / ctx.w, (y1 - y0) / (ctx.h - 110)),
        ),
      );
    if (Number.isFinite(k + x0 + y0 + x1 + y1))
      ctx.zoomTo(
        ctx.d3.zoomIdentity
          .translate(ctx.w / 2, ctx.h / 2 + 25)
          .scale(k)
          .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
        animate,
      );
    return true;
  }
}
