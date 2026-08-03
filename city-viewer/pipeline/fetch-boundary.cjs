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
      "https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=1&q=" +
      encodeURIComponent(QUERY);
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "pune-typology-explorer-pipeline" } });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const results = await res.json();
    const match = results[0];
    if (match?.geojson && (match.geojson.type === "Polygon" || match.geojson.type === "MultiPolygon")) {
      geometry = match.geojson;
      source = `nominatim:${match.osm_type}/${match.osm_id}`;
    } else {
      console.error("fetch-boundary: Nominatim did not return a polygon boundary; using fallback bbox.");
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
