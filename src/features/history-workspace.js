/** One history workspace, three peer views; exploration state stays underneath. */
export function install(ctx) {
  const entries = [
    ["national", "全國歷屆", "history-dialog", () => ctx.openNationalHistory()],
    [
      "county",
      "縣市比較",
      "county-history-dialog",
      () => ctx.openCountyHistory(),
    ],
    ["archive", "原始資料", "archive-dialog", () => ctx.openArchive()],
  ];
  ctx.presentHistoryNavigation = (active) => {
    for (const [name, , id] of entries) {
      const dialog = document.getElementById(id);
      if (!dialog) continue;
      if (name !== active && dialog.open) dialog.close();
      let nav = dialog.querySelector(".history-workspace-nav");
      if (!nav) {
        nav = document.createElement("nav");
        nav.className = "history-workspace-nav";
        nav.setAttribute("aria-label", "歷史分析工作區");
        for (const [key, label, , open] of entries) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.historyWorkspace = key;
          button.textContent = label;
          button.onclick = open;
          nav.append(button);
        }
        const back = document.createElement("button");
        back.className = "return-exploration";
        back.textContent = "返回探索 ↗";
        back.onclick = () => {
          for (const [, , target] of entries)
            document.getElementById(target)?.close();
          ctx.updateHash();
        };
        nav.append(back);
        dialog.querySelector("header").after(nav);
      }
      for (const button of nav.querySelectorAll("[data-history-workspace]")) {
        const selected = button.dataset.historyWorkspace === active;
        button.classList.toggle("active", selected);
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    }
  };
}
