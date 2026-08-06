# Pune 3D Building-Typology Explorer

A 3D building-typology explorer for Pune, India, built with React, Vite, [MapLibre GL JS](https://maplibre.org/), [deck.gl](https://deck.gl/), and [PMTiles](https://protomaps.com/docs/pmtiles). Every building shown is real — footprints and tags come from [OpenStreetMap](https://www.openstreetmap.org/), classified into 12 typologies by a heuristic tag-based classifier and tiled offline so the browser only ever streams what's in view.

## How it works

- **Data pipeline** (`pipeline/`, runs in CI, not at runtime): fetches Pune's real administrative boundary, extracts it from a Maharashtra OpenStreetMap regional extract, filters to tagged buildings, classifies each one, and tiles the result into a `buildings.pmtiles` file with [tippecanoe](https://github.com/felt/tippecanoe) + [go-pmtiles](https://github.com/protomaps/go-pmtiles). A second, separate extraction does the same for point POIs (traffic signals, pedestrian crossings, bus stops), producing `pois.pmtiles`.
- **Basemap** (`basemap.pmtiles`, also built in CI): a [Protomaps](https://protomaps.com/) planet extract clipped to Pune, self-hosted alongside the other tiles. Three third-party tile CDNs were tried first and each failed to deliver tiles on some networks, so the basemap now uses the same same-origin delivery path as everything else — which also keeps us off OSM's tile servers, per their [usage policy](https://operations.osmfoundation.org/policies/tiles/), with no API key or quota.
- **Frontend** (`src/`): MapLibre renders that basemap via the `pmtiles://` protocol; deck.gl overlays a `TileLayer` (buildings, extruded to real height) and, when the "Show traffic/POIs" toggle is on, a second `TileLayer` of point markers, both reading vector tiles directly out of their PMTiles files via HTTP range requests — no server, no tile-serving backend.
- Nothing is computed over the full dataset at render time — the legend's "in view" counts come from whatever tiles are currently loaded, deduplicated by OSM id.

## Typology classification

Each building is classified from its OSM tags (`building`, `amenity`, `shop`, `leisure`, `landuse`, `tourism`, `historic`, `office`, `power`, `man_made`, `railway`, `aeroway`) into one of: Residential, Commercial/Retail, Industrial, Health/Medical, Religious, Educational, Mixed Use, Transport, Recreational/Open Space, Cultural/Heritage, Government/Civic, Utilities/Power. A building with a matching tag is marked `typo_src: osm`; an untagged/generic building defaults to Residential, marked `typo_src: heuristic_default`. Height uses the OSM `height` tag when present, else `building:levels × 3.5m`, else a per-typology default. See `shared/typology.json` for the exact rules and `pipeline/classify-lib.cjs` for the implementation.

## Traffic signals & POIs

A separate, much smaller extraction pulls point nodes tagged `highway=traffic_signals`, `highway=crossing`, `highway=bus_stop`, or `public_transport=platform` and classifies them into Traffic Signal / Pedestrian Crossing / Bus Stop (see `shared/poi-types.json` and `pipeline/classify-poi-lib.cjs`). Unlike buildings, a point with no matching tag is dropped rather than given a default category — there's no meaningful "default" POI type. These render as a toggleable point layer ("Show traffic/POIs" in the controls panel) so they don't clutter the default view.

## Running it locally

```bash
npm install
npm run dev
```

The dev server needs a `public/buildings.pmtiles` file to show anything. Generate a small synthetic one for local testing (no network required):

```bash
node pipeline/make-sample.cjs /tmp/sample.ndjson
node pipeline/classify.cjs /tmp/sample.ndjson > /tmp/classified.ndjson
tippecanoe -o /tmp/buildings.mbtiles --name="Pune Buildings" --layer=buildings \
  --minimum-zoom=10 --maximum-zoom=16 --force /tmp/classified.ndjson
go-pmtiles convert /tmp/buildings.mbtiles public/buildings.pmtiles
```

(`tippecanoe` and [`go-pmtiles`](https://github.com/protomaps/go-pmtiles) need to be installed — `apt install tippecanoe` and `go install github.com/protomaps/go-pmtiles@latest` on Debian/Ubuntu.)

The "Show traffic/POIs" toggle needs a `public/pois.pmtiles` the same way — without it the toggle just shows an empty point layer (each tile 404s, no crash). To generate a synthetic one, run the same three commands against `classify-poi.cjs` and a geojsonseq of point features instead.

The basemap needs `public/basemap.pmtiles`. Grab the same Pune extract CI builds (needs network):

```bash
go-pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles public/basemap.pmtiles \
  --bbox=73.65,18.42,74.05,18.75 --maxzoom=15
```

### Serving a production build locally

**PMTiles is read with HTTP range requests, and Python's `http.server` doesn't implement them** — serving `dist/` with it makes every tile fail with a content-length error. Use the bundled range-capable server instead:

```bash
npm run build
node range-server.mjs dist 8931
```

`npm run dev` is fine as-is; Vite's dev server handles ranges.

## Regenerating for a different city

The classifier and tiling pipeline are city-agnostic — `pipeline/fetch-boundary.cjs` takes a place name (`PUNE_BOUNDARY_QUERY` env var), and the rest of the pipeline works from whatever boundary and regional `.osm.pbf` extract you point it at. To retarget:

1. Update `PUNE_BOUNDARY_QUERY` and `MAHARASHTRA_PBF_URL` (the Geofabrik regional extract covering the new city) in `.github/workflows/deploy.yml`.
2. Update `CITY_CONFIG` in `src/config.js` (name, map center).
3. Re-run the workflow.

## Deployment

`.github/workflows/deploy.yml` runs the full pipeline against real OpenStreetMap data and deploys to GitHub Pages on every push to `main` (or manually via "Run workflow"). This requires the repository's **Settings → Pages → Build and deployment → Source** to be set to **GitHub Actions** (not "Deploy from a branch").

## Known limitations

- Buildings modeled as OSM multipolygon *relations* (rather than simple ways) aren't included yet — only way-based footprints.
- Road/rail geometry itself isn't a data layer here (it comes from the basemap) — only buildings and a small set of point POIs (traffic signals, crossings, bus stops) are drawn from our own OSM extract.
- The 12-category color palette can't achieve perfect colorblind-safe separation for every simultaneous pairing at this many categories — text labels are always shown alongside color (legend and click popup) so identity never depends on color alone.
- Data pipeline fetches happen only in CI (build time), not from the browser — content reflects the OpenStreetMap data as of the last successful workflow run, not live edits.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/).
