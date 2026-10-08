# Readiness implementation, 7 October 2026

Scope: the five requested readiness areas. Preserve the current working tree and development data. Local automation cannot certify physical hardware, screen readers or a remote deployment.

- [x] Add opt-in rendered-frame/GPU profiling, stable canvas-size validation and six measured Intel/NVIDIA workload budgets. Fix the traced CPU pointer bottleneck; defer geometry LOD.
- [x] Add Chromium, Firefox, WebKit, Android-touch and iPhone-touch projects for catalog, canvas selection and dialogs. Installed Firefox now passes through BiDi; the separate Playwright Windows binary remains blocked.
- [x] Add axe light/dark coverage for public, owner, admin, shared/revoked and workshop/dialog states, retain violations/incomplete results, and document manual screen-reader/contrast checks.
- [x] Add read-only deployment preflight, queue/health checks, isolated database restore/upgrade and independent Storage byte recovery. Missing actual deployment/SMTP evidence fails the release gate.
- [x] Add isolated SQL and HTTP/PostgREST pool workloads, deep pagination, visibility/correctness checks, raw latency artifacts and threshold gates.
- [x] Run final browser/performance checks and record local results separately from external release evidence.

Artifacts stay in ignored `.local-artifacts/`. npm scripts expose each check; CI runs available automated coverage. No remote publishing, test emails or development database resets.

## Local evidence

| Check | Result |
| --- | --- |
| Lint / typecheck | Passed |
| Unit tests | 372 passed, 58 files |
| Worker/tool tests | 63 passed |
| Clean migration replay / database assertions | 68 migrations; 541 assertions, 35 files passed |
| Catalog load | 50,000 synthetic rows; 8 clients; 14 cases; 11,200 requests; zero errors; worst p95 109.519 ms, p99 124.081 ms |
| Catalog gate negative check | All 14 cases rejected with a 1 ms latency limit |
| CI catalog smoke | 10,000 rows; 2 clients; 140 measured requests; all cases passed |
| HTTP/PostgREST load | 50,000 rows; 8 clients; pool 4; 16 cases; 12,800 requests; zero errors; worst p95 436.867 ms, p99 534.670 ms |
| Database recovery | Seven table digests preserved; final migration upgrade; ownership/RLS and 59 assertions passed; isolated databases removed |
| Storage recovery | Independent WebM/MP4/WebP backups restored byte-for-byte; denied access checked; temporary bucket independently verified absent |
| Monitoring | QA liveness passed; stale development backlog and four failed renders correctly failed the queue gate |
| Rendered media | 4 flows passed, including private/public publication and saved/reloaded cable movements |
| Affected end-to-end flows | 10 catalog/quick-create tests passed, including filters/detail, recovery, RTL/touch and saved/reloaded editing |
| Pointer optimization regression | Three camera/mouse flows and eight canvas/dialog checks passed on final build; click, drag, cancel, Undo and saved placement preserved |
| Production build / browser performance | Build passed; resource budgets and 30-second software-profiler smoke passed |
| Browser/accessibility | Latest combined evidence: 62 passed, 2 desktop touch cases skipped; 432 axe scans, zero violations; Windows WebKit decoding explicitly unverified |
| Installed Firefox | Eight checks and 14 light/dark axe scans passed on Firefox 157.0.1; zero violations; cleanup verified |
| Hardware profiling | Intel/NVIDIA: 4 scenarios each, 30 valid final captures; six approved playback/camera/selection budgets independently checked; comparison held as cadence diagnostics |
| Deployment preflight negative check | Exit 1 for missing configuration/evidence; no remote actions |

Catalog artifacts: `.local-artifacts/catalog-load/4b317b9e625746c190c6eb5992fa74bb/results.json` (full), `ee1bd4bd3d074577b045c3ded021ac5c/results.json` (negative), and `4d61ec7e9102496eb5c99b17b6bf8ca2/results.json` (CI smoke).

Browser evidence combines the latest result for each case across the four-project matrix, reflow/navigation rerun, 24 passing moderation/reflow/workshop scans, and eight final-build canvas/dialog checks. This is not one uninterrupted clean matrix. Reports are `.local-artifacts/readiness/remaining-matrix-failed.json`, `reflow-rerun-results.json`, `final-accessibility-results.json`, `final-pointer-interactions.json`, and `combined-summary.json`. Installed Firefox has separate evidence at `.local-artifacts/firefox-installed/be85be05-3277-4f5a-ac8e-a7c6ef2d81f9/results.json`; its ordinary Windows Playwright binary cannot launch.

