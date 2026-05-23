# Zero Deployment And Operations

## Scope

Use this reference for Postgres compatibility, provider setup, zero-cache config, previews, Cloud Zero, self-hosting, OpenTelemetry, and production rollouts.

Source docs to read for exact detail:

- `source-docs/connecting-to-postgres.mdx`
- `source-docs/postgres-support.mdx`
- `source-docs/zero-cache-config.mdx`
- `source-docs/cloud-zero.mdx`
- `source-docs/previews.mdx`
- `source-docs/self-host.mdx`
- `source-docs/otel.mdx`
- `source-docs/debug/replication.mdx`
- `source-docs/debug/zero-out.mdx`

## Postgres Requirements

Zero requires Postgres with logical replication. Development examples use Postgres 15+ and `wal_level=logical`.

Provider support from the docs includes:

- Supported: AWS RDS, AWS Aurora 15.6+, PlanetScale for Postgres, Neon, Google Cloud SQL, Postgres.app, Postgres 15+ Docker.
- Conditional/caveat-heavy: Supabase, Fly.io Managed Postgres, Render.
- Heroku is called out as missing event triggers in the provider table.

Read provider-specific notes before deployment. Important recurring topics:

- Logical replication support.
- Event triggers or schema change hooks.
- Publication changes.
- IPv4/networking constraints.
- Pooling restrictions.
- Permissions needed to manage replication.
- WAL size bounding and replication slot behavior.

## Postgres Feature Compatibility

Check `source-docs/postgres-support.mdx` when schema features are involved.

Areas covered:

- Object names and object types.
- Column type mapping.
- Column defaults.
- IDs and client-generated ID guidance.
- Primary keys and compound keys.
- Limiting replication for zero-cache and browser clients.
- Schema changes.

For new schema work, favor client-generated IDs for optimistically created records. Avoid relying on server-generated values for primary identity if the client must create rows instantly.

## zero-cache Config

Required flags:

- Upstream DB connection (`ZERO_UPSTREAM_DB`).
- Admin password (`ZERO_ADMIN_PASSWORD`) for production/admin operations.

Common optional flags:

- `ZERO_APP_ID`
- `ZERO_QUERY_URL`
- `ZERO_MUTATE_URL`
- `ZERO_QUERY_FORWARD_COOKIES`
- `ZERO_MUTATE_FORWARD_COOKIES`
- `ZERO_QUERY_ALLOWED_CLIENT_HEADERS`
- `ZERO_MUTATE_ALLOWED_CLIENT_HEADERS`
- `ZERO_REPLICA_FILE`
- `ZERO_PORT`
- `ZERO_LOG_LEVEL`
- `ZERO_LOG_FORMAT`
- `ZERO_ENABLE_TELEMETRY`
- `ZERO_SERVER_VERSION`
- `ZERO_WEBSOCKET_COMPRESSION`
- `ZERO_WEBSOCKET_MAX_PAYLOAD_BYTES`

The config docs contain many operational flags for CVR DBs, change DBs, Litestream, replica vacuum, sync workers, lazy startup, shadow sync, and flow control. Read `source-docs/zero-cache-config.mdx` before changing production defaults.

## Previews

Preview deployments use allowed endpoint URL patterns:

- Configure `ZERO_QUERY_URL` and `ZERO_MUTATE_URL` with comma-separated allowed URLs or URLPattern strings.
- Choose branch-specific URLs in the client with `queryURL` and mutate URL/client options.
- Ensure preview schema changes are compatible with the zero-cache/database environment they target.

URLPattern validation prevents clients from choosing arbitrary query/mutate endpoints.

## Cloud Zero

Use Cloud Zero when available for the project to reduce self-hosting burden. The docs include a Cloud Zero page, and the project status page says public availability is a major 2026 goal. Check the current source docs or public site before committing to Cloud Zero for a production plan.

## Self-Hosting Topology

The self-hosting docs distinguish:

- Replication Manager: owns the replication slot, produces replication stream, backs up replica in multi-node, optionally restores from backup.
- View Syncer: serves client queries, subscribes to changes, manages CVRs, scales horizontally.

Minimum viable strategy:

- Suitable for smaller/simple deployments.
- One or few components, with carefully chosen storage and config.
- Read current examples before copying because they include platform-specific YAML/TOML/SST details.

Maximal strategy:

- Separate replication manager and view-syncers.
- Private networking between internal Zero components.
- Public routing only to view-syncers.
- Sticky routing/session affinity when multiple view-syncers are deployed.
- Litestream or equivalent backup/restore path for replicas.

## Rolling Updates

For upgrades, deploy `zero-cache` before the API server when helper response shapes or protocols change. Zero 1.5 specifically requires this order because 1.5 endpoint helpers return response shapes that `zero-cache` 1.4 cannot parse.

Check client/server version compatibility in the self-hosting docs. Keep the app, `@rocicorp/zero`, and `zero-cache` versions compatible.

## OpenTelemetry

Zero can emit traces and metrics. The docs cover:

- Grafana Cloud walkthrough.
- Distributed tracing from client to zero-cache/API via trace context callbacks.
- Metrics groups:
  - `zero.server`
  - `zero.replica`
  - `zero.replication`
  - `zero.sync`
  - `zero.mutation`

Use OTel to track:

- Replication lag.
- Replica DB/WAL size and backup lag.
- Active clients/client groups.
- Active queries and tracked rows.
- Hydration count/time.
- IVM advancement time.
- Pipeline resets and query transformations.
- Mutation pushes and custom/CRUD mutation counts.

## Backups And Storage

Production self-hosting must treat the SQLite replica and CVR/change databases as operational state:

- Understand replica lifecycle before deleting or relocating files.
- Configure Litestream backup/restore if using multi-node/replica backup workflows.
- Put storage on fast local disks where possible; the query engine assumes fast local access.
- Monitor replica size, WAL size, backup lag, and hydration performance.

## Schema Changes

Zero detects schema changes through Postgres mechanisms. Some providers lack event triggers or restrict publication operations; use documented schema change hooks/workarounds where needed.

Zero 1.5 added `zero_<shard>.update_schemas()` for databases that cannot use event triggers. Read `source-docs/connecting-to-postgres.mdx` before implementing provider-specific schema migration hooks.
