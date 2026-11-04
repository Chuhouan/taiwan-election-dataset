export function installSelection(ctx) {
  const targetSelector =
    "#map .geo,#scatter [data-region-key],#scatter [data-region-keys],.bubble-rank-row,.region-row,.district-geo";
  let index = new Map(),
    marked = new Set(),
    hover = [];
  const keysFor = (node) =>
    (
      node.dataset.regionKeys ||
      node.dataset.regionKey ||
      node.dataset.key ||
      node.dataset.region ||
      ""
    )
      .split(",")
      .filter(Boolean);
  function clearHover() {
    for (const node of marked) {
      node.classList.remove("linked-region", "linked-parent");
    }
    marked.clear();
  }
  function applyHover() {
    clearHover();
    for (const key of hover) {
      const r = ctx.records?.[key];
      for (const node of index.get(key) || []) {
        node.classList.add("linked-region");
        marked.add(node);
      }
      if (!r) continue;
      const parent = r.county + "/000";
      if (r.town !== "000" || ctx.isLeg()) {
        for (const node of index.get(parent) || []) {
          node.classList.add("linked-parent");
          marked.add(node);
        }
      } else if (!ctx.isLeg()) {
        for (const [child, nodes] of index)
          if (child.startsWith(r.county + "/") && child !== key)
            for (const node of nodes) {
              node.classList.add("linked-parent");
              marked.add(node);
            }
      }
    }
  }
  ctx.setRegionHover = (value) => {
    const next = Array.isArray(value) ? value : value ? [value] : [];
    if (next.join(",") === hover.join(",")) return;
    hover = next;
    applyHover();
  };
  ctx.refreshLinkedMarks = () => {
    clearHover();
    index = new Map();
    for (const node of document.querySelectorAll(targetSelector)) {
      const keys = keysFor(node);
      for (const key of keys) {
        if (!index.has(key)) index.set(key, new Set());
        index.get(key).add(node);
      }
      node.classList.toggle(
        "pinned-selection",
        !!ctx.state.key && keys.includes(ctx.state.key),
      );
    }
    applyHover();
  };
  document.addEventListener("pointerover", (event) => {
    const node = event.target.closest?.(targetSelector);
    if (node) ctx.setRegionHover(keysFor(node));
  });
  document.addEventListener("pointerout", (event) => {
    const node = event.target.closest?.(targetSelector);
    if (node && !node.contains(event.relatedTarget)) ctx.setRegionHover("");
  });
  document.addEventListener("focusin", (event) => {
    const node = event.target.closest?.(targetSelector);
    if (node) ctx.setRegionHover(keysFor(node));
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.(targetSelector)) ctx.setRegionHover("");
  });
  ctx.clearInspection = () => {
    ctx.state.key = "";
    ctx.state.inspection = false;
    ctx.setRegionHover("");
    ctx.updateUI();
  };
  ctx.renderSelectionRibbon = () => {
    const host = document.querySelector("#finding"),
      r = ctx.records?.[ctx.state.key];
    host.classList.toggle("selection-active", !!r && ctx.state.inspection);
    if (!r || !ctx.state.inspection) return false;
    host.replaceChildren();
    const title = document.createElement("div");
    title.className = "selection-place";
    const label = document.createElement("small");
    label.textContent = "目前檢視";
    const name = document.createElement("strong");
    name.textContent = ctx.areaName(r, true);
    title.append(label, name);
    host.append(title);
    const candidates = document.createElement("div");
    candidates.className = "selection-candidates";
    const reference = ctx.isLeg()
      ? r.candidates
      : ctx.records["00000/000"].candidates;
    for (const ref of reference.slice(0, 3)) {
      const c = r.candidates.find((c) => c.name === ref.name);
      if (!c) continue;
      const item = document.createElement("span"),
        dot = document.createElement("i"),
        name = document.createElement("span"),
        share = document.createElement("b");
      dot.style.background = ctx.color(c.party);
      name.textContent = c.name;
      share.textContent = ctx.pct((c.votes / r.total) * 100);
      item.append(dot, name, share);
      candidates.append(item);
    }
    host.append(candidates);
    const votes = document.createElement("span");
    votes.className = "selection-votes";
    votes.textContent = ctx.fmt(r.total) + " 有效票";
    host.append(votes);
    const actions = document.createElement("div");
    actions.className = "selection-actions";
    for (const [label, action] of [
      [
        "詳情",
        () => {
          document.body.classList.remove("detail-closed");
          ctx.$("#detail-toggle").setAttribute("aria-expanded", "true");
          ctx.scheduleCanvasReflow();
          ctx.updateHash();
        },
      ],
      [
        "縣市內比較",
        () => {
          ctx.selectRegion(ctx.state.key, true);
          if (ctx.dualMode || ctx.state.chart === "map")
            ctx.zoomToRegion(r.county + "/000");
        },
      ],
      ["×", () => ctx.clearInspection()],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (label === "×")
        button.setAttribute("aria-label", "取消固定檢視，保留分析範圍");
      button.onclick = action;
      actions.append(button);
    }
    host.append(actions);
    return true;
  };
}
