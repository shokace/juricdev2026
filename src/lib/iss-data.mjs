/** @param {unknown} value */
export function normalizeIssTrail(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(point => point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180 && Number.isFinite(point.ts) && point.ts > 0).map(({lat, lon, ts}) => ({lat, lon, ts})).sort((a,b) => a.ts-b.ts).slice(-2400);
}

/** Validate coordinates before they reach the renderer; zero is a valid coordinate.
 * @param {any} payload
 * @param {unknown[]} previousTrail
 */
export function parseIssSnapshot(payload, previousTrail = [], now = Date.now()) {
  const rawLat = payload?.iss_position?.latitude;
  const rawLon = payload?.iss_position?.longitude;
  if (rawLat == null || rawLon == null || (typeof rawLat === "string" && rawLat.trim() === "") || (typeof rawLon === "string" && rawLon.trim() === "") || typeof rawLat === "boolean" || typeof rawLon === "boolean") throw new Error("Missing ISS coordinates.");
  const lat = Number(rawLat), lon = Number(rawLon), timestamp = Number(payload?.timestamp);
  if (payload?.message !== "success" || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp * 1000 > now + 60_000) throw new Error("Invalid ISS position.");
  return {
    ok: now - timestamp * 1000 < 45_000,
    latitude: lat.toFixed(4), longitude: lon.toFixed(4), timestamp,
    trail: Array.isArray(payload.trail) ? normalizeIssTrail(payload.trail) : previousTrail,
  };
}

/** @param {{lat: number, lon: number, ts: number}[]} previous
 * @param {{lat: number, lon: number, ts: number}[]} incoming
 */
export function mergeIssTrail(previous, incoming) {
  const points = new Map([...previous, ...incoming].map(point => [point.ts, point]));
  return [...points.values()].sort((a,b) => a.ts-b.ts).slice(-2400);
}
