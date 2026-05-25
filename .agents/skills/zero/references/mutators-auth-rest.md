# Zero Mutators, Auth, And REST

## Scope

Use this reference for writes, push endpoint setup, auth context, credential forwarding, permissions, logout, and REST APIs over Zero.

Source docs to read for exact detail:

- `source-docs/mutators.mdx`
- `source-docs/auth.mdx`
- `source-docs/rest.mdx`
- `source-docs/connection.mdx`
- `source-docs/server-zql.mdx`
- `source-docs/deprecated/crud-mutators.mdx`
- `source-docs/deprecated/rls-permissions.mdx`

## Mutators

Mutators are named, validated, async functions that write data. Like queries, a copy can run on the client for optimistic effects and on the server for authoritative transaction processing.

Basic pattern:

```ts
import {defineMutators, defineMutator} from '@rocicorp/zero'
import {z} from 'zod'

export const mutators = defineMutators({
  issues: {
    updateTitle: defineMutator(
      z.object({id: z.string(), title: z.string()}),
      async ({tx, args: {id, title}, ctx}) => {
        if (title.length > 100) {
          throw new Error('Title is too long')
        }
        await tx.mutate.issue.update({
          id,
          title,
          updatedBy: ctx.id,
        })
      },
    ),
  },
})
```

Rules:

- Mutator functions must be `async`.
- Always `await` writes, including client-side optimistic writes.
- Use validators for client-provided args.
- Use `ctx` for user identity, roles, organization IDs, and other trusted server-derived facts.
- Reads and writes inside a mutator are transactional.
- If the mutator throws, the mutation rolls back.
- Client-side mutator reads are local only; server-side mutator reads see authoritative server data.

CRUD operations:

- `tx.mutate.table.insert(row)`.
- `tx.mutate.table.upsert(row)`.
- `tx.mutate.table.update(partialRowWithPK)`.
- `tx.mutate.table.delete(primaryKeyObject)`.

Optional field semantics:

- `null` explicitly writes null.
- Omitted/`undefined` optional fields in insert/upsert use backend defaults.
- `undefined` non-PK fields in update leave existing values unchanged.

Use `tx.run(zql...)` to read data during validation or business logic.

## Mutate Endpoint

Set `ZERO_MUTATE_URL` to the app endpoint that runs server-side mutators.

Current object-form helper shape:

```ts
const result = await handleMutateRequest({
  dbProvider,
  handler: transact =>
    transact((tx, name, args) => {
      const mutator = mustGetMutator(mutators, name)
      return mutator.fn({args, tx, ctx})
    }),
  request,
  userID,
})
```

Use a DB provider from the adapter matching the project's database client:

- Drizzle: `zeroDrizzle`
- Kysely: `zeroKysely`
- Prisma: `zeroPrisma`
- node-postgres: `zeroNodePg`
- postgres.js: `zeroPostgresJS`

The object-form helpers and `userID` are important for Zero 1.5 authenticated client-group behavior. Older positional signatures are deprecated.

## Waiting For Mutator Results

Zero mutator calls have optimistic client behavior and server application behavior. In modern APIs, promises resolve with structured success/error cases rather than relying on rejection for all server errors. Read `source-docs/mutators.mdx` for exact promise shapes before writing UI that waits for mutation results.

## Auth Context

Auth setup has four parts:

1. Pass `userID` to the client/provider.
2. Define and register a `ZeroContext` type.
3. Authenticate query and mutate endpoint requests.
4. Pass server-derived `ctx` and `userID` to query/mutator functions and Zero helpers.

Example context registration:

```ts
export type ZeroContext = {
  id: string
  orgID: string
  role: 'admin' | 'member'
}

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    context: ZeroContext | undefined
  }
}
```

Client `userID` segregates local storage per user. It is not a security boundary against users sharing a device and inspecting persisted local data. Use in-memory storage for sensitive scenarios where persisted local storage is not acceptable.

## Credential Forwarding

Cookie auth:

- Set `ZERO_QUERY_FORWARD_COOKIES=true`.
- Set `ZERO_MUTATE_FORWARD_COOKIES=true`.
- Authenticate endpoints from the normal `Cookie` header.
- In production, put `zero-cache` on a subdomain that can receive the app cookies.
- Set app cookies for the root domain if they must be sent to both app and `zero-cache`.
- Avoid `SameSite=None` for auth cookies because Zero uses WebSockets and that can expose Cross-Site WebSocket Hijacking risk.

Token auth:

- Pass a token through the `auth` option/provider prop.
- Zero forwards it to query/mutate endpoints as `Authorization: Bearer <token>`.
- Refresh by reconnecting with the new token according to the auth docs.

Custom client headers:

- If clients must forward custom headers, allowlist them with `ZERO_QUERY_ALLOWED_CLIENT_HEADERS` and/or `ZERO_MUTATE_ALLOWED_CLIENT_HEADERS`.
- Do not forward arbitrary client headers by default.

## Read And Write Permissions

Zero no longer has a separate first-class permissions subsystem in the current docs. Enforce permissions in server query and mutator functions:

- Read permissions: add server-only filters based on `ctx`.
- Write permissions: validate inside server-side mutators before writing.
- Keep client copies optimistic but not authoritative.
- Never derive permissions from query/mutator args alone.

Common read authorization pattern:

```ts
defineQuery(({ctx}) => {
  if (!ctx) {
    return zql.issue.where(({cmpLit}) => cmpLit(false, true))
  }
  return zql.issue.where('orgID', ctx.orgID)
})
```

Use the raw auth docs for exact `cmpLit`, context, authenticated client-group, logout, and auth-refresh examples.

## Logout And Data Deletion

When users log out, pass `userID: null` or `undefined` to the client/provider and clear app auth state.

Use `zero.delete()` when the app needs to delete Zero's local IndexedDB data for the current local storage identity. Read `source-docs/auth.mdx` for exact logout and auth failure behavior.

## REST APIs

Use REST routes over Zero when external callers or existing routes need conventional HTTP:

- Share validators between REST handlers and mutators/queries.
- Call server-side mutators or DB provider transactions rather than duplicating write logic.
- Generate OpenAPI from REST route schemas when needed.
- Keep REST auth equivalent to Zero endpoint auth.

REST APIs should not bypass Zero business rules unless they intentionally expose a separate administrative path.

## Deprecated APIs

The docs include deprecated CRUD mutators and RLS permissions. Use them only for legacy migration. For new work, use the current `defineMutators` and explicit server-side authorization patterns.
