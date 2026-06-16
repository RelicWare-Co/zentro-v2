# Zero Core Concepts

## Scope

Use this reference for product fit, mental model, architecture, connection states, offline behavior, project status, and roadmap.

Source docs to read for exact detail:

- `source-docs/introduction.mdx`
- `source-docs/sync.mdx`
- `source-docs/when-to-use.mdx`
- `source-docs/status.mdx`
- `source-docs/roadmap.mdx`
- `source-docs/connection.mdx`
- `source-docs/release-notes/index.mdx`

## Mental Model

Zero syncs the data a UI needs into a local normalized datastore. Reads and writes hit that local store first; Zero then synchronizes with the server in the background.

The app controls what syncs by defining queries in application code. Zero can reuse cached rows and ask the server for authoritative ZQL when it needs more data.

Zero is query-driven sync, not table-wide static sync rules by default. Favor screen- and workflow-specific named queries over syncing entire domains.

Zero remains a client-server system with authoritative Postgres. It is not a CRDT/local-first database, and the docs explicitly call out that it does not provide local-first privacy/data-ownership semantics.

## Fit

Zero is a strong fit when:

- The app needs instant interaction performance for productivity-style workflows.
- Only a subset of backend data should sync to each client.
- The app is a traditional web app with a Postgres backend.
- Read/write permissions need to be fine-grained and enforced server-side.
- The product is broadly similar to Linear: rich, collaborative, data-heavy, highly interactive UI.

Zero is usually a poor fit when:

- Offline writes or long offline sessions are required.
- The app needs CRDT/local-first ownership semantics.
- The client is not TypeScript-based.
- The total syncable backend dataset is very large; docs currently recommend discussing datasets above about 100GB with Rocicorp.

## Sync Architecture

Key parts:

- Client: stores synced rows locally and runs ZQL optimistically.
- Server app: implements query and mutate endpoints, derives auth context, applies business logic and permissions.
- `zero-cache`: maintains a SQLite replica of the upstream Postgres database, transforms named queries to server-authorized ZQL, hydrates active queries, computes incremental updates, and pushes changes to clients.
- Postgres: authoritative upstream database, replicated through logical replication.

Query lifecycle:

1. Client invokes a named query and immediately runs the client-side version against local data.
2. The name and validated args go to `zero-cache`.
3. `zero-cache` calls the app's query endpoint to get authoritative ZQL.
4. `zero-cache` runs that ZQL against its server-side replica and sends authoritative results.
5. Later Postgres changes stream into `zero-cache`; affected client queries receive incremental row changes.

Mutation lifecycle:

1. Client invokes a named mutator.
2. The client-side mutator runs optimistically against local data.
3. Zero sends the mutation name/args to the app's mutate endpoint through `zero-cache`.
4. The server-side mutator runs in a transaction against Postgres.
5. Postgres logical replication sends committed changes back through `zero-cache`.
6. Clients reconcile optimistic effects with authoritative replicated rows.

## Connection States

Use the connection-state APIs from the relevant binding when UI needs network/auth state.

States:

- `connecting`: local reads work; writes are queued or attempted depending on current behavior.
- `connected`: reads and writes work.
- `disconnected`: local reads work; writes are rejected/unavailable.
- `error`: local reads work; writes are rejected/unavailable until the connection recovers.
- `needs-auth`: local reads work; writes are rejected/unavailable until reauth.
- `closed`: reads and writes do not work.

Zero intentionally does not support offline writes. Show offline UI for write paths instead of promising queued offline work.

## Status And Roadmap

The status page says Zero is generally available and fully supported as of March 2026. Prefer `source-docs/status.mdx` over the older standalone roadmap page if they disagree.

Current roadmap themes from the status docs:

- Cloud Zero public availability.
- Column permissions.
- Large-scale performance work.
- Possible future aggregates, SSR, JSON filters, and first-class text search.

## Release Posture

Zero 1.0 declared the public API stable. Breaking changes can still happen but should be rarer and smaller. Read `debugging-release-notes.md` before upgrades, especially across 0.25, 1.4, and 1.5. In `zentro-v2`, the installed package is currently 1.6.2, so verify behavior beyond 1.5 with local types or current official docs.
