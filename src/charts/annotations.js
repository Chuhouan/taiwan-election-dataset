export function placeCallouts(items, bounds) {
  const used = [...(bounds.obstacles || [])],
    output = [];
  for (const item of items) {
    const w = Math.min(item.width, bounds.right - bounds.left),
      h = 22;
    for (const [dx, dy] of [
      [12, -32],
      [12, 12],
      [-w - 12, -32],
      [-w - 12, 12],
      [12, -58],
      [-w - 12, -58],
      [12, 38],
      [-w - 12, 38],
    ]) {
      const x = Math.max(bounds.left, Math.min(bounds.right - w, item.x + dx)),
        y = Math.max(bounds.top, Math.min(bounds.bottom - h, item.y + dy));
      const box = { x, y, w, h };
      if (
        used.some(
          (b) =>
            x < b.x + b.w + 5 &&
            x + w + 5 > b.x &&
            y < b.y + b.h + 5 &&
            y + h + 5 > b.y,
        )
      )
        continue;
      used.push(box);
      output.push({ ...item, ...box });
      break;
    }
  }
  return output;
}
export function installAnnotations(ctx) {
  ctx.drawCallouts = (svg, items, bounds, className = "chart-callouts") => {
    svg.selectAll("." + className).remove();
    const layer = svg
      .append("g")
      .attr("class", className)
      .attr("pointer-events", "auto");
    const measure = layer.append("text").attr("font-size", 12).attr("visibility", "hidden"),
      maxWidth = bounds.right - bounds.left;
    const measured = items.map((d) => {
      let label = d.label;
      measure.text(label);
      while (label.length > 3 && measure.node().getComputedTextLength() + 18 > maxWidth) {
        label = label.slice(0, -2) + "…";
        measure.text(label);
      }
      return { ...d, fullLabel: d.label, label, width: Math.max(60, measure.node().getComputedTextLength() + 18), anchorX: d.x, anchorY: d.y };
    });
    measure.remove();
    for (const d of placeCallouts(measured, bounds)) {
      const g = layer.append("g").attr("data-callout-key", d.key || "");
      g.append("title").text(d.fullLabel);
      if (d.key) g.style("cursor", "pointer").on("click", () => ctx.selectRegion(d.key));
      g.append("path")
        .attr(
          "d",
          `M${d.anchorX},${d.anchorY}L${d.x + Math.min(d.w - 6, Math.max(6, d.anchorX - d.x))},${d.y + 11}`,
        )
        .attr("stroke", "#617785")
        .attr("fill", "none");
      g.append("circle")
        .attr("cx", d.anchorX)
        .attr("cy", d.anchorY)
        .attr("r", 7)
        .attr("fill", "none")
        .attr("stroke", "#264759");
      g.append("rect")
        .attr("x", d.x)
        .attr("y", d.y)
        .attr("width", d.w)
        .attr("height", d.h)
        .attr("rx", 3)
        .attr("fill", "#ffffffee")
        .attr("stroke", "#c8d3db");
      g.append("text")
        .attr("x", d.x + 8)
        .attr("y", d.y + 15)
        .attr("font-size", 12)
        .attr("fill", "#233e4e")
        .text(d.label);
    }
  };
}
