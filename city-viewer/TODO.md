# TODO.md — Remaining Tasks

Engineering-level breakdown of open work. Cross-reference `PRODUCT_BACKLOG.md`
for the user-story framing of the bigger items. Keep this current — it's the
first place a new session should look after `HANDOFF.md`.

## Blocked on user input (do not start without an answer)

- [ ] **AWS/GCP migration — architecture choice.** User was asked "just host
      it more properly (static, e.g. S3+CloudFront/GCS+CDN)" vs. "add a real
      backend (accounts/roles/audit logs)" and answered "no preference."
      That's not an answer to build from — the two paths produce completely
      different codebases and costs. Needs a re-ask, ideally forcing a
      choice (e.g. "if you had to pick one for the next two weeks of work,
      which?") or a concrete driver (a specific requirement, budget, or
      government body) that implies the answer.
- [ ] **AI/LLM features — inference placement.** All three approved features
      (natural-language query, area summaries, anomaly flagging) need *some*
      way to call an LLM API. This app is a static GitHub Pages site today —
      it cannot safely hold an API key client-side. This is blocked on the
      AWS/GCP decision above (a backend solves it trivially; a static-only
      host does not solve it at all and needs a different answer, e.g.
      CI-time-only batch LLM calls with no live inference).

## Ready to scope once the above unblocks

- [ ] Pick and integrate an LLM provider/SDK for whichever features get
      greenlit first (anomaly flagging is the only one of the three that
      could plausibly run CI-time-only, with no backend — worth proposing as
      the first shippable slice regardless of the cloud answer).
- [ ] Design the natural-language-query grammar: what subset of
      filters/spatial predicates ("near", "within", "along") is actually
      supported, vs. what's just prompt-shaped hope. Spatial predicates need
      real geometry (turf.js point-in-polygon/buffer, or similar), not an
      LLM guessing coordinates.
- [ ] Design the cloud target concretely once chosen: pick AWS or GCP, pick
      the specific services (e.g. S3+CloudFront+Route53 vs. Cloud
      Storage+Cloud CDN; or ECS/Cloud Run + RDS/Cloud SQL + Cognito/Identity
      Platform if a backend is needed), and get a rough cost estimate before
      writing IaC.

## Small, independently actionable (no blocker, not yet done)

- [ ] Add a `Content-Security-Policy` `<meta>` tag to `index.html` (GitHub
      Pages can't set response headers, so `<meta>` is the only lever)
      restricting `connect-src`/`img-src`/`style-src` to self plus
      `protomaps.github.io`. Found in the 2026-08-07 security audit; low
      urgency but should land before any "enterprise-ready" claim.
- [ ] Verify road labels actually render on the live site after the
      basemap.pmtiles switch (the switch fixed the underlying dead-worker
      bug, but the user hadn't confirmed a fresh screenshot as of the last
      check-in). If labels still don't show, the next diagnostic step is
      confirming `protomaps.github.io/basemaps-assets` glyph fetches are
      succeeding (network tab / Playwright), and if not, self-hosting the
      font/sprite PBFs alongside `basemap.pmtiles` instead of depending on
      that GitHub Pages resource at runtime.
- [ ] Confirm "map extends beyond Pune with a plain, un-detailed basemap"
      actually reads correctly now that the self-hosted basemap covers a
      bbox somewhat larger than the strict city boundary — re-check against
      a live screenshot, this was reported as an issue before the basemap
      rewrite and hasn't been re-verified since.

## Known data-quality bugs (explained to user, explicitly deferred — "just
explain, don't change anything yet")

- [ ] `pipeline/classify-lib.cjs`: `building=office` has no dedicated
      typology match (falls through to Residential default). OSM commonly
      tags standalone office buildings this way.
- [ ] `pipeline/classify-lib.cjs`: `office=*` tag only matches the
      `government` typology's `officeTags: ["government"]`. Other
      `office=company` / `office=it` / `office=coworking` values fall
      through to default, even though `office` presence at all is a strong
      commercial/mixed-use signal.
- [ ] `src/BuildingPopup.jsx`: `height_src` (`heightSrc` from the
      classifier: `osm_height` / `osm_levels` / typology default) is
      computed in the pipeline but not surfaced in the popup UI — a user has
      no way to tell whether a height is real OSM data or a guessed default.
- [ ] **Root architectural gap, larger than the three above:** POI-node tags
      (e.g. a company name tagged on a point inside a building's footprint)
      are never spatially joined to the containing building polygon. This is
      the actual reason the TCS building shows as "Residential" — the
      building polygon itself carries no distinguishing tag, and the POI
      layer (traffic signals/crossings/bus stops only) doesn't include
      named-business POI types or attempt any join. Fixing this properly
      needs a point-in-polygon join step in the pipeline (e.g. via turf.js
      or a spatial index) between the building extract and a broader POI
      extract than the traffic-only one that exists today.

## Long-standing known limitations (accepted, not bugs — see CLAUDE.md)

- [ ] OSM multipolygon relations not included as building footprints (only
      simple ways).
- [ ] No live OSM update path — data is as fresh as the last CI run on
      `main`, not real-time.
