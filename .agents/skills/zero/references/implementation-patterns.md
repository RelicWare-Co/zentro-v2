# Zero Implementation Patterns

## Scope

Use this reference for installation, local development, client setup, framework bindings, React Native, REST endpoints, examples, and common project structure.

Source docs to read for exact detail:

- `source-docs/install.mdx`
- `source-docs/tutorial.mdx`
- `source-docs/quickstart.mdx`
- `source-docs/samples.mdx`
- `source-docs/react.mdx`
- `source-docs/solidjs.mdx`
- `source-docs/react-native.mdx`
- `source-docs/rest.mdx`
- `source-docs/server-zql.mdx`

## Local Setup Checklist

1. Use Postgres 15+ with logical replication enabled.
2. Set `ZERO_UPSTREAM_DB` to the app database connection URL.
3. Install `@rocicorp/zero` and a Standard Schema-compatible validator, commonly `zod`.
4. If the package manager blocks native postinstall scripts, approve or rebuild `@rocicorp/zero-sqlite3`.
5. Generate or write `src/zero/schema.ts`.
6. Create `queries.ts` and `mutators.ts`.
7. Implement server query and mutate endpoints.
8. Configure `ZERO_QUERY_URL` and `ZERO_MUTATE_URL`.
9. Start `zero-cache-dev` and the app server.

Common package-manager notes:

- pnpm: approve builds or configure `onlyBuiltDependencies` for `@rocicorp/zero-sqlite3`, then rebuild.
- Bun: trust `@rocicorp/zero-sqlite3` or add it to `trustedDependencies`.
- Modern Yarn: configure `dependenciesMeta` for `@rocicorp/zero-sqlite3`, then rebuild.

## Common File Layout

Adapt names to the host framework:

```text
src/zero/schema.ts
src/zero/context.ts
src/zero/queries.ts
src/zero/mutators.ts
src/zero/client.ts
src/routes/api/zero/query.ts
src/routes/api/zero/mutate.ts
```

Keep `schema.ts`, query definitions, and mutator definitions shareable when possible. Endpoint modules are server-only because they authenticate requests, use server DB providers, and call Zero server helpers.

## Client Creation

For React and Solid apps, prefer `ZeroProvider` from the matching package path:

- React: `@rocicorp/zero/react`
- Solid: `@rocicorp/zero/solid`

For non-framework TypeScript code, instantiate `new Zero({ schema, queries, mutators, userID, auth, context, cacheURL, ... })` and expose the instance through the app's dependency pattern.

Pass `userID` when authenticated; pass `null` or `undefined` when logged out. Do not use `userID: 'anon'` for logged-out users.

Use `storageKey` when one domain has multiple independent Zero datasets per user.

Use `kvStore: 'mem'` if persisted device storage is unacceptable for a user/session, understanding that data will not survive reloads or browser restarts.

## React Binding

Typical setup:

- Wrap the app in `ZeroProvider`.
- Pass `schema`, `mutators`, `queries`, auth fields, and connection options to the provider according to the app's architecture.
- Read data with `useQuery(queries.some.path(args))`.
- Get the Zero instance with `useZero()` for mutator calls and lower-level APIs.
- Use Suspense support only if the project already uses Suspense boundaries deliberately.

React query usage shape:

```tsx
const [rows] = useQuery(queries.posts.byAuthor({authorID}))
```

## Solid Binding

Typical setup mirrors React:

- Wrap the app in `ZeroProvider` from `@rocicorp/zero/solid`.
- Use `useQuery(() => queries.some.path(args))` so Solid can track reactive inputs.
- Use `useZero()` for mutation calls.

Solid query usage shape:

```tsx
const [rows] = useQuery(() => queries.posts.byAuthor({authorID: userID()}))
```

## React Native

Zero has React Native support through storage providers:

- Expo SQLite: `expoSQLiteStoreProvider` from `@rocicorp/zero/expo-sqlite`.
- OP SQLite: `opSQLiteStoreProvider` from `@rocicorp/zero/op-sqlite`.

Read `source-docs/react-native.mdx` for package versions and exact provider setup. This is still a TypeScript client story; Zero is not a native mobile sync engine for non-TypeScript stacks.

## Server ZQL

Use server-side ZQL when a server route or mutator needs type-safe reads against Postgres using the same Zero schema semantics.

Adapters exist for common Postgres clients/ORMs:

- Drizzle: `zeroDrizzle`
- Kysely: `zeroKysely`
- Prisma: `zeroPrisma`
- node-postgres: `zeroNodePg`
- postgres.js: `zeroPostgresJS`

Read `source-docs/server-zql.mdx` for exact imports and transaction provider setup.

## REST APIs For Zero Apps

REST routes can call Zero mutators/query helpers on the server to expose conventional HTTP APIs while preserving Zero business logic.

Use this pattern when:

- External systems need an HTTP API.
- The app has existing REST routes and is incrementally adopting Zero.
- You want OpenAPI docs around server routes.

Keep validators separately exportable so the REST route and Zero mutator/query can share them. Do not bypass server-side authorization by directly writing database rows from REST handlers unless the business rule is intentionally separate.

## Samples And Quickstarts

The docs list these starting points:

- `hello-zero`: minimal Zero example.
- `hello-zero-solid`: SolidJS example.
- `hello-zero-cf`: Cloudflare-oriented example.

Use sample repositories for exact modern boilerplate when starting from scratch.
