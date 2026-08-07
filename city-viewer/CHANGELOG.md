# CHANGELOG.md — Completed Work

Reverse-chronological log of *shipped* work, one entry per meaningful chunk
of committed history. This is not a commit-by-commit mirror of `git log` —
it groups related commits into the outcome they produced, in plain language,
so a future session (human or Claude) can understand project history without
replaying every commit message.

## 2026-08-07 — Security & compliance audit

Audited the codebase for secrets, dependency vulnerabilities, third-party
ToS compliance, and government-compliance posture, per explicit user
request, before starting any AI/LLM or cloud-migration work.

- Grepped for API keys/secrets/credentials/tokens across `src/`,
  `pipeline/`, `shared/`, workflow files — clean (only false positives on
  the unrelated `resetToken` React state variable).
- Confirmed no `.env`/credential/`.pem`/`.key` files exist.
- Ran `npm audit` — 0 vulnerabilities across all severities, all 8 direct
  dependencies.
- Confirmed no plain-`http://` URLs anywhere; GitHub Pages HTTPS enforcement
  already on.
- Confirmed CI token permissions are already least-privilege
  (`contents: read, pages: write, id-token: write`).
- Reviewed third-party usage: OSM (ODbL attribution present and correct),
  Geofabrik (anonymous CI-time-only downloads), `build.protomaps.com`
  (CI-time-only, range-request extraction not full download),
  `protomaps.github.io/basemaps-assets` (runtime glyph/sprite dependency —
  flagged as the one remaining non-self-hosted runtime dependency, not a
  violation).
- Identified one gap: no Content-Security-Policy meta tag in `index.html`
  (not fixed yet — logged in `TODO.md`).
- Assessed data-privacy posture: no backend/accounts/forms/analytics/PII —
  good starting position for DPDP Act 2023, but not a formal certification;
  formal government compliance (GIGW, procurement) would need a named
  target body to scope against.
- No code changes made — audit only, per the natural next step after the
  user's request.

## 2026-08-06 — Self-hosted basemap + critical MapLibre worker fix

Commit: `6875c5f`

- Root-caused why no third-party vector basemap (CARTO, then OpenFreeMap)
  ever painted visible tiles on some networks despite style/sprite/glyph
  JSON loading fine: MapLibre's worker script was being imported with a
  Vite `?url` suffix, which copies the file's bytes without resolving its
  internal `import` of `maplibre-gl-shared.mjs` — so the worker threw on
  load and died silently, leaving every vector tile source stuck in
  `"loading"` forever, no console error anywhere. This bug predated the
  whole basemap-switching effort and was invisible until a genuinely
  vector-tile-dependent basemap was introduced (deck.gl parses its own
  tiles without this worker; raster basemaps decode on the main thread).
- Fixed via `?worker&url` import suffix (forces Vite to bundle the worker
  with its dependencies) plus `worker: { format: 'es' }` in
  `vite.config.js`. Verified worker bundle size went from 19KB (broken) to
  469KB (correct) and tiles moved from "stuck loading, zero range requests"
  to "loaded, visible, real range requests" (Playwright-screenshot
  confirmed before deploying).
- Also fixed a separate, independent bug found in the same investigation:
  `protomaps-themes-base`'s `layers()` needs a theme *object*
  (`namedTheme("light")`), not a theme name string — passing a string
  silently produced empty `paint: {}` blocks and invalid-style runtime
  errors.
- Built a new CI step extracting a Pune-sized `basemap.pmtiles` from
  Protomaps' daily planet build (`build.protomaps.com/<date>.pmtiles`, no
  stable "latest" alias, so the step probes backward by date up to 10 days)
  via `go-pmtiles extract --bbox=... --maxzoom=15`, using the same bbox
  logic already computed for the real Pune boundary.
- Rewrote `src/config.js`'s basemap style to point at the self-hosted
  `pmtiles://` source instead of any third-party CDN, keeping only glyphs/
  sprites on `protomaps.github.io/basemaps-assets`.
