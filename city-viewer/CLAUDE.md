# CLAUDE.md — Permanent Project Memory

This file is the durable, low-churn memory for this project. It should stay
accurate across many sessions. Session-to-session detail belongs in
`HANDOFF.md`; completed work belongs in `CHANGELOG.md`; open work belongs in
`TODO.md`; feature requests belong in `PRODUCT_BACKLOG.md`. This file is
**not** a session diary — update it only when something structurally true
about the project changes (a new architecture decision, a new directory, a
new hard-won constraint), not on every commit.

## What this project is

A 3D building-typology explorer for Pune, India — a live, deployed web app at
**https://shivkumar-cloud.github.io/Shivkumar-cloud/city-viewer/**. It shows
every real OSM building footprint in Pune, extruded to height, colored by a
12-category typology classification derived from OSM tags. It replaced an
earlier Three.js-based city viewer that lived at the same URL.

The long-term direction (user-stated, not yet built) is to grow this from a
static demo into an enterprise-grade tool for town planners and government
officials, adding AI/LLM-assisted features and a cloud (AWS/GCP) deployment.
See `PRODUCT_BACKLOG.md` for the shape of that and `TODO.md` for what's
actually queued.

## Repository layout

This is a subdirectory of the `Shivkumar-cloud/Shivkumar-cloud` GitHub repo.
The repo root also holds an unrelated GitHub-profile `README.md` — ignore it,
it's not part of this project. Everything for this project lives under
`city-viewer/`:

```
city-viewer/
├── .github/workflows/deploy.yml   # (actually at repo root: .github/workflows/deploy.yml)
├── pipeline/           # Node CLI scripts, run in CI only, never at runtime
│   ├── fetch-boundary.cjs      # Nominatim -> real Pune admin boundary (geojson + .poly)
│   ├── classify-lib.cjs        # pure classification logic (buildings)
│   ├── classify.cjs            # CLI wrapper around classify-lib.cjs
│   ├── classify-poi-lib.cjs    # pure classification logic (POIs)
│   ├── classify-poi.cjs        # CLI wrapper around classify-poi-lib.cjs
│   └── make-sample.cjs         # synthetic ndjson generator for local dev
├── shared/
│   ├── typology.json   # the 12 building typology definitions (tags, color, default height)
│   └── poi-types.json  # the 3 POI type definitions (traffic signal / crossing / bus stop)
├── src/
│   ├── main.jsx, App.jsx          # app shell, top-level state
│   ├── MapView.jsx                # MapLibre + deck.gl integration (the core rendering code)
│   ├── config.js                  # CITY_CONFIG: map center, basemap style, PMTiles URLs
│   ├── ControlsPanel.jsx           # colour-mode / filter / 3D / POI-toggle UI
│   ├── Legend.jsx                  # typology or POI legend, with in-view counts
│   ├── BuildingPopup.jsx           # click-to-inspect popup
│   ├── AboutModal.jsx
│   ├── colors.js, poiColors.js     # typology/POI id -> color lookups
│   └── app.css
├── public/              # buildings.pmtiles, pois.pmtiles, basemap.pmtiles land here at
│                         # build time (CI-generated, gitignored, never committed)
├── range-server.mjs      # Range-request-capable static server for testing a production
│                         # build locally (python's http.server can't serve PMTiles)
├── vite.config.js
├── package.json
└── README.md             # user-facing / contributor-facing docs (how it works, how to run it)
```

The GitHub Actions workflow lives at the **repo root**:
`.github/workflows/deploy.yml` (not inside `city-viewer/`), because it also
does `working-directory: city-viewer/...` steps for the app-specific parts.

## Architecture (why it's built this way)

- **Stack:** React + Vite, MapLibre GL JS v6 (basemap rendering), deck.gl
  (building/POI extrusion and picking), PMTiles (all vector data, self-hosted,
  read via HTTP range requests — no tile server, no backend, no API keys).
- **Data pipeline runs only in CI** (GitHub Actions), not at runtime. Every
  push to `main` re-fetches real OpenStreetMap data for Pune, classifies it,
  tiles it, and deploys. The browser never talks to OSM, Nominatim, or
  Geofabrik directly — it only ever reads static `.pmtiles` files from the
  same GitHub Pages origin as the app itself.
- **Three PMTiles archives**, all generated fresh in CI and gitignored:
  - `buildings.pmtiles` — every classified OSM building polygon.
  - `pois.pmtiles` — traffic signals, pedestrian crossings, bus stops (point
    features only; unmatched points are dropped, not defaulted).
  - `basemap.pmtiles` — a Pune-sized extract of Protomaps' daily planet
    build, self-hosted so the app has zero third-party tile-CDN dependency
    at runtime (see "Basemap history" below for why).
- **Classification is tag-based and heuristic**, not authoritative. A
  building with no recognized tag defaults to Residential
  (`typo_src: heuristic_default`). This is a known, accepted limitation —
  see `shared/typology.json` and `pipeline/classify-lib.cjs` for the exact
  rules, and `TODO.md` for known misclassification bugs.
- **Height** comes from, in priority order: OSM `height` tag → OSM
  `building:levels` × 3.5m → a per-typology default from `typology.json`.
  None of it is guessed per-building beyond that; there's no ML height
  estimation.

## Hard-won constraints (do not relearn these the hard way)

