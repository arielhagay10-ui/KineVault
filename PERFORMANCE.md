# Local performance checks

Measured on 28 September 2026 using local Docker PostgreSQL, 50,000 synthetic exercises, normalized junctions, aliases, and `EXPLAIN (ANALYZE, BUFFERS)`. Catalog queries run as an anonymous visitor; duplicate detection runs as an authenticated draft owner. Fixtures stay in a UUID-named temporary database. Development records remain intact.

| Scenario | Before optimization, ms | Latest run, ms |
| --- | ---: | ---: |
| Alphabetical page | 1,801 | 3.0 |
| Shoulder Abduction + Cable | 3,198 | 6.4 |
| Multiple actions + Compound | 2,393 | 25.9 |
| Muscle + action + equipment + resistance | 2,521 | 50.0 |
| Alias search | 1,483 | 65.6 |
| Fuzzy name search | 1,433 | 145.6 |
| Newest page | 1,733 | 1.0 |
| Most favorited page | 1,710 | 1.5 |
| Combined filters with no matches | 2,975 | 344.8 |
| Duplicates including contributor aliases | Not measured | 294.1 |

Each number is one execution, including function overhead. This is a local check, not a percentile, concurrency benchmark, network measurement, or production latency guarantee. Synthetic classifications repeat 20 original templates; diverse metadata and longer alias lists need new measurements. Browser tests also exercise two actual Chrome/FFmpeg renders, approval, signed WebM/MP4 playback, and the required matching Explore flow.

## Measured improvements

- Explicit published/current-content checks enforce the catalog RPC's public boundary. Direct table reads retain RLS. Repeated draft-ownership checks are removed from this public-only operation.
- Include selected filters only. Identifiers come from a fixed internal mapping; inputs are quoted as values. Database tests cover hostile parameters and unpublished-content exclusion.
- Use indexed full-text/trigram candidate unions, reverse junction indexes, SQL `EXISTS`, and stable cursor pagination. A redundant join predicate caused poor cardinality estimates and was removed.
- Duplicate detection verifies ownership/reviewer access, uses indexed name/alias candidates, and limits relational scoring to 200 candidates.
- No-match combinations remain the most expensive catalog case. Further optimization should follow real workload measurements.

## Reproduce

```sh
npm run db:benchmark
```

The runner writes `PERFORMANCE_RESULTS.txt` and ignored `PERFORMANCE_PLANS.txt`. The original baseline is in `PERFORMANCE_BASELINE.txt`. Inspect nested plans, estimated versus actual rows, index usage, and buffers before changing queries.

References: [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html).
