# Local performance checks

Rechecked on 3 October 2026 using local Docker PostgreSQL, 50,000 synthetic exercises, normalized junctions, aliases, and `EXPLAIN (ANALYZE, BUFFERS)`. Catalog queries run as an anonymous visitor; duplicate detection runs as an authenticated draft owner. Fixtures stay in a UUID-named temporary database. Development records remain intact.

| Scenario | Before optimization, ms | Latest run, ms |
| --- | ---: | ---: |
| Alphabetical page | 1,801 | 2.044 |
| Shoulder Abduction + Cable | 3,198 | 5.978 |
| Multiple actions + Compound | 2,393 | 23.999 |
| Muscle + action + equipment + resistance | 2,521 | 54.934 |
| Alias search | 1,483 | 75.377 |
| Fuzzy name search | 1,433 | 179.435 |
| Newest page | 1,733 | 1.354 |
| Most favorited page | 1,710 | 1.689 |
| Combined filters with no matches | 2,975 | 249.874 |
| Duplicates including contributor aliases | Not measured | 290.069 |

Each number is one execution, including function overhead. This is a local check, not a percentile, concurrency benchmark, network measurement, or production latency guarantee. Synthetic classifications repeat 20 original templates; diverse metadata and longer alias lists need new measurements. Browser tests also exercise two actual Chrome/FFmpeg renders, approval, signed WebM/MP4 playback, and the required matching Explore flow.

## Measured improvements

- Explicit published/current-content checks enforce the catalog RPC's public boundary. Direct table reads retain RLS. Repeated draft-ownership checks are removed from this public-only operation.
- Include selected filters only. Identifiers come from a fixed internal mapping; inputs are quoted as values. Database tests cover hostile parameters and unpublished-content exclusion.
- Use indexed full-text/trigram candidate unions, reverse junction indexes, SQL `EXISTS`, and stable cursor pagination. A redundant join predicate caused poor cardinality estimates and was removed.
- Duplicate detection verifies ownership/reviewer access, uses indexed name/alias candidates, and limits relational scoring to 200 candidates.
- No-match combinations remain the most expensive catalog case. Further optimization should follow real workload measurements.

## Anatomy preparation

The fingerprinted meshopt asset is 9,920,700 bytes versus 12,417,516, a 20.1% reduction. All 2,352 decoded buffer views match the source; 784 meshes, 325,619 vertices, indices, normals and muscle identities survive. The source model and attribution remain available. Interactive viewers load the compressed asset only when requested, cache immutable prepared skinning geometry, and retain independent skeletons/highlights. Each rig shares three material states. The final viewer releases shared GPU geometry.

The neutral Home poster is 7,770 bytes. Larger geometry merging, lower-detail exports and pose-aware culling need hardware GPU profiling and independent muscle/grip validation before adoption.

## Render worker

Measured local Chrome/FFmpeg captures, with a fresh browser per job:

| Phase, ms | 3.2-second scene, 78 frames | 0.5-second scene, 13 frames |
| --- | ---: | ---: |
| Browser launch | 359 | 336 |
| Page ready | 2,248 | 1,455 |
| Frame capture | 12,894 | 2,238 |
| WebM | 2,002 | 311 |
| MP4 | 192 | 97 |
| Poster | 66 | 64 |
| Total | 18,157 | 4,871 |

Warm-browser reuse could remove only the measured launch cost, about 2–7% of these totals. A separate three-run combined-encoding comparison saved about 90 ms, 0.5% of the longer job. Capture dominates. Browser reuse, encoding consolidation and worker concurrency remain deferred; claims, deadlines, isolated contexts and deterministic cleanup take priority. Evidence is in ignored `.local-artifacts/worker-profile/`.

## Production browser baseline

Measured on 3 October with a warm local production server, disabled browser cache, Chrome/SwiftShader, and no concurrent browser or worker checks. Initial transfer includes CDP network data, including cross-origin signed posters hidden by Resource Timing. These are individual local observations, not production percentiles or hardware GPU benchmarks.

| Route | Requests | Compressed JS, bytes | Total transfer, bytes | Poster transfer, bytes | Response / DOM ready, ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 21 | 157,054 | 220,322 | 8,157 | 8 / 20 |
| Explore | 43 | 155,246 | 409,481 | 178,611 | 15 / 61 |
| Cable Lateral Raise | 41 | 151,968 | 226,611 | 14,759 | 8 / 70 |

All three routes make zero initial model requests. Explicit Home 3D was ready in 912 ms locally. The largest signed poster was 17,523 transferred bytes; Explore's 12 cards totaled 178,611. Individual posters remain modest, so stable responsive variants are deferred. Track aggregate poster transfer on slow networks and larger pages before adding publication/storage variants. Warm response times give no clear reason to replace the flash-free cookie-based theme shell.

Workshop idle task time rounds to 0 ms/second over two seconds. Playback recorded 7.79 React commits/second, 785 draw calls/geometries and two textures. Software frame intervals were median 129.2 ms, p95 137.5 ms, maximum 141.8 ms. These slow SwiftShader frames identify the need for hardware profiling before claiming smooth GPU performance; material sharing alone does not reduce the 785 draw calls.

Camera-only frames add zero pose solves. Demand rendering can stop before the throttled counter publishes a final pause solve, so the test renders a settled camera frame before taking this baseline. After garbage collection, opening comparison increased JS heap from 19,902,116 to 22,569,120 bytes; closing returned it to 20,238,360, 336,244 bytes above the starting sample. This is one open/close observation, not a long-running leak test.

`test:performance` enforces initial JS below 200,000 bytes per route, fewer than 65 initial requests, zero eager model requests, fewer than 15 workshop commits/second, fewer than 900 draw calls, zero additional camera-only solves and less than 3 MB retained heap after comparison closes. It also captures public desktop/mobile light/dark screens and workshop English/Hebrew layouts, checks overflow and rejects browser errors. JSON and screenshots stay in ignored `.local-artifacts/efficiency-review/`.

## Reproduce

```sh
npm run db:benchmark
npm run test:performance
npm run test:worker
```

The runner writes `PERFORMANCE_RESULTS.txt` and ignored `PERFORMANCE_PLANS.txt`. The original baseline is in `PERFORMANCE_BASELINE.txt`. Inspect nested plans, estimated versus actual rows, index usage, and buffers before changing queries.

References: [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html).
