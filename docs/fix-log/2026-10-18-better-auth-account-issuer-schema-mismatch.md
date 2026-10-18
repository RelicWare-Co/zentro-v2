# better-auth rejects every request with `SCHEMA_MISMATCH` on `account.issuer`

## Symptom

After upgrading `better-auth` 1.7.1 → 1.7.10, every `/api/auth/*` request
returned 500:

```text
BetterAuthError: Drizzle schema mismatch
  Required columns Better Auth never writes
    account.issuer
  Inserts into account will fail.
```

## Cause

Better Auth 1.7.0–1.7.2 required an `account.issuer` column and migration
`0023_brief_luminals.sql` added it as `NOT NULL` plus a unique index on
`(issuer, account_id)`. **1.7.3 reverted that**: account identity is
`(providerId, accountId)` again and `issuer` is never written.

From 1.7.3 the runtime schema check (`@better-auth/core/dist/db/schema-diff.mjs`)
reports any column that is non-nullable, has no default, and is not written by
Better Auth.

## Solution

- Removed `issuer` from `database/drizzle/schema/auth.schema.ts` and dropped
  `account_issuer_accountId_uidx` (nothing in the app read the column).
- Generated `database/migrations/0025_rich_red_wolf.sql`: drop the index first,
  then the column, as the Better Auth 1.7 upgrade guide requires.
- Regenerated `zero/schema.gen.ts` (auth tables are not exposed to Zero, so the
  output was unchanged apart from the signature).

## Verification

- `bun run build` + `bun run start`: `/api/auth/ok` returns 200.
- `bun run db:generate` reports `No schema changes`.
- `bunx tsc --noEmit` and `bun run check` pass.

## Follow-up

Dropping the index leaves `account` without a unique constraint. Before adding
`uniqueIndex(providerId, accountId)`, check for duplicates:

```sql
SELECT provider_id, account_id, count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;
```
