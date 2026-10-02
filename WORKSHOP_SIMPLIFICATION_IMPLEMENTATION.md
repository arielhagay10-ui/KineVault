# Workshop simplification implementation

Implemented 2 October 2026 in the local KineVault app. Quick create now guides equipment selection, start/finish adjustment, preview and private saving. Advanced editing remains available. The original cable row, regular pec deck and reverse pec deck retain their saved scenes, metadata and chosen muscles.

## Coverage of the approved review

| Items | Delivered behavior |
| --- | --- |
| 1–4 | Default Quick create, examples, four steps with Back/progress and contextual instructions. |
| 5 | Deliberately started short repetition with machine/phase captions, static endpoint illustrations and inline help. |
| 6–8 | Search names/synonyms/typos; grouped equipment pictures; account-scoped recents/favorites. |
| 9–10 | Private templates/duplicate action; picker closes with Escape, outside click or Cancel and restores focus. |
| 11–15 | Reversible machine/contact setup, combined support checklist, body-size/fit presets, machine-facing benches and body-relative pulley adjustment. |
| 16 | Hand reach/wrist/elbow warnings with repairs; paused equipment/body bounds-overlap advisory with placement repair. Bounds can overlap empty space: this asks for inspection, not proof of mesh collision. Deliberate held/machine/seat contacts are excluded. |
| 17–18 | Locked controls explain their controlling machine; movement travel comes before placement. |
| 19–24 | Pictured/plain endpoints, generated Start → Finish → Return, one item-animation action, locked animated placement, large ± controls, range presets and adjustment reset. Advanced timeline is a disclosure. |
| 25–32 | Grouped joints, plain constraint labels/help, separate preview time/editing pose, explicit pose scope, copy/mirror/loop tools, Advanced precision controls, quarter/half/normal speed and previous/next poses. |
| 33–37 | Camera/Edit modes; large zoom, fit, reset, body/selected focus, opposite-side, fade and fullscreen controls; text scene summary. Transient camera commands survive playback renders. |
| 38–43 | Serial private autosave, account-scoped recovery until confirmation, saved/offline/retry states, sign-in repair, exact validation paths and navigation protection when recovery is unavailable. First-save UUID is persisted before sending and retried atomically without duplicates. Late responses cannot erase a resumed editor's newer copy. |
| 44–45 | Restore confirmed save/reset example with explicit scope and Undo; inline name; completion card only for the confirmed current snapshot; private playable library result. Optional details waits for the latest save. |
| 46–50 | One Undo for global changes, replacement/constraint scope explanations, prior scene retained in history, removal Undo and visible Undo/Redo labels. |
| 51–56 | Optional classifications, collapsed details, familiar anatomy search, selected chips/roles, explicit equipment/body-position suggestions and no-match help. Selected fields remain submitted when hidden; uncertain anatomy stays Unknown. |
| 57–62 | Larger readable controls, visible/accessible action names, temporary numeric text validated on blur/Enter, localized decimals/numbers, English/Hebrew RTL and optional discoverable shortcuts. |
| 63–68 | One mobile scroll, collapsible preview, reachable step actions, numeric/non-drag alternatives, polite selection/pose/contact/save status, optional playback/static inspection and actionable model/WebGL/loading/error states. Dormant canvas fallback is hidden and inert. |
| 69–70 | Supports/contact/start/finish/return checklist and library resume actions. |
| 71 | **Unperformed:** independent completion trials with novice and older-adult participants of varied vision, dexterity and experience. |
| 72 | **Partial validation:** software keyboard/focus, touch, RTL, 320px reflow, CSS 200% text resize and connection/authentication/save recovery checks passed. Actual screen-reader speech, native browser 400% zoom, measured contrast, assistance/mistake counts and time to first preview remain unperformed. Viewport/text emulation does not replace those checks. |
| 73 | Equipment, mode, grip, elbow and range changes preserve creator-selected muscle highlights, including unconventional uses. No compulsory muscle highlighting. |
| 74–75 | Hand pictures, independent inward/outward palms and beside-body/shoulder-height elbow paths, exact start/finish inspection and wrist/reach repairs. Legacy defaults preserve existing movements. |

