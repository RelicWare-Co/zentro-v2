# Dashboard Zoned Sales Trend GROUP BY

## Symptom

`GET /api/dashboard/overview` returned 500 when building the sales trend. PostgreSQL rejected the grouped sales query with:

```text
column "sale.created_at" must appear in the GROUP BY clause or be used in an aggregate function
```

## Root Cause

`buildZonedSaleDateKey` interpolated the dashboard time zone as a Drizzle parameter. The same helper expression was reused in `SELECT`, `GROUP BY`, and `ORDER BY`, but Drizzle emitted separate placeholders (`$1`, `$2`, `$3`). PostgreSQL did not treat those parameterized expressions as identical grouping expressions.

## Solution

The dashboard now validates the IANA time zone first, then emits it as a SQL string literal inside the shared date-key expression. This keeps `SELECT`, `GROUP BY`, and `ORDER BY` textually stable for PostgreSQL while preserving the existing SQL-safety guard.

## Verification

- Added a regression test that compiles the grouped date-key SQL and asserts the validated time zone is not emitted as repeated parameters.
- Ran `bun test tests/dashboard-zoned-time.test.ts`.
- Ran `bunx tsc --noEmit`.
