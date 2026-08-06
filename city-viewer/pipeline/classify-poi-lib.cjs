// Pure, testable classification logic for point POIs (traffic signals, bus
// stops, pedestrian crossings) — mirrors classify-lib.cjs's shape but for a
// much smaller, point-only tag set. No I/O here; reused by classify-poi.cjs.
const path = require("path");
const poiDefs = require(path.join(__dirname, "..", "shared", "poi-types.json"));

const TAG_CHECK_ORDER = Object.keys(poiDefs);

function lower(v) {
  return typeof v === "string" ? v.toLowerCase() : v;
}

function classifyPoiTags(props) {
  const highway = lower(props.highway);
  const publicTransport = lower(props.public_transport);

  for (const id of TAG_CHECK_ORDER) {
    const def = poiDefs[id];
    if (def.highwayTags?.includes(highway)) return id;
    if (def.publicTransportTags?.includes(publicTransport)) return id;
  }
  return null;
}

// Classifies one GeoJSON point Feature. Returns null if it doesn't match any
// known POI type (the caller should drop it) — unlike buildings, there's no
// meaningful "default" category for an arbitrary OSM point.
function classifyPoiFeature(feature) {
  const props = feature.properties || {};
  const poiId = classifyPoiTags(props);
  if (!poiId) return null;
  const def = poiDefs[poiId];

  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      id: props["@id"] ?? props.id ?? null,
      name: props.name ?? null,
      poi_type: poiId,
      poi_type_label: def.label,
      source: "osm",
    },
  };
}

module.exports = { classifyPoiFeature, classifyPoiTags, poiDefs };
