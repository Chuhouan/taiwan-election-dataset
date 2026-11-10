const translatedAttributes = ["aria-label", "aria-description", "title", "placeholder", "alt"];
const hasHan = /\p{Script=Han}/u;

export function installLanguage(ctx) {
  const button = ctx.$("#language-toggle");
  if (document.documentElement.dataset.page === "legacy") return;
  const root = document.documentElement;
  const originalText = new Map();
  const originalAttributes = new Map();
  let convert, converterRequest;

  function replaceText(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, [contenteditable], [translate=no]")) return;
    const text = node.nodeValue;
    if (!hasHan.test(text)) return;
    const existing = originalText.get(node);
    if (existing?.translated === text) return;
    if (parent.tagName === "OPTION" && !parent.hasAttribute("value"))
      parent.value = parent.textContent;
    const translated = convert(text);
    originalText.set(node, { text, translated });
    if (translated !== text) node.nodeValue = translated;
  }
  function replaceAttributes(element) {
    let saved = originalAttributes.get(element);
    for (const name of translatedAttributes) {
      const value = element.getAttribute(name);
      if (!value || !hasHan.test(value) || saved?.get(name)?.translated === value) continue;
      const translated = convert(value);
      if (!saved) { saved = new Map(); originalAttributes.set(element, saved); }
      saved.set(name, { value, translated });
      if (translated !== value) element.setAttribute(name, translated);
    }
  }
  function replaceTree(node) {
    if (node.nodeType === Node.TEXT_NODE) { replaceText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest("[translate=no]")) return;
    replaceAttributes(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const item = walker.currentNode;
      if (item.nodeType === Node.TEXT_NODE) replaceText(item);
      else replaceAttributes(item);
    }
  }
  function update(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") replaceText(mutation.target);
      else if (mutation.type === "attributes") replaceAttributes(mutation.target);
      else for (const node of mutation.addedNodes) replaceTree(node);
    }
    for (const node of originalText.keys()) if (!node.isConnected) originalText.delete(node);
    for (const node of originalAttributes.keys()) if (!node.isConnected) originalAttributes.delete(node);
  }
  const observer = new MutationObserver(update);
  function useTraditional() {
    update(observer.takeRecords());
    observer.disconnect();
    for (const [node, entry] of originalText)
      if (node.nodeValue === entry.translated) node.nodeValue = entry.text;
    for (const [node, attributes] of originalAttributes)
      for (const [name, entry] of attributes)
        if (node.getAttribute(name) === entry.translated) node.setAttribute(name, entry.value);
    originalText.clear();
    originalAttributes.clear();
  }
  async function setLanguage(simplified) {
    if (simplified) {
      if (!converterRequest) converterRequest = import("opencc-js/t2cn")
        .then(({ Converter }) => Converter({ from: "tw", to: "cn" }))
        .catch((error) => { converterRequest = null; throw error; });
      convert = await converterRequest;
      root.lang = "zh-Hans";
      replaceTree(root);
      observer.observe(root, {
        subtree: true, characterData: true, childList: true,
        attributes: true, attributeFilter: translatedAttributes,
      });
    } else {
      useTraditional();
      root.lang = "zh-Hant";
    }
    button.textContent = simplified ? "繁" : "簡";
    button.setAttribute("aria-label", simplified ? "切换繁体中文" : "切換簡體中文");
    button.setAttribute("aria-pressed", String(simplified));
    try { localStorage.setItem("atlas-language", root.lang); } catch {}
  }
  ctx.normalizeSearchText = (text) => convert ? convert(text) : text;
  button.onclick = async () => {
    button.disabled = true;
    try {
      await setLanguage(root.lang !== "zh-Hans");
    } catch {
      ctx.toast("語言資源載入失敗，請再試一次。");
    } finally {
      button.disabled = false;
    }
  };
  try {
    if (localStorage.getItem("atlas-language") === "zh-Hans")
      setLanguage(true).catch(() => ctx.toast("語言資源載入失敗，請再試一次。"));
  } catch {}
}
