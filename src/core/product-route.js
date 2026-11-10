export function readRoute() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const page = document.documentElement.dataset.page;
  if (location.hash.includes("=")) {
    if (page === "legacy") return fragment;
    for (const [key, value] of fragment) query.set(key, value);
  }
  if (page === "home") {
    for (const key of new Set(query.keys()))
      if (!["l", "r", "camera"].includes(key)) query.delete(key);
    if (!query.has("l")) query.set("l", "county");
    query.set("chart", "map");
    query.set("m", "winner");
    query.set("e", "president");
  }
  if ((page === "home" || page === "explore") && query.has("r") && !query.has("inspect"))
    query.set("inspect", "1");
  if (query.get("mode") === "chart" && !query.has("chart"))
    query.set("chart", query.get("e") === "legislator" ? "hex" : "ternary");
  return query;
}

// Large collections remain fully shareable without putting them in the server request.
export function productAddress(path, params, fragment = "") {
  const encoded = params.toString();
  if (encoded.length > 8000) {
    const mode = params.get("mode");
    return path + (mode ? "?mode=" + mode : "") + "#" + encoded;
  }
  return path + (encoded ? "?" + encoded : "") + fragment;
}

export function productMode() {
  const mode = new URLSearchParams(location.search).get("mode");
  return ["chart", "history", "filter"].includes(mode) ? mode : "map";
}

const defaults = {
  e: "president", m: "winner", sort: "margin", distribution: "swarm",
  export: "range", camera: "1,0,0", "small-camera": "1,0,0", "ternary-camera": "1,0,0",
  "axis-x": "turnout", "axis-y": "margin", "axis-size": "votes", "axis-color": "party",
  "point-color": "party", "point-size": "fixed", "density-mode": "contour", "density-weight": "regions",
  "bubble-layout": "bar", "hex-layout": "geo", "hex-labels": "simple",
  "ternary-focus": "1",
  "ternary-references": "false", "ternary-extremes": "true", "reference-share": "40",
  "reference-candidate": "賴清德",
};

export function productQuery(input, page, mode = "map") {
  const params = new URLSearchParams(input);
  if (page === "home") {
    const home = new URLSearchParams();
    for (const key of ["l", "r", "camera"]) {
      const value = params.get(key);
      if (value && value !== (key === "l" ? "county" : defaults[key])) home.set(key, value);
    }
    if (params.has("r")) home.set("inspect", "1");
    return home;
  }
  const expectedChart = mode === "chart"
    ? params.get("e") === "legislator" ? "hex" : "ternary"
    : params.get("e") === "legislator" ? "hex" : "map";
  if (params.get("chart") === expectedChart) params.delete("chart");
  if (params.get("l") === "town") params.delete("l");
  if (params.get("detail") === (params.has("r") ? "1" : "0")) params.delete("detail");
  for (const [key, value] of Object.entries(defaults)) if (params.get(key) === value) params.delete(key);
  if (mode !== "map") params.set("mode", mode);
  else params.delete("mode");
  params.sort();
  const leading = new URLSearchParams();
  for (const key of ["e", "l", "r", "mode", "m", "chart"]) {
    if (params.has(key)) leading.set(key, params.get(key));
    params.delete(key);
  }
  for (const [key, value] of params) leading.append(key, value);
  return leading;
}
