export function geographyEvidence(level, metadata = {}) {
  const versions = metadata?.boundary_version || {};
  if (level === "district") return {
    source_type: "derived_village_assignment", official_boundary: false, derived: true,
    vintage: "2024 assignment / 2023-09-28 base geometry", boundary_version: versions.district || "2024 CEC village assignment + historical village geometry",
    limitation: "依投票村里歸屬合併的簡化範圍，非法定測量界線。",
  };
  if (level === "village") return {
    source_type: "official_boundary_generalized", official_boundary: true, derived: true,
    vintage: "2023-09-28", boundary_version: versions.village || "VILLAGE_NLSC_1120928 + Village_Sanhe",
    limitation: "official_boundary表示來源官方；顯示幾何經簡化，非測量用途。特殊統計組不提供估計範圍。",
  };
  return {
    source_type: "third_party_administrative_atlas", official_boundary: false, derived: true,
    vintage: null, boundary_version: versions.administrative || "Taiwan Atlas 0.0.2",
    limitation: "行政定位示意，圖資版本不是歷史邊界日期；未提供可核驗歷史vintage。",
  };
}