## Verification

- `npm run lint`: passed.
- `npm run typecheck`: passed, including generated route types.
- Relevant Vitest suite: **29 files / 219 tests passed**.
- Isolated PostgreSQL suite: **30 files / 439 assertions passed**, including 13 new idempotent-save checks, ownership, rollback and metadata preservation. Incremental migrations applied locally without resetting the database.
- Browser coverage: **11 scenarios passed** across guided creation/recovery, lost first-save response, late response/newer resumed edit, expired sign-in repair, endpoint inspection, placement locks, touch/RTL/text resize, camera persistence, optional details/templates, preview initialization/fallback and machine save/reload. The grouped run passed 10; the remaining worker crashed before its test began (Windows exit 3221226505). That unchanged test passed alone with one worker; the grouped invocation itself was not clean.
- Scoped final re-review: all eight original findings addressed, no remaining substantive finding in that wave. [Report](.local-artifacts/workshop/simplification/fix-rereview.md).
- Impeccable detector run once over 14 changed UI files: **zero findings**. This is not accessibility conformance evidence.
- Desktop/mobile screenshots and motion evidence are retained under `.local-artifacts/workshop/simplification/`.
- Final saved-scene copies: **102 rendered frames** (17 times in two views for each of three variants), normal/quarter-speed continuous playback and saved library previews; zero page errors. Inspected contacts, stance, joint paths, return and framing. Row retains sagittal travel/diagonal foot support, regular pec deck inward palms and reverse pec deck outward palms. [Motion manifest](.local-artifacts/workshop/simplification/motion/manifest.json).
- Final database checkpoint deeply equals the initial checkpoint for all three original private exercises, including metadata, scenes, frames and joint poses.

Production build/deployment was not run. No measured human usability or WCAG conformance claim is made.

## Remaining validation

Follow-up, 2 October: cable rows now support independent start/finish handle heights and per-moment Advanced editing. The cable angles from its fixed pulley. Existing scenes retain the default horizontal path until edited. [Follow-up checks and saved-motion evidence](.local-artifacts/workshop/row-height/review.md): 101 relevant unit tests, all 455 database assertions and browser save/reload passed.

Mouse movement follow-up: Move with mouse enables direct placement including height or floor movement. Quick create adds Drag start / Drag finish, and machine handles have large grab buttons with keyboard alternatives. Row handles move in height and pull distance; regular/reverse pec deck handles follow their machine arcs. Undo/Redo and cancellation operate on the whole drag. [Checks and visual evidence](.local-artifacts/workshop/mouse/review.md): lint, TypeScript, 89 relevant unit tests and two browser scenarios passed, including saved row reload, translated labels and mobile layout.

Recruit novice and older-adult participants for item 71. Run actual screen-reader and native browser zoom sessions for item 72, then record completion, assistance, mistakes, lost work and time to first preview. Refine the interface using those results. The overlap advisory in item 16 remains conservative.

## Working decisions

Direct limb posing follow-up: Pose hands and feet adds large drag controls with elbows/knees following, keyboard alternatives, joint-limit/contact advisories, cancellation and one-step Undo. Attached equipment and supports remain in charge of linked limbs; custom palm orientation stays stable. [Saved preview and geometry evidence](.local-artifacts/workshop/limb-posing/review.md): lint, TypeScript, 92 relevant unit checks and three browser scenarios passed, including private-library playback, Hebrew and mobile layout.

1. Kept the designated shared checkout and existing changes; this required careful file ownership.
2. Used the already-approved review as the design; reversible interface choices may still need refinement after user trials.
3. Retained evidence and left Git history untouched; the evidence consumes local disk space.
