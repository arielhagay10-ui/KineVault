# Visual rollout — 17 October 2026

The pilot direction now covers 11 studio equipment families, seven cable attachments and the existing website screens. The exercise figure remains the bundled Z-Anatomy model. Blender assets contain equipment only; the home mascot remains the existing brand illustration.

## Implementation

- Original equipment GLBs, named moving groups, independent GPU resources, procedural failure fallbacks, shared studio lighting and 18 WebP picker thumbnails. Moving cables remain website geometry. See [generation and attribution](equipment-assets.md).
- Home, taxonomy, personal exercises, dashboard, notifications, sharing, submission and administration use the pilot's shared hierarchy, controls and states. Workshop refinements expose capture guidance, recovery timestamps and equipment previews.
- Existing workshop authoring/save/submission/review remains the publication path. Batch scripts no longer author or approve catalog demonstrations. No real exercises were published during this rollout; tests use isolated local fixtures and retain required audit history.
- No schema, public API, solver coordinate or saved scene format changes. Original authorization and moderation remain authoritative.

## Validation

| Check | Evidence |
| --- | --- |
| Unit suite | 93 files, 802 tests passed after the motion follow-up |
| Real GLB checks after regeneration | 32 tests passed; named groups, independent disposal, draw limits and 17 travel samples |
| Machine browser checks | Six cases passed, including both lat grips; playback, editing and save/reload |
| Exported media | Eight cases passed: all five machine families, cable attachments, dumbbells and barbell; actual posters/videos and 17 sampled video positions |
| Publication | Two cases passed, including actual workshop UI authoring, frozen scene ancestry, public playback, original anatomy attribution and Shoulder Abduction + Cable → detail |
| Workshop layouts | Desktop/mobile, both themes, Hebrew RTL, keyboard tabs and picker/playback interactions passed |
| Recovery and ownership | Missing WebGL, private editing/sharing/revocation and failed attachment replacement passed |
| Production | Webpack build, lint and typecheck passed; Turbopack remains unavailable in this environment |
| Account accessibility | 16 checks passed across desktop Chromium/WebKit and Android/iPhone layouts in both themes; the four Firefox checks now pass using the unchanged official browser bundle copied into the workspace |
| Performance | Four production checks passed; blank/held/machine use 3/9/15 draws, one pose solve per rendered frame and zero steady-playback React commits |
| Actual GPU playback | Three valid 15-second captures on RTX 5070 Ti Laptop GPU; p95 rendered-frame cadence 5.8, 5.5 and 4.6 ms |

The worker suite passed 69 tests and the isolated database suite passed 725 assertions across 41 files. Final confirmation is recorded in the ignored rollout logs.

Software-rendered machine capture initially collected 117 intervals in 15 seconds. Extending that smoke capture to 20 seconds met the existing 120-interval requirement; no resource, solver or validity limit was relaxed. Actual GPU measurements are specific to this local setup, with background user activity and power/thermal conditions unverified; they are frame cadence, not GPU execution time or a universal FPS promise.

## Equipment review closure

URL changes remount an asset loader, keeping the procedural fallback available after a failed replacement. Pec pivot housings follow both moving arms and connect to overhead supports. Leg-press tests measure actual triangle distance to both solver foot contacts at 17 positions. Same-material meshes merge inside each moving group: dumbbells use three draws each; Smith uses six meshes, row eight and pec deck fourteen.

The 18 equipment GLBs total 2,451,200 bytes; the 18 thumbnails total 146,228 bytes. Runtime budgets and frame measurements are reported separately from transfer size.

## Local evidence

Ignored `.local-artifacts/visual-rollout/` contains logs, before/after workshop captures, generated asset measurements and 17-position contact sheets. `.local-artifacts/machines/review/` contains original anatomy/model request provenance and sampled browser views. `.local-artifacts/workshop/cable-freedom/` contains exported posters, videos and sampled frames. The earlier pilot review remains in `docs/visual-pilot-2026-10-16.md`.

## Motion follow-up

The reported two-handed pullover snapped its wrist near an end pose. The shared-head fit had an unnecessary palm-heading degree of freedom. It now retains authored wrist tilt while fitting the palm, preserving the requested shoulder/elbow bend and existing contacts. The exercise's saved scene was read without changing it.

Five regression cases sample 257–385 positions per loop, including a normalized copy of the reported movement and Both shoulder edits after four different initial elbow bends. All 786 unit tests, lint, typecheck and the production build pass. The near-limit browser flow passes playback, grip checks and save/reload. Its actual private poster/video export also passes. Evidence is in ignored `.local-artifacts/stretch-*.log` and `.local-artifacts/workshop-three-comments/near-limit-pullover/`.

### Follow-up closure, 18 October

The remaining shared-hold flips are corrected. The following arm starts from an analytical reach fit, then the bounded contact fit retains its shoulder orientation using quaternion distance. This avoids switching elbow branches near a shoulder singularity. Wrist tilt stays authored, and the driving palm remains under the head during interpolation. No playback history or new scene fields are required. Impossible straight-arm reaches retain the existing warning rather than stretching the model.

Twenty-one movement cases sample 257–385 positions each, including weight-driven, balanced, left-arm and right-arm holds, straight and bent elbows, and changing elbow bend. Existing grip, palm-support and real torso-clearance checks also pass. Five browser cases pass playback, 17 contact samples in two views, editing and save/reload. All five actual private poster/video exports pass, with 17 sampled video positions each. The original figure remains Z-Anatomy.

Real workshop testing also exposed a new-draft refresh issue: saving at `/my-exercises/new` left that URL unchanged. A confirmed save now updates the URL to the saved workshop without remounting ongoing edits. Its regression failed against the previous build, then passed after the correction. All seven save checks pass, including queued autosaves, keyboard saves and name prompts. A fresh private workshop draft was authored, played, saved and reloaded through Workshop MCP, retaining its equipment and finish pose.

Final lint, typecheck, all 802 unit tests, 69 worker tests, 725 isolated database assertions and the production webpack build pass. The four production performance checks pass with the motion correction. The later URL correction changes only confirmed-save handling. Four Firefox account accessibility cases pass in both themes. On this Windows installation the cache-path executable failed to launch; an unchanged copy under `.local-artifacts/tools/firefox-1543-local/` works. `PLAYWRIGHT_FIREFOX_EXECUTABLE` selects that executable for readiness checks without changing default CI behavior.

Evidence is stored in ignored `.local-artifacts/remaining-*.log`, `.local-artifacts/workshop-three-comments/`, `.local-artifacts/workshop/cable-freedom/`, `.local-artifacts/efficiency-review/` and `tools/workshop-mcp/.local-artifacts/`. The equipment, screen and reported movement follow-up work is complete locally. No deployment or real exercise publication was performed.
