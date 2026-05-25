# Zero Schema, Queries, And ZQL

## Scope

Use this reference for schema generation, manual schemas, relationships, ZQL, query registries, query endpoints, and query performance.

Source docs to read for exact detail:

- `source-docs/schema.mdx`
- `source-docs/queries.mdx`
- `source-docs/zql.mdx`
- `source-docs/postgres-support.mdx`
- `source-docs/server-zql.mdx`
- `source-docs/debug/inspector.mdx`
- `source-docs/debug/analyze-query-cli.mdx`

## Zero Schema

Zero apps have both a normal backend database schema and a Zero schema, conventionally in `schema.ts`.

The Zero schema provides:

- Type-safe ZQL.
- First-class relationships between tables.

Prefer generation:

- Drizzle: `drizzle-zero generate`.
- Prisma: add a `generator zero` block and run `prisma generate`.

Write by hand when generators do not fit:

```ts
import {boolean, createBuilder, createSchema, string, table} from '@rocicorp/zero'

const user = table('user')
  .columns({
    id: string(),
    name: string(),
    active: boolean(),
  })
  .primaryKey('id')

export const schema = createSchema({
  tables: [user],
})

export const zql = createBuilder(schema)

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: typeof schema
  }
}
```

Column helpers include `boolean()`, `number()`, `string()`, `json()`, and `enumeration()`.

Important semantics:

- `optional()` means nullable. Reads return `null`, not `undefined`.
- Writes can use `null` to set null.
- `insert`/`upsert` can omit optional fields or set `undefined` to let the backend default apply.
- `update` can set non-PK fields to `undefined` to leave existing values unchanged.
- Use `from()` for table/column name mapping and other Postgres schemas.
- Compound primary keys are supported with multiple `primaryKey(...)` columns.

## Relationships

Define relationships with `relationships(table, ({one, many}) => ({ ... }))`.

Use:

- `one(...)` for singular relationships.
- `many(...)` for plural relationships.
- Junction relationships for many-to-many by chaining through a join table.
- Compound-key relationships when source/destination fields are composite.
- Circular relationships are supported; read raw docs for exact pattern.

Relationship definitions power ZQL `related()` and `whereExists()`.

## ZQL Essentials

Create the builder with `createBuilder(schema)` or use the generated `zql` export.

ZQL is a TypeScript builder API inspired by SQL:

```ts
zql.issue
  .where('priority', 'high')
  .orderBy('created', 'desc')
  .limit(100)
```

Key clauses:

- Table select: `zql.issue`.
- Ordering: `.orderBy(column, 'asc' | 'desc')`; primary key is the implicit final order.
- Limit: `.limit(n)`.
- Paging: `.start(row)` or `.start(row, {inclusive: true})`.
- Single row: `.one()`, returning `Row | undefined`.
- Relationships: `.related('comments')`; refine with a callback.
- Nested relationships: call `.related()` inside relationship refinements.
- Filters: `.where(column, value)` or `.where(column, operator, value)`.
- Compound filters: `.where(({cmp, and, or, not}) => ...)`.
- Literal comparisons: use `cmpLit(...)`.
- Relationship filters: `.whereExists('relationship', q => ...)`.
- Type extraction: `QueryResultType`.

Where operators include equality/inequality, numeric comparison, SQL-like string matching, `IN`/`NOT IN`, and `IS`/`IS NOT`.

Use `IS`/`IS NOT` for intentional null comparisons. Normal comparisons to `null` follow SQL semantics and are false.

Passing `undefined` to `where` is allowed as a convenience and returns no results.

Current limitation: `orderBy` and `limit` in a relationship that goes through a junction table are not supported.

Rows returned by ZQL should be treated as immutable. Clone before modifying data for UI-only transforms.

## Queries

Queries are named, validated functions that return ZQL. A copy can run on the client for instant optimistic reads and on the server for authoritative filtering.

Basic pattern:

```ts
import {defineQueries, defineQuery} from '@rocicorp/zero'
import {z} from 'zod'
import {zql} from './schema'

export const queries = defineQueries({
  posts: {
    byAuthor: defineQuery(
      z.object({authorID: z.string()}),
      ({args: {authorID}}) => zql.post.where('authorID', authorID),
    ),
  },
})
```

Rules:

- Use validators for args because server query args come from the client and are untrusted.
- Use `defineQueries` once at the top level so query names are stable.
- Split query groups into files if needed, then compose them in one top-level registry.
- Use `ctx` for credentials/permissions, not args.
- If not using global `DefaultTypes`, use typed helpers such as `defineQueryWithType` and `defineQueriesWithType`.

## Query Endpoint

Set `ZERO_QUERY_URL` to the app endpoint that resolves query names to ZQL.

Object-form helper shape:

```ts
const result = await handleQueryRequest({
  handler: (name, args) => {
    const query = mustGetQuery(queries, name)
    return query.fn({args, ctx})
  },
  schema,
  request,
  userID,
})
```

Notes:

- `handleQueryRequest` accepts a standard `Request` and returns JSON-serializable output.
- `mustGetQuery` looks up the named query and throws if missing.
- Pass authenticated `ctx` and `userID` when auth is enabled.
- `ZERO_QUERY_URL` can contain multiple URLs or URLPattern strings for preview deployments; clients can choose an allowed `queryURL`.

## Running Queries

React:

```tsx
const [posts] = useQuery(queries.posts.byAuthor({authorID}))
```

Solid:

```tsx
const [posts] = useQuery(() => queries.posts.byAuthor({authorID: userID()}))
```

Low-level TypeScript:

```ts
const view = zero.materialize(queries.posts.byAuthor({authorID}))
view.addListener(rows => {
  // update app state
})
```

For one-off reads, use the low-level Zero APIs described in `source-docs/queries.mdx`.

## Query Performance

When a query hydrates slowly or returns too many rows:

- Analyze with Inspector or the analyze-query CLI.
- Watch `readRowCount` relative to `syncedRowCount`.
- Inspect SQLite and Zero plans.
- Check missing indexes on filter/order columns.
- Review relationship filters and nested relationships.
- Check `ttl` and whether inactive queries are still running.
- Avoid broad queries that sync unnecessary rows.

Read `debugging-release-notes.md` for operational debugging steps.
