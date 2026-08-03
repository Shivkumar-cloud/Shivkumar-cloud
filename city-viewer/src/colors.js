import typologyDefs from "../shared/typology.json";

export const TYPOLOGY_ORDER = Object.keys(typologyDefs);

export function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function typologyColor(id) {
  return typologyDefs[id]?.color || "#b9ac95";
}

// Single-hue sequential ramps (light -> dark), per the dataviz method: one hue
// per magnitude encoding, never a rainbow.
const HEIGHT_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab", "#104281"];
const AREA_RAMP = ["#fdd9b5", "#fbb87a", "#f2903c", "#d9701f", "#b8560f", "#8a3f0a"];

function bucketColor(ramp, value, min, max) {
  if (max <= min) return ramp[0];
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const idx = Math.min(ramp.length - 1, Math.floor(t * ramp.length));
  return ramp[idx];
}

export function colorForFeature(props, colorMode, ranges) {
  if (colorMode === "height") {
    return hexToRgb(bucketColor(HEIGHT_RAMP, props.height || 0, ranges.heightMin, ranges.heightMax));
  }
  if (colorMode === "area") {
    return hexToRgb(bucketColor(AREA_RAMP, props.area_m2 || 0, ranges.areaMin, ranges.areaMax));
  }
  return hexToRgb(typologyColor(props.typology));
}

export { typologyDefs };
