import { packVoteGroups } from "./bubble-layout.js";
import { rankVoteRegions } from "../data/vote-scale.js";
export function drawPublicationBubbles(ctx, svg, legend, width, height) {
  const rows = ctx.overviewRecords(), ranked = rankVoteRegions(rows), plotWidth = width * .63,
    nodes = packVoteGroups(rows.map((r) => ({ r, key: ctx.keyOf(r), radius: Math.sqrt(r.total) })),
      { x: 16, y: 28, width: Math.max(80, plotWidth - 32), height: Math.max(100, height - 50) });
  svg.attr("data-publication-bubble-count", rows.length);
  svg.append("metadata").text(JSON.stringify({ count: rows.length, ranking: ranked.rows.map((d) => ({ key: ctx.keyOf(d.r), votes: d.r.total, contribution: d.share, cumulative: d.cumulative })) }));
  svg.append("g").selectAll("circle").data(nodes).join("circle")
    .attr("data-region-key", (d) => d.key).attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", (d) => d.radius)
    .attr("fill", (d) => ctx.fill(d.r, d.key));
  svg.append("g").selectAll("text").data(nodes.filter((d) => d.radius >= 22)).join("text")
    .attr("x", (d) => d.x).attr("y", (d) => d.y + 4).attr("text-anchor", "middle").attr("font-size", 12)
    .attr("fill", "#172331").attr("paint-order", "stroke").attr("stroke", "#fff").attr("stroke-width", 3).text((d) => ctx.areaName(d.r));
  const text = (label, x, y, size = 12) => svg.append("text").attr("x", x).attr("y", y).attr("font-size", size).attr("fill", "#233e4e").text(label),
    shown = Math.min(rows.length, 24), rowHeight = Math.min(26, (height - 70) / Math.max(1, shown)),
    x = plotWidth + 20, right = width - 16,
    barScale = ctx.d3.scaleLinear().domain([0, ranked.rows[0]?.r.total || 1]).range([0, width - x - 18]);
  text(`有效票排行 · 顯示 ${shown}／${rows.length}`, x, 20, 14);
  ranked.rows.slice(0, shown).forEach((d, i) => {
    const y = 43 + i * rowHeight;
    svg.append("rect").attr("x", x).attr("y", y + 5).attr("width", barScale(d.r.total)).attr("height", Math.max(3, Math.min(6, rowHeight - 18))).attr("fill", ctx.color(d.r.candidates[0].party)).attr("opacity", .5);
    text(ctx.areaName(d.r, true), x, y);
    text(ctx.fmt(d.r.total), right, y).attr("text-anchor", "end");
  });
  text(rows.length > shown ? "完整排行附於 SVG metadata；原始票數另可匯出 CSV。" : "全部地區，依有效票由多至少。", x, height - 10, 12);
  const sizeScale = nodes.length ? nodes[0].radius / Math.sqrt(nodes[0].r.total) : 0,
    values = [10000, 100000, 1000000].filter((v) => Math.sqrt(v) * sizeScale < 48),
    valuesToShow = values.length ? values : [ranked.rows[0]?.r.total || 1];
  let cursor = 0;
  const circles = valuesToShow.map((value) => {
    const radius = Math.sqrt(value) * sizeScale, cx = cursor + radius + 12; cursor += radius * 2 + 80;
    return `<circle cx="${cx}" cy="50" r="${radius}" fill="none" stroke="#526575"/><text x="${cx}" y="108" text-anchor="middle" font-size="12">${ctx.fmt(value)}票</text>`;
  }).join("");
  legend.innerHTML = `<div class="legend-title">圓面積 ∝ 有效票數 · 顏色依目前地圖指標</div><svg class="bubble-scale" width="${cursor}" height="120" viewBox="0 0 ${cursor} 120">${circles}</svg><div class="legend-foot">所有地區共用同一面積比例。首五地區占 ${ranked.topFive.toFixed(1)}% 有效票；${ranked.halfCount} 個地區涵蓋一半票量。排列按地區第一名政黨分群，並非政黨取得的票數。</div>`;
}
