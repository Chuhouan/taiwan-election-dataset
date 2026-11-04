/** Inspecting a mark preserves the research population; drilling changes its scope. */
export function selectionTransition(current, key, record, drill = false) {
  return {
    key,
    county: drill ? record.county : current.county,
    inspection: !drill,
  };
}
