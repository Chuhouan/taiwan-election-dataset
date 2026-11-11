export function installChartCaptions(ctx) {
  ctx.presentChartCaption = () => presentChartCaption(ctx);
}

function presentChartCaption(ctx) {
  const $ = ctx.$;
  const { chart, metric } = ctx.state;
  const mapFormula = ctx.metricFormula();
  let mapCaption = mapFormula;
  if (ctx.mapEncoding === "symbols") mapCaption = "圓面積代表有效票。 " + mapFormula;
  else if (metric === "winner" || metric === "runner")
    mapCaption = "顏色代表各地" + (metric === "winner" ? "第一名" : "第二名") + "的政黨。 " + mapFormula;
  const { bubbleLayout, densityMode, densityWeight, ternaryColor, ternarySize } = ctx.chartOptions;
  const ternaryWeight = densityWeight === "votes" ? "有效票加權" : "地區等權";
  const pointEncoding = (ternarySize === "votes" ? "點大小：有效票" : "點大小一致") +
    " · 顏色：" + (ternaryColor === "county" ? "所屬縣市" : "第一名政黨");
  const ternaryEncoding = densityMode === "hexbin" ? "分箱：" + ternaryWeight :
    pointEncoding + (densityMode === "contour" ? " · 密度：" + ternaryWeight : "");
  const bubbleOrder = {
    bar: "按第一名政黨分群，排行按有效票",
    geo: "按近似地理位置排列",
    rank: "按有效票排序",
    pack: "緊密排列，位置不代表地理",
  };
  const chartCaptions = {
    map: mapCaption,
    hex: "每格代表一個地區，面積相同。 " + mapFormula,
    bubble: "圓面積代表有效票 · " + bubbleOrder[bubbleLayout] + " · 顏色依圖例",
    ternary: ternaryEncoding + "。每個地區三位候選人的有效票占比合計 100%。",
    small: ctx.isLeg()
      ? ctx.fullParliament ? "每點代表一席；全院 113 席，過半門檻 57 席。" : "每點代表一席區域立委，共 73 席。"
      : "各圖使用相同地理尺度；得票率以 % 顯示，差值以百分點顯示。",
    scatter: chart === "scatter" ? distributionCaption(ctx) : "",
  };
  const mapVisible = chart === "map" || chart === "hex" || (ctx.dualMode && ctx.dualFocus !== "chart");
  const metricInfo = $("#metric-info");
  metricInfo.hidden = !mapVisible;
  if (!mapVisible) {
    $("#metric-info-popover").hidden = true;
    metricInfo.setAttribute("aria-expanded", "false");
  }
  $("#view-description").hidden = true;
  const caption = $("#metric-formula");
  caption.textContent = ctx.dualMode ? "" : chartCaptions[chart];
  caption.title = caption.textContent;
  for (const [side, note] of [["left", mapCaption], ["right", chartCaptions[chart]]]) {
    const pane = $("#" + side + "-pane-caption");
    pane.textContent = ctx.dualMode ? note : "";
    pane.title = pane.textContent;
  }
}

function distributionCaption(ctx) {
  const mode = ctx.state.distribution;
  if (mode === "scatter") {
    const axis = (key) => key === "votes" ? "有效票（票）" :
      key === "share" ? ctx.state.candidate + "得票率（%）" : ctx.labels[key].replace("pp", "百分點");
    const size = ctx.axes.size === "fixed" ? "點大小一致" : "點面積代表有效票";
    const color = ctx.scatterSettings.neutral ? "中性色" : ctx.axes.color === "county" ? "所屬縣市" : "第一名政黨";
    return "橫軸：" + axis(ctx.axes.x) + " · 縱軸：" + axis(ctx.axes.y) + " · " + size + " · 顏色：" + color;
  }
  const captions = {
    histogram: "橫軸：候選人得票率（%） · 縱軸：各區間的地區數",
    ecdf: "橫軸：候選人得票率（%） · 縱軸：低於或等於該得票率的地區占比（%）",
    box: "橫軸：縣市 · 縱軸：地區得票率（%） · 箱體為第 25 至第 75 百分位",
    dumbbell: "橫軸：候選人得票率（%） · 同一列兩點距離為得票率差（個百分點）",
  };
  return captions[mode] || "每點代表一個地區；橫軸為前兩名得票率差（個百分點）。";
}
