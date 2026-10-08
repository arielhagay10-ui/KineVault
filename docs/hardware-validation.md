# Repeatable local workshop hardware captures

`test:hardware` uses installed Chrome with hardware acceleration. It requires an explicitly confirmed quiet window, local app/Supabase origins, device identity and an expected renderer. It creates one disposable private fixture per scenario, authenticates through the app and cleans up only its fixture account. The fixture has changing shoulder poses and a separate static dumbbell. It is a rendering workload, not published exercise content.

Start a current production server first. Do not run a build, database load test, axe audit, media worker or other browser suite during captures. The runner checks that the origin HTML contains the current `.next/BUILD_ID`. It never starts or restarts a server.

PowerShell example:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3001'
$env:HARDWARE_QUIET_WINDOW = '1'
$env:HARDWARE_DEVICE = 'LENOVO 83F5 / Windows 11 Home 10.0.26300'
$env:HARDWARE_EXPECT_RENDERER = 'Intel'
$env:HARDWARE_CONDITIONS = 'Parsec virtual display; power/thermal conditions uncontrolled'
$env:HARDWARE_GPU = 'default'
npm run test:hardware
```

Keep secrets in `.env.local`. The runner loads that file and rejects nonlocal fixture destinations. Run three new warm 15-second captures for each scenario at viewport 1440×1000 and browser DPR 1. The profiler records actual drawing-buffer dimensions and renderer DPR. Calibration rejects software/masked renderers, invalid/duplicate captures and changing browser/build/render dimensions.

| Scenario | Actual workload | Measurement scope |
| --- | --- | --- |
| Playback | Continuous saved shoulder motion | One canvas |
| Camera | Continuous motion with repeated mouse orbit drags | One canvas |
| Selection | Actual equipment selection, then Play after each selection | One canvas, including playback restart |
| Comparison | Fixed start/finish poses with continuous linked orbit drags | Two simultaneous canvases, separate cadence diagnostics |

Selection pauses playback by design. Comparison also stops playback and renders two fixed poses. Comparison captures therefore measure linked camera interactions, not animated comparison. Per-canvas frame intervals cannot establish aggregate GPU execution cost or interaction latency. The runner records camera positions, solve counts, gesture counts, browser version, Chrome GPU inventory and launch options alongside raw captures. Trace/video recording is off during timing.

Artifacts live under `.local-artifacts/readiness/devices/workshop-default/` or `workshop-high-performance/`, in a new timestamped directory per invocation. Each scenario has three raw files per canvas, interaction evidence, an environment file and a workload screenshot. Playback, camera and selection proposals use the worst p95 plus 20%, rounded up. They require review. Comparison produces held cadence summaries, with no rendering budget or LOD conclusion. A continuous-animation p95 above 33.3 ms requests trace investigation; it never changes runtime quality or enables LOD.

To check reviewed budgets, use a directory with filenames `playback-canvas-1.json`, `camera-canvas-1.json` and `selection-canvas-1.json`. Set `HARDWARE_BUDGET_DIR` to that directory and run again. The runner requires `status: "approved"`, matching device/GPU/browser/workload/dimensions and three distinct captures. A new build can be compared to the approved scope. Comparison remains diagnostic and cannot pass an approved rendering-budget gate.

For a separate diagnostic trace, set `HARDWARE_TRACE_SCENARIO` to `camera` or `comparison` and run `npm run test:hardware -- workshop-trace.spec.ts`. Clear that variable before normal budget captures. Traces have recording overhead and never enter calibration. Run `node scripts/summarize-hardware-trace.mjs path/to/chrome-trace.json` to summarize complete-event wall times and sampled CPU leaf time separately. GPU command-thread wall time is not GPU execution time. Input marks precede gesture dispatch and do not establish input-to-render latency.

## Discrete GPU probe

Chromium defines [`--force-high-performance-gpu`](https://chromium.googlesource.com/chromium/src.git/+/refs/heads/main/gpu/config/gpu_switches.cc). Set `HARDWARE_GPU=high-performance` and `HARDWARE_EXPECT_RENDERER=NVIDIA`. This requests the adapter; the captured WebGL renderer must actually identify NVIDIA. An ignored request, software fallback or Intel renderer fails before physical captures. `renderer-probe.json` preserves the reported adapter and Chrome inventory even on rejection. The flag alone is never GPU evidence.

## External gaps

Headless Chrome on a Parsec desktop does not certify interactive physical desktop use, phone touch, iPhone Safari, Android Chrome, controlled power/thermal behavior or sustained thermal throttling. Those need actual devices and controlled manual captures. Do not convert emulation or software samples into physical-device evidence. The existing public-home Intel budget in `docs/device-profiling.md` applies only to its exact public workload and render dimensions.

## Recorded final desktop captures, 7 October 2026

Build `sTYX3FV488yr_1JEbSIDl` passed all four scenarios on both actual adapters. Each scenario has three distinct valid 15-second captures. LENOVO 83F5 ran Windows 11 Home 10.0.26300, installed headless Chrome 154.0.8037.98 and a Parsec display. WebGL and Chrome GPU inventory identified Intel Graphics D3D11 with driver 32.0.101.8331, and NVIDIA GeForce RTX 5070 Ti Laptop GPU D3D11 with driver 32.0.16.1742. Power and thermal conditions were uncontrolled.

The single-view buffer was 1064×585 at renderer DPR 1, viewport 1440×1000 at browser DPR 1. The fixture reached 648,707 triangles and seven draw calls. Approved local regression budgets are in `tests/hardware/budgets/intel/` and `tests/hardware/budgets/nvidia/`. All six budget checks passed against their three final captures.

| GPU | Workload | Worst p95 | Approved limit |
| --- | --- | --- | --- |
| Intel | Playback | 4.7 ms | 6 ms |
| Intel | Camera with playback | 7.4 ms | 9 ms |
| Intel | Selection and playback restart | 5.6 ms | 7 ms |
| NVIDIA | Playback | 4.6 ms | 6 ms |
| NVIDIA | Camera with playback | 5.0 ms | 6 ms |
| NVIDIA | Selection and playback restart | 4.6 ms | 6 ms |

Set `HARDWARE_BUDGET_DIR=tests/hardware/budgets/intel` or `tests/hardware/budgets/nvidia` for later matching runs. Use the same device identifier shown in the example. Actual driver versions are recorded for review; the automated gate matches reported GPU/browser/workload/render dimensions. Rebaseline driver, browser or workload changes.

Final raw captures and checks are in `.local-artifacts/readiness/devices/workshop-default/2026-10-07T17-14-39-048Z/` and `workshop-high-performance/2026-10-07T17-18-24-511Z/`. The combined check is `final-workshop-budget-checks.json` in the devices directory.

### Comparison investigation

Comparison buffers were 526×400 each at DPR 1. Final demand-render cadence p95 was 9.2/9.1 ms on Intel and 8.5/8.2 ms on NVIDIA. These include driver/input gaps and remain held diagnostic summaries, with no approved rendering limit or 30Hz claim.

The earlier build `x7wsEGtYkk2s1DU2DC_9u` showed 161.6/88.4 ms Intel and 166.0/89.8 ms NVIDIA comparison cadence. Separate V8 traces located CPU work along `intersectObject → raycast → computeBoundingSphere/_computeIntersections → getVertexPosition → applyBoneTransform`. The drag hook registered mesh pointer handlers even without an editor. R3F performed intersections before callback guards could return.

`src/components/character/studio-drag.ts` now registers handlers only when an idle item can begin a drag, or an active drag still needs completion/cancellation. Click and context-menu handlers, original anatomy meshes, contact logic and geometry remain intact. Regression coverage reproduced the old registration, then passed with the fix; camera/mouse browser flows also passed.

Post-fix comparison EventDispatch p95 fell from 38.04 to 0.28 ms on Intel and from 38.88 to 0.25 ms on NVIDIA. `applyBoneTransform` disappeared from sampled CPU leaves. GPU command-thread task p95 stayed near 0.2 ms, which is not GPU execution timing. Traces have recording overhead and are separate from budget captures. No LOD change was indicated or enabled.

Post-fix traces and summaries are under `.local-artifacts/readiness/devices/trace-default/2026-10-07T17-22-29-018Z/comparison/` and `trace-high-performance/2026-10-07T17-23-53-556Z/comparison/`. Earlier traces remain under the same GPU directories with timestamps 16:58 and 16:59 UTC.
