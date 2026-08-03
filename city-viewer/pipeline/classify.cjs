#!/usr/bin/env node
// Streams newline-delimited GeoJSON (GeoJSONSeq) in on stdin (or from a file
// argument), classifies each building feature, and writes newline-delimited
// classified GeoJSON to stdout for tippecanoe. Kept as a pure stream so this
// can run over hundreds of thousands of features without loading them all
// into memory at once.
const fs = require("fs");
const readline = require("readline");
const { classifyFeature } = require("./classify-lib.cjs");

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
    // osmium/ogr2ogr GeoJSONSeq output sometimes prefixes each record with a
    // U+001E record separator; strip it if present.
    const jsonText = trimmed.charCodeAt(0) === 0x1e ? trimmed.slice(1) : trimmed;

    let feature;
    try {
      feature = JSON.parse(jsonText);
    } catch {
      skipped++;
      continue;
    }
    if (!feature.geometry || (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon")) {
      skipped++;
      continue;
    }

    const classified = classifyFeature(feature);
    counts[classified.properties.typology] = (counts[classified.properties.typology] || 0) + 1;
    total++;
    process.stdout.write(JSON.stringify(classified) + "\n");
  }

  console.error(`classify.js: ${total} features classified, ${skipped} skipped (no/invalid polygon geometry)`);
  console.error("classify.js: counts by typology:", JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error("classify.js failed:", err);
  process.exit(1);
});
