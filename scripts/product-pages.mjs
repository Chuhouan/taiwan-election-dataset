import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homeFindings } from "./home-findings.mjs";

export async function writeProductPages() {
  const json = async (file) => JSON.parse(await readFile("dist/" + file, "utf8"));
  const [data, topology, metadata, history, historyCounties, builtIndex] = await Promise.all([
    json("data.json"), json("towns-lod0.json"), json("metadata.json"), json("history.json"), json("history-counties.json"),
    readFile("dist/index.html", "utf8"),
  ]);
  const index = builtIndex.replace(/\r+\n/g, "\n");
  const { counties, president } = data;
  const national = president["00000/000"];
  const countyRows = Object.fromEntries(Object.entries(president).filter(([, row]) => row.town === "000"));
  const towns = Object.entries(president).filter(([, row]) => row.town !== "000" && row.total > 0);
  const margin = (row) => (row.candidates[0].votes - row.candidates[1].votes) * 100 / row.total;
  const closest = towns.sort(([, a], [, b]) => margin(a) - margin(b)).slice(0, 10);
  const countyTopology = topology.objects.counties;
  const islandTowns = {
    type: "GeometryCollection",
    geometries: topology.objects.towns.geometries.filter((geometry) =>
      ["09007", "09020", "10016"].includes(geometry.properties.COUNTYCODE)),
  };
  const arcs = [], indexes = new Map();
  function remap(ref) {
    if (Array.isArray(ref)) return ref.map(remap);
    const old = ref < 0 ? ~ref : ref;
    if (!indexes.has(old)) {
      indexes.set(old, arcs.length);
      arcs.push(topology.arcs[old]);
    }
    const current = indexes.get(old);
    return ref < 0 ? ~current : current;
  }
  for (const geometry of [...countyTopology.geometries, ...islandTowns.geometries]) {
    geometry.arcs = remap(geometry.arcs);
  }
  const summary = {
    president: countyRows, legislator: {}, counties,
    highlights: { closest, townCount: towns.length, ...homeFindings(national, towns, history, historyCounties) },
    sourceVersion: metadata.source_version,
    updatedAt: metadata.data_updated_at,
  };
  await Promise.all([
    writeFile("dist/homepage.json", JSON.stringify(summary)),
    writeFile("dist/home-counties.json", JSON.stringify({
      type: "Topology", transform: topology.transform, arcs,
      objects: { counties: countyTopology, towns: islandTowns },
    })),
  ]);
  const percent = (votes) => (100 * votes / national.total).toFixed(2);
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const fmt = (value) => Number(value).toLocaleString("en-US");
  const winner = national.candidates[0];
  const snapshot = `<div class="home-kicker">總統選舉 <span>2024.01.13</span></div>
    <h1 id="home-title">${escape(winner.name)}當選總統</h1>
    <p class="home-deck">以 ${percent(winner.votes)}% 得票率勝出，領先 ${margin(national).toFixed(2)} 個百分點。</p>
    <dl class="home-kpis">
      <div><dt><button data-term="margin_pp">領先差距</button></dt><dd data-term="margin_pp">${margin(national).toFixed(2)}<small>百分點</small></dd></div>
      <div><dt><button data-term="valid_votes">有效票</button></dt><dd data-term="valid_votes">${fmt(national.total)}<small>票</small></dd></div>
      <div><dt><button data-term="turnout">投票率</button></dt><dd data-term="turnout">${(100 * national.cast / national.eligible).toFixed(2)}<small>%</small></dd></div>
    </dl>
    <table class="home-results"><caption>全國候選人結果</caption>
      <thead><tr><th scope="col">候選人</th><th scope="col">得票率</th><th scope="col">票數</th></tr></thead>
      <tbody>${national.candidates.map((candidate) => `<tr><th scope="row" class="home-candidate-name">${escape(candidate.name)}<i class="home-candidate-bar" aria-hidden="true" style="--share:${percent(candidate.votes)}%;--party:${candidate.party === "民進黨" ? "#16804f" : candidate.party === "國民黨" ? "#2758b5" : "#267b84"}"></i></th><td data-term="share">${percent(candidate.votes)}%</td><td data-term="valid_votes">${fmt(candidate.votes)}</td></tr>`).join("")}</tbody>
    </table>
    <p class="home-source">中央選舉委員會 · 資料整理 ${escape(metadata.data_updated_at)}</p>
    <button class="home-how" type="button" data-term="winner_party">這張圖怎麼看 <span aria-hidden="true">↗</span></button>`;
  const home = index
    .replace("<title>臺灣選舉觀測</title>", "<title>臺灣選舉數據分析集成網</title>")
    .replace("<!-- HOME_SNAPSHOT -->", snapshot);
  const subpage = (page) => index
    .replace('data-page="home"', 'data-page="' + page + '"')
    .replace("<head>", '<head>\n    <base href="../" />');
  await Promise.all(["explore", "about"].map((page) => mkdir("dist/" + page, { recursive: true })));
  await Promise.all([
    writeFile("dist/index.html", home),
    writeFile("dist/explore/index.html", subpage("explore")),
    writeFile("dist/about/index.html", subpage("about")),
  ]);
}
