import { readRoute } from "../core/product-route.js";

const factories = {
  bubbles: async (ctx) => {
    (await import("../charts/bubbles.js")).installBubbles(ctx);
  },
  history: async (ctx) => {
    (await import("../modules/history.js")).install(ctx);
    (await import("../modules/history-counties.js")).install(ctx);
    (await import("../modules/history-spatial.js")).install(ctx);
    (await import("../modules/archive.js")).install(ctx);
    (await import("./history-workspace.js")).install(ctx);
  },
  villages: async (ctx) => {
    (await import("../modules/villages.js")).install(ctx);
  },
  spatial: async (ctx) => {
    (await import("../modules/spatial.js")).install(ctx);
  },
  multiscale: async (ctx) => {
    await ctx.ensureFeature("villages");
    (await import("../modules/multiscale.js")).install(ctx);
  },
  voteSeats: async (ctx) => {
    (await import("../modules/vote-seats.js")).install(ctx);
  },
  parliamentHistory: async (ctx) => {
    (await import("../modules/parliament-history.js")).install(ctx);
  },
};
export function installLazyFeatures(ctx) {
  const loaded = new Map();
  ctx.ensureFeature = (name) => {
    if (!loaded.has(name))
      loaded.set(
        name,
        Promise.resolve()
          .then(() => {
            for (const el of document.querySelectorAll(
              `[data-feature-placeholder="${name}"]`,
            ))
              el.remove();
            return factories[name](ctx);
          })
          .catch((error) => {
            loaded.delete(name);
            console.error(error);
            ctx.toast?.("功能載入失敗，請重試");
            throw error;
          }),
      );
    return loaded.get(name);
  };
  ctx.drawBubbleWorkspace = () => {
    const svg = ctx.d3.select("#scatter");
    svg.selectAll("*").remove();
    svg
      .append("text")
      .attr("x", 30)
      .attr("y", 230)
      .attr("fill", "#536575")
      .attr("font-size", 14)
      .text("載入票數規模工作區…");
    ctx
      .ensureFeature("bubbles")
      .then(() => {
        if (ctx.state.chart === "bubble") ctx.updateUI();
      })
      .catch(() => {});
  };
  ctx.openNationalHistory = (...args) =>
    ctx.ensureFeature("history").then(() => ctx.openNationalHistory(...args));
  ctx.parseNationalHistoryRoute = () => {};
  ctx.serializeNationalHistoryRoute = () => {};
  ctx.openCountyHistory = (...args) =>
    ctx.ensureFeature("history").then(() => ctx.openCountyHistory(...args));
  ctx.openCountyHistoryForElection = (...args) =>
    ctx
      .ensureFeature("history")
      .then(() => ctx.openCountyHistoryForElection(...args));
  ctx.parseCountyHistoryRoute = () => {};
  ctx.serializeCountyHistoryRoute = () => {};
  ctx.openArchiveEntry = (...args) =>
    ctx.ensureFeature("history").then(() => ctx.openArchiveEntry(...args));
  ctx.openArchive = (...args) =>
    ctx.ensureFeature("history").then(() => ctx.openArchive(...args));
  ctx.parseArchiveRoute = () => {};
  ctx.serializeArchiveRoute = () => {};
  ctx.openVillage = (...args) =>
    ctx.ensureFeature("villages").then(() => ctx.openVillage(...args));
  ctx.serializeVillageRoute = () => {};
  ctx.parseVillageRoute = () => {};
  ctx.openScale = (...args) =>
    ctx.ensureFeature("multiscale").then(() => ctx.openScale(...args));
  ctx.parseScaleRoute = () => {};
  ctx.serializeScaleRoute = () => {};
  ctx.openVoteSeats = (...args) =>
    ctx.ensureFeature("voteSeats").then(() => ctx.openVoteSeats(...args));
  ctx.parseVoteSeatRoute = () => {};
  ctx.serializeVoteSeatRoute = () => {};
  ctx.openParliamentHistory = (...args) =>
    ctx
      .ensureFeature("parliamentHistory")
      .then(() => ctx.openParliamentHistory(...args));
  ctx.parseParliamentHistoryRoute = () => {};
  ctx.serializeParliamentHistoryRoute = () => {};
  ctx.mountLazyLaunchers = () => {
    const add = (parent, id, label, feature, hidden = false) => {
      const b = document.createElement("button");
      b.id = id;
      b.textContent = label;
      b.hidden = hidden;
      b.dataset.featurePlaceholder = feature;
      b.onclick = () =>
        ctx
          .ensureFeature(feature)
          .then(() => document.getElementById(id)?.click());
      parent.append(b);
    };
    add(
      document.querySelector(".app-header nav"),
      "history-open",
      "歷史選舉",
      "history",
    );
    add(
      document.querySelector(".research-menu-items"),
      "spatial-open",
      "檢查相鄰地區關聯",
      "spatial",
    );
    add(
      document.querySelector(".research-menu-items"),
      "scale-open",
      "比較不同尺度",
      "multiscale",
    );
    add(
      document.querySelector(".research-menu-items"),
      "vote-seat-open",
      "票席結構",
      "voteSeats",
    );
    add(
      document.querySelector(".research-menu-items"),
      "parliament-history-open",
      "歷屆席次",
      "parliamentHistory",
    );
    add(
      document.querySelector("#detail-export").parentElement,
      "village-open",
      "村里細查 ↗",
      "villages",
      true,
    );
  };
  ctx.ensureRouteFeatures = async () => {
    const p = readRoute(),
      wanted = [];
    if (p.get("chart") === "bubble") wanted.push("bubbles");
    if (
      p.has("national-history") ||
      p.has("history-region") ||
      (p.has("history-a") && p.has("history-b")) ||
      p.has("archive")
    )
      wanted.push("history");
    if (p.has("village-county") || p.has("village-district"))
      wanted.push("villages");
    if (p.has("scale-county")) wanted.push("multiscale");
    if (p.has("seat-analysis")) wanted.push("voteSeats");
    if (p.has("parliament-history")) wanted.push("parliamentHistory");
    await Promise.all(wanted.map(ctx.ensureFeature));
  };
}
