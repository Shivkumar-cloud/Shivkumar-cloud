import poiDefs from "../shared/poi-types.json";
import { hexToRgb } from "./colors";

export const POI_TYPE_ORDER = Object.keys(poiDefs);

export function poiLabel(id) {
  return poiDefs[id]?.label || id;
}

export function poiHexColor(id) {
  return poiDefs[id]?.color || "#cccccc";
}

export function poiColor(id) {
  return hexToRgb(poiHexColor(id));
}

export { poiDefs };