- Result deployed and confirmed live: 17.3MB `basemap.pmtiles`, 53 HTTP
  requests, 5.9s extraction, `20260806` daily build used.

## 2026-08-06 — Traffic signals & POI layer

Commits: `834b5ec` and follow-ups

- Added a second, separate OSM extraction for point features: traffic
  signals, pedestrian crossings, bus stops (`highway=traffic_signals`,
  `highway=crossing`, `highway=bus_stop`, `public_transport=platform`).
- New pipeline files: `pipeline/classify-poi-lib.cjs`,
  `pipeline/classify-poi.cjs`, `shared/poi-types.json`. Unlike buildings,
  an unmatched point is dropped rather than defaulted — there's no
  meaningful "default" POI type.
- New frontend files: `src/poiColors.js`. Extended `MapView.jsx` with a
  second `TileLayer`/`ScatterplotLayer` gated behind a `showPois` prop,
  `App.jsx`/`ControlsPanel.jsx` with a toggle, `Legend.jsx` generalized to
  render either typology or POI legend data, `BuildingPopup.jsx` extended
  with a simpler POI-specific popup branch.
- New CI steps in `deploy.yml`: filter → export → classify → tippecanoe →
  go-pmtiles → upload artifact → download into `build-site`, mirroring the
  existing buildings pipeline.
- Result: 1,838 real Pune POIs (550 traffic signals, 586 crossings, 702 bus
  stops) rendering live.

## 2026-08-05/06 — Basemap CDN troubleshooting (CARTO → OpenFreeMap → raster OSM)

Commits: `a5ec023`, `7999a97`, `834b5ec`, `dd3a3c3` (see also the 08-06 entry
above for the eventual real fix)

- Diagnosed road names/labels not rendering on the CARTO basemap. Built an
  auto-fallback mechanism to switch to a different CDN when CARTO stalled,
  plus a temporary on-screen debug HUD to see network/tile state remotely.
- User asked for both removed once it was clear the underlying issue wasn't
  something a fallback could fix — reverted to a single, direct basemap
  choice and stripped all debug/fallback code back out
  (`7999a97 Remove diagnostic debug HUD and CARTO auto-fallback`).
- Switched directly to OpenFreeMap — same failure mode.
- Tried standard OSM raster tiles (`tile.openstreetmap.org`) as a pure
  diagnostic (never intended to ship — would violate OSM's tile usage
  policy at real traffic) to isolate whether the problem was CDN-specific.
  It wasn't — see the 2026-08-06 entry above for the actual root cause.

## 2026-08-04/05 — Initial 3D building-typology explorer

Commits: `f00785a`, `ff7060e`, and the scaffold/classifier/pipeline/workflow
commits before them (see `git log` for the full list — this entry covers
everything before basemap troubleshooting began)

- Replaced the old Three.js city viewer at the same deployed URL entirely.
- Built the full pipeline: real Pune administrative boundary via Nominatim
  (`fetch-boundary.cjs`), Maharashtra/India OSM extract via Geofabrik,
  osmium filtering to tagged buildings, tag-based classification into 12
  typologies (`classify-lib.cjs` / `shared/typology.json`), tippecanoe +
  go-pmtiles tiling into `buildings.pmtiles`.
- Built the frontend: React + Vite scaffold, MapLibre + deck.gl integration,
  3D extrusion, legend, filter controls, click-to-inspect popups.
- Built the GitHub Actions workflow end-to-end: real-data pipeline → Vite
  build → GitHub Pages deploy, gated on push to `main`.
- Fixed early deployment bugs: wrong base path
  (`ba70506 Fix deployed app being served at repo root`), silent black-map
  failures (`1b6aabd Surface MapLibre load errors on-screen`), Nominatim
  picking the wrong boundary (`d8fe045`), npm cache path and Geofabrik PBF
  download issues in the workflow (`95940a8`, `222aef3`).
