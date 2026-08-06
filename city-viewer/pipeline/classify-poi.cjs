#!/usr/bin/env node
// Streams newline-delimited GeoJSON (GeoJSONSeq) point features in on stdin
// (or from a file argument), classifies each as a known POI type, and writes
// newline-delimited classified GeoJSON to stdout for tippecanoe. Features
// that don't match a known POI type are dropped.
const fs = require("fs");
const readline = require("readline");
const { classifyPoiFeature } = require("./classify-poi-lib.cjs");

async function main() {
  const inputPath = process.argv[2];
  const input = inputPath ? fs.createReadStream(inputPath) : process.stdin;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let total = 0;
  let skipped = 0;
  const counts = {};

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const jsonText = trimmed.charCodeAt(0) === 0x1e ? trimmed.slice(1) : trimmed;

    let feature;
    try {
      feature = JSON.parse(jsonText);
    } catch {
      skipped++;
      continue;
    }
    if (!feature.geometry || feature.geometry.type !== "Point") {
      skipped++;
      continue;
    }

    const classified = classifyPoiFeature(feature);
    if (!classified) {
      skipped++;
      continue;
    }
    counts[classified.properties.poi_type] = (counts[classified.properties.poi_type] || 0) + 1;
    total++;
    process.stdout.write(JSON.stringify(classified) + "\n");
  }

  console.error(`classify-poi.js: ${total} POIs classified, ${skipped} skipped`);
  console.error("classify-poi.js: counts by type:", JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error("classify-poi.js failed:", err);
  process.exit(1);
});
