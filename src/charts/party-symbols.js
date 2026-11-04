export function partySymbolPath(radius, party) {
  if (party === "國民黨") {
    const half = radius * Math.sqrt(Math.PI / Math.sqrt(3)), h = half * Math.sqrt(3);
    return `M0,${-2 * h / 3}L${half},${h / 3}L${-half},${h / 3}Z`;
  }
  const half = radius * Math.sqrt(Math.PI) / 2;
  return `M${-half},${-half}H${half}V${half}H${-half}Z`;
}
export function applyPartySymbols(ctx, root, interactive = true) {
  root.querySelectorAll(".accessible-symbol").forEach((node) => node.remove());
  for (const circle of root.querySelectorAll(".ternary-dot,.scatter-dot,.swarm-dot,.ecdf-dot")) {
    circle.style.visibility = "";
    const datum = circle.__data__, party = datum?.r?.candidates[0]?.party;
    if (ctx.colorMode !== "accessible" || !["國民黨", "民眾黨"].includes(party) || !datum?.key) continue;
    const radius = +circle.getAttribute("r"), x = +circle.getAttribute("cx"), y = +circle.getAttribute("cy");
    const symbol = ctx.d3.select(circle.parentNode).append("path").datum(datum)
      .attr("class", "accessible-symbol " + ["group-a", "group-b", "condition-highlight", "condition-muted", "county-context-active", "county-context-muted"].filter((name) => circle.classList.contains(name)).join(" "))
      .attr("d", partySymbolPath(radius, party)).attr("transform", `translate(${x},${y})`)
      .attr("data-symbol-radius", radius)
      .attr("data-region-key", datum.key).attr("data-party-symbol", party === "國民黨" ? "triangle" : "square")
      .attr("fill", circle.getAttribute("fill")).attr("stroke", circle.getAttribute("stroke") || "white")
      .attr("stroke-width", 1).attr("vector-effect", "non-scaling-stroke").attr("fill-opacity", circle.getAttribute("fill-opacity") || .8)
      .style("display", getComputedStyle(circle).display);
    circle.style.visibility = "hidden";
    if (ctx.state.brushEnabled || ctx.scatterSettings?.brush) symbol.style("pointer-events", "none");
    if (interactive) ctx.wireChart(symbol);
  }
}
