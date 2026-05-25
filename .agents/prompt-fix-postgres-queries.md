# Prompt: Fix PostgreSQL Date/Time Queries — Remove SQLite-isms

## Context

Project: `zentro-v2` — a Vike + Hono + Drizzle ORM + PostgreSQL app.
- Driver: `postgres-js` via `drizzle-orm/postgres-js`
- DB client setup: `database/drizzle/db.ts`
- Timestamp columns use: `timestamp('created_at', { withTimezone: true, mode: 'date' })`
- Problem: some server-side queries were written with SQLite assumptions (`strftime`, passing epoch numbers to `sql` templates, etc.) and fail at runtime with `ERR_INVALID_ARG_TYPE`.

## Drizzle ORM docs (cloned locally)

The official Drizzle ORM docs are cloned at:
```
/tmp/drizzle-orm-docs/
```
Use them to verify best practices. Key file to read:
- `/tmp/drizzle-orm-docs/src/content/docs/operators.mdx` — `gt`, `gte`, `lt`, `lte`, `eq`, `ne`, `and`, `or`
- `/tmp/drizzle-orm-docs/src/content/docs/sql.mdx` — `sql` template, `sql.raw()`, parameterization
- Any other docs pages that explain how `timestamp({ mode: 'date' })` serializes values via `mapToDriverValue`

## What the agent must do

### 1. Audit ALL server-side queries
Scan every file under:
```
server/orpc/routers/
server/orpc/contracts/
server/zero/
database/drizzle/schema/
```

Look for these anti-patterns (SQLite-isms in a PostgreSQL context):

| Anti-pattern | Why it fails | Correct approach |
|-------------|-------------|-----------------|
| `sql\`${col} >= ${date.getTime()}\`` | `timestamp` column expects a `Date` or ISO string, not an epoch number. `postgres-js` falls back to `'' + x`, producing an unparseable string for PostgreSQL. | Use `gte(col, date)` or `lt(col, date)` — Drizzle calls `mapToDriverValue` which emits `.toISOString()`. |
| `sql\`${col} >= ${someDate}\`` | When a raw `Date` object is interpolated into a `sql` template, `postgres-js` does not know the target OID and serializes via `'' + date`, producing `Sun May 17 2026 00:00:00 GMT-0500...` which PostgreSQL rejects. | Use `gte(col, someDate)` / `lt(col, someDate)` instead of raw `sql`. If you must use `sql`, pass an ISO string and cast: `sql\`${col} >= ${date.toISOString()}::timestamp\``, but prefer operators. |
| `sql\`strftime('%Y-%m-%d', ${col} / 1000, 'unixepoch', 'localtime')\`` | `strftime` is SQLite-only. | For PostgreSQL use `to_char(${col}, 'YYYY-MM-DD')` inside `sql`. |
| Any other SQLite functions: `julianday`, `date('now')`, `datetime('now')`, `unixepoch` | These do not exist in PostgreSQL. | Replace with PostgreSQL equivalents: `now()`, `current_timestamp`, `to_char(...)`, `date_trunc(...)`, `extract(epoch from ...)`, etc. |
| `.getTime()` used **inside** an `sql` template literal | Same epoch-number issue. | Remove `.getTime()`; pass `Date` objects through Drizzle operators, or use `.toISOString()` with an explicit cast if you must stay inside `sql`. |

### 2. Fix `server/orpc/routers/dashboard.ts` first
This file is the confirmed broken surface. It contains:
- `sql\`${sale.createdAt} >= ${todayStart.getTime()}\`` (epoch number)
- `sql\`strftime('%Y-%m-%d', ${sale.createdAt} / 1000, 'unixepoch', 'localtime')\`` (SQLite function)
- Multiple date-range filters for today, yesterday, month, previous month, trend, top products, payments.

**Correct pattern to apply:**
```typescript
import { and, gte, lt } from "drizzle-orm";

// For a date column defined as:
// createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })

// ✅ CORRECT — Drizzle serializes the Date to ISO string via mapToDriverValue
.where(
  and(
    eq(sale.organizationId, orgId),
    ne(sale.status, "cancelled"),
    gte(sale.createdAt, todayStart),   // todayStart is a Date
    lt(sale.createdAt, tomorrowStart)    // tomorrowStart is a Date
  )
)
```

**For extracting a date string key (e.g. `YYYY-MM-DD` for grouping):**
```typescript
// ❌ INCORRECT (SQLite)
const saleDateKey = sql<string>`strftime('%Y-%m-%d', ${sale.createdAt} / 1000, 'unixepoch', 'localtime')`;

// ✅ CORRECT (PostgreSQL)
const saleDateKey = sql<string>`to_char(${sale.createdAt}, 'YYYY-MM-DD')`;
```

### 3. Fix any other files found in the audit
Apply the same rules. Replace:
- `sql\`${timestampCol} >= ${someDate.getTime()}\`` → `gte(timestampCol, someDate)`
- `sql\`${timestampCol} < ${someDate.getTime()}\`` → `lt(timestampCol, someDate)`
- `sql\`${timestampCol} >= ${someDate}\`` (raw Date in sql) → `gte(timestampCol, someDate)`
- `strftime(...)` → `to_char(...)` or other PostgreSQL equivalents

### 4. What NOT to change
- **Do NOT** remove `.getTime()` from API response serializers like `toTimestamp()` or `generatedAt: now.getTime()`. Those are intentional: the frontend expects epoch milliseconds.
- **Do NOT** change `.getTime()` used in plain JavaScript arithmetic (e.g. `new Date(now.getTime() + 48 * 60 * 60 * 1000)`). That is fine.
- **Only** change `.getTime()` (and similar patterns) when it appears **inside a Drizzle `sql` template literal** or when a raw `Date` is interpolated into `sql`.

### 5. Verification
After editing, run:
```bash
bunx tsc --noEmit
```
If it passes, you are done. If there are errors, fix them before finishing.

### 6. Report
List every file you touched and what you changed in each one.
