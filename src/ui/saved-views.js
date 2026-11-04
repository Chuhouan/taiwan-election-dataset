const KEY = "taiwan-election-observatory.views.v1";
export function readSavedViews(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) || "{}");
    const clean = (items) => (Array.isArray(items) ? items : []).filter((x) => typeof x.name === "string" && typeof x.hash === "string" && x.hash.startsWith("#") && x.hash.length < 30000).slice(0, 20);
    return { saved: clean(value.saved), recent: clean(value.recent) };
  } catch { return { saved: [], recent: [] }; }
}
export function installSavedViews(ctx) {
  let library = readSavedViews(localStorage);
  const $ = ctx.$;
  $(".research-menu-items").insertAdjacentHTML("beforeend", '<div class="research-section"><strong>分析工作階段</strong><button id="saved-views-open">收藏與最近檢視</button></div>');
  document.body.insertAdjacentHTML("beforeend", '<dialog id="saved-views-dialog" class="saved-views-dialog"><header class="filter-title"><h2>分析收藏</h2><button id="saved-views-close" aria-label="關閉收藏">×</button></header><p>收藏與最近檢視只保存在這個瀏覽器。分享連結可以在其他瀏覽器還原，無須本機收藏。</p><form id="save-view-form"><label>分析名稱<input id="saved-view-name" maxlength="80" required placeholder="例如：三方競爭，北部鄉鎮"></label><button type="submit">收藏目前分析</button></form><div id="saved-view-list"></div><h3>最近檢視</h3><div id="recent-view-list"></div><h3>分析起點</h3><div id="analysis-recipes"></div><footer><button id="clear-recent-views">清除最近檢視</button></footer></dialog>');
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(library)); }
    catch { ctx.toast("瀏覽器儲存空間不可用，分享連結仍可使用。"); }
  };
  const open = (hash) => {
    $("#saved-views-dialog").close();
    if (location.hash !== hash) location.hash = hash;
  };
  const list = (host, items, saved) => {
    host.replaceChildren();
    if (!items.length) { host.textContent = saved ? "尚未收藏分析。" : "尚無最近檢視。"; return; }
    items.forEach((item, index) => {
      const row = document.createElement("div"), button = document.createElement("button");
      row.className = "saved-view-row";
      button.textContent = item.name;
      button.onclick = () => open(item.hash);
      row.append(button);
      if (saved) {
        const input = document.createElement("input"), share = document.createElement("button"), remove = document.createElement("button");
        input.value = item.name; input.maxLength = 80; input.setAttribute("aria-label", "重新命名收藏");
        input.onchange = () => { item.name = input.value.trim() || item.name; persist(); render(); };
        share.textContent = "複製連結";
        share.onclick = async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname + item.hash); ctx.toast("已複製「" + item.name + "」的分析連結"); } catch { ctx.toast("請開啟收藏後從網址列複製連結。"); } };
        remove.textContent = "刪除";
        remove.onclick = () => { library.saved.splice(index, 1); persist(); render(); };
        row.append(input, share, remove);
      }
      host.append(row);
    });
  };
  const render = () => { list($("#saved-view-list"), library.saved, true); list($("#recent-view-list"), library.recent, false); };
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    library = readSavedViews(localStorage);
    if ($("#saved-views-dialog").open) render();
  });
  $("#saved-views-open").onclick = () => { render(); $("#saved-view-name").value = ctx.$("#view-title").textContent + " · " + ctx.$("#scope-summary").textContent; $("#saved-views-dialog").showModal(); };
  $("#saved-views-close").onclick = () => $("#saved-views-dialog").close();
  $("#save-view-form").onsubmit = (event) => {
    event.preventDefault();
    ctx.updateHash();
    library.saved.unshift({ name: $("#saved-view-name").value.trim().slice(0, 80), hash: ctx.routeString(), at: Date.now() });
    library.saved = library.saved.slice(0, 20); persist(); render(); ctx.toast("分析已收藏");
  };
  $("#clear-recent-views").onclick = () => { library.recent = []; persist(); render(); };
  for (const [name, hash] of [
    ["三方競爭 · 全臺鄉鎮", "#e=president&chart=ternary&l=town&detail=0&ternary-focus=1"],
    ["高亮接近的三方選區", "#e=president&chart=ternary&l=town&dual=1&detail=0&f-candidate=柯文哲&f-share=30&f-turnout=70&f-margin=5&f-mode=highlight"],
    ["有效票規模與完整排行", "#e=president&chart=bubble&l=county&detail=0&bubble-layout=bar"],
    ["完整國會 · 113 席", "#e=legislator&chart=small&seats=full&detail=0"],
  ]) {
    const button = document.createElement("button"); button.textContent = name; button.onclick = () => open(hash); $("#analysis-recipes").append(button);
  }
  let timer, previous = "";
  ctx.recordRecentView = () => {
    if (!ctx.routeReady || ctx.routeApplying) return;
    const hash = ctx.routeString();
    if (hash === previous) return;
    previous = hash;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const name = $("#election").selectedOptions[0].textContent.trim() + " · " + $("#view-title").textContent + " · " + $("#scope-summary").textContent;
      library.recent = [{ name, hash, at: Date.now() }, ...library.recent.filter((item) => item.hash !== hash)].slice(0, 12);
      persist();
    }, 700);
  };
}
