export const CITY_CONFIG = {
  name: "Pune",
  center: [73.8553, 18.5195], // Shaniwar Wada
  zoom: 13,
  pitch: 45,
  bearing: 0,
  pmtilesUrl: `${import.meta.env.BASE_URL}buildings.pmtiles`,
  basemapStyle: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  // Used if the primary basemap's tiles stall for several seconds (observed
  // in practice: CARTO's CDN can end up effectively unreachable for a given
  // client while its own style/sprite/glyph JSON still loads fine, which
  // looks like a working map that never actually paints any tiles). This is
  // a different provider/CDN entirely so it isn't affected by whatever the
  // primary is stuck on.
  fallbackBasemapStyle: "https://tiles.openfreemap.org/styles/liberty",
};
