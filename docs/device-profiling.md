# Physical device profiling

Phone and workshop-comparison budgets are awaiting physical measurements. `test:performance` uses SwiftShader and remains a software regression check. Never label those samples as phone/GPU evidence.

Use a production build on a reachable HTTPS staging origin. Do not expose the local Supabase service key or development server to a phone. Test Safari on a physical iPhone, Chrome on a physical Android phone, and an integrated desktop GPU. Record model, OS/browser version, power mode, temperature state and build revision. Repeat warm captures three times per device/scenario. Keep cold model-ready timing separately.

1. Open the workshop with `?metrics=1`. Dismiss the tutorial, load the anatomy and start continuous playback.
2. In Safari's remote Web Inspector or Chrome's USB remote DevTools console, run:

```js
document.querySelector('[data-anatomy-state="ready"]').dispatchEvent(new CustomEvent('kinevault:profile', {
  detail: { device: 'Exact phone model / OS', physical: true, scenario: 'playback', workload: 'Exact saved fixture and setup identifier', build: 'git revision', durationMs: 15000 }
}));
```

3. Keep the page visible. The profiler downloads JSON. If the browser blocks downloading, copy `document.querySelector('[data-device-profile]').dataset.deviceProfile`. Capture comparison with continuous playback and repeat camera/selection gestures during those scenarios.
4. Store files under `.local-artifacts/readiness/devices/`, then run:

```sh
npm run performance:calibrate -- capture-1.json capture-2.json capture-3.json
```

Captures measure intervals between actual canvas renders, not window rAF or GPU execution time. Background or fewer than 120 intervals/10 seconds invalidate the capture. Capture windows range from 12 to 60 seconds. GPU identity can be privacy-masked; calibration rejects unknown/masked/software renderers. `physical` is an operator attestation, not device detection.

Calibration requires three distinct capture IDs/timestamps with the same build, browser, viewport and actual canvas drawing-buffer dimensions/pixel ratio. Changing render size during capture invalidates it.

Calibration proposes a p95 limit 20% above the worst observed p95. Review and commit approved device budgets only after repeated measurements. A measured p95 above 33.3 ms flags an investigation; it does not enable LOD. Compare triangle count, pose solving and CPU/GPU traces before attributing slow rendering to geometry. Any LOD prototype must preserve named muscle picking, highlights, grip/contact, saved/reloaded poses and media. Reject it unless repeated physical captures improve and those checks pass.

## Recorded Intel desktop baseline, 7 October 2026

`tests/performance/local-intel-budget.json` sets an 11 ms p95 rendered-frame budget for workload `public-home-defaultScene-lateral-raise`. Three warm 15-second captures on the final build each measured p95 8.6 ms, with 648,915 peak triangles and nine peak draw calls. An earlier series measured 9.0, 8.8 and 8.7 ms. The drawing buffer was 611×500 at renderer DPR 1; the browser viewport was 1440×1000. No geometry LOD investigation is indicated by these captures.

Hardware was LENOVO 83F5, Windows 11 Home 10.0.26300, Intel Graphics driver 32.0.101.8331. Installed headless Chrome 154 reported ANGLE Intel Graphics D3D11, matching the OS GPU inventory. The desktop used a Parsec virtual display; power and thermal conditions were uncontrolled. This is hardware rendering evidence for that exact baseline, not phone touch, interactive desktop, workshop comparison, or discrete NVIDIA GPU certification. Final raw captures and environment metadata are in `.local-artifacts/readiness/devices/local-intel-workload/`; earlier captures remain in `local-intel/`. The build identity is recorded in the budget.

Check three newly recorded captures against the approved baseline:

```sh
npm run performance:calibrate -- --budget=tests/performance/local-intel-budget.json capture-1.json capture-2.json capture-3.json
```

The gate requires approved status and matching device, GPU, scenario, workload identifier, browser, viewport and actual render dimensions/DPR. A new build may be compared to the baseline. All captures within a run must share one build and distinct IDs/timestamps. Exceeding the approved p95 limit exits 1; incompatible conditions throw instead of passing. Workload is an operator attestation: use a distinct identifier for each saved scene and setup, and confirm it matches the budget's scope before checking. Rebaseline browser or driver changes and collect controlled interactive runs before setting release performance targets.

References: [Chrome remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging/), [Safari Web Inspector](https://webkit.org/web-inspector/enabling-web-inspector/), [WebGL renderer identity](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info).
