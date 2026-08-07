# PRODUCT_BACKLOG.md — User Stories

Backlog of things the user has asked for or that follow naturally from those
asks. Not all of these are scoped or approved for implementation — status is
tracked explicitly per story. Cross-reference `TODO.md` for the
engineering-level breakdown of whatever is currently `Scoping` or `In
progress`.

Status legend: `Shipped` / `In progress` / `Scoping` (clarifying questions
asked, answers partially in) / `Backlog` (requested, not yet scoped) /
`Deferred` (explicitly postponed by the user).

---

## Epic: Core map viewer

### Shipped
- **As a viewer, I can see every real building in Pune extruded to height
  and colored by typology**, so I can visually understand the city's
  building-type distribution. *(buildings.pmtiles + deck.gl extrusion)*
- **As a viewer, I can filter buildings by height, area, and typology**, so I
  can narrow down to what I care about. *(ControlsPanel + DataFilterExtension)*
- **As a viewer, I can toggle 2D/3D and reset the camera**, so I can explore
  comfortably.
- **As a viewer, I can click a building to see its typology, height, area,
  and data source**, so I can sanity-check what I'm looking at.
- **As a viewer, I see a legend with live in-view counts per typology**, so
  the map isn't just colors with no scale.
- **As a viewer, I can see the basemap (roads, place names, water) alongside
  the buildings**, so the buildings have geographic context.
  *(self-hosted Protomaps basemap.pmtiles)*
- **As a viewer, I can toggle a traffic-signals/POI layer** (traffic signals,
  pedestrian crossings, bus stops) with its own legend and popups, so I can
  see traffic infrastructure without it cluttering the default view.

### Backlog
- **As a viewer, I want the map to show recognizable context beyond Pune's
  city limits** (not just a blank void past the boundary), so the map
  doesn't look broken when panned/zoomed out. *(Partially addressed by the
  basemap switch — needs a fresh check against the live site; see TODO.md.)*

---

## Epic: Data quality & trust

### Backlog (explicitly explained to user, not yet fixed — user said "just
explain, don't change anything yet")
- **As a town planner, I want a building's classification to reflect POI tags
  inside its footprint** (e.g. a company name tagged on a node inside the
  building), not just tags on the building polygon itself, so buildings like
  the TCS office aren't shown as "Residential" when OSM clearly has better
  data. Requires a point-in-polygon spatial join in the pipeline.
- **As a maintainer, I want the 3 known classifier gaps fixed**
  (`building=office` unrecognized as its own case, `office=*` only matching
  `government`, `height_src` not shown in the popup), so classification
  matches OSM's actual tagging conventions more closely.

---

## Epic: AI / LLM-assisted features

Status: **Scoping.** User has confirmed *which* features (see answers below);
none are scoped to an implementation plan or approved to build yet.

### Requested (user selected all three, 2026-08-07)
- **As a town planner, I can type a natural-language query** (e.g. "show me
  all industrial buildings near schools") **and have the map filter/highlight
  accordingly**, instead of manually setting range sliders and typology
  checkboxes.
  - Open questions: which LLM/provider, where inference runs (this is a
    static site today — a live LLM call needs *some* backend or a
    client-side-callable API), query-to-filter grammar (spatial predicates
    like "near" need real geometry work, not just an LLM prompt), cost per
    query, rate limiting/abuse prevention for a public government-facing URL.
- **As a town planner, I can select a building or draw an area and get an
  LLM-written summary** (typology mix, density, land-use observations) from
  the OSM data already on the map, instead of reading raw counts myself.
  - Open questions: same backend/inference-location question as above;
    whether summaries are generated live per-request or precomputed in CI
    for a fixed grid of areas (much cheaper, no live LLM cost, but less
    flexible).
- **As a maintainer, I want an LLM to flag buildings that look
  misclassified or suspicious** (like the TCS case) for human review, rather
  than silently trusting the heuristic classifier or auto-"fixing" it.
  - Open questions: run in CI as a batch job (cheap, reviewable diff) vs.
    live in the browser (expensive, no clear reviewer workflow); what
    "flagged" surfaces as in the UI; whether this needs a review/approval
    queue (implies a backend + auth, see Cloud epic below).

### Not yet answered
- Cloud/runtime placement for any of the above (all three need *some* way to
  call an LLM API, which a pure static GitHub Pages site cannot do without
  exposing a key client-side) is blocked on the Cloud epic below — these two
  epics are coupled, not independent.

---

## Epic: Enterprise cloud deployment (AWS/GCP)

Status: **Scoping — blocked on a clarifying answer.** User was asked what's
driving the move (host more "properly" as a static site vs. add a real
backend for accounts/roles/audit logs) and answered "no preference," which
means this still needs a decision before any infrastructure work starts —
"no preference" is not the same as "either is fine," since the two paths
imply very different architectures and costs.

### Candidate stories (none approved yet)
- **As an IT admin, I want the app hosted on AWS/GCP instead of GitHub
  Pages**, so it fits our organization's existing cloud footprint /
  procurement rules. *(Lower-effort path: static hosting only — S3+CloudFront
  or GCS+Cloud CDN, no functional change to the app.)*
- **As a government official, I want to log in with a role** (e.g. viewer vs.
  editor vs. admin), so access can be restricted appropriately.
  *(Higher-effort path: needs auth, a database, an API layer — a real
  backend where today there is none.)*
- **As an auditor, I want a record of who viewed/changed what**, so the
  system meets whatever internal audit requirements apply.
  *(Depends on the backend above existing first.)*
- **As a town planner, I want the data refreshed more often than "on every
  push to main"**, so the map reflects recent OSM edits. *(Could mean a
  scheduled CI cron rebuild — cheap, no architecture change — or a live
  OSM-Overpass-backed refresh — expensive, real backend.)*

### Explicitly out of scope until re-raised
- Multi-city support beyond Pune (mentioned only as a side note in README's
  "Regenerating for a different city" section — not requested as a product
  feature by the user).
- Any specific named government body's procurement/empanelment requirements
  — no such body has been named.

---

## How to use this file

When the user asks for something new: add it here first as `Backlog` (or
`Scoping` if genuinely ambiguous), *before* writing code. When work starts,
flip it to `In progress` and mirror the engineering breakdown into
`TODO.md`. When it ships, flip it to `Shipped` here and log it in
`CHANGELOG.md` with the commit(s) that did it. Don't delete old entries —
history here is part of the point.
