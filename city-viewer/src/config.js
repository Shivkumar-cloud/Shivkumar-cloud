export const CITY_CONFIG = {
  name: "Pune",
  center: [73.8553, 18.5195], // Shaniwar Wada
  zoom: 13,
  pitch: 45,
  bearing: 0,
  pmtilesUrl: `${import.meta.env.BASE_URL}buildings.pmtiles`,
  poiPmtilesUrl: `${import.meta.env.BASE_URL}pois.pmtiles`,
  // Two different vector-tile CDNs (CARTO, then OpenFreeMap) both loaded
  // their style/sprite/glyph JSON fine but never delivered real tile content
  // for some users/networks, while this app's own same-origin PMTiles
  // (buildings, POIs) have been completely reliable throughout. That points
  // at third-party tile-CDN traffic being blocked/throttled somewhere in the
  // network path, not a code issue. tile.openstreetmap.org is the single
  // most widely used, most likely to be whitelisted map tile source that
  // exists — trying a plain raster style against it as the next diagnostic
  // step, inline so it isn't yet another cross-origin style.json fetch.
  //
  // NOTE: OSM's tile usage policy (https://operations.osmfoundation.org/policies/tiles/)
  // asks non-trivial deployments not to hotlink production traffic against
  // this server long-term — fine for now while diagnosing, but if this ends
  // up being the permanent basemap, migrate to a compliant provider or a
  // self-hosted PMTiles basemap instead.
  basemapStyle: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  },
};
