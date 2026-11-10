const axisNames = {
  margin: "前兩名差距 · 百分點", share: "候選人得票率 · %", turnout: "投票率 · %",
  votes: "有效票 · 票", cumulative: "累積地區比例 · %", count: "地區數",
  county: "縣市", year: "選舉年份", ternary: "候選人有效票占比 · %",
};

const controlHelp = {
  election: "切換總統與立法委員選舉，圖表會套用對應的統計單位。",
  search: "搜尋地區、候選人或分析工具。",
  "county-filter": "限定資料表與圖形的縣市範圍。",
  sort: "重新排列目前範圍的地區。",
  "distribution-style": "切換分布的讀法，保留目前分析範圍。",
  "bubble-layout": "改變地區排列，圓面積仍對應有效票。",
  "hex-layout": "以地理、政黨或指標排列等權格網。",
  "hex-labels": "調整格網上要顯示的讀數。",
  "axis-x": "選擇散點圖橫軸指標。",
  "axis-y": "選擇散點圖縱軸指標。",
  "axis-size": "選擇固定點大小，或用面積表示有效票。",
  "axis-color": "選擇用第一名政黨或縣市區分地區。",
  "seat-mode": "切換完整 113 席及區域 73 席。",
  "seat-focus": "聚焦席次類型，保留完整國會的席次總數。",
  "relative-mode": "選擇各地實際得票率，或與全國基準的差。",
  "list-toggle": "打開目前範圍的地區排名。",
  "detail-toggle": "展開或收起目前地區的結果。",
  "filter-share": "最低候選人得票率，分母為該地有效票。",
  "filter-turnout": "最低投票率，分母為該地選舉人數。",
  "filter-margin": "前兩名得票率差距的上限，單位是百分點。",
  "filter-mode": "決定條件如何作用於既有範圍或只作高亮。",
  "filter-logic": "在同一組內選擇全部符合或任一符合。",
  "filter-apply": "按指定模式套用條件，結果會更新目前範圍或高亮。",
  "product-history-president": "查看各屆總統選舉的全國趨勢。",
  "product-history-counties": "在同一縣市口徑下比較各屆結果。",
  "product-history-seats": "查看 2024 完整國會和區域席次。",
  "home-detail-explore": "在分析台保留這個地區和目前地圖視角。",
  "theme-toggle": "在一般配色與夜間護眼配色間切換。",
  "language-toggle": "切換繁體與簡體，地區識別碼及選舉設定維持相同。",
};

const readoutTarget = [
  "button", "select", "input", "summary", "a[href]", "[data-axis] .tick text",
  ".ternary-scale-tick", ".history-axis .tick text", ".legend-parties span", ".legend-ticks span",
].join(",");

export function installShortReadout(ctx, occupied) {
  const tooltip = document.createElement("div");
  tooltip.id = "atlas-short-readout";
  tooltip.className = "atlas-short-readout";
  tooltip.setAttribute("popover", "manual");
  tooltip.setAttribute("role", "tooltip");
  let anchor, delay, previousDescription;
  function describe(target) {
    const text = target.textContent.trim();
    const axis = target.closest("[data-axis]")?.dataset.axis;
    if (axis && axisNames[axis]) return `${axisNames[axis]} · ${text}`;
    if (target.matches(".ternary-scale-tick")) return `候選人有效票占比的參考刻度 · ${text}`;
    if (target.closest(".history-axis")) return /^\d{4}$/.test(text) ? "選舉年份 · " + text : "比較刻度 · " + text;
    if (target.matches(".legend-parties span")) return "分類 · " + text + "。形狀與文字可用來辨認地區或席次。";
    if (target.matches(".legend-ticks span")) {
      const label = target.closest(".legend-card, .dual-map-legend, #county-history-legend")?.querySelector(".legend-title");
      return [label?.textContent.trim(), "色階刻度 " + text].filter(Boolean).join(" · ");
    }
    if (target.disabled && target.title) return target.title;
    if (target.dataset.purpose) return target.dataset.purpose;
    if (controlHelp[target.id]) return controlHelp[target.id];
    return target.title || target.getAttribute("aria-description") || "";
  }
  function hide() {
    clearTimeout(delay);
    if (tooltip.matches(":popover-open")) tooltip.hidePopover();
    if (anchor) {
      if (previousDescription) anchor.setAttribute("aria-describedby", previousDescription);
      else anchor.removeAttribute("aria-describedby");
    }
    anchor = null;
  }
  function show(target, text) {
    if (occupied(target) || !target.isConnected) return;
    (target.closest("dialog[open]") || document.body).append(tooltip);
    tooltip.textContent = text;
    tooltip.showPopover();
    const box = target.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(box.left, innerWidth - tooltip.offsetWidth - 8)) + "px";
    const top = box.bottom + tooltip.offsetHeight + 12 < innerHeight
      ? box.bottom + 6 : Math.max(8, box.top - tooltip.offsetHeight - 6);
    tooltip.style.top = top + "px";
    anchor = target;
    previousDescription = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", [previousDescription, tooltip.id].filter(Boolean).join(" "));
  }
  function targetOf(event) {
    return event.target.closest?.(readoutTarget);
  }
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const target = targetOf(event);
    if (target === anchor) return;
    hide();
    if (!target || occupied(target)) return;
    const text = describe(target);
    if (text) delay = setTimeout(() => show(target, text), 380);
  });
  document.addEventListener("pointerout", (event) => {
    const target = targetOf(event);
    if (target && !target.contains(event.relatedTarget)) hide();
  });
  document.addEventListener("focusin", (event) => {
    hide();
    const target = targetOf(event);
    if (!target || occupied(target)) return;
    const text = describe(target);
    if (text) show(target, text);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("click", hide, true);
  document.addEventListener("scroll", hide, { capture: true, passive: true });
  window.addEventListener("resize", hide, { passive: true });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") hide(); });
  ctx.$("#map-tooltip")?.setAttribute("role", "tooltip");
}
