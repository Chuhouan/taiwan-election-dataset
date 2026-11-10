export const electionCapabilities = {
  president: {
    geography: ["county", "town"],
    views: ["map", "hex", "bubble", "ternary", "small", "scatter"],
    conditions: true,
    dual: true,
  },
  legislator: {
    geography: ["district"],
    views: ["map", "hex", "bubble", "small", "scatter"],
    metrics: ["winner", "runner", "margin", "turnout"],
    conditions: false,
    dual: false,
  },
};

export function capabilityNote(election) {
  return election === "legislator"
    ? "區域立委以 73 個選區計票。全臺候選人得票率地圖與三方圖適用於各地使用同一組候選人的選舉。"
    : "縣市與鄉鎮結果各自以有效票為分母。跨屆下級邊界須先核驗，未核驗的地區不計差值。";
}
