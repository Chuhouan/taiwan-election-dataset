/** Explicit module installer; dependencies are supplied by the application context. */
export function install(ctx) {
  Object.assign(ctx, {
    dataVersionLabel,
    dataVersionDate,
    loadDistrictMembership,
    presentDistrictSources,
  });
  ctx.siteMetadata = null;
  function dataVersionLabel() {
    return [
      ctx.siteMetadata?.source_version || "CEC final results",
      ctx.siteMetadata?.data_updated_at,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  function dataVersionDate() {
    return ctx.siteMetadata?.data_updated_at || "未標示";
  }
  ctx.districtScopes = {};
  fetch("district-scopes.json")
    .then((r) => r.json())
    .then((d) => {
      ctx.districtScopes = d;
      if (ctx.isLeg() && ctx.state.key) {
        ctx.lastDetail = "";
        ctx.updateUI();
      }
    })
    .catch(() => {});
  ctx.districtMembershipPromise = null;
  function loadDistrictMembership() {
    if (!ctx.districtMembershipPromise)
      ctx.districtMembershipPromise = fetch("district-membership.json")
        .then((r) => {
          if (!r.ok) throw Error("membership");
          return r.json();
        })
        .catch((error) => {
          ctx.districtMembershipPromise = null;
          throw error;
        });
    return ctx.districtMembershipPromise;
  }
  function presentDistrictSources() {
    const scope = ctx.isLeg() && ctx.districtScopes[ctx.state.key];
    if (scope) {
      ctx
        .$("#detail-result")
        .insertAdjacentHTML(
          "beforeend",
          '<details class="district-scope"><summary>官方選區範圍</summary><p>' +
            ctx.esc(scope.description) +
            '</p><a href="https://data.gov.tw/dataset/170247" target="_blank" rel="noopener">中選會第11屆選區資料 ↗</a></details><details class="district-membership"><summary>包含的鄉鎮與村里</summary><div class="membership-content">展開時載入完整所屬清單。</div></details>',
        );
      const details = ctx.$(".district-membership"),
        key = ctx.state.key;
      details.ontoggle = async () => {
        if (!details.open || details.dataset.loaded) return;
        const host = details.querySelector(".membership-content");
        host.textContent = "載入2024所屬清單…";
        try {
          const payload = await ctx.loadDistrictMembership();
          if (!details.isConnected || ctx.state.key !== key) return;
          const group = payload.districts[key];
          host.innerHTML =
            "<p>" +
            group.towns.length +
            " 個鄉鎮分部 · " +
            group.regular +
            " 常規村里" +
            (group.special ? " · " + group.special + " 特殊統計組" : "") +
            '</p><input class="membership-search" aria-label="搜尋選區村里" placeholder="搜尋鄉鎮或村里"><div class="membership-towns">' +
            group.towns
              .map(
                (t) =>
                  '<details class="membership-town"><summary>' +
                  ctx.esc(t.name) +
                  "（" +
                  t.units.length +
                  '）</summary><div class="membership-units">' +
                  t.units
                    .map(
                      (u) =>
                        '<span class="membership-unit" data-name="' +
                        ctx.esc(t.name + u.name) +
                        '">' +
                        ctx.esc(u.name) +
                        (u.special ? " <small>特殊組</small>" : "") +
                        "</span>",
                    )
                    .join("") +
                  "</div></details>",
              )
              .join("") +
            '</div><button class="membership-export">範圍清單 CSV</button><p>為2024投票所屬清單，不等同測量界線；合併統計組不推估空間範圍。</p>';
          details.dataset.loaded = "1";
          host.querySelector(".membership-search").oninput = (ev) => {
            const q = ev.target.value.replaceAll("台", "臺").trim();
            for (const town of host.querySelectorAll(".membership-town")) {
              let matches = 0;
              for (const unit of town.querySelectorAll(".membership-unit")) {
                const visible =
                  !q || unit.dataset.name.replaceAll("台", "臺").includes(q);
                unit.hidden = !visible;
                if (visible) matches++;
              }
              town.hidden = !matches;
              if (q) town.open = !!matches;
            }
          };
          host.querySelector(".membership-export").onclick = () =>
            ctx.csvTable(
              ["選區ID", "選區", "鄉鎮", "村里或統計單位", "類型", "來源版本"],
              group.towns.flatMap((t) =>
                t.units.map((u) => [
                  key,
                  scope.name,
                  t.name,
                  u.name,
                  u.special ? "特殊統計組" : "常規村里",
                  "CEC regional 2024",
                ]),
              ),
              "臺灣2024-" + scope.name + "-所屬村里.csv",
            );
        } catch (error) {
          host.textContent = "所屬清單載入失敗，請收合後重新展開。";
        }
      };
    }
  }

  fetch("metadata.json")
    .then((r) => {
      if (!r.ok) throw Error("metadata");
      return r.json();
    })
    .then((meta) => {
      ctx.siteMetadata = meta;
      const body = document.querySelector("#methods .dialog-body");
      body.innerHTML =
        meta.sections
          .map(
            (section) =>
              "<section><h3>" +
              ctx.esc(section.title) +
              "</h3><p>" +
              ctx.esc(section.body) +
              "</p></section>",
          )
          .join("") +
        '<div class="source-links">' +
        meta.sources
          .map(
            (source) =>
              '<a href="' +
              ctx.esc(source.url) +
              '" target="_blank" rel="noopener">' +
              ctx.esc(source.title) +
              " ↗</a>",
          )
          .join("") +
        "</div><small>資料版本：" +
        ctx.esc(meta.source_version) +
        " · 整理日期：" +
        ctx.esc(meta.data_updated_at) +
        '</small><section class="lineage-links"><h3>逐資料集來源與可比性</h3><p>A：同一邊界；B：整單位無損聚合；C：估計對應；D：未核驗／不可比。本平台僅對已核驗A／B範圍計算直接差值。</p><a href="dataset-registry.json" download>資料集血緣 JSON</a> · <a href="boundary-registry.json" download>邊界版本 JSON</a> · <a href="crosswalk-registry.json" download>區劃對應 JSON</a></section>';
    })
    .catch(() => {
      document.querySelector("#methods .dialog-body").textContent =
        "資料說明載入失敗，請重新整理。";
    });
}