Axe retained 159 incomplete rule instances across the 432 scans: `color-contrast` and `video-caption`. Installed Firefox retained another ten incomplete instances. These are not certified passes; review their nodes manually alongside screen-reader, visual focus, rendered canvas and physical-touch checks. No unresolved `aria-prohibited-attr` checks remain in the automated coverage.

UI fixes found by these checks: sufficient light-theme error-text contrast; initial equipment Search focus; Safari opener focus restoration; preservation of WebKit native dialog modality during body scrollbar initialization/resize.

## Additional local implementation

- Installed Firefox 157.0.1: eight catalog/canvas/dialog checks and 14 light/dark axe scans passed. Fixture, draft, browser and profile cleanup were verified.
- Populated submission/review/editor/history, contributor diff, requested changes, notification and signed-media accessibility coverage added. Labelled preview/editor/control containers now expose group/region names. Review video has a name and metadata preload.
- Public 320px reflow passes. A real clipped-playback defect was repaired by giving the mobile workshop preview natural height; narrow focused controls now have unobscured 24px targets in all four runnable projects.
- GPU traces identified CPU skinned-mesh raycasting during camera/comparison pointer events. Inactive drag handlers now stay unregistered, while active drag completion remains available. Original selection/contact meshes remain intact; geometry LOD is deferred.
- Post-fix comparison traces independently show EventDispatch p95 of 0.28 ms on Intel and 0.25 ms on NVIDIA, down from 38.04/38.88 ms. `applyBoneTransform` is absent from sampled CPU leaves. Trace overhead is excluded from rendering budgets; GPU command-thread wall time is not GPU execution time.
- Final hardware build: `sTYX3FV488yr_1JEbSIDl`. Intel playback/camera/selection observed p95: 4.7/7.4/5.6 ms, approved limits: 6/9/7 ms. NVIDIA observed: 4.6/5.0/4.6 ms, limits: 6/6/6 ms. Budget files are `tests/hardware/budgets/{intel,nvidia}/`; all six independent checks passed in `.local-artifacts/readiness/final-hardware-budget-checks.json`. These apply to installed headless Chrome and the exact local workload/dimensions, with uncontrolled power/thermal conditions.
- Full HTTP load: 50,000 synthetic rows, eight clients, four PostgREST connections, 16 cases, 12,800 measured requests, eight visibility/pagination checks, zero errors; worst p95 436.867 ms and p99 534.670 ms. The run shared host CPU with validation jobs.
- Database dump/restore/upgrade preserved seven table digests and ownership/RLS; 59 worker/integrity assertions passed. Storage independently backed up/deleted/restored WebM/MP4/WebP bytes with matching checksums and signed access. Temporary databases/bucket were removed.
- Read-only monitoring detected old development backlog and four failed renders. Existing jobs were left untouched. The connected cloud project has two unrelated migrations and cannot certify this app's 68-migration deployment.
- CI now includes HTTP smoke and recovery drills, disables sensitive network traces for readiness, and redacts URL credentials and shared bearer paths from accessibility reports. Hardware interaction captures are scoped to actual renderer, workload, build and canvas dimensions.

Windows WebKit's media runtime rejected independent valid MP4/WebM probes. Its signed-media accessibility tests verify HTTP bytes and controls, with explicit unverified-playback annotations. A macOS/Safari playback pass remains required; the Windows annotation is not a decoder pass.

## Remaining release evidence

- Physical iPhone/Android profiling, controlled power/thermal runs, macOS Safari/physical touch and decoded signed-video checks.
- NVDA, VoiceOver and TalkBack runs; manual composed contrast/focus and remaining axe incomplete-result review.
- An actual deployment target: migration upgrade on restored data, independent database/Storage restore, alert receipt, worker restart/retry and real signup/recovery inbox delivery.
- Production workload histograms and deployment HTTP/external pooler load. The synthetic distribution is explicit; local HTTP covers PostgREST's internal pool.

Details and run commands: `device-profiling.md`, `hardware-validation.md`, `browser-accessibility-readiness.md`, `firefox-testing.md`, `deployment-readiness.md`, `operations-validation.md`, and `catalog-load-testing.md`. These local passes do not certify the remaining rows.

Development port 3000 and final-build production QA port 3001 were restored and both `/api/health` responses returned 200. The context graph was refreshed after implementation.
