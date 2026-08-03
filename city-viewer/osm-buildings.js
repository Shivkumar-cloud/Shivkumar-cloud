// Real building footprints for Pune's historic core, fetched live from
// OpenStreetMap's Overpass API (free, no key required). This is a separate,
// deliberately exaggerated local scale (not the 220m/unit used for the rest
// of the city) so individual real buildings are actually visible/clickable —
// the same "zoomed schematic bubble" approach already used for each
// district cluster, just applied to real geometry instead of random boxes.
// Relative position, shape, and height between these buildings are real;
// only the zoom factor versus the rest of the (compressed) city is stylized.
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const METERS_PER_DEG_LAT = 111320;

export const CORE_METERS_PER_UNIT = 35;
export const CORE_FETCH_RADIUS_METERS = 400;
const MAX_BUILDINGS = 600;

export function projectCore(lat, lng, origin) {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  const xMeters = (lng - origin.lng) * metersPerDegLng;
  const zMeters = -(lat - origin.lat) * METERS_PER_DEG_LAT;
  return { x: xMeters / CORE_METERS_PER_UNIT, z: zMeters / CORE_METERS_PER_UNIT };
}

export async function fetchOsmBuildings(center, radiusMeters = CORE_FETCH_RADIUS_METERS) {
  const query = `[out:json][timeout:25];(way["building"](around:${radiusMeters},${center.lat},${center.lng}););out body;>;out skel qt;`;
  const res = await fetch(OVERPASS_ENDPOINT, { method: "POST", body: query });
  if (!res.ok) {
    throw new Error(`Overpass API returned HTTP ${res.status}`);
  }
  const data = await res.json();

  const nodes = new Map();
  for (const el of data.elements) {
    if (el.type === "node") nodes.set(el.id, { lat: el.lat, lng: el.lon });
  }

  const buildings = [];
  for (const el of data.elements) {
    if (buildings.length >= MAX_BUILDINGS) break;
    if (el.type !== "way" || !el.tags || !el.tags.building) continue;
    const ring = el.nodes.map((id) => nodes.get(id)).filter(Boolean);
    if (ring.length < 3) continue;

    buildings.push({
      id: el.id,
      name: el.tags.name || el.tags["name:en"] || null,
      historic: el.tags.historic || null,
      levels: el.tags["building:levels"] ? parseFloat(el.tags["building:levels"]) : null,
      heightMeters: el.tags.height ? parseFloat(el.tags.height) : null,
      ring,
    });
  }
  return buildings;
}
