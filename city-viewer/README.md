# Interactive 3D City Building Viewer

A 3D city you can fly around in the browser, built with [Three.js](https://threejs.org/). No build step, no server-side code — just static files. Two modes:

- **Procedural City** — a randomly generated grid city, fully fictional.
- **Real Pune, India** — a live, on-demand explorer of *actual* Pune, built entirely from [OpenStreetMap](https://www.openstreetmap.org/) data. No dummy buildings.

## Features

### Procedural City mode

- A grid of buildings split into four districts (Downtown, Residential, Industrial, Business Park), each with its own color palette and height range.
- Adjustable city size and a Regenerate button for a fresh random layout.

### Real Pune, India mode

Everything in this mode comes from live OpenStreetMap data — no random or hardcoded geometry:

- **Search any place in Pune** (a neighborhood, road, landmark name) — geocoded live via OpenStreetMap's free Nominatim API — and jump straight there.
- **Load Real Area Here** fetches, for a radius around your current location (200–900m, adjustable), real: building footprints (with real height/floor-count where tagged, colored by building type), roads and paths (categorized — motorway down to footpath/cycleway/steps, each styled by real width/type), railway lines, bus stops, train stations, and parks/water bodies.
- Click any building, bus stop, station, park, or water body to see its real OpenStreetMap details in the side panel.
- Only one area is held in memory at a time — search or reload elsewhere to explore a different part of the city. This is intentional: Pune has hundreds of thousands of real buildings, far more than a browser can render as 3D meshes at once, so this is a "load what you're looking at" explorer rather than an attempt to hold the whole city simultaneously.

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
- `main.js` — scene setup, both modes' rendering, controls, and raycasting for selection
- `osm-explore.js` — live OpenStreetMap fetching (Overpass API for map data, Nominatim for search), lat/lng-to-scene projection, and road-style definitions
- `vendor/three/` — a vendored copy of Three.js (MIT licensed) so the viewer works fully offline (Procedural City mode needs no network at all; Real Pune mode needs it only to fetch map data)

## About the real-data mode

- **No API key or billing required.** Overpass and Nominatim are free, public OpenStreetMap services.
- **Scale:** 1 scene unit = 8 real meters, chosen so individual real buildings are large enough to see and click. Within a loaded area, relative position, shape, and height between features are real and accurate to that scale.
- **Known gaps:** buildings modeled as OSM multipolygon *relations* (rather than simple ways) aren't rendered yet, and road/rail names aren't shown on click (only buildings, bus stops, stations, parks, and water are clickable). Very sparse or missing data in a given area reflects gaps in OpenStreetMap's coverage there, not a bug in this viewer.
- **Fair use:** Nominatim and the public Overpass instance are shared community resources — this app makes one request per search/load action, not a background poller, so normal use stays well within their usage policies.
- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/).