1. **MapLibre's worker must be imported with `?worker&url`, not `?url`.**
   `?url` only copies the worker file's raw bytes without resolving its
   internal `import "./maplibre-gl-shared.mjs"`, so the worker throws on
   load and dies **silently** — no console error, no visible symptom except
   every vector tile source stuck in `"loading"` forever. This is invisible
   with a raster basemap (images decode on the main thread) and invisible
   for deck.gl's own tile layers (deck.gl parses tiles itself, not through
   MapLibre's worker) — it only surfaces once a MapLibre **vector** source
   is introduced. Also requires `worker: { format: 'es' }` in
   `vite.config.js`. See `src/MapView.jsx` top-of-file comment and
   `vite.config.js`.
2. **`protomaps-themes-base`'s `layers()` needs a theme *object*, not a
   theme name string.** `layers("protomaps", "light", opts)` silently
   produces layers with empty `paint: {}` blocks (invalid style, cryptic
   MapLibre runtime errors like `paint.text-halo-color: color expected,
   undefined found`). Correct form: `layers("protomaps", namedTheme("light"),
   opts)`. See `src/config.js`.
3. **Use `map.once("style.load", ...)`, not `"load"`, to gate our own
   layers.** `"load"` additionally waits for the first fully-painted basemap
   frame, which ties our own same-origin building/POI layers' visibility to
   a third-party basemap's tile speed for no reason. See `src/MapView.jsx`.
4. **PMTiles needs HTTP Range support to serve locally.** Python's
   `http.server` doesn't implement Range requests and will corrupt/fail
   PMTiles reads (`ERR_CONTENT_LENGTH_MISMATCH`). Use `range-server.mjs`
   (bundled in this repo) to serve a local production build; `npm run dev`
   is fine as-is since Vite's dev server handles ranges natively.
5. **Never hotlink `tile.openstreetmap.org` or similar OSM tile servers in
   production.** Violates OSM's tile usage policy
   (https://operations.osmfoundation.org/policies/tiles/). This project
   self-hosts its own basemap PMTiles specifically to avoid that.
6. **`vite.config.js`'s `base` must be
   `'/Shivkumar-cloud/city-viewer/'` in committed code.** It gets toggled to
   `'/'` during local testing sometimes — always restore before committing,
   or the deployed asset paths break.

## Basemap history (context for why config.js looks the way it does)

Three third-party basemap sources were tried and rejected, in this order,
before settling on self-hosting:
1. **CARTO** vector tiles — style/sprite/glyph JSON loaded fine, but actual
   tile content never rendered on some networks.
2. **OpenFreeMap** vector tiles — same failure mode as CARTO.
3. **Raw OSM raster tiles** (`tile.openstreetmap.org`) — used only as a
   diagnostic to isolate whether the problem was CDN-specific; correctly
   never shipped, since it would violate OSM's tile usage policy at any real
   traffic volume.

The real root cause turned out to be unrelated to any of those three CDNs:
a dead MapLibre worker (see constraint #1 above) meant **no vector basemap
could ever have worked**, regardless of which CDN served it. Once fixed, the
project moved straight to self-hosting (`basemap.pmtiles`, a Protomaps daily
build clipped to Pune's bbox) rather than retrying a third-party CDN, since
self-hosting is strictly better here: no ToS risk, no dependency on a
service this project doesn't control, and it reuses the exact same
range-request delivery path already proven reliable for buildings/POIs.

Glyphs and sprites (fonts + icons for the basemap) still load from
`protomaps.github.io/basemaps-assets` at runtime — that's the one remaining
third-party runtime dependency. If road labels ever fail to render while
the rest of the basemap draws fine, self-hosting those font/sprite files
alongside `basemap.pmtiles` is the documented next step (see `TODO.md`).

## Security & compliance posture (last audited 2026-08-07)

- No secrets/API keys/credentials anywhen the codebase (verified by grep).
- `npm audit`: 0 vulnerabilities (all severities).
- No plain-HTTP URLs; GitHub Pages HTTPS enforcement is on.
- CI token permissions are least-privilege (`contents: read, pages: write,
  id-token: write` — no write access to repo contents).
- No backend, no accounts, no forms, no analytics, no PII collected — a
  strong starting position for India's DPDP Act 2023, but this is **not** a
  formal compliance certification.
- Known gap: no Content-Security-Policy meta tag in `index.html` yet (GitHub
  Pages can't set response headers, so a `<meta>` CSP is the only option).
  Low urgency today (no user input, no XSS surface) but worth adding before
  any "enterprise-ready" claim. See `TODO.md`.
- Full findings: see `CHANGELOG.md` entry for the 2026-08-07 audit.

## Known, accepted limitations (not bugs — architectural choices)

- OSM multipolygon *relations* aren't included as building footprints yet —
  only simple-way footprints.
- Road/rail geometry is not our data — it comes entirely from the basemap;
  our own OSM extract only supplies buildings + a small POI set.
- POI tags are not spatially joined to building polygons — a building with
  no direct tags of its own (e.g. a named office building whose company name
  is only on a POI node inside its footprint) will misclassify as
  Residential even though a human looking at OSM would see the POI. This is
  the root cause of the TCS-building misclassification the user found. See
  `TODO.md` for the fix options (not yet implemented, by explicit user
  request to "just explain, don't change anything yet").
- Classifier has at least 3 known tag-matching bugs (`building=office` not
  recognized as a distinct case, `office=*` only matches `government`,
  `height_src` not surfaced in the popup UI). Documented, not fixed. See
  `TODO.md`.

## Conventions

- Comments explain *why*, never *what* — see existing files for the style
  this project has consistently used (e.g. the worker-import comment in
  `MapView.jsx`).
- No feature flags, no speculative abstraction — this project has
  deliberately stayed a flat, single-purpose static app.
- Every commit to `main` triggers a full real-data CI rebuild + redeploy —
  there is no staging environment. Treat pushes to `main` accordingly.
