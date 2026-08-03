# Pune 3D Building-Typology Explorer

A 3D building-typology explorer for Pune, India, built with React, Vite, [MapLibre GL JS](https://maplibre.org/), [deck.gl](https://deck.gl/), and [PMTiles](https://protomaps.com/docs/pmtiles). Every building shown is real — footprints and tags come from [OpenStreetMap](https://www.openstreetmap.org/), classified into 12 typologies by a heuristic tag-based classifier and tiled offline so the browser only ever streams what's in view.

## How it works

- **Data pipeline** (`pipeline/`, runs in CI, not at runtime): fetches Pune's real administrative boundary, extracts it from a Maharashtra OpenStreetMap regional extract, filters to tagged buildings, classifies each one, and tiles the result into a single `.pmtiles` file with [tippecanoe](https://github.com/felt/tippecanoe) + [go-pmtiles](https://github.com/protomaps/go-pmtiles).
- **Frontend** (`src/`): MapLibre renders the dark CARTO basemap; deck.gl overlays a `TileLayer` that reads vector tiles directly out of the PMTiles file (via HTTP range requests — no server, no tile-serving backend) and extrudes each building to its real height.
- Nothing is computed over the full dataset at render time — the legend's "in view" counts come from whatever tiles are currently loaded, deduplicated by OSM id.

## Typology classification

Each building is classified from its OSM tags (`building`, `amenity`, `shop`, `leisure`, `landuse`, `tourism`, `historic`, `office`, `power`, `man_made`, `railway`, `aeroway`) into one of: Residential, Commercial/Retail, Industrial, Health/Medical, Religious, Educational, Mixed Use, Transport, Recreational/Open Space, Cultural/Heritage, Government/Civic, Utilities/Power. A building with a matching tag is marked `typo_src: osm`; an untagged/generic building defaults to Residential, marked `typo_src: heuristic_default`. Height uses the OSM `height` tag when present, else `building:levels × 3.5m`, else a per-typology default. See `shared/typology.json` for the exact rules and `pipeline/classify-lib.cjs` for the implementation.

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

## Regenerating for a different city

The classifier and tiling pipeline are city-agnostic — `pipeline/fetch-boundary.cjs` takes a place name (`PUNE_BOUNDARY_QUERY` env var), and the rest of the pipeline works from whatever boundary and regional `.osm.pbf` extract you point it at. To retarget:

1. Update `PUNE_BOUNDARY_QUERY` and `MAHARASHTRA_PBF_URL` (the Geofabrik regional extract covering the new city) in `.github/workflows/deploy.yml`.
2. Update `CITY_CONFIG` in `src/config.js` (name, map center).
3. Re-run the workflow.

## Deployment

`.github/workflows/deploy.yml` runs the full pipeline against real OpenStreetMap data and deploys to GitHub Pages on every push to `main` (or manually via "Run workflow"). This requires the repository's **Settings → Pages → Build and deployment → Source** to be set to **GitHub Actions** (not "Deploy from a branch").

## Known limitations

- Buildings modeled as OSM multipolygon *relations* (rather than simple ways) aren't included yet — only way-based footprints.
- Road/rail/transit layers aren't part of this map — it's buildings only.
- The 12-category color palette can't achieve perfect colorblind-safe separation for every simultaneous pairing at this many categories — text labels are always shown alongside color (legend and click popup) so identity never depends on color alone.
- Data pipeline fetches happen only in CI (build time), not from the browser — content reflects the OpenStreetMap data as of the last successful workflow run, not live edits.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/).
