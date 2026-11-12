/** A mark's name and number always describe the same selected metric. */
export function markReadout(ctx, r) {
  const { metric, candidate, otherCandidate, swingParty } = ctx.state;
  const region = ctx.areaName(r, true);
  const definition = ctx.metricDefinition();
  const contender =
    metric === "runner"
      ? r.candidates[1]
      : ["share", "advantage", "difference", "bivariate"].includes(metric)
        ? r.candidates.find((c) => c.name === candidate)
        : r.candidates[0];
  const person = [
    "winner",
    "runner",
    "share",
    "advantage",
    "bivariate",
  ].includes(metric)
    ? contender?.name || (metric === "runner" ? "無第二名" : candidate)
    : "";
  let value = ctx.EXTRA_METRICS[metric]
    ? ctx.extraMetricValue(r)
    : metric === "margin"
      ? ctx.marginOf(r)
      : metric === "turnout"
        ? ctx.turnoutOf(r)
        : metric === "swing"
          ? ctx.swing(ctx.keyOf(r))
          : contender && r.total
            ? (contender.votes / r.total) * 100
            : null;
  const unit = [
    "margin",
    "swing",
    "advantage",
    "difference",
    "competitive",
  ].includes(metric)
    ? "個百分點"
    : ["leadVotes", "validVotes"].includes(metric)
      ? "票"
      : ctx.EXTRA_METRICS[metric]?.unit || "%";
  const formatted =
    value == null || !Number.isFinite(value)
      ? "—"
      : unit === "票"
        ? ctx.fmt(value) + " 票"
        : value.toFixed(2) + (unit === "%" ? "%" : " " + unit);
  const label =
    metric === "difference"
      ? candidate + " − " + (otherCandidate || "侯友宜")
      : metric === "swing"
        ? swingParty + " · " + definition.title
        : person
          ? person +
            (metric === "advantage"
              ? " · 相對全國優勢"
              : metric === "bivariate"
                ? " · 得票率"
                : "")
          : definition.title;
  const secondary =
    metric === "bivariate" ? "；投票率 " + ctx.pct(ctx.turnoutOf(r)) : "";
  return {
    region,
    metric,
    candidate: person,
    label,
    value,
    unit,
    formatted,
    text: label + " " + formatted + secondary,
  };
}
