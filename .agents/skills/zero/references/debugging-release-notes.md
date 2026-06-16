# Zero Debugging And Release Notes

## Scope

Use this reference for Inspector, analyze-query CLI, slow queries, replication debugging, query ASTs, `zero-out`, deprecated APIs, bug reporting, community resources, and upgrade-sensitive release notes.

Source docs to read for exact detail:

- `source-docs/debug/inspector.mdx`
- `source-docs/debug/analyze-query-cli.mdx`
- `source-docs/debug/slow-queries.mdx`
- `source-docs/debug/replication.mdx`
- `source-docs/debug/query-asts.mdx`
- `source-docs/debug/zero-out.mdx`
- `source-docs/reporting-bugs.mdx`
- `source-docs/community.mdx`
- `source-docs/open-source.mdx`
- `source-docs/agents.mdx`
- `source-docs/release-notes/*.mdx`
- `source-docs/deprecated/*.mdx`

Project caveat: `zentro-v2` currently depends on `@rocicorp/zero` 1.6.2, but the bundled release-note snapshot ends at Zero 1.5. Use this file for historical context and verify 1.6-specific behavior against local package types/binaries or current official docs.

## Inspector

Use the Inspector to inspect live Zero state:

- Clients and client groups.
- Active queries and query names/args.
- Client ZQL and server ZQL.
- Hydration timing.
- Row counts.
- TTL/inactivation status.
- Update p50/p95 timings.
- Query analysis.
- SQLite plans and Zero plans.
- Table data.
- Server version.

The Inspector is password-protected in production. Read the raw docs for access URL and admin password details.

## Analyze Query CLI

Use `@rocicorp/zero/analyze` to build a local CLI for query analysis. The docs show `runAnalyzeCLI` with the app schema.

Typical uses:

- Analyze named ZQL queries from the command line.
- Point at production/staging with `ZERO_CACHE_URL` and `ZERO_ADMIN_PASSWORD`.
- Feed query input through CLI args or other documented input modes.
- Capture optional output for debugging or sharing.

Important output fields:

- `elapsed`: total analysis time, useful proxy for hydration time.
- `dbScansByQuery`: SQLite query scan counts.
- `readRowCount`: total rows read from the replica.
- `readRowCountsByQuery`: rows read per SQLite query.
- `syncedRowCount`: rows actually synced.
- `syncedRows`: actual output rows.
- `plans`: SQLite `EXPLAIN QUERY PLAN` output.

## Slow Query Checklist

When a query is slow:

1. Analyze it with Inspector or analyze-query CLI.
2. Compare `readRowCount` with `syncedRowCount`; large multiples often mean poor locality or missing indexes.
3. Check `ttl`; inactive queries can still run if retained.
4. Review relationship filters, nested relationships, and broad `related()` calls.
5. Add or adjust Postgres indexes that improve replicated SQLite query plans.
6. Check storage speed and replica location.
7. Inspect `/statz` for server health and replication information.

## Replication Debugging

Use replication docs when:

- `zero-cache` is not receiving upstream changes.
- A replication slot appears stuck.
- Schema changes are not recognized.
- Publications or event triggers are misconfigured.
- A reset is required.

Zero uses the bedrock version of SQLite; read the raw replication docs before manually inspecting replica files.

## Query ASTs

Query AST docs explain how to inspect/decompile query structures. Use them when debugging generated ZQL, server query transformation, or cases where client/server query forms diverge unexpectedly.

## zero-out

`zero-out` removes Zero's traces from Postgres. Use it for cleanup/reset workflows, not as routine maintenance. Read `source-docs/debug/zero-out.mdx` before running it because it can affect replication/schema objects.

## Bug Reports

When reporting bugs:

- Include package and `zero-cache` versions.
- Include relevant schema, query/mutator definitions, endpoint setup, and zero-cache config.
- Include Inspector/analyze-query output for query issues.
- Include Postgres provider/version and logical replication details for replication issues.
- Reduce to a reproduction when possible.

## Deprecated Docs

The bundled docs include deprecated topics:

- Ad-hoc queries.
- CRUD mutators.
- RLS permissions.

Use these only to migrate legacy apps. New work should use schemas, named queries, mutators, and explicit auth context.

## Release Notes That Affect Implementation

The list below is complete only through the bundled 1.5 docs snapshot.

Zero 1.5:

- `handleQueryRequest` and `handleMutateRequest` object-form options are current.
- `userID` is required by helpers for authenticated client groups.
- Positional helper signatures are deprecated.
- Deploy `zero-cache` before the API server when upgrading to avoid response-shape incompatibility with 1.4.
- Added schema change hooks for environments without event triggers.

Zero 1.4:

- `userID: 'anon'` for logged-out users is deprecated; use `null` or `undefined`.
- Added Kysely adapter, analyze-query library, shadow sync, and client log sink.

Zero 1.3:

- Added distributed tracing and more sync metrics.
- Improved initial sync and update performance.

Zero 1.2:

- Added replica OTel metrics.
- Improved query performance and fixed timestamp/constraint issues.

Zero 1.1:

- Added replication lag monitoring metric.

Zero 1.0:

- Declared Zero stable and committed to maintaining the API.
- Added Supabase publication-change workaround through schema change support.

Zero 0.26:

- Added schema backfill, scalar subqueries, `zero.delete()`, time/timetz columns, and comparing to `undefined`.
- Custom forwarded client headers must be allowlisted.
- WebSocket messages are limited by default; adjust `ZERO_WEBSOCKET_MAX_PAYLOAD_BYTES` for very large mutations.

Zero 0.25:

- Major DX/API overhaul: current docs revolve around schemas, queries, and mutators.
- Legacy query/mutator/auth/permission APIs were deprecated.
- Added query planning, Standard Schema validators, official Drizzle/Prisma generators, connection status API, and `zero-out`.

For exact upgrade instructions, read the specific release file under `source-docs/release-notes/`.
