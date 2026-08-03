# Interactive 3D City Building Viewer

A procedurally generated 3D city you can fly around in the browser, built with [Three.js](https://threejs.org/). No build step, no server-side code — just static files.

## Features

- **Procedural city generation** — a grid of buildings split into four districts (Downtown, Residential, Industrial, Business Park), each with its own color palette and height range.
- **Real Pune, India mode** — switch to a second mode built from real latitude/longitude coordinates for ten actual Pune neighborhoods (Kothrud, Koregaon Park, Hinjewadi IT Park, Kharadi, Viman Nagar, Swargate, Pune Camp, Aundh, Baner, Deccan Gymkhana) and four landmarks (Shaniwar Wada, Aga Khan Palace, Parvati Hill, Savitribai Phule Pune University), projected to true relative bearings/distances from the historic city center. Each district's building density/height/palette reflects its real character (e.g. Hinjewadi's tall IT towers vs. the old city's low dense blocks), with distinctly modeled landmarks and real facts shown on click. See `pune-data.js` for the data and sourcing notes.
- **Orbit camera controls** — drag to orbit, scroll to zoom, right-drag to pan.
- **Click-to-inspect** — click any building or landmark to see details (height/floors/footprint/district for buildings, historical facts for landmarks) in a side panel.
- **Day / night toggle** — swap lighting and sky color.
- **Wireframe toggle** — see the underlying geometry.
- **Adjustable city size** — regenerate a bigger or smaller procedural city with the slider.
- **Regenerate** — get a fresh random layout at any time (keeps the real geography in Pune mode).

## Running it

Any static file server works, since ES module imports require `http(s)://` (not `file://`):

```bash
cd city-viewer
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

- `index.html` — page shell and UI controls
- `style.css` — HUD/panel styling
- `main.js` — scene setup, both city-generation modes, controls, and raycasting for selection
- `pune-data.js` — real Pune coordinates, lat/lng-to-scene projection, and per-district building profiles
- `vendor/three/` — a vendored copy of Three.js (MIT licensed) so the viewer works fully offline with no CDN dependency

## About the Pune data

Coordinates in `pune-data.js` are approximate real-world values, not fetched from a live GIS/mapping API (this project has no network dependency at build or runtime). They're accurate enough to place each neighborhood at the correct real bearing and roughly correct real distance from Shaniwar Wada, and the scene scale is compressed (1 unit = 220m) so the ~15km-wide metro area fits in view. Exact per-building footprints aren't real data — those are still procedurally generated within each real neighborhood's boundary.

## Optional: real roads via Google Maps

In Pune mode, an optional panel lets you paste a Google Maps Platform API key and click **"Fetch Real Roads (Google)"**. This calls the Directions API (client-side, straight from your browser) to fetch the actual driving route from Shaniwar Wada to each neighborhood/landmark, and redraws the connecting roads to follow that real path instead of a straight line. Regenerating or switching modes afterward keeps the fetched roads; fetching again re-queries Google.

- The key is never committed to the repo — it's typed into the page and saved only in your own browser's `localStorage`.
- Setup: in [Google Cloud Console](https://console.cloud.google.com), enable **Maps JavaScript API** and **Directions API** for a project with billing enabled, then create an API key under **APIs & Services → Credentials**.
- Restrict the key (HTTP referrer = your deployed URL, API restriction = just those two APIs) so it can't be used elsewhere if someone reads your page source.
- If no key is entered, or a request fails, the viewer silently falls back to the straight-line roads — nothing breaks.
