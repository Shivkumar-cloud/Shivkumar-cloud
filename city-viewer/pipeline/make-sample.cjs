// Generates a synthetic sample of building-like GeoJSON features around
// Shaniwar Wada, covering every typology's tag combinations, purely so the
// classify -> tippecanoe -> pmtiles pipeline can be validated end-to-end
// without real network access to Overpass/Geofabrik (both blocked from this
// sandbox). Not used in production — the real CI pipeline fetches real data.
const fs = require("fs");

const CENTER = { lat: 18.5195, lng: 73.8553 };

function square(lat, lng, halfDeg, tags) {
  const ring = [
    [lng - halfDeg, lat - halfDeg],
    [lng + halfDeg, lat - halfDeg],
    [lng + halfDeg, lat + halfDeg],
    [lng - halfDeg, lat + halfDeg],
    [lng - halfDeg, lat - halfDeg],
  ];
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: tags };
}

const samples = [];
let i = 0;
const grid = [
  { building: "house", "building:levels": "2" },
  { building: "apartments", "building:levels": "6" },
  { building: "commercial", height: "14" },
  { shop: "supermarket", building: "yes" },
  { building: "industrial" },
  { amenity: "hospital", building: "yes", "building:levels": "4" },
  { amenity: "place_of_worship", building: "yes" },
  { amenity: "school", "building:levels": "3" },
  { building: "mixed_use", "building:levels": "8" },
  { railway: "station", building: "yes" },
  { leisure: "sports_centre", building: "yes" },
  { tourism: "museum", building: "yes" },
  { amenity: "townhall", building: "yes" },
  { power: "substation" },
  { building: "yes" }, // unmatched -> residential heuristic_default
  { building: "garage" },
];

for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 4; col++) {
    const tags = grid[i % grid.length];
    const lat = CENTER.lat + (row - 2) * 0.0009;
    const lng = CENTER.lng + (col - 2) * 0.0009;
    samples.push(square(lat, lng, 0.00015 + (i % 3) * 0.00006, { ...tags, name: `Sample ${i}` }));
    i++;
  }
}

fs.writeFileSync(
  process.argv[2] || "sample.ndjson",
  samples.map((f) => JSON.stringify(f)).join("\n") + "\n"
);
console.error(`Wrote ${samples.length} synthetic features.`);
