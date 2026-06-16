---
name: zero
description: Build, migrate, debug, or explain applications that use Rocicorp Zero, @rocicorp/zero, zero-cache, ZQL, query-driven sync, Zero schemas, custom queries, mutators, auth context, React/Solid/React Native bindings, Postgres logical replication, Cloud Zero, self-hosting, or Zero operational tooling. Use when working on Zero setup, schema generation, query and mutator APIs, server query/mutate endpoints, connection state, REST APIs over Zero, Postgres compatibility, previews, deployments, OpenTelemetry metrics, debugging with Inspector/analyze-query/zero-out, or upgrading between Zero releases.
---

# Zero

## Overview

Use this skill to work with Zero, Rocicorp's query-driven sync system for TypeScript apps backed by Postgres. Zero makes reads and writes hit a local normalized client datastore first, then synchronizes continuously through `zero-cache` and authoritative server endpoints.

Zero is not a generic local-first/CRDT system. Treat it as a client-server system with an authoritative Postgres database, instant local reads, optimistic writes, server-side validation/authorization, and no offline writes.

Project note for `zentro-v2`: `package.json` currently uses `@rocicorp/zero` `^1.6.2`, while this skill's bundled docs snapshot stops at Zero 1.5 release notes. For 1.6-specific behavior, verify against local package types/binaries or current official docs before editing code.

## Start Here

1. Identify the Zero task: new integration, schema/ZQL, queries, mutators, auth, UI bindings, deployment, debugging, or upgrade.
2. Read the narrow reference file below before editing code.
3. If exact syntax, flags, or release behavior matters, search `references/source-index.md`, then read the matching file under `references/source-docs/`.
4. Prefer APIs that match the installed project version. Use the bundled snapshot for stable context through 1.5, and verify behavior beyond that with local package types/binaries or current official docs. Deprecated APIs only belong in migration work or legacy code maintenance.

## Reference Map

- `references/core-concepts.md`: product fit, architecture, sync model, connection/offline behavior, status, roadmap, and release posture.
- `references/implementation-patterns.md`: installation, project wiring, client creation, framework bindings, React Native storage providers, REST APIs, and common file layout.
- `references/schema-queries-zql.md`: Zero schema, schema generation, relationships, ZQL clauses, query registries, server query endpoints, and performance-sensitive query design.
- `references/mutators-auth-rest.md`: mutator definition, push endpoint setup, auth context, cookie/token forwarding, read/write authorization, logout, and REST endpoint patterns.
- `references/deployment-operations.md`: Postgres provider support, zero-cache config, Cloud Zero, previews, self-hosting topology, rolling updates, backups, OpenTelemetry, and production safety.
- `references/debugging-release-notes.md`: Inspector, analyze-query CLI, slow queries, replication inspection/reset, `zero-out`, deprecated APIs, and important release notes through Zero 1.5. This is not complete for the repo's current `@rocicorp/zero` 1.6.2 dependency.
- `references/source-index.md`: exhaustive index of all cloned Zero docs files, headings, source URLs, and word counts.
- `references/source-docs/`: full raw MDX snapshot from `rocicorp/zero-docs` commit `21a131c2e089915fb9eea692f07cd37593d78186`.

## Implementation Rules

- Use `@rocicorp/zero` current schema/query/mutator APIs: `createSchema`, `createBuilder`, `defineQueries`, `defineQuery`, `defineMutators`, and `defineMutator`.
- Use Zod or another Standard Schema-compatible validator for query and mutator arguments accepted from clients.
- Put app-wide Zero definitions in small shared files such as `schema.ts`, `queries.ts`, `mutators.ts`, `context.ts`, and client/server endpoint modules.
- Use `drizzle-zero` or `prisma-zero` when a project already uses Drizzle or Prisma. Write `schema.ts` by hand only when generators do not fit.
- Register `schema` and `context` through `declare module '@rocicorp/zero' { interface DefaultTypes { ... } }` when that matches the project's TypeScript style.
- Implement query and mutate endpoints with object-form `handleQueryRequest({ ... })` and `handleMutateRequest({ ... })`, including `userID`; the older positional signatures are deprecated.
- Never trust client query or mutator arguments for credentials. Derive permissions from validated cookies/tokens and pass a server-created `ctx`.
- Keep permission filters in server-side query/mutator implementations. The client copy can be optimistic, but the server copy must be authoritative.
- Always `await` `tx.mutate.*` writes inside mutators.
- Do not design around offline writes. In `disconnected`, `error`, and `needs-auth` states, reads can continue from local data but writes are rejected or unavailable.
- When auth cookies are used, run `zero-cache` on a subdomain that can receive the app cookies and avoid `SameSite=None` for auth cookies.
- For deployment, make `zero-cache` rollout compatible with API server rollout. Deploy `zero-cache` before API code when upgrading across response-shape changes such as Zero 1.5.

## Common Workflows

### Add Zero to an app

1. Confirm Postgres 15+ with logical replication (`wal_level=logical`).
2. Add `@rocicorp/zero` plus a validator such as `zod`.
3. Generate or write `schema.ts`; export `schema` and `zql`.
4. Create `queries.ts` and `mutators.ts`; keep them shareable between client and server when possible.
5. Add server query and mutate endpoints; configure `ZERO_QUERY_URL`, `ZERO_MUTATE_URL`, and `ZERO_UPSTREAM_DB`.
6. Wrap the app with `ZeroProvider` for React/Solid, or instantiate `new Zero(...)` directly.
7. Run `zero-cache-dev` locally, then verify queries hydrate from server and update after mutations.

Read `references/implementation-patterns.md`, `references/schema-queries-zql.md`, and `references/mutators-auth-rest.md`.

### Design synced data

1. Model the Postgres schema first, then expose the tables and relationships in the Zero schema.
2. Sync only what each screen needs by defining named queries.
3. Use ZQL `related()` for hierarchical data and `whereExists()` for relationship filters.
4. Avoid using Zero as a whole-database sync layer unless the dataset and product requirements truly fit.

Read `references/core-concepts.md` and `references/schema-queries-zql.md`.

### Debug a slow or wrong query

1. Reproduce the query and identify its query name/args.
2. Use the Inspector for live clients, active queries, analysis, table data, server version, and query plans.
3. Use `@rocicorp/zero/analyze` or the analyze-query CLI for scriptable query analysis.
4. Check hydration row reads, SQLite plans, relationship filters, missing indexes, `ttl`, storage speed, and `/statz`.

Read `references/debugging-release-notes.md` and the raw debug docs under `references/source-docs/debug/`.

### Deploy or operate Zero

1. Choose Cloud Zero when it is available for the project; otherwise self-host `zero-cache`.
2. For self-hosting, understand the replication manager and view-syncer split before scaling horizontally.
3. Configure upstream DB, admin password, query/mutate URLs, storage, ports, auth forwarding, backups, and metrics deliberately.
4. Validate provider-specific Postgres requirements, especially logical replication, publications, event triggers, schema hooks, and pooling.

Read `references/deployment-operations.md`.

## Exact Docs Lookup

Use `rg` over the bundled raw docs when a flag, function signature, provider note, or release detail must be exact:

```bash
rg "handleMutateRequest|ZERO_MUTATE_URL|whereExists|replication slot|SameSite" /path/to/zero/references/source-docs
```

Prefer `references/source-index.md` first when choosing a source file. Load raw MDX only for the specific topic needed.
