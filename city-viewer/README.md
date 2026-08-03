# Interactive 3D City Building Viewer

A procedurally generated 3D city you can fly around in the browser, built with [Three.js](https://threejs.org/). No build step, no server-side code — just static files.

## Features

- **Procedural city generation** — a grid of buildings split into four districts (Downtown, Residential, Industrial, Business Park), each with its own color palette and height range.
- **Orbit camera controls** — drag to orbit, scroll to zoom, right-drag to pan.
- **Click-to-inspect** — click any building to see its height, floor count, footprint, and district in a side panel.
- **Day / night toggle** — swap lighting and sky color.
- **Wireframe toggle** — see the underlying geometry.
- **Adjustable city size** — regenerate a bigger or smaller city with the slider.
- **Regenerate** — get a fresh random layout at any time.

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
- `main.js` — scene setup, procedural city generation, controls, and raycasting for building selection
- `vendor/three/` — a vendored copy of Three.js (MIT licensed) so the viewer works fully offline with no CDN dependency
