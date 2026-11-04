export const charts = ["map", "hex", "bubble", "ternary", "small", "scatter"];
export const normalCases = [
  ...charts.map((chart) => ({ name: chart, hash: `e=president&chart=${chart}&detail=0` })),
  { name: "dual", hash: "e=president&chart=ternary&dual=1&detail=0" },
  { name: "parliament", hash: "e=legislator&chart=small&detail=0" },
  { name: "history", hash: "e=president&history-region=matrix&history-county=63000" },
];
export const edgeCases = charts.flatMap((chart) => [
  { name: chart + "-single", chart, hash: `e=president&chart=${chart}&l=town&selection=63000/010&detail=0`, state: "single" },
  { name: chart + "-empty", chart, hash: `e=president&chart=${chart}&f-share=100&f-turnout=100&detail=0`, state: "empty" },
  { name: chart + "-full", chart, hash: `e=president&chart=${chart}&l=town&dual=${chart === "map" ? "0" : "1"}&detail=0`, state: "full" },
]);
