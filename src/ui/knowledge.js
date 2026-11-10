import { knowledge, metricKnowledge } from "../data/knowledge.js";

export function installKnowledge(ctx) {
  if (document.documentElement.dataset.page === "legacy") return;
  const card = document.createElement("aside");
  card.className = "knowledge-popover";
  card.setAttribute("popover", "manual");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-labelledby", "knowledge-title");
  const shortcutTerms = new Map([
    ["metric-info", () => metricKnowledge[ctx.state.metric]],
    ["conditions-open", () => "filter"], ["groups-open", () => "groups"],
    ["contribution-open", () => "contribution"], ["spatial-open", () => "moran"],
    ["outliers-open", () => "outlier"], ["vote-seat-open", () => "vote_seats"],
    ["boundary-badge", () => "boundary"], ["home-map-label", () => "winner_party"],
    ["national-turnout", () => "turnout"],
  ]);
  const triggerSelector = ["[data-term]", "[data-metric]", ".home-map-label", ".score-main strong",
    ...[...shortcutTerms.keys()].map((id) => "#" + id)].join(",");
  let anchor, trail = [], pinned = false, openTimer, closeTimer;
  const isOpen = () => card.matches(":popover-open");
  const clear = () => { clearTimeout(openTimer); clearTimeout(closeTimer); };
  function find(target) {
    const trigger = target?.closest?.(triggerSelector);
    if (!trigger || card.contains(trigger)) return null;
    const id = trigger.dataset.term || metricKnowledge[trigger.dataset.metric] ||
      shortcutTerms.get(trigger.id)?.() ||
      (trigger.matches(".score-main strong") ? "share" : trigger.matches(".home-map-label") ? "winner_party" : null);
    return knowledge.has(id) ? { trigger, id } : null;
  }
  function position() {
    if (!isOpen()) return;
    if (!anchor?.isConnected) { close(); return; }
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const left = Math.max(12, Math.min(rect.left, innerWidth - card.offsetWidth - 12));
    const below = rect.bottom + gap;
    const above = rect.top - card.offsetHeight - gap;
    const top = below + card.offsetHeight < innerHeight - 12 ? below : Math.max(12, above);
    card.style.left = left + "px";
    card.style.top = Math.min(top, Math.max(12, innerHeight - card.offsetHeight - 12)) + "px";
  }
  function close(returnFocus = false) {
    clear();
    if (isOpen()) card.hidePopover();
    if (anchor?.matches("[data-term], #metric-info, #boundary-badge"))
      anchor.removeAttribute("aria-expanded");
    const previous = anchor;
    anchor = null;
    trail = [];
    pinned = false;
    if (returnFocus && previous?.isConnected) {
      // Suppress the focus handler when returning to the control that closed the card.
      previous.dataset.knowledgeReturn = "";
      previous.focus({ preventScroll: true });
      delete previous.dataset.knowledgeReturn;
    }
  }
  function render(focus = false) {
    const item = knowledge.get(trail.at(-1));
    const nav = trail.length < 3 ? item.related.map((id) =>
      '<button type="button" data-knowledge-next="' + id + '">' + knowledge.get(id).label + '</button>').join("") : "";
    const version = ctx.siteMetadata?.data_updated_at || ctx.data?.updatedAt;
    card.innerHTML = `<header><span>讀圖說明 · ${trail.length} / 3</span><button type="button" data-knowledge-close aria-label="關閉說明">×</button></header>
      <h2 id="knowledge-title">${item.label}</h2><p>${item.definition}</p>
      <details open><summary>口徑與單位</summary><p>${item.method}</p></details>
      ${nav ? '<div class="knowledge-related" aria-label="相關術語">' + nav + "</div>" : ""}
      <footer>${trail.length > 1 ? '<button type="button" data-knowledge-back>返回上層</button>' : ""}
        <button type="button" data-knowledge-pin aria-pressed="${pinned}">${pinned ? "解除固定" : "固定說明"}</button>
        <a href="${new URL("about/", document.baseURI)}">${version ? "來源 " + ctx.esc(version) : "資料來源"} ↗</a>
      </footer>`;
    position();
    if (focus) card.querySelector("[data-knowledge-back], [data-knowledge-pin]").focus({ preventScroll: true });
  }
  function open({ trigger, id }, fixed = false) {
    if (anchor !== trigger) {
      close();
      anchor = trigger;
      trail = [id];
      if (trigger.matches("[data-term], #metric-info, #boundary-badge")) {
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute("aria-expanded", "true");
      }
    }
    if (fixed) pinned = true;
    const host = trigger.closest("dialog[open]") || document.body;
    if (card.parentElement !== host) host.append(card);
    if (!isOpen()) card.showPopover();
    render(fixed);
  }
  const deferClose = (target) => {
    if (pinned || card.contains(target) || anchor?.contains(target)) return;
    clear();
    closeTimer = setTimeout(() => close(), 360);
  };
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    if (card.contains(event.target)) { clear(); return; }
    const match = find(event.target);
    if (!match || pinned) return;
    clear();
    if (anchor !== match.trigger) openTimer = setTimeout(() => open(match), 290);
  });
  document.addEventListener("pointerout", (event) => {
    const match = find(event.target);
    if (!match && !card.contains(event.target)) return;
    if (match?.trigger.contains(event.relatedTarget)) return;
    deferClose(event.relatedTarget);
  });
  document.addEventListener("focusin", (event) => {
    const match = find(event.target);
    if (match && !pinned && !match.trigger.hasAttribute("data-knowledge-return")) open(match);
    else if (isOpen() && !card.contains(event.target)) deferClose(event.target);
  });
  document.addEventListener("click", (event) => {
    const match = find(event.target);
    if (match?.trigger.matches("[data-term],#metric-info,#boundary-badge")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pinned && anchor === match.trigger) close();
      else open(match, true);
    } else if (isOpen() && !card.contains(event.target)) close();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (trail.length > 1) { trail.pop(); render(true); }
    else close(true);
  }, true);
  card.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-knowledge-close")) close(true);
    else if (button.hasAttribute("data-knowledge-pin")) { pinned = !pinned; render(true); }
    else if (button.hasAttribute("data-knowledge-back")) { trail.pop(); render(true); }
    else if (button.dataset.knowledgeNext && trail.length < 3) {
      trail.push(button.dataset.knowledgeNext);
      render(true);
    }
  });
  card.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-knowledge-next]");
    if (!target || target.contains(event.relatedTarget)) return;
    clearTimeout(openTimer);
    const id = target.dataset.knowledgeNext;
    openTimer = setTimeout(() => {
      if (!target.isConnected || trail.length >= 3) return;
      trail.push(id);
      render();
    }, 330);
  });
  card.addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-knowledge-next]");
    if (target && !target.contains(event.relatedTarget)) clearTimeout(openTimer);
  });
  window.addEventListener("resize", position, { passive: true });
  document.addEventListener("scroll", position, { capture: true, passive: true });
  const index = ctx.$("#knowledge-index");
  if (index) for (const item of knowledge.values()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.term = item.id;
    button.textContent = item.label;
    index.append(button);
  }
}
