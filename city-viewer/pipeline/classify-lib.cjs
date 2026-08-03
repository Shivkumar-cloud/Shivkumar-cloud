// Pure, testable classification logic — no I/O here. Reused by classify.js
// (the CLI) and by the test script.
const path = require("path");
const typologyDefs = require(path.join(__dirname, "..", "shared", "typology.json"));

const TAG_CHECK_ORDER = Object.keys(typologyDefs);

function lower(v) {
  return typeof v === "string" ? v.toLowerCase() : v;
}

function classifyTags(props) {
  const building = lower(props.building);
  const amenity = lower(props.amenity);
  const leisure = lower(props.leisure);
  const landuse = lower(props.landuse);
  const tourism = lower(props.tourism);
  const office = lower(props.office);
  const power = lower(props.power);
  const manMade = lower(props.man_made);
  const railway = lower(props.railway);
  const aeroway = lower(props.aeroway);

  for (const id of TAG_CHECK_ORDER) {
    const def = typologyDefs[id];
    if (def.buildingTags?.includes(building)) return id;
    if (def.amenityTags?.includes(amenity)) return id;
    if (def.shopTagPresent && props.shop) return id;
    if (def.leisureTags?.includes(leisure)) return id;
    if (def.landuseTags?.includes(landuse)) return id;
    if (def.tourismTags?.includes(tourism)) return id;
    if (def.historicTagPresent && props.historic) return id;
    if (def.officeTags?.includes(office)) return id;
    if (def.powerTags?.includes(power)) return id;
    if (def.manMadeTags?.includes(manMade)) return id;
    if (def.railwayTags?.includes(railway)) return id;
    if (def.aerowayTags?.includes(aeroway)) return id;
  }
  return null;
}

function computeHeight(props, typologyId) {
  if (props.height != null) {
    const h = parseFloat(String(props.height).replace(/[^0-9.]/g, ""));
    if (!isNaN(h) && h > 0) return { height: h, heightSrc: "osm_height" };
  }
  const levelsRaw = props["building:levels"];
  if (levelsRaw != null) {
    const levels = parseFloat(String(levelsRaw).replace(/[^0-9.]/g, ""));
    if (!isNaN(levels) && levels > 0) return { height: levels * 3.5, heightSrc: "osm_levels" };
  }
  return { height: typologyDefs[typologyId].defaultHeightM, heightSrc: "typology_default" };
}

const EARTH_METERS_PER_DEG_LAT = 111320;

function ringAreaM2(ring, refLatDeg) {
  const metersPerDegLng = EARTH_METERS_PER_DEG_LAT * Math.cos((refLatDeg * Math.PI) / 180);
  const pts = ring.map(([lng, lat]) => [lng * metersPerDegLng, lat * EARTH_METERS_PER_DEG_LAT]);
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

function computeAreaM2(geometry) {
  if (!geometry) return 0;
  if (geometry.type === "Polygon") {
    const refLat = geometry.coordinates[0][0][1];
    const outer = ringAreaM2(geometry.coordinates[0], refLat);
    const holes = geometry.coordinates.slice(1).reduce((sum, ring) => sum + ringAreaM2(ring, refLat), 0);
    return Math.max(0, outer - holes);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce((sum, poly) => sum + computeAreaM2({ type: "Polygon", coordinates: poly }), 0);
  }
  return 0;
}

// Classifies one GeoJSON Feature, returning a NEW feature with typology
// properties added. Does not mutate the input.
function classifyFeature(feature) {
  const props = feature.properties || {};
  const matchedId = classifyTags(props);
  const typologyId = matchedId || "residential";
  const typoSrc = matchedId ? "osm" : "heuristic_default";
  const { height, heightSrc } = computeHeight(props, typologyId);
  const areaM2 = computeAreaM2(feature.geometry);
  const def = typologyDefs[typologyId];

  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      id: props["@id"] ?? props.id ?? null,
      name: props.name ?? null,
      typology: typologyId,
      typology_label: def.label,
      typo_src: typoSrc,
      source: "osm",
      height: Math.round(height * 10) / 10,
      height_src: heightSrc,
      area_m2: Math.round(areaM2 * 10) / 10,
    },
  };
}

module.exports = { classifyFeature, classifyTags, computeHeight, computeAreaM2, typologyDefs };
