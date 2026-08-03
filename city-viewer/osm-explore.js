// Live, on-demand real-world data for any spot in Pune (or anywhere), fetched
// straight from OpenStreetMap — free, no API key. One area (buildings, roads,
// railways, bus stops, train stations, parks, water) is loaded into memory at
// a time; pan/search to explore a different area. There is no dummy/random
// geometry here: everything rendered by this module comes from real tags.
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const METERS_PER_DEG_LAT = 111320;

// 1 scene unit = 8 real meters. Chosen so individual real buildings (typically
// 10-40m across) render at roughly the same visual scale as this project's
// other modes, comfortably zoomable with the existing orbit controls.
export const EXPLORE_METERS_PER_UNIT = 8;

const MAX_BUILDINGS = 2000;
const MAX_ROADS = 1200;
const MAX_RAILWAYS = 200;
const MAX_AREAS = 300; // parks + water combined

export function projectExplore(lat, lng, origin) {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  const xMeters = (lng - origin.lng) * metersPerDegLng;
  const zMeters = -(lat - origin.lat) * METERS_PER_DEG_LAT;
  return { x: xMeters / EXPLORE_METERS_PER_UNIT, z: zMeters / EXPLORE_METERS_PER_UNIT };
}

export async function geocodeSuggestions(query, limit = 5) {
  const q = /pune/i.test(query) ? query : `${query}, Pune, Maharashtra, India`;
  const url = `${NOMINATIM_ENDPOINT}?format=json&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim returned HTTP ${res.status}`);
  const results = await res.json();
  return results.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), displayName: r.display_name }));
}

export async function geocodePlace(query) {
  const results = await geocodeSuggestions(query, 1);
  if (!results.length) throw new Error(`No place found for "${query}"`);
  return results[0];
}

export async function fetchArea(center, radiusMeters) {
  const r = radiusMeters;
  const c = `${center.lat},${center.lng}`;
  const query =
    `[out:json][timeout:30];` +
    `(` +
    `way["building"](around:${r},${c});` +
    `way["highway"](around:${r},${c});` +
    `way["railway"="rail"](around:${r},${c});` +
    `way["leisure"="park"](around:${r},${c});` +
    `way["landuse"="grass"](around:${r},${c});` +
    `way["natural"="water"](around:${r},${c});` +
    `node["highway"="bus_stop"](around:${r},${c});` +
    `node["railway"="station"](around:${r},${c});` +
    `);out body;>;out skel qt;`;

  const res = await fetch(OVERPASS_ENDPOINT, { method: "POST", body: query });
  if (!res.ok) throw new Error(`Overpass API returned HTTP ${res.status}`);
  const data = await res.json();

  const nodeCoords = new Map();
  const taggedNodes = [];
  for (const el of data.elements) {
    if (el.type === "node") {
      nodeCoords.set(el.id, { lat: el.lat, lng: el.lon });
      if (el.tags) taggedNodes.push(el);
    }
  }

  const buildings = [];
  const roads = [];
  const railways = [];
  const parks = [];
  const water = [];

  for (const el of data.elements) {
    if (el.type !== "way" || !el.tags) continue;
    const pts = () => el.nodes.map((id) => nodeCoords.get(id)).filter(Boolean);

    if (el.tags.building && buildings.length < MAX_BUILDINGS) {
      const ring = pts();
      if (ring.length >= 3) {
        buildings.push({
          id: el.id,
          name: el.tags.name || null,
          type: el.tags.building,
          levels: el.tags["building:levels"] ? parseFloat(el.tags["building:levels"]) : null,
          heightMeters: el.tags.height ? parseFloat(el.tags.height) : null,
          ring,
        });
      }
    } else if (el.tags.highway && roads.length < MAX_ROADS) {
      const line = pts();
      if (line.length >= 2) {
        roads.push({ id: el.id, kind: el.tags.highway, name: el.tags.name || null, points: line });
      }
    } else if (el.tags.railway === "rail" && railways.length < MAX_RAILWAYS) {
      const line = pts();
      if (line.length >= 2) railways.push({ id: el.id, name: el.tags.name || null, points: line });
    } else if ((el.tags.leisure === "park" || el.tags.landuse === "grass") && parks.length + water.length < MAX_AREAS) {
      const ring = pts();
      if (ring.length >= 3) parks.push({ id: el.id, name: el.tags.name || null, ring });
    } else if (el.tags.natural === "water" && parks.length + water.length < MAX_AREAS) {
      const ring = pts();
      if (ring.length >= 3) water.push({ id: el.id, name: el.tags.name || null, ring });
    }
  }

  const busStops = taggedNodes
    .filter((n) => n.tags.highway === "bus_stop")
    .map((n) => ({ id: n.id, name: n.tags.name || null, lat: n.lat, lng: n.lon }));
  const trainStations = taggedNodes
    .filter((n) => n.tags.railway === "station")
    .map((n) => ({ id: n.id, name: n.tags.name || null, lat: n.lat, lng: n.lon }));

  return { buildings, roads, railways, parks, water, busStops, trainStations };
}

export function decimatePoints(points, maxPoints = 60) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result = points.filter((_, i) => i % step === 0);
  if (result[result.length - 1] !== points[points.length - 1]) result.push(points[points.length - 1]);
  return result;
}

export const ROAD_STYLES = {
  motorway: { width: 1.8, color: 0x2a2a2e },
  trunk: { width: 1.7, color: 0x2a2a2e },
  primary: { width: 1.5, color: 0x333338 },
  secondary: { width: 1.2, color: 0x38383d },
  tertiary: { width: 1.0, color: 0x3d3d42 },
  residential: { width: 0.8, color: 0x45454a },
  unclassified: { width: 0.8, color: 0x45454a },
  service: { width: 0.6, color: 0x4a4a50 },
  living_street: { width: 0.7, color: 0x45454a },
  track: { width: 0.45, color: 0x6b5a45 },
  footway: { width: 0.3, color: 0xb8ac8e },
  path: { width: 0.28, color: 0xb0a583 },
  pedestrian: { width: 0.5, color: 0xb8ac8e },
  cycleway: { width: 0.3, color: 0x9fb08e },
  steps: { width: 0.35, color: 0xc4b896 },
  DEFAULT: { width: 0.5, color: 0x4a4a50 },
};
