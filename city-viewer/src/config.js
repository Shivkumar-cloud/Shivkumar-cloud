import { layers, namedTheme } from "protomaps-themes-base";

// Resolve to an absolute URL: MapLibre hands the raw string to the pmtiles://
// protocol handler, which can't resolve a page-relative path on its own.
function asset(name) {
  return new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
}

const BASEMAP_PMTILES_URL = asset("basemap.pmtiles");

export const CITY_CONFIG = {
  name: "Pune",
  center: [73.8553, 18.5195], // Shaniwar Wada
  zoom: 13,
  pitch: 45,
  bearing: 0,
  pmtilesUrl: asset("buildings.pmtiles"),
  poiPmtilesUrl: asset("pois.pmtiles"),
  basemapPmtilesUrl: BASEMAP_PMTILES_URL,

  // The basemap is a self-hosted Protomaps extract served from the same origin
  // as the building/POI tiles, rather than a third-party tile CDN.
  //
  // Rationale: three separate third-party sources were tried first (CARTO and
  // OpenFreeMap vector tiles, then tile.openstreetmap.org raster). The vector
  // ones loaded their style/sprite/glyph JSON but never delivered actual tile
  // content on some networks, while this app's own same-origin PMTiles have
  // been completely reliable throughout — so the basemap now uses that same
  // proven delivery path. It also avoids hotlinking OSM's tile servers, which
  // their usage policy (https://operations.osmfoundation.org/policies/tiles/)
  // asks deployments not to do, and needs no API key or paid quota.
  //
  // Glyphs/sprites still come from protomaps.github.io (GitHub Pages — the
  // same infrastructure that serves this app, so it shares its reachability).
  // Labels depend on the glyphs loading; if road names ever fail to render
  // while the rest of the basemap draws fine, self-hosting the font PBFs
  // alongside basemap.pmtiles is the next step.
  basemapStyle: {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${BASEMAP_PMTILES_URL}`,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    // Second arg must be a theme *object* — passing the name as a string
    // silently yields empty paint blocks and an invalid style. Swap "light"
    // for "dark" here to flip the basemap's appearance.
    layers: layers("protomaps", namedTheme("light"), { lang: "en" }),
  },
};
