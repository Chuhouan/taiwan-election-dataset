import {
  MOTION,
  animateMotion,
  motionDuration,
  motionEase,
} from "../core/motion.js";
import "../styles/visual-motion.css";

/** Presentation only. Geometry, numbers and route state are committed before motion starts. */
export function installVisualMotion(ctx) {
  ctx.visualMotion = true;
  for (const [kind, ms] of Object.entries(MOTION))
    document.documentElement.style.setProperty("--motion-" + kind, ms + "ms");
  let previous,
    before,
    overlay,
    frame,
    epoch = 0;
  const transient = new Set();
  const $ = ctx.$;
  ctx.chartReading = (r) => {
    if (["ternary", "small"].includes(ctx.state.chart) && !ctx.isLeg())
      return r.candidates
        .slice(0, 3)
        .map((c) => c.name + " " + ctx.pct((c.votes / r.total) * 100))
        .join("　");
    if (ctx.state.chart === "scatter") {
      const value = (field) =>
        field === "votes"
          ? ctx.fmt(ctx.axisValue(r, field)) + " 票"
          : ctx.axisValue(r, field).toFixed(2) +
            (field === "margin" ? " 個百分點" : "%");
      if (ctx.state.distribution === "scatter")
        return (
          "橫軸 " +
          ctx.labels[ctx.axes.x] +
          " " +
          value(ctx.axes.x) +
          "　縱軸 " +
          ctx.labels[ctx.axes.y] +
          " " +
          value(ctx.axes.y)
        );
      if (ctx.state.distribution === "swarm")
        return "前兩名差距 " + ctx.marginOf(r).toFixed(2) + " 個百分點";
      return (
        ctx.state.candidate +
        " " +
        ctx.pct(ctx.shareOf(r, ctx.state.candidate)) +
        (ctx.state.distribution === "dumbbell"
          ? "　" +
            ctx.statsOther +
            " " +
            ctx.pct(ctx.shareOf(r, ctx.statsOther))
          : "")
      );
    }
    return ctx.markReadout?.(r).text || "";
  };

  const rects = () =>
    new Map(
      ["#map-host", "#chart-pane", ".detail-sidebar", "#explore-dock"].map(
        (selector) => {
          const node = $(selector);
          return [
            selector,
            node && !node.hidden ? node.getBoundingClientRect() : null,
          ];
        },
      ),
    );
  function descriptor() {
    const rows = ["hex", "bubble"].includes(ctx.state.chart)
      ? ctx.overviewRecords?.()
      : ctx.scoped?.();
    return {
      chart: ctx.state.chart,
      election: ctx.state.e,
      level: ctx.state.level,
      dual: ctx.dualMode,
      keys: (rows || []).map(ctx.keyOf).sort().join(","),
      metric: ctx.state.metric,
      candidate: ctx.state.candidate,
      layout: ctx.chartOptions?.bubbleLayout,
      distribution: ctx.state.distribution,
      axes: JSON.stringify(ctx.axes),
      focus: ctx.chartOptions?.ternaryFocus,
      density: ctx.chartOptions?.densityMode,
      groups: JSON.stringify(ctx.groupSelection),
      key: ctx.state.key,
    };
  }
  function points(meta, final = false) {
    const result = new Map();
    if (!meta || !["map", "hex", "bubble"].includes(meta.chart)) return result;
    const allowed = new Set(meta.keys.split(","));
    const nodes =
      meta.chart === "map"
        ? ctx.$$("#map .geo[d], #map .district-geo[d]")
        : ctx.$$("#scatter .unit");
    for (const node of nodes) {
      const d = node.__data__,
        key = node.dataset.regionKey || node.dataset.key || d?.key;
      if (
        !allowed.has(key) ||
        !node.getClientRects().length ||
        getComputedStyle(node).display === "none" ||
        node.closest('[display="none"]')
      )
        continue;
      let p;
      if (meta.chart === "map") {
        const geo = ctx.geoByKey[key];
        if (!geo || !node.parentNode.getScreenCTM()) continue;
        const [x, y] = geo.path.centroid(geo.f);
        p = new DOMPoint(x, y).matrixTransform(node.parentNode.getScreenCTM());
      } else if (final) {
        if (!d || !node.parentNode.getScreenCTM()) continue;
        p = new DOMPoint(d.x, d.y).matrixTransform(
          node.parentNode.getScreenCTM(),
        );
      } else {
        p = new DOMPoint(0, 0).matrixTransform(node.getScreenCTM());
      }
      if (!Number.isFinite(p.x + p.y)) continue;
      const r = ctx.records[key];
      result.set(key, {
        x: p.x,
        y: p.y,
        radius: meta.chart === "map" ? 6 : d.radius,
        fill: ctx.fill(r, key),
        label: ctx.areaName(r),
        key,
      });
    }
    return result;
  }
  function cancel() {
    epoch++;
    cancelAnimationFrame(frame);
    overlay?.remove();
    overlay = null;
    for (const node of transient) node.remove();
    transient.clear();
    for (const node of ctx.$$(".motion-receiving"))
      node.classList.remove("motion-receiving");
    for (const animation of document.getAnimations())
      if (
        animation.id.startsWith("atlas-spatial") ||
        animation.id === "atlas-view-enter"
      )
        animation.cancel();
  }
  ctx.beginVisualUpdate = () => {
    // Sample in-flight positions before cancellation so a new operation can take over.
    before = {
      meta: previous,
      points:
        previous?.chart !== ctx.state.chart && motionDuration()
          ? points(previous)
          : new Map(),
      rects: rects(),
    };
    if (previous?.chart === "map" && ctx.state.chart !== "map")
      before.shapes = ctx
        .$$("#map .geo[d]")
        .filter(
          (node) =>
            node.getClientRects().length && !node.closest('[display="none"]'),
        )
        .map((node) => ({
          d: node.getAttribute("d"),
          matrix: node.getScreenCTM(),
          fill: node.getAttribute("fill") || getComputedStyle(node).fill,
        }));
    if (overlay) {
      for (const node of overlay.querySelectorAll("[data-motion-region]")) {
        const box = node.getBoundingClientRect(),
          item = before.points.get(node.dataset.motionRegion);
        if (item) {
          item.x = box.x + box.width / 2;
          item.y = box.y + box.height / 2;
        }
      }
    }
    if (
      previous &&
      previous.chart === ctx.state.chart &&
      ((previous.chart === "scatter" &&
        previous.distribution !== ctx.state.distribution) ||
        (previous.chart === "ternary" &&
          previous.density !== ctx.chartOptions.densityMode))
    ) {
      const node = $("#scatter");
      before.snapshot = {
        node: node.cloneNode(true),
        box: node.getBoundingClientRect(),
      };
    }
    cancel();
    ctx.motionCross =
      !!previous && previous.chart !== ctx.state.chart && !ctx.dualMode;
  };
  function transfer(old, next, target) {
    if (
      old.meta.dual ||
      next.dual ||
      old.meta.election !== next.election ||
      old.meta.level !== next.level ||
      old.meta.keys !== next.keys ||
      old.meta.chart === next.chart ||
      !["map", "hex", "bubble"].includes(old.meta.chart) ||
      !["map", "hex", "bubble"].includes(next.chart) ||
      old.points.size !== target.size ||
      !target.size ||
      target.size > 400
    )
      return false;
    const keys = [...target.keys()];
    if (keys.some((key) => !old.points.has(key))) return false;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("region-transfer");
    svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    svg.setAttribute("aria-hidden", "true");
    svg.dataset.from = old.meta.chart;
    svg.dataset.to = next.chart;
    const receiver = $(next.chart === "map" ? "#map .map-world" : "#scatter");
    receiver?.classList.add("motion-receiving");
    const duration = motionDuration("transform"),
      token = epoch;
    document.body.append(svg);
    overlay = svg;
    const caption = document.createElementNS(svg.namespaceURI, "text");
    caption.textContent = "同一地區 · 改變排列，範圍與票數不變";
    const host = $(
      next.chart === "map" ? "#map-host" : "#chart-pane",
    ).getBoundingClientRect();
    caption.setAttribute("x", host.x + 24);
    caption.setAttribute("y", Math.min(innerHeight - 18, host.bottom - 68));
    caption.setAttribute("class", "transfer-caption");
    svg.append(caption);
    if (old.shapes?.length) {
      const outlines = document.createElementNS(svg.namespaceURI, "g");
      for (const item of old.shapes) {
        const path = document.createElementNS(svg.namespaceURI, "path"),
          m = item.matrix;
        path.setAttribute("d", item.d);
        path.setAttribute("fill", item.fill);
        path.setAttribute(
          "transform",
          `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`,
        );
        outlines.append(path);
      }
      svg.prepend(outlines);
      animateMotion(
        outlines,
        "spatial-outline",
        [{ opacity: 0.45 }, { opacity: 0 }],
        "panel",
        { fill: "forwards" },
      );
    }
    const jobs = [];
    for (const key of keys) {
      const a = old.points.get(key),
        b = target.get(key);
      const group = document.createElementNS(svg.namespaceURI, "g");
      group.dataset.motionRegion = key;
      const shape = document.createElementNS(
        svg.namespaceURI,
        next.chart === "hex" ? "path" : "circle",
      );
      const radius = next.chart === "map" ? 6 : b.radius;
      if (next.chart === "hex") shape.setAttribute("d", ctx.hexPath(radius));
      else shape.setAttribute("r", radius);
      shape.setAttribute("fill", b.fill);
      shape.setAttribute("fill-opacity", ".78");
      group.append(shape);
      svg.append(group);
      // Keep geographic names readable while the data marks travel. No arrows or trails.
      if (keys.length <= 30 || key === next.key) {
        const text = document.createElementNS(svg.namespaceURI, "text");
        text.textContent = b.label;
        text.setAttribute("y", -Math.min(radius, 22) - 8);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("class", "transfer-label");
        group.append(text);
      }
      const startScale = Math.max(
        0.12,
        Math.min(1.8, a.radius / Math.max(1, radius)),
      );
      const animation = group.animate(
        [
          {
            transform: `translate(${a.x}px,${a.y}px) scale(${startScale})`,
            opacity: 0.8,
          },
          {
            transform: `translate(${b.x}px,${b.y}px) scale(1)`,
            opacity: 0.9,
            offset: 0.8,
          },
          { transform: `translate(${b.x}px,${b.y}px) scale(1)`, opacity: 0 },
        ],
        {
          duration,
          easing: motionEase,
          fill: "both",
          id: "atlas-spatial-" + key,
        },
      );
      jobs.push(animation.finished.catch(() => {}));
    }
    Promise.all(jobs).then(() => {
      if (token !== epoch) return;
      receiver?.classList.remove("motion-receiving");
      svg.remove();
      overlay = null;
    });
    return true;
  }
  const nav = $(".atlas-modes nav");
  let navIndicator;
  if (nav) {
    navIndicator = document.createElement("i");
    navIndicator.className = "mode-indicator";
    navIndicator.setAttribute("aria-hidden", "true");
    nav.append(navIndicator);
  }
  const showNavigation = () => {
    const active = nav?.querySelector('[aria-current="page"]');
    if (active && navIndicator) {
      navIndicator.style.width = active.offsetWidth + "px";
      navIndicator.style.transform = `translateX(${active.offsetLeft}px)`;
    }
  };
  showNavigation();
  addEventListener("resize", showNavigation);
  nav?.addEventListener("pointerover", (event) => {
    const link = event.target.closest("a[data-product-mode]");
    if (!link || !navIndicator) return;
    navIndicator.style.width = link.offsetWidth + "px";
    navIndicator.style.transform = `translateX(${link.offsetLeft}px)`;
  });
  nav?.addEventListener("pointerleave", showNavigation);
  ctx.finishVisualUpdate = () => {
    const next = descriptor(),
      old = before;
    previous = next;
    showNavigation();
    ctx.showLinkedReading?.(ctx.records?.[ctx.state.key]);
    ctx.motionCross = false;
    if (!old?.meta || !motionDuration()) return;
    const token = epoch;
    frame = requestAnimationFrame(() => {
      if (token !== epoch) return;
      const changed = next.chart !== old.meta.chart;
      if (changed && !transfer(old, next, points(next, true))) {
        animateMotion(
          $(next.chart === "map" ? "#map" : "#scatter"),
          "view-enter",
          [{ opacity: 0.2 }, { opacity: 1 }],
          "data",
        );
      }
      if (old.snapshot) {
        const { node, box } = old.snapshot;
        node.removeAttribute("id");
        node.setAttribute("aria-hidden", "true");
        node.classList.add("chart-crossfade");
        const prefix = "motion-" + token + "-";
        for (const el of node.querySelectorAll("[id]")) el.id = prefix + el.id;
        for (const el of node.querySelectorAll("[clip-path]"))
          el.setAttribute(
            "clip-path",
            el.getAttribute("clip-path").replace("url(#", "url(#" + prefix),
          );
        Object.assign(node.style, {
          position: "fixed",
          left: box.x + "px",
          top: box.y + "px",
          width: box.width + "px",
          height: box.height + "px",
          zIndex: "35",
          pointerEvents: "none",
        });
        document.body.append(node);
        transient.add(node);
        animateMotion(
          node,
          "spatial-fade",
          [{ opacity: 1 }, { opacity: 0 }],
          "panel",
        )
          ?.finished.finally(() => {
            node.remove();
            transient.delete(node);
          })
          .catch(() => {});
        animateMotion(
          $("#scatter"),
          "view-enter",
          [{ opacity: 0 }, { opacity: 1 }],
          "data",
          { delay: 90, fill: "backwards" },
        );
      }
      if (
        next.metric !== old.meta.metric ||
        next.candidate !== old.meta.candidate
      ) {
        for (const selector of [
          "#stage-metric",
          "#legend",
          "#chart-guide-encoding",
        ])
          animateMotion(
            $(selector),
            "metric",
            [
              { opacity: 0.2, transform: "translateY(3px)" },
              { opacity: 1, transform: "none" },
            ],
            "data",
          );
      }
      for (const [selector, a] of old.rects) {
        const node = $(selector),
          b = node?.getBoundingClientRect();
        if (!a?.width || !b?.width || node.hidden) continue;
        if (Math.abs(a.width - b.width) > 2 || Math.abs(a.x - b.x) > 2)
          animateMotion(
            node,
            "workspace-layout",
            [
              {
                transformOrigin: "0 0",
                transform: `translate(${a.x - b.x}px,${a.y - b.y}px) scaleX(${a.width / b.width})`,
              },
              { transformOrigin: "0 0", transform: "none" },
            ],
            "panel",
          );
      }
      if (next.groups !== old.meta.groups) {
        const prior = JSON.parse(old.meta.groups || '{"a":[],"b":[]}');
        for (const group of ["a", "b"])
          for (const key of ctx.groupSelection[group]) {
            if (prior[group]?.includes(key)) continue;
            const mark = [
              ...ctx.$$("#map .geo,#scatter [data-region-key]"),
            ].find(
              (node) =>
                (node.dataset.regionKey || node.dataset.key) === key &&
                node.getClientRects().length &&
                !node.closest('[display="none"]'),
            );
            if (!mark) continue;
            const box = mark.getBoundingClientRect(),
              badge = document.createElement("span");
            badge.className = "group-ack group-ack-" + group;
            badge.textContent = group.toUpperCase();
            badge.setAttribute("aria-hidden", "true");
            Object.assign(badge.style, {
              left: box.x + box.width / 2 + "px",
              top: box.y + box.height / 2 - 16 + "px",
            });
            document.body.append(badge);
            transient.add(badge);
            animateMotion(
              badge,
              "spatial-group",
              [
                { opacity: 0, transform: "translate(-50%,4px)" },
                { opacity: 1, transform: "translate(-50%,0)", offset: 0.35 },
                { opacity: 0, transform: "translate(-50%,-6px)" },
              ],
              "transform",
            )
              ?.finished.finally(() => {
                badge.remove();
                transient.delete(badge);
              })
              .catch(() => {});
          }
      }
    });
  };
  // Keep the one shared readout in a stable location, including for both linked panes.
  if (document.documentElement.dataset.page === "explore") {
    $(".map-bottom").insertAdjacentHTML(
      "beforebegin",
      '<div id="linked-reading" aria-live="off" hidden></div>',
    );
    ctx.showLinkedReading = (r) => {
      const host = $("#linked-reading");
      host.hidden = !r;
      document.body.classList.toggle("has-linked-reading", !!r);
      if (!r) return;
      const reading = ctx.chartReading(r);
      host.textContent =
        ctx.areaName(r, true) +
        "　" +
        (ctx.dualMode
          ? "地圖：" + ctx.markReadout(r).text + "　｜　圖表："
          : "") +
        reading +
        "　· 有效票 " +
        ctx.fmt(r.total);
    };
    const selector =
      "#map .geo,#scatter [data-region-key],.bubble-rank-row,.region-row,.district-geo";
    document.addEventListener("pointerover", (event) => {
      const node = event.target.closest?.(selector);
      const key =
        node?.dataset.regionKey || node?.dataset.key || node?.dataset.region;
      if (key) ctx.showLinkedReading(ctx.records?.[key]);
    });
    document.addEventListener("pointerout", (event) => {
      const node = event.target.closest?.(selector);
      if (node && !node.contains(event.relatedTarget))
        ctx.showLinkedReading(ctx.records?.[ctx.state.key]);
    });
    ctx.showLinkedReading();
  }
  // Panels enter and leave in the same direction. Exit snapshots never contain controls.
  const panelRects = new WeakMap(),
    ghosts = new Map();
  function panelMotion(node, visible) {
    ghosts.get(node)?.remove();
    ghosts.delete(node);
    if (visible) {
      panelRects.set(node, node.getBoundingClientRect());
      animateMotion(node, "panel", [
        { opacity: 0.15, transform: "translateX(18px)" },
        { opacity: 1, transform: "none" },
      ]);
    } else {
      const box = panelRects.get(node);
      if (!box?.width || !motionDuration()) return;
      const ghost = node.cloneNode(true);
      ghost.hidden = false;
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      for (const el of [ghost, ...ghost.querySelectorAll("[id]")])
        el.removeAttribute("id");
      ghost.classList.add("closed-panel-ghost");
      Object.assign(ghost.style, {
        position: "fixed",
        left: box.x + "px",
        top: box.y + "px",
        width: box.width + "px",
        height: box.height + "px",
        zIndex: "38",
        pointerEvents: "none",
        overflow: "hidden",
      });
      document.body.append(ghost);
      ghosts.set(node, ghost);
      const animation = animateMotion(ghost, "panel-exit", [
        { opacity: 0.85, transform: "none" },
        { opacity: 0, transform: "translateX(18px)" },
      ]);
      animation?.finished
        .finally(() => {
          ghost.remove();
          if (ghosts.get(node) === ghost) ghosts.delete(node);
        })
        .catch(() => {});
    }
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const node = record.target;
      if (node === document.body) {
        const wasClosed = (record.oldValue || "")
          .split(" ")
          .includes("detail-closed");
        const closed = node.classList.contains("detail-closed");
        if (wasClosed !== closed) panelMotion($(".detail-sidebar"), !closed);
      } else panelMotion(node, !node.hidden);
    }
  });
  for (const node of ctx.$$("#explore-dock,#conditions,#groups-panel"))
    observer.observe(node, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
    attributeOldValue: true,
  });
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", () => {
    if (!media.matches) return;
    cancel();
    const marks = ctx.d3.selectAll("#map *,#scatter *");
    for (const name of [null, "coordinates", "rank", "camera"])
      marks.interrupt(name);
    if (ctx.data) ctx.updateUI();
  });
  addEventListener("pagehide", cancel);
  addEventListener("resize", cancel);
  addEventListener(
    "scroll",
    () => {
      if (overlay) cancel();
    },
    { passive: true },
  );
  if (document.documentElement.dataset.page === "home") {
    ctx.presentPageArrival = () => {
      let seen = false;
      try {
        seen = sessionStorage.getItem("atlas-result-seen") === "1";
        sessionStorage.setItem("atlas-result-seen", "1");
      } catch {}
      if (!motionDuration()) return;
      const fade = (selector, delay = 0, duration = 300) => {
        for (const node of ctx.$$(selector))
          animateMotion(
            node,
            "home-enter",
            [
              { opacity: 0.15, transform: "translateY(6px)" },
              { opacity: 1, transform: "none" },
            ],
            "intro",
            { delay, duration, fill: "backwards" },
          );
      };
      if (seen) {
        fade(".home-map-label", 0, 180);
        return;
      }
      fade("#home-title,.home-kicker,.home-deck", 0);
      ctx
        .$$(".home-candidate-bar")
        .forEach((node, i) =>
          animateMotion(
            node,
            "result-bar",
            [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
            "data",
            { delay: 90 + i * 70, duration: 460, fill: "backwards" },
          ),
        );
      for (const node of ctx.$$("#map .geo"))
        animateMotion(
          node,
          "result-fill",
          [{ fillOpacity: 0.12 }, { fillOpacity: 1 }],
          "data",
          { delay: 240, duration: 440, fill: "backwards" },
        );
      fade(
        "#map .inset-title,#map .inset-summary,.home-map-label,#home-map-votes",
        570,
        250,
      );
    };
  }
}
