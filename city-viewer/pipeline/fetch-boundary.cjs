#!/usr/bin/env node
// Fetches Pune's real administrative boundary from Nominatim and writes it
// out as both GeoJSON and a .poly file (the simple text format osmium/osmconvert
// use for polygon-based extraction). Falls back to a generous bounding box
// covering the greater Pune metropolitan area if Nominatim can't resolve a
// precise boundary, so the pipeline degrades gracefully rather than failing.
const fs = require("fs");

const QUERY = process.env.PUNE_BOUNDARY_QUERY || "Pune Municipal Corporation, Maharashtra, India";

// Greater Pune metro area (Pune + Pimpri-Chinchwad + surrounding), used only
// if a precise administrative boundary can't be resolved.
const FALLBACK_BBOX = { south: 18.42, west: 73.65, north: 18.75, east: 74.05 };

function bboxToPolygon(bbox) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [bbox.west, bbox.south],
        [bbox.east, bbox.south],
        [bbox.east, bbox.north],
        [bbox.west, bbox.north],
        [bbox.west, bbox.south],
      ],
    ],
  };
}

function ringsOf(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`Unsupported geometry type for .poly conversion: ${geometry.type}`);
}

// A real city-level administrative boundary spans several kilometers in
// every direction. Nominatim can match a query like "Pune Municipal
// Corporation" to an unrelated small way (e.g. a single building or office)
// sharing similar words in its name, which would silently produce a
// near-empty extract. Reject anything smaller than this before accepting it.
const MIN_CITY_SPAN_DEG = 0.05;

function bboxOf(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rings of ringsOf(geometry)) {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { width: maxX - minX, height: maxY - minY };
}

function geojsonToPoly(geometry, name) {
  const polygons = ringsOf(geometry);
  const lines = [name];
  let ringIndex = 1;
  for (const rings of polygons) {
    rings.forEach((ring, i) => {
      lines.push(i === 0 ? String(ringIndex) : `!${ringIndex}`);
      ringIndex++;
      for (const [lng, lat] of ring) {
        lines.push(`   ${lng.toFixed(7)}   ${lat.toFixed(7)}`);
      }
      lines.push("END");
    });
  }
  lines.push("END");
  return lines.join("\n") + "\n";
}

async function main() {
  const outGeojson = process.argv[2] || "pune-boundary.geojson";
  const outPoly = process.argv[3] || "pune.poly";

  let geometry = null;
  let source = "fallback_bbox";

  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=5&q=" +
      encodeURIComponent(QUERY);
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "pune-typology-explorer-pipeline" } });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const results = await res.json();
    const candidates = results.filter(
      (r) => r.geojson && (r.geojson.type === "Polygon" || r.geojson.type === "MultiPolygon")
    );
    // Real administrative boundaries are (multi)polygon relations, not ways
    // or nodes; prefer an actual boundary=administrative relation, then any
    // relation, then whatever polygon Nominatim ranked first.
    const chosen =
      candidates.find((r) => r.osm_type === "relation" && r.class === "boundary" && r.type === "administrative") ||
      candidates.find((r) => r.osm_type === "relation") ||
      candidates[0];

    if (!chosen) {
      console.error("fetch-boundary: Nominatim returned no polygon boundaries; using fallback bbox.");
    } else {
      const { width, height } = bboxOf(chosen.geojson);
      if (width < MIN_CITY_SPAN_DEG || height < MIN_CITY_SPAN_DEG) {
        console.error(
          `fetch-boundary: matched ${chosen.osm_type}/${chosen.osm_id} but its extent ` +
            `(${width.toFixed(4)}° x ${height.toFixed(4)}°) is too small for a city boundary; using fallback bbox.`
        );
      } else {
        geometry = chosen.geojson;
        source = `nominatim:${chosen.osm_type}/${chosen.osm_id}`;
      }
    }
  } catch (err) {
    console.error("fetch-boundary: Nominatim lookup failed, using fallback bbox:", err.message);
  }

  if (!geometry) geometry = bboxToPolygon(FALLBACK_BBOX);

  fs.writeFileSync(outGeojson, JSON.stringify({ type: "Feature", properties: { source }, geometry }, null, 2));
  fs.writeFileSync(outPoly, geojsonToPoly(geometry, "pune"));
  console.error(`fetch-boundary: wrote ${outGeojson} and ${outPoly} (source: ${source})`);
}

main().catch((err) => {
  console.error("fetch-boundary failed:", err);
  process.exit(1);
});
