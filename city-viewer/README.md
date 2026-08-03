# Interactive 3D City Building Viewer

A 3D city you can fly around in the browser, built with [Three.js](https://threejs.org/). No build step, no server-side code — just static files. Two modes:

- **Procedural City** — a randomly generated grid city, fully fictional.
- **Real Pune, India** — a live, tile-streamed explorer of *actual* Pune, built entirely from [OpenStreetMap](https://www.openstreetmap.org/) data. No dummy buildings.

## Features

### Procedural City mode

- A grid of buildings split into four districts (Downtown, Residential, Industrial, Business Park), each with its own color palette and height range.
- Adjustable city size and a Regenerate button for a fresh random layout.

### Real Pune, India mode

Everything in this mode comes from live OpenStreetMap data — no random or hardcoded geometry:

- **Tile streaming** — the map is divided into fixed 400m×400m tiles. As you orbit, pan (drag, D-pad, or two-finger drag), or zoom, tiles near the camera load automatically, and tiles that drift far away unload to keep the browser fast. There's no "load area" button to click and no radius cap on how far you can explore — pan continuously across Pune and new real tiles keep streaming in, the same idea Google Maps uses for its own map tiles.
- **Search any place in Pune** (a neighborhood, road, landmark name) — geocoded live via OpenStreetMap's free Nominatim API, with live autocomplete suggestions as you type — and jump straight there; nearby tiles load automatically on arrival.
- Each tile brings real: building footprints (with real height/floor-count where tagged, colored by building type), roads and paths (categorized — motorway down to footpath/cycleway/steps, each styled by real width/type), railway lines, bus stops, train stations, and parks/water bodies.
- Click any building, bus stop, station, park, or water body to see its real OpenStreetMap details in the side panel.
- **View distance** (adjustable, 250–800m) controls how large a radius around the camera stays loaded at once — bigger means more of the city visible simultaneously, at the cost of more concurrent tile fetches.
- Only tiles near the camera are ever in memory at once — this is intentional. Pune has hundreds of thousands of real buildings, far more than a browser can render as 3D meshes simultaneously, so this streams what's nearby rather than attempting to hold the whole city in memory at once.

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
- `osm-explore.js` — live OpenStreetMap fetching (Overpass API per tile, Nominatim for search), lat/lng-to-scene projection, tile-grid math, and road-style definitions
- `vendor/three/` — a vendored copy of Three.js (MIT licensed) so the viewer works fully offline (Procedural City mode needs no network at all; Real Pune mode needs it only to fetch map data)

## About the real-data mode

- **No API key or billing required.** Overpass and Nominatim are free, public OpenStreetMap services.
- **Scale:** 1 scene unit = 8 real meters, chosen so individual real buildings are large enough to see and click. Position, shape, and height are all real and to that same scale — every tile is projected from one fixed origin (Shaniwar Wada), so tiles line up correctly with each other no matter how far you've panned.
- **Known gaps:** buildings modeled as OSM multipolygon *relations* (rather than simple ways) aren't rendered yet, and road/rail names aren't shown on click (only buildings, bus stops, stations, parks, and water are clickable). Very sparse or missing data in a given area reflects gaps in OpenStreetMap's coverage there, not a bug in this viewer.
- **Fair use:** Nominatim and the public Overpass instance are shared community resources. Tile fetches are debounced (only fire ~500ms after you stop moving the camera) and capped at 2 concurrent requests, so normal interactive use — even continuous panning — stays reasonable. Very fast, wide panning across a large view distance can still queue up a number of tile requests in a row; they'll stream in progressively rather than all at once.
- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/).
