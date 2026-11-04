export function cameraFromRoute(value, maximum = 28) {
  const values = String(value || "")
    .split(",")
    .map(Number);
  return values.length === 3 &&
    values.every(Number.isFinite) &&
    Math.abs(values[1]) <= 100 && Math.abs(values[2]) <= 100 &&
    values[0] >= 1 &&
    values[0] <= maximum
    ? values
    : null;
}
export function enumFromRoute(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
export function comparableDifference(a, b, status) {
  return ["A", "B"].includes(status) && Number.isFinite(a) && Number.isFinite(b)
    ? b - a
    : null;
}
