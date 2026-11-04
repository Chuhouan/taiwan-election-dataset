/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    villageAll,
    villageCandidates,
    villageTownRecord,
    villageResults,
    loadVillagePayload,
    villageCompetitionValue,
    villageCompetitionDomain,
    villageColor,
    villageListReading,
    villageList,
    villageDetail,
    selectVillage,
    renderVillageMap,
    renderVillage,
    openVillage,
    serializeVillageRoute,
    parseVillageRoute,
    villageLabelFontSize,
    refreshVillageLabels,
  });
  /* County-sharded village explorer. Special statistical groups remain list-only. */
  ctx.villageCache = new Map();
  ctx.villagePayload = null;
  ctx.villageTown = "";
  ctx.villageSelection = "";
  ctx.villageMetric = "winner";
  ctx.villageRange = "focus";
  ctx.villageCandidate = "賴清德";
  ctx.villageZoom = null;
  ctx.villageLabelUpdater = null;
  ctx.villageRequest = 0;
  ctx
    .$("#detail-export")
    .insertAdjacentHTML(
      "beforebegin",
      '<button id="village-open" hidden>村里細查 ↗</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="village-dialog" aria-labelledby="village-title"><header class="village-header"><div><span id="village-election-title">2024 總統副總統選舉 · 村里層級</span><h2 id="village-title">村里細查</h2></div><button id="village-close" aria-label="關閉村里細查">×</button></header><div class="village-toolbar"><label>鄉鎮市區<select id="village-town"></select></label><label>地圖指標<select id="village-metric"><option value="winner">第一名</option><option value="share">候選人得票率</option><option value="margin">前兩名差距</option><option value="turnout">投票率</option><option value="enp">有效候選人數 ENP</option><option value="hhi">得票集中度 HHI</option></select></label><select id="village-candidate" aria-label="候選人" hidden><option>賴清德</option><option>侯友宜</option><option>柯文哲</option></select><label id="village-range-label" hidden>色階<select id="village-range"><option value="focus">本鄉鎮資料範圍</option><option value="full">完整理論範圍</option></select></label><input id="village-search" aria-label="搜尋村里" placeholder="搜尋本縣市村里"><select id="village-export-scope" aria-label="村里匯出範圍"><option value="town">目前鄉鎮村里</option><option value="county">全縣市村里</option></select><button id="village-export">匯出 CSV</button></div><div class="village-layout"><aside class="village-list-pane"><div class="village-pane-title"><b>村里結果</b><span id="village-count"></span></div><div id="village-list" class="village-list"></div></aside><section class="village-map-pane"><svg id="village-map" viewBox="0 0 900 570" role="group" aria-label="可縮放的村里選舉地圖"></svg><div id="village-tip" class="village-tip" hidden></div><div class="village-map-controls"><button id="village-zoom-in" aria-label="放大村里地圖">＋</button><button id="village-zoom-out" aria-label="縮小村里地圖">−</button><button id="village-reset" aria-label="重設村里地圖">⌂</button></div><div id="village-legend" class="village-legend"></div></section><aside id="village-detail" class="village-detail"></aside></div><footer class="village-footer">中選會2024村里統計 × 內政部1120928歷史村里圖資（含附補圖）；幾何經簡化，非測量界線。特殊或合併統計單位僅列清單，不推估地理範圍。<a href="https://data.gov.tw/dataset/130549" target="_blank" rel="noopener">圖資與授權 ↗</a></footer></dialog>`,
  );
  function villageAll() {
    return ctx.villagePayload
      ? [
          ...ctx.villagePayload.features.map((f) => f.properties),
          ...ctx.villagePayload.special,
        ]
      : [];
  }
  function villageCandidates() {
    return (
      ctx.villagePayload?.metadata.candidates ||
      ctx.data.president["00000/000"].candidates
    );
  }
  function villageTownRecord(town = ctx.villageTown) {
    return ctx.data.president[ctx.villagePayload.metadata.county + "/" + town];
  }
  function villageResults(r) {
    return ctx
      .villageCandidates()
      .map((c) => ({
        ...c,
        votes: r.votes[String(Number(c.number))] || 0,
        share: r.valid
          ? ((r.votes[String(Number(c.number))] || 0) / r.valid) * 100
          : null,
      }))
      .sort((a, b) => b.votes - a.votes);
  }
  async function loadVillagePayload(election, county, districtKey) {
    const key = election + "/" + (districtKey || county);
    if (ctx.villageCache.has(key)) return ctx.villageCache.get(key);
    const baseKey = "geometry/" + county;
    if (!ctx.villageCache.has(baseKey)) {
      const response = await fetch(
        "villages/" + encodeURIComponent(county) + ".json",
      );
      if (!response.ok) throw Error("village geometry");
      ctx.villageCache.set(baseKey, await response.json());
    }
    const base = ctx.villageCache.get(baseKey),
      fullTownCounts = {};
    for (const r of [
      ...base.features.map((f) => f.properties),
      ...base.special,
    ])
      fullTownCounts[r.town] = (fullTownCounts[r.town] || 0) + 1;
    let payload;
    if (election === "president")
      payload = {
        ...base,
        metadata: {
          ...base.metadata,
          election_id: "president:2024",
          scopeName: base.metadata.countyName,
          candidates: ctx.data.president["00000/000"].candidates,
          fullTownCounts,
        },
      };
    else {
      if (
        !ctx.data.legislator[districtKey] ||
        ctx.data.legislator[districtKey].town !== "000" ||
        ctx.data.legislator[districtKey].county !== county
      )
        throw Error("invalid village district");
      const response = await fetch(
        "legislator-villages/" +
          encodeURIComponent(
            districtKey.replace(":", "-").replace("/000", ""),
          ) +
          ".json",
      );
      if (!response.ok) throw Error("legislator village results");
      const result = await response.json(),
        features = base.features
          .filter((f) => result.units[f.properties.id])
          .map((f) => ({
            ...f,
            properties: { ...f.properties, ...result.units[f.properties.id] },
          })),
        special = base.special
          .filter((r) => result.units[r.id])
          .map((r) => ({ ...r, ...result.units[r.id] }));
      if (features.length + special.length !== Object.keys(result.units).length)
        throw Error("unmatched legislator village units");
      payload = {
        type: "FeatureCollection",
        features,
        special,
        metadata: { ...base.metadata, ...result.metadata, fullTownCounts },
      };
    }
    ctx.villageCache.set(key, payload);
    return payload;
  }
  function villageCompetitionValue(r, metric = ctx.villageMetric) {
    if (!r.valid) return null;
    const hhi = ctx.d3.sum(
      Object.values(r.votes),
      (votes) => (votes / r.valid) ** 2,
    );
    return metric === "enp" ? (hhi ? 1 / hhi : null) : hhi;
  }
  function villageCompetitionDomain() {
    const n = ctx.villageCandidates().length,
      full = ctx.villageMetric === "enp" ? [1, n] : [1 / n, 1];
    if (ctx.villageRange === "full") return full;
    const values = ctx
      .villageAll()
      .filter((r) => r.town === ctx.villageTown && r.valid)
      .map((r) => ctx.villageCompetitionValue(r));
    if (!values.length) return full;
    const domain = ctx.d3
      .scaleLinear()
      .domain(ctx.d3.extent(values))
      .nice(5)
      .domain();
    if (domain[0] === domain[1]) {
      const pad = ctx.villageMetric === "enp" ? 0.05 : 0.005;
      domain[0] -= pad;
      domain[1] += pad;
    }
    return [Math.max(full[0], domain[0]), Math.min(full[1], domain[1])];
  }
  function villageColor(r, competitionDomain = null) {
    const cs = ctx.villageResults(r);
    if (!r.valid) return "#dce2e7";
    if (["enp", "hhi"].includes(ctx.villageMetric)) {
      const [min, max] = competitionDomain || ctx.villageCompetitionDomain();
      return ctx.d3.interpolateViridis(
        max === min
          ? 0.5
          : Math.max(
              0,
              Math.min(1, (ctx.villageCompetitionValue(r) - min) / (max - min)),
            ),
      );
    }
    if (ctx.villageMetric === "winner") return ctx.color(cs[0].party);
    if (ctx.villageMetric === "share") {
      const c = cs.find((x) => x.name === ctx.villageCandidate);
      return ctx.d3.interpolateRgb(
        "#e6edf3",
        ctx.color(c.party),
      )(Math.min(1, c.share / 65));
    }
    if (ctx.villageMetric === "turnout")
      return r.eligible
        ? ctx.d3.interpolateRgb(
            "#eee9f0",
            "#66507a",
          )(Math.max(0, Math.min(1, ((r.cast / r.eligible) * 100 - 30) / 55)))
        : "#dce2e7";
    return ctx.d3.interpolateRgbBasis([
      "#fff3dd",
      "#f9bf76",
      "#df684b",
      "#a42f47",
    ])(Math.min(1, (cs[0].share - cs[1].share) / 35));
  }
  function villageListReading(r) {
    const cs = ctx.villageResults(r);
    if (["enp", "hhi"].includes(ctx.villageMetric))
      return {
        value: r.valid
          ? ctx.d3.format(".3f")(ctx.villageCompetitionValue(r))
          : "—",
        label: ctx.villageMetric.toUpperCase(),
      };
    if (ctx.villageMetric === "turnout")
      return {
        value: ctx.pct(r.eligible ? (r.cast / r.eligible) * 100 : null),
        label: "投票率",
      };
    if (ctx.villageMetric === "margin")
      return {
        value: r.valid
          ? (cs[0].share - (cs[1]?.share || 0)).toFixed(2) + " pp"
          : "—",
        label: "前兩名差距",
      };
    const candidate =
      ctx.villageMetric === "share"
        ? cs.find((c) => c.name === ctx.villageCandidate) || cs[0]
        : cs[0];
    return { value: ctx.pct(candidate.share), label: candidate.name };
  }
  function villageList() {
    const q = ctx
        .$("#village-search")
        .value.replace(/\s+/g, "")
        .replaceAll("台", "臺"),
      all = ctx.villageAll(),
      rs = all
        .filter((r) =>
          q
            ? (ctx.villagePayload.metadata.countyName + r.townName + r.name)
                .replaceAll("台", "臺")
                .includes(q)
            : r.town === ctx.villageTown,
        )
        .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    ctx.$("#village-count").textContent = rs.length + " 個";
    ctx.$("#village-list").innerHTML = rs
      .map((r) => {
        const reading = ctx.villageListReading(r);
        return (
          '<button class="village-row ' +
          (r.id === ctx.villageSelection ? "active" : "") +
          '" data-village="' +
          ctx.esc(r.id) +
          '"><span><b>' +
          ctx.esc(r.name) +
          "</b><small>" +
          ctx.esc(r.townName) +
          (r.synthetic ? " · 特殊統計組" : "") +
          "</small></span><span><strong>" +
          reading.value +
          "</strong><small>" +
          ctx.esc(reading.label) +
          "</small></span></button>"
        );
      })
      .join("");
    ctx
      .$$("[data-village]")
      .forEach((b) => (b.onclick = () => ctx.selectVillage(b.dataset.village)));
  }
  function villageDetail() {
    const all = ctx.villageAll(),
      r = all.find((x) => x.id === ctx.villageSelection),
      town = ctx.villageTownRecord(),
      leg = ctx.villagePayload.metadata.election_id === "legislator:2024";
    if (!r) {
      const units = all.filter((x) => x.town === ctx.villageTown),
        special = units.filter((x) => x.synthetic).length,
        full = ctx.villagePayload.metadata.fullTownCounts[ctx.villageTown];
      ctx.$("#village-detail").innerHTML =
        '<span class="village-kicker">' +
        (leg ? "選區內鄉鎮分部" : "鄉鎮概況") +
        "</span><h3>" +
        ctx.esc(town.name) +
        '</h3><div class="village-big">' +
        units.length +
        " <small>個統計單位</small></div><p>" +
        ctx.fmt(ctx.d3.sum(units, (x) => x.valid)) +
        " 張有效票</p>" +
        (leg && units.length < full
          ? "<p>此選區含本鄉鎮 " +
            units.length +
            "／" +
            full +
            " 個村里或統計組，地圖僅繪製本選區所屬單位。</p>"
          : "") +
        "<p>選擇村里查看候選人、得票率與投票率。" +
        (special ? "其中 " + special + " 個為特殊統計組，僅列於清單。" : "") +
        "</p>" +
        (leg ? "<p>僅為區域立委選票，不含政黨票與原住民立委選票。</p>" : "");
      return;
    }
    const cs = ctx.villageResults(r),
      turnout = r.eligible ? (r.cast / r.eligible) * 100 : null;
    const statistic = ["enp", "hhi"].includes(ctx.villageMetric)
      ? '<p class="village-statistic" data-unit-id="' +
        ctx.esc(r.id) +
        '" data-metric="' +
        ctx.villageMetric +
        '" data-value="' +
        (ctx.villageCompetitionValue(r) ?? "") +
        '">' +
        (ctx.villageMetric === "enp" ? "有效候選人數 ENP" : "得票集中度 HHI") +
        " <b>" +
        (r.valid ? ctx.d3.format(".3f")(ctx.villageCompetitionValue(r)) : "—") +
        "</b></p>"
      : "";
    ctx.$("#village-detail").innerHTML =
      '<span class="village-kicker">' +
      ctx.esc(ctx.villagePayload.metadata.scopeName) +
      " · " +
      ctx.esc(r.townName) +
      (r.synthetic ? " · 特殊統計組" : " · 村里") +
      "</span><h3>" +
      ctx.esc(r.name) +
      '</h3><div class="village-big">' +
      ctx.fmt(r.valid) +
      " <small>有效票</small></div><p>投票率 " +
      ctx.pct(turnout) +
      " · 投票 " +
      ctx.fmt(r.cast) +
      "／選舉人 " +
      ctx.fmt(r.eligible) +
      "</p>" +
      statistic +
      cs
        .map(
          (c) =>
            '<div class="village-result"><div><span><i style="background:' +
            ctx.color(c.party) +
            '"></i>' +
            ctx.esc(c.name) +
            "</span><b>" +
            ctx.pct(c.share) +
            '</b></div><div class="history-track"><i style="width:' +
            (c.share ?? 0) +
            "%;background:" +
            ctx.color(c.party) +
            '"></i></div><small>' +
            ctx.fmt(c.votes) +
            " 票" +
            (c.elected ? " · " + (leg ? "選區當選" : "全國當選") : "") +
            "</small></div>",
        )
        .join("") +
      (r.synthetic
        ? '<p class="village-special">此為合併或特殊統計單位，未繪製其地理範圍。</p>'
        : "");
    if (!leg) {
      const county = ctx.data.president[ctx.villagePayload.metadata.county + "/000"],
        parent = ctx.data.president[ctx.villagePayload.metadata.county + "/" + r.town];
      if (parent && county) {
        const rows = cs.map((c) => '<tr><th>' + ctx.esc(c.name) + '</th><td>' + ctx.pct(c.share) + '</td><td>' + ctx.pct(ctx.shareOf(parent, c.name)) + '</td><td>' + ctx.pct(ctx.shareOf(county, c.name)) + '</td></tr>').join("");
        ctx.$("#village-detail").insertAdjacentHTML("beforeend", '<section class="village-context"><h4>同場選舉 · 三個尺度</h4><table><thead><tr><th>候選人</th><th>本單位</th><th>鄉鎮</th><th>縣市</th></tr></thead><tbody>' + rows + '<tr><th>有效票</th><td>' + ctx.fmt(r.valid) + '</td><td>' + ctx.fmt(parent.total) + '</td><td>' + ctx.fmt(county.total) + '</td></tr></tbody></table><p>上級比率由原始票數加總計算；地區平均不代表所有村里相同。</p></section>');
      }
    }
    ctx.$("#village-detail").insertAdjacentHTML("beforeend", '<details class="village-evidence"><summary>本單位的圖資來源</summary><p>' + (r.synthetic ? '特殊或合併統計組：無可核驗單獨幾何。' : '官方村里界配對後簡化，非測量界線。') + '</p><p>邊界版本：' + ctx.esc(ctx.villagePayload.metadata.boundaryVersion || '依本資料集標示') + '</p></details>');
  }
  function selectVillage(id) {
    const r = ctx.villageAll().find((x) => x.id === id);
    if (!r) return;
    const moved = ctx.villageTown !== r.town;
    ctx.villageTown = r.town;
    ctx.villageSelection = id;
    ctx.$("#village-town").value = ctx.villageTown;
    ctx.villageList();
    ctx.villageDetail();
    if (moved) ctx.renderVillageMap();
    else {
      ctx.d3
        .select("#village-map")
        .selectAll(".village-shape")
        .classed("selected", (f) => f.properties.id === id);
      ctx.villageLabelUpdater?.();
    }
    ctx.updateHash();
  }
  function renderVillageMap(preserveCamera = false) {
    if (!ctx.villagePayload) return;
    const renderStarted = performance.now(),
      previousCamera =
        preserveCamera && ctx.villageZoom
          ? ctx.d3.zoomTransform(ctx.$("#village-map"))
          : null,
      competitionDomain = ["enp", "hhi"].includes(ctx.villageMetric)
        ? ctx.villageCompetitionDomain()
        : null;
    const fs = ctx.villagePayload.features.filter(
        (f) => f.properties.town === ctx.villageTown,
      ),
      svg = ctx.d3.select("#village-map");
    svg.selectAll("*").remove();
    for (const id of ["village-zoom-in", "village-zoom-out", "village-reset"])
      ctx.$("#" + id).disabled = !fs.length;
    if (!fs.length) {
      ctx.villageZoom = null;
      ctx.villageLabelUpdater = null;
      ctx.$("#village-legend").textContent =
        "此鄉鎮只有特殊統計組，沒有可配對的村里幾何；請由清單查看結果。";
      svg.attr("data-feature-count", 0);
      return;
    }
    const projection = ctx.d3.geoMercator().fitExtent(
        [
          [55, 30],
          [845, 535],
        ],
        { type: "FeatureCollection", features: fs },
      ),
      path = ctx.d3.geoPath(projection),
      layer = svg.append("g");
    layer
      .selectAll("path")
      .data(fs, (f) => f.properties.id)
      .join("path")
      .attr("class", "village-shape")
      .attr("data-village-id", (f) => f.properties.id)
      .attr("data-metric", ctx.villageMetric)
      .attr("data-metric-value", (f) =>
        ["enp", "hhi"].includes(ctx.villageMetric)
          ? ctx.villageCompetitionValue(f.properties)
          : null,
      )
      .attr("d", path)
      .attr("fill", (f) => ctx.villageColor(f.properties, competitionDomain))
      .classed("selected", (f) => f.properties.id === ctx.villageSelection)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr(
        "aria-label",
        (f) => f.properties.townName + " " + f.properties.name,
      )
      .on("click", (_, f) => ctx.selectVillage(f.properties.id))
      .on("keydown", (ev, f) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.selectVillage(f.properties.id);
        }
      })
      .on("pointermove", (ev, f) => {
        const r = f.properties,
          c = ctx.villageResults(r)[0],
          tip = ctx.$("#village-tip"),
          box = ctx.$(".village-map-pane").getBoundingClientRect();
        tip.hidden = false;
        tip.innerHTML =
          "<b>" +
          ctx.esc(r.name) +
          "</b><span>" +
          ctx.esc(c.name) +
          " " +
          ctx.pct(c.share) +
          " · " +
          ctx.fmt(r.valid) +
          " 有效票</span>" +
          (["enp", "hhi"].includes(ctx.villageMetric)
            ? "<span>" +
              ctx.villageMetric.toUpperCase() +
              " " +
              ctx.d3.format(".3f")(ctx.villageCompetitionValue(r)) +
              "</span>"
            : "");
        tip.style.left =
          Math.max(8, Math.min(box.width - 210, ev.clientX - box.left + 14)) +
          "px";
        tip.style.top =
          Math.max(8, Math.min(box.height - 70, ev.clientY - box.top + 14)) +
          "px";
      })
      .on("pointerleave", () => (ctx.$("#village-tip").hidden = true));
    const labels = layer
      .append("g")
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(fs)
      .join("text")
      .attr("class", "village-label")
      .style("font-size", ctx.villageLabelFontSize() + "px")
      .attr("text-anchor", "middle")
      .text((f) => f.properties.name);
    labels.each(function (f) {
      this.dataset.labelWidth = this.getComputedTextLength() + 10;
    });
    ctx.villageLabelUpdater = () => {
      const t = ctx.d3.zoomTransform(svg.node()),
        boxes = [],
        nodes = labels
          .nodes()
          .sort(
            (a, b) =>
              (a.__data__.properties.id === ctx.villageSelection ? -1 : 0) -
              (b.__data__.properties.id === ctx.villageSelection ? -1 : 0),
          );
      for (const node of nodes) {
        const f = node.__data__,
          p = path.centroid(f),
          [x, y] = t.apply(p),
          w = +node.dataset.labelWidth,
          fh = parseFloat(node.style.fontSize) || 14,
          box = [x - w / 2, y - fh, x + w / 2, y + fh * 0.35],
          selected = f.properties.id === ctx.villageSelection;
        node.setAttribute("display", "none");
        if (
          !Number.isFinite(x + y) ||
          x < 25 ||
          x > 875 ||
          y < 25 ||
          y > 540 ||
          (!selected && path.area(f) * t.k * t.k < 850) ||
          boxes.some(
            (b) =>
              box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
          )
        )
          continue;
        node.removeAttribute("display");
        node.setAttribute(
          "transform",
          `translate(${p[0]},${p[1]}) scale(${1 / t.k})`,
        );
        boxes.push(box);
      }
    };
    ctx.villageZoom = ctx.d3
      .zoom()
      .scaleExtent([1, 12])
      .on("zoom", (ev) => {
        layer.attr("transform", ev.transform);
        ctx.villageLabelUpdater();
      })
      .on("end", () => ctx.updateHash());
    svg
      .call(ctx.villageZoom)
      .call(ctx.villageZoom.transform, previousCamera || ctx.d3.zoomIdentity)
      .on("dblclick.zoom", null);
    const title = {
      winner: "第一名所屬政黨",
      share: ctx.villageCandidate + "得票率",
      margin: "前兩名差距",
      turnout: "投票率",
      enp: "有效候選人數 ENP",
      hhi: "得票集中度 HHI",
    }[ctx.villageMetric];
    let legend = "<b>" + ctx.esc(title) + "</b>";
    if (ctx.villageMetric === "winner")
      legend +=
        '<div class="legend-parties">' +
        [...new Set(ctx.villageCandidates().map((c) => c.party))]
          .map(
            (p) =>
              '<span><i style="background:' +
              ctx.color(p) +
              '"></i>' +
              ctx.esc(p) +
              "</span>",
          )
          .join("") +
        "</div>";
    else if (["enp", "hhi"].includes(ctx.villageMetric)) {
      const [min, max] = competitionDomain;
      legend +=
        ctx.legendRamp(
          ctx.d3.range(7).map((i) => ctx.d3.interpolateViridis(i / 6)),
          [
            ctx.d3.format(".3~f")(min),
            ctx.villageMetric === "enp" ? "有效候選人數" : "集中度",
            String(max),
          ],
        ) +
        '<div class="legend-foot">' +
        (ctx.villageMetric === "enp" ? "ENP = 1 / Σp²" : "HHI = Σp²") +
        "；p為候選人有效票占比。" +
        (ctx.villageRange === "focus"
          ? "本鄉鎮資料範圍；跨鄉鎮比較請改用理論範圍。"
          : "完整理論範圍。") +
        "</div>";
    } else {
      const colors =
        ctx.villageMetric === "share"
          ? ctx.d3
              .range(7)
              .map((i) =>
                ctx.d3.interpolateRgb(
                  "#e6edf3",
                  ctx.color(
                    ctx
                      .villageCandidates()
                      .find((c) => c.name === ctx.villageCandidate).party,
                  ),
                )(i / 6),
              )
          : ctx.villageMetric === "turnout"
            ? ctx.d3
                .range(7)
                .map((i) => ctx.d3.interpolateRgb("#eee9f0", "#66507a")(i / 6))
            : ctx.d3
                .range(7)
                .map((i) =>
                  ctx.d3.interpolateRgbBasis([
                    "#fff3dd",
                    "#f9bf76",
                    "#df684b",
                    "#a42f47",
                  ])(i / 6),
                );
      legend += ctx.legendRamp(
        colors,
        ctx.villageMetric === "share"
          ? ["0%", "得票率", "65%+"]
          : ctx.villageMetric === "turnout"
            ? ["30%", "投票率", "85%+"]
            : ["0", "差距 pp", "35+"],
      );
    }
    if (ctx.villageAll().some((r) => r.town === ctx.villageTown && !r.valid))
      legend += '<div class="legend-foot">灰色：無有效票；比率不定義。</div>';
    ctx.$("#village-legend").innerHTML = legend;
    svg
      .attr("data-render-ms", (performance.now() - renderStarted).toFixed(2))
      .attr("data-feature-count", fs.length);
    ctx.updateChartTabStops();
  }
  function renderVillage() {
    const townCodes = [...new Set(ctx.villageAll().map((r) => r.town))].sort(),
      leg = ctx.villagePayload.metadata.election_id === "legislator:2024",
      cs = ctx.villageCandidates();
    if (!cs.some((c) => c.name === ctx.villageCandidate))
      ctx.villageCandidate = cs[0].name;
    ctx.$("#village-election-title").textContent =
      "2024 " + (leg ? "區域立法委員" : "總統副總統") + "選舉 · 村里層級";
    ctx.$("#village-title").textContent =
      ctx.villagePayload.metadata.scopeName + " · 村里細查";
    ctx.$("#village-search").placeholder = leg
      ? "搜尋本選區村里"
      : "搜尋本縣市村里";
    ctx.$("#village-town").innerHTML = townCodes
      .map(
        (t) =>
          '<option value="' +
          ctx.esc(t) +
          '">' +
          ctx.esc(ctx.villageTownRecord(t).name) +
          "</option>",
      )
      .join("");
    ctx.$("#village-town").value = ctx.villageTown;
    ctx.$("#village-metric").value = ctx.villageMetric;
    ctx.$("#village-range").value = ctx.villageRange;
    ctx.$("#village-range-label").hidden = !["enp", "hhi"].includes(
      ctx.villageMetric,
    );
    ctx.$("#village-candidate").innerHTML = cs
      .map((c) => "<option>" + ctx.esc(c.name) + "</option>")
      .join("");
    ctx.$("#village-candidate").hidden = ctx.villageMetric !== "share";
    ctx.$("#village-candidate").value = ctx.villageCandidate;
    ctx.$("#village-export-scope option[value=county]").textContent = leg
      ? "整個選區村里"
      : "全縣市村里";
    ctx.villageList();
    ctx.villageDetail();
    ctx.renderVillageMap();
  }
  async function openVillage(options) {
    const election = ctx.state.e,
      county = options.county,
      districtKey = options.districtKey || "";
    if (
      !ctx.data.counties[county] ||
      (election === "legislator" &&
        (!ctx.data.legislator[districtKey] ||
          ctx.data.legislator[districtKey].town !== "000"))
    )
      return;
    const request = ++ctx.villageRequest;
    ctx.villageTown = options.town;
    ctx.villageSelection = options.selection || "";
    ctx.villageMetric = [
      "winner",
      "share",
      "margin",
      "turnout",
      "enp",
      "hhi",
    ].includes(options.metric)
      ? options.metric
      : "winner";
    ctx.villageCandidate = options.candidate || "";
    ctx.villageRange = options.range === "full" ? "full" : "focus";
    ctx.villagePayload = null;
    ctx.$("#village-search").value = "";
    if (!ctx.$("#village-dialog").open) ctx.$("#village-dialog").showModal();
    ctx.$("#village-title").textContent = "載入村里資料…";
    ctx.$("#village-map").innerHTML = "";
    ctx.$("#village-map").removeAttribute("data-feature-count");
    ctx.$("#village-list").innerHTML = "";
    ctx.$("#village-detail").textContent = "按需載入目前縣市圖資與選舉結果…";
    ctx.$("#village-tip").hidden = true;
    ctx.villageZoom = null;
    try {
      const payload = await ctx.loadVillagePayload(
        election,
        county,
        districtKey,
      );
      if (request !== ctx.villageRequest || ctx.state.e !== election) return;
      ctx.villagePayload = payload;
      const towns = [...new Set(ctx.villageAll().map((r) => r.town))];
      if (!towns.includes(ctx.villageTown)) ctx.villageTown = towns[0];
      if (!ctx.villageAll().some((r) => r.id === ctx.villageSelection))
        ctx.villageSelection = "";
      ctx.renderVillage();
      const camera = options.camera;
      if (
        camera &&
        camera.length === 3 &&
        camera.every(Number.isFinite) &&
        camera[0] >= 1 &&
        camera[0] <= 12 &&
        ctx.villageZoom
      )
        ctx.d3
          .select("#village-map")
          .call(
            ctx.villageZoom.transform,
            ctx.d3.zoomIdentity
              .translate(camera[1] * 900, camera[2] * 570)
              .scale(camera[0]),
          );
      ctx.updateHash();
    } catch (error) {
      if (request !== ctx.villageRequest) return;
      ctx.$("#village-title").textContent = "村里資料載入失敗";
      console.error(error);
    }
  }
  ctx.$("#village-open").onclick = () => {
    if (!ctx.state.key) return;
    ctx.openVillage({
      county: ctx.rec().county,
      town: ctx.rec().town,
      districtKey: ctx.isLeg() ? ctx.state.key : "",
    });
  };
  function serializeVillageRoute(p) {
    if (!ctx.$("#village-dialog").open || !ctx.villagePayload) return;
    p.set("village-county", ctx.villagePayload.metadata.county);
    if (ctx.villagePayload.metadata.districtKey)
      p.set("village-district", ctx.villagePayload.metadata.districtKey);
    p.set("village-town", ctx.villageTown);
    if (ctx.villageSelection) p.set("village-id", ctx.villageSelection);
    p.set("village-metric", ctx.villageMetric);
    p.set("village-range", ctx.villageRange);
    p.set("village-candidate", ctx.villageCandidate);
    if (ctx.villageZoom) {
      const t = ctx.d3.zoomTransform(ctx.$("#village-map"));
      p.set(
        "village-camera",
        [t.k, t.x / 900, t.y / 570].map((v) => Number(v.toFixed(5))).join(","),
      );
    }
  }
  function parseVillageRoute(p) {
    const county = p.get("village-county"),
      districtKey = p.get("village-district") || "";
    if (
      county &&
      ctx.data.counties[county] &&
      (ctx.state.e === "president" ||
        ctx.data.legislator[districtKey]?.town === "000")
    ) {
      const options = {
        county,
        districtKey,
        town: p.get("village-town"),
        selection: p.get("village-id"),
        metric: p.get("village-metric"),
        range: p.get("village-range"),
        candidate: p.get("village-candidate"),
        camera: (p.get("village-camera") || "").split(",").map(Number),
      };
      requestAnimationFrame(() => ctx.openVillage(options));
    } else if (ctx.$("#village-dialog").open) {
      ctx.villageRequest++;
      ctx.$("#village-dialog").close();
    }
  }
  ctx.$("#village-close").onclick = () => {
    ctx.villageRequest++;
    ctx.$("#village-dialog").close();
    ctx.updateHash();
  };
  ctx.$("#village-dialog").addEventListener("cancel", () => {
    ctx.villageRequest++;
    requestAnimationFrame(ctx.updateHash);
  });
  ctx.$("#village-town").onchange = (ev) => {
    ctx.villageTown = ev.target.value;
    ctx.villageSelection = "";
    ctx.$("#village-search").value = "";
    ctx.renderVillage();
    ctx.updateHash();
  };
  ctx.$("#village-range").onchange = (ev) => {
    ctx.villageRange = ev.target.value;
    ctx.renderVillageMap(true);
    ctx.updateHash();
  };
  ctx.$("#village-metric").onchange = (ev) => {
    ctx.villageMetric = ev.target.value;
    ctx.$("#village-range-label").hidden = !["enp", "hhi"].includes(
      ctx.villageMetric,
    );
    ctx.$("#village-candidate").hidden = ctx.villageMetric !== "share";
    ctx.villageList();
    ctx.villageDetail();
    ctx.renderVillageMap(true);
    ctx.updateHash();
  };
  ctx.$("#village-candidate").onchange = (ev) => {
    ctx.villageCandidate = ev.target.value;
    ctx.villageList();
    ctx.renderVillageMap(true);
    ctx.updateHash();
  };
  ctx.$("#village-search").oninput = ctx.villageList;
  for (const [id, factor] of [
    ["village-zoom-in", 1.6],
    ["village-zoom-out", 1 / 1.6],
  ])
    ctx.$("#" + id).onclick = () => {
      if (ctx.villageZoom)
        ctx.d3
          .select("#village-map")
          .transition()
          .duration(ctx.duration() / 2)
          .call(ctx.villageZoom.scaleBy, factor);
    };
  ctx.$("#village-reset").onclick = () => {
    if (ctx.villageZoom)
      ctx.d3
        .select("#village-map")
        .transition()
        .duration(ctx.duration() / 2)
        .call(ctx.villageZoom.transform, ctx.d3.zoomIdentity);
  };
  ctx.$("#village-export").onclick = () => {
    if (!ctx.villagePayload) return;
    const countyScope = ctx.$("#village-export-scope").value === "county",
      rs = ctx
        .villageAll()
        .filter((r) => countyScope || r.town === ctx.villageTown),
      leg = ctx.villagePayload.metadata.election_id === "legislator:2024";
    ctx.csvTable(
      [
        "選舉",
        "縣市",
        "選區",
        "鄉鎮",
        "統計單位ID",
        "統計單位",
        "類型",
        "候選人",
        "號次",
        "政黨",
        "票數",
        "得票率",
        "有效票",
        "投票數",
        "選舉人數",
        "投票率",
        "選舉ID",
        "資料版本",
        "邊界版本",
        "有效候選人數 ENP",
        "得票集中度 HHI",
      ],
      rs.flatMap((r) =>
        ctx
          .villageResults(r)
          .map((c) => [
            leg ? "區域立委" : "總統",
            ctx.villagePayload.metadata.countyName,
            leg ? ctx.villagePayload.metadata.scopeName : "",
            r.townName,
            r.id,
            r.name,
            r.synthetic ? "特殊統計組" : "常規村里",
            c.name,
            c.number,
            c.party,
            c.votes,
            c.share ?? "",
            r.valid,
            r.cast,
            r.eligible,
            r.eligible ? (r.cast / r.eligible) * 100 : "",
            ctx.villagePayload.metadata.election_id,
            ctx.dataVersionLabel(),
            "VILLAGE_NLSC_1120928 + Village_Sanhe",
            ctx.villageCompetitionValue(r, "enp") ?? "",
            ctx.villageCompetitionValue(r, "hhi") ?? "",
          ]),
      ),
      "臺灣2024-" +
        (countyScope
          ? ctx.villagePayload.metadata.scopeName
          : (leg ? ctx.villagePayload.metadata.scopeName + "-" : "") +
            ctx.villageTownRecord().name) +
        "-村里.csv",
    );
  };

  function villageLabelFontSize() {
    const box = ctx.$("#village-map").getBoundingClientRect(),
      scale = Math.max(0.1, Math.min(box.width / 900, box.height / 570));
    return 14 / scale;
  }
  function refreshVillageLabels() {
    if (!ctx.$("#village-dialog").open || !ctx.villageLabelUpdater) return;
    const labels = ctx.d3.select("#village-map").selectAll(".village-label");
    labels
      .attr("display", null)
      .style("font-size", ctx.villageLabelFontSize() + "px")
      .each(function () {
        this.dataset.labelWidth = this.getComputedTextLength() + 10;
      });
    ctx.villageLabelUpdater();
  }
  ctx.villageLabelSize = "";
  new ResizeObserver((entries) => {
    const b = entries[0].contentRect,
      signature = Math.round(b.width) + "|" + Math.round(b.height);
    if (signature !== ctx.villageLabelSize) {
      ctx.villageLabelSize = signature;
      requestAnimationFrame(ctx.refreshVillageLabels);
    }
  }).observe(ctx.$("#village-map"));
}
