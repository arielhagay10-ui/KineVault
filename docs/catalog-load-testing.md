# Catalog load test

Run `npm run db:load` with local Supabase running. Docker must provide `psql`, `pg_dump`, and `pgbench`. The runner creates a UUID-named check database, copies schema only, applies all application migrations, seeds it, and inserts synthetic fixtures there. It never inserts fixtures into the development database. It drops its database and container temporary directory after success or failure.

Direct entry, including migration verification:

```powershell
node scripts/test-database.mjs --load --migrations
```

A short plumbing check:

```powershell
npm run db:load -- --rows=1000 --clients=2 --requests=5 --warmup=1
```

The default fixture adds 50,000 rows, about 91% published. It clones seed relationships across all seed exercises, which start as unpublished candidates. One published copy of each seed keeps its exact name; other copies append unique variation numbers. Sixty percent of remaining rows use eight common source exercises; the remainder span every source. Thirty percent have aliases. Ninety percent have zero favorites, nine percent have small counts, and one percent have large counts. Publication dates span 730 days with ties, exercising the UUID sort tiebreaker. IDs, dates, source assignment and pgbench seed are deterministic.

These are explicit workload assumptions, not measured production distributions. The JSON artifact records observed fixture counts and leading family frequencies. Replace assumptions with anonymized production histograms when available. Media rows contain metadata only; no synthetic objects are uploaded.

Fourteen cases cover exact names, broad full-text queries, aliases, a typo, no results, common equipment, Shoulder Abduction + Cable, combined anatomy/resistance, next pages, search next pages, and cursors at 90% catalog depth for alphabetical, newest and favorite ordering. Deep cursors are calculated before measurement. Timing uses the production `explore_exercises` RPC as `anon`, with persistent connections and the normal 24-row page plus lookahead. Cases run sequentially; clients within each case run concurrently. Preflight checks require nonempty results for positive cases and zero results for the no-match case.

Defaults are eight concurrent clients, five warmup requests per client per case, and 100 measured requests per client per case. Warmup is excluded. Nearest-rank p50/p95/p99 values use successful raw pgbench transaction latencies. SQL/connection failures, missing logs and missing requests count as errors. Process failures fail the gate even if latency samples pass. Every case must meet p50 ≤250ms, p95 ≤500ms, p99 ≤1000ms, and error rate zero. Exceeding a threshold exits nonzero and preserves evidence. These initial local regression budgets need calibration on consistent hardware; they are not a production service-level objective.

Options use `--name=value`:

| Option | Default | Range |
| --- | ---: | --- |
| `rows` | 50000 | 1000–1000000 |
| `clients` | 8 | 1–32 |
| `requests` per client per case | 100 | 1–10000 |
| `warmup` per client per case | 5 | 0–100 |
| `statement-timeout-ms` | 5000 | 100–60000 |
| `timeout-seconds` for setup and measurement | 600 | 10–1800 |
| `p50-ms`, `p95-ms`, `p99-ms` | 250, 500, 1000 | 1–60000, ascending |
| `error-rate` | 0 | 0–1 |

Each run writes `.local-artifacts/catalog-load/<run-id>/results.json`, per-case pgbench output and raw transaction logs. JSON includes parameters, versions, actual fixture distribution, query text, cursor depth, counts, latency, throughput, violations and pass status. It is updated after each case, including failures. No connection credentials appear in the artifact. Setup commands have 120-second limits, statements have server timeouts, and the full load has a deadline. Cleanup has its own 30-second limit.

This measures database RPC latency under a closed-loop fixed concurrency load. It excludes HTTP, Supabase poolers, application rendering, network delays and media hydration. Repeated case queries use a warm cache; shorter runs prove plumbing only. For capacity claims, increase requests and concurrency, repeat runs on the same hardware, and compare per-case distributions. Keep browser performance and exercise detail tests as separate checks. `npm run db:benchmark` retains the existing EXPLAIN plan workflow.

See [PostgreSQL pgbench documentation](https://www.postgresql.org/docs/17/pgbench.html) for raw log units and connection/timing semantics.

## Local HTTP and PostgREST pool checks

Run `npm run db:load:http`, or `node scripts/test-database.mjs --http --migrations`. A short check is:

```powershell
node scripts/test-database.mjs --http --migrations --rows=1000 --clients=2 --requests=5 --warmup=1 --http-pool=1
```

This uses the same disposable UUID database, migration replay and representative synthetic fixture. A separate PostgREST container uses the existing local Supabase image with `--pull=never`. Its HTTP port binds only to `127.0.0.1`; it connects over the private local Supabase Docker network as `authenticator`. The runner never changes the development database's roles or connection settings. Database credentials and a fresh test JWT secret travel through stdin configuration and never appear in command arguments, environment files or artifacts. The container and isolated database are removed after success or failure.

Sixteen cases include the original query families, next and deep pages for all three sort orders, and the next search page. Every successful HTTP result must match the complete ordered SQL reference page. Missing rows, duplicates, changed fields, incorrect ordering, non-JSON bodies, non-success statuses, timeouts and omitted requests count as errors. Separate preflight checks compare next pages against the preceding larger page to catch gaps and repeated boundary rows. Anonymous and JWT-authenticated visitors must see the same published catalog and no sampled unpublished records through direct table HTTP requests.

The SQL options and thresholds above also apply to HTTP. Use `--http-pool=4` to set PostgREST's internal database pool, bounded to 1–32. The default eight concurrent HTTP clients share four database connections. This exercises queueing when concurrency exceeds the pool size. Each client waits for the response body and correctness check before its next request, with no retries. Warmup is excluded; successful nearest-rank percentiles include loopback transport, PostgREST execution, JSON decoding and client correctness checking. HTTP failures and absent requests never enter the successful latency sample. Pool acquisition has a five-second timeout. Statements and the full run remain bounded.

Evidence is `.local-artifacts/catalog-http-load/<run-id>/results.json` and per-case `.samples.jsonl` files. The report records the PostgREST image, fixture distribution, pool/concurrency settings, raw HTTP statuses and failure categories, correctness checks, latency gates and container cleanup status. It includes explicit coverage flags. It measures the internal PostgREST pool, not external Supavisor/PgBouncer, hosted network latency, Next.js rendering or media hydration. An actual staging pooler workload still needs an explicitly approved target and coordinated limits; no remote load is run by this script.

The 7 October full local HTTP run added 50,000 rows and completed 12,800 measured requests across 16 cases with eight clients and a four-connection pool. All eight visibility/pagination checks passed; errors were zero; worst p50/p95/p99 were 194.639/436.867/534.670 ms. Artifact: `.local-artifacts/catalog-http-load/494a529644864ad89386d9b3ec94efcc/results.json`. The temporary container and database were independently verified absent. Lint/typecheck/unit worker jobs shared the host during this run, so these are local regression measurements under that contention, not isolated hardware capacity results.
