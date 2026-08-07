# HANDOFF.md — Session Handoff

**Regenerate this file before ending any session** (or when context is about
to run out and a new session must pick up cold). It should always describe
the *current* state, not history — history lives in `CHANGELOG.md`. Overwrite
this file each time; don't append to it.

Last updated: 2026-08-07

## Where things stand right now

The app is live and working at
https://shivkumar-cloud.github.io/Shivkumar-cloud/city-viewer/. The most
recent deployed commit is `6875c5f` (self-hosted Protomaps basemap + the
critical MapLibre dead-worker fix). That fix resolved a bug that had been
silently breaking every vector-tile basemap attempt (CARTO, then
OpenFreeMap) for multiple sessions — buildings and POIs were always fine;
only the vector basemap was affected, and only because of a Vite worker
bundling mistake, not a CDN problem.

**Not yet reconfirmed by the user:** whether road labels now actually render
on the live site post-fix, and whether the "map looks blank beyond Pune"
complaint is resolved now that the basemap covers a wider bbox than the
strict city boundary. Both were open complaints before this fix landed; ask
for (or take) a fresh screenshot before assuming either is fixed.

Five project-memory files were just created in this session (this one plus
`CLAUDE.md`, `PRODUCT_BACKLOG.md`, `CHANGELOG.md`, `TODO.md`) at the user's
explicit request, specifically so a context-window handoff to a new session
doesn't lose project understanding. **These five files have not yet been
committed to git** — that's the immediate next action if the user confirms
they're good.

## What the user asked for, most recently, in order

1. ✅ **Done.** A cybersecurity/compliance audit of the codebase (secrets,
   `npm audit`, third-party ToS, HTTPS, CI token scope, data-privacy
   posture). Clean — see `CHANGELOG.md`'s 2026-08-07 entry for full findings.
   One small gap identified (no CSP meta tag) and logged in `TODO.md`, not
   yet fixed.
2. **Partially scoped.** "Add a few AI/LLM based features." Asked the user
   which features via `AskUserQuestion`; they selected **all three** offered
   options: natural-language map query, LLM-written area/building summaries,
   and LLM-based anomaly/misclassification flagging. None are architecturally
   scoped or built yet — see `PRODUCT_BACKLOG.md`'s AI epic and `TODO.md`'s
   "blocked on user input" section. The real blocker: all three need some
   way to call an LLM API, and this is a static GitHub Pages site with no
   backend today, so inference placement is unresolved.
3. **Asked, answer insufficient.** "Move this to cloud (AWS/GCP), make it a
   full-blown enterprise app for town planners and government officials."
   Asked the user what's actually driving it (host more "properly" as a
   static site vs. add a real backend for accounts/roles/audit logs) — they
   answered **"no preference,"** which doesn't resolve anything, since the
   two paths are architecturally very different (static hosting swap vs.
   building an entire backend). **This needs to be re-asked with a forcing
   framing**, or the user needs to give a concrete driver (a named
   requirement, a budget, a specific government body) that implies the
   answer. Do not start building cloud infrastructure without this resolved
   — it's exactly the kind of large, hard-to-reverse, speculative work the
   system prompt says to scope first.

   Note: items 2 and 3 are coupled — the AI features are blocked on the
   cloud decision, not independently actionable.

## Immediate next steps for a fresh session

1. If the five new `.md` files haven't been committed yet, commit them
   (only if the user hasn't already asked for something else in the
   meantime — check chat history first).
2. Re-ask the cloud-architecture question with a forcing framing (see
   `TODO.md`'s top item) — this is the actual blocker on everything else the
   user wants next.
3. Once that's answered, `TODO.md` has the ready-to-scope breakdown for both
   the AI features and the cloud migration.
4. Independently of the above, there are small, unblocked items in
   `TODO.md` (CSP meta tag, re-confirming road labels/map-extent fixes)
   that could be picked up any time without needing user input first.

## Things a fresh session should NOT do without asking

- Don't pick AWS vs. GCP, or static-vs-backend architecture, unilaterally —
  the user was asked twice now and hasn't given an actionable answer; a
  third silent assumption would compound the problem, not fix it.
- Don't implement the three data-quality bugs found during the TCS-building
  investigation (`building=office`, `office=*` matching, `height_src` not
  shown, and the deeper POI-to-building spatial join) — the user explicitly
  said "just explain, don't change anything yet" and hasn't reopened that
  since. They're fully documented in `TODO.md` if and when the user asks.
- Don't add a live LLM API call anywhere in client-side code — there is
  currently no safe place to put a key. This is a hard blocker, not a
  style preference.

## Key facts worth not re-deriving

- The repo is `Shivkumar-cloud/Shivkumar-cloud`; this project lives in the
  `city-viewer/` subdirectory; the repo-root `README.md` is an unrelated
  GitHub-profile README — don't touch it as part of this project's work.
  The GitHub Actions workflow is at the repo root
  (`.github/workflows/deploy.yml`), not inside `city-viewer/`.
  Current working branch: `ccr-6eec1b49-dq5d0a`.
- Every push to `main` triggers a full real-OSM-data CI rebuild and
  redeploy — there's no staging environment, so treat `main` pushes as
  production deploys.
- See `CLAUDE.md` for the six hard-won technical constraints (worker
  bundling, theme-object vs. theme-string, `style.load` vs `load`, PMTiles
  range-request requirement, OSM tile-policy rule, `vite.config.js` base
  path) — these have each cost real debugging time before; don't relearn
  them.
