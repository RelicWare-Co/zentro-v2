# Repository Instructions

## General

- Use conventional commits when creating git commits.
- Keep changes scoped to the requested behavior. Do not rewrite unrelated code or revert user changes.
- Prefer existing project patterns over introducing new abstractions.
- Before migrating code from `../zentro-reborn`, read `MIGRATION_PLAN.md`, follow its milestone order unless there is a clear reason not to, and update the relevant checkboxes/notes in the same change as completed work.
- If you are unsure about Vike behavior, consult the local docs/dependencies first. If that is not enough, clone or inspect the official repository for current guidance:
  - Vike: `https://github.com/vikejs/vike`
- Update this `AGENTS.md` when a change introduces or materially changes project conventions, architecture, workflows, commands, or integration patterns that future agents need to know.

## Commands

- Install dependencies with `bun install`.
- Run the dev server with `bun run dev`.
- Build with `bun run build`.
- Type-check with `bunx tsc --noEmit`.
- Run tests with `bun test`.
- Database commands:
  - `bun run db:generate`
  - `bun run db:migrate`
  - `bun run db:push`
  - `bun run db:studio`
- Zero commands (see `MIGRATION_PLAN.md` for the surface-by-surface plan):
  - `bun run zero:schema:gen` regenerates `src/zero/schema.gen.ts` from the Drizzle schema using `drizzle-zero.config.ts`. Run it after **any** change to `database/drizzle/schema/*.schema.ts`.
  - `bun run zero:dev` starts `zero-cache-dev`. Run it in a separate terminal alongside `bun run dev`. It reads `ZERO_QUERY_URL` / `ZERO_MUTATE_URL` from `.env` (defaults point at `http://localhost:3000/api/zero/*`) and requires `ZERO_QUERY_FORWARD_COOKIES=true` / `ZERO_MUTATE_FORWARD_COOKIES=true` for better-auth cookies.
  - Postgres must be up first (`docker compose up -d`) and configured with `wal_level=logical` — already done in the committed `docker-compose.yml`.

## Code Quality (Ultracite)

- This project uses **Ultracite** with the **Biome** backend for zero-config linting and formatting.
- Configuration lives in `biome.jsonc` and extends `ultracite/biome/core`, `ultracite/biome/react`, and `ultracite/biome/vitest`.
- **Commands**:
  - `bun run check` — read-only lint/format check.
  - `bun run fix` — auto-fix issues. Run this before committing if you touched JS/TS/JSON/CSS files.
- **Lefthook** runs `ultracite fix` automatically on pre-commit for staged `.{js,jsx,ts,tsx,json,jsonc,css}` files and re-stages fixes. Do not disable `stage_fixed`.
- **Do not** create legacy config files (`.eslintrc.*`, `.prettierrc.*`) or manually override formatting rules. If rules need changing, update `biome.jsonc` within the Ultracite preset system.
- Follow Ultracite standards when writing or editing code:
  - Prefer `const`, destructuring, optional chaining, nullish coalescing, template literals, `for...of`, and concise arrow functions.
  - Prefer `async/await` over promise chains; always `await` promises in async functions.
  - Use explicit types when they improve clarity. Prefer `unknown` over `any`. Use `as const` for immutable values and rely on type narrowing.
  - Do not leave `console.log`, `debugger`, or `alert` in production code. On the server use `evlog` (see Logging). On the client, avoid debug logs in committed code.
  - Keep React components as function components, hooks top-level with correct dependency arrays, and avoid nested component definitions.
  - Use semantic HTML with proper labels, headings, alt text, and keyboard affordances.
  - Keep tests free of `.only` and `.skip`.

## Stack

- App framework: Vike with React, configured as full CSR (`ssr: false` in `pages/+config.ts`).
- Server: Hono through `@vikejs/hono`.
- Styling: Tailwind CSS v4, shadcn/radix-style UI components in `components/ui`.
- Auth: better-auth with organization support.
- Database: Drizzle ORM over PostgreSQL (`drizzle-orm/postgres-js`). Postgres runs locally with `wal_level=logical` (see `docker-compose.yml`) so Zero can mirror it via logical replication.
- Server state: Zero (`@rocicorp/zero`) for replicated reads/writes + TanStack Query for ephemeral server fetches (dashboard overview).
- API: Zero query/mutate endpoints (`/api/zero/*`) and authenticated REST helpers (`/api/dashboard/*`, `/api/auth/*`).
- Logging: **evlog** with `evlog/vite` plugin and `evlog/hono` middleware.

## Logging (evlog)

- The `evlog/vite` plugin in `vite.config.ts` auto-initializes the logger with `service: 'zentro'`.
- The Hono app uses `evlog()` middleware from `evlog/hono`, making a request-scoped logger available via `c.get('log')`.
- Use `c.get('log').set({ ... })` inside Hono handlers to enrich the current request's wide event with structured data.
- Use `createError({ message, status, why, fix, link })` from `evlog` for structured errors; handle them in Hono's `app.onError` with `parseError()`.
- Do not use `console.log` / `console.error` in server code. Use `c.get('log').info()`, `c.get('log').warn()`, or `c.get('log').error()` in Hono handlers instead.
- CLI scripts (`scripts/*.ts`) may still use prefixed `console.log` since they run outside the Hono/evlog lifecycle.

## Vike

- Pages live under `pages/**`.
- Route guards use Vike guard files such as `+guard.ts`.
- Keep server-only behavior behind the Hono/Vike server boundary.
- Components and browser code should not import database tables, auth server modules, or server-only procedure implementations.
- Use Vike file environment suffixes to enforce runtime boundaries:
  - `.server.ts` / `.server.tsx` for files that must never be imported by client-side code, especially secrets, database access, auth server logic, server handlers, and filesystem/process usage.
  - `.client.ts` / `.client.tsx` for files that require browser APIs such as `window`, `document`, browser storage, or DOM-only libraries.
  - For Vike `+` files, `.server`, `.client`, `.shared`, and `.ssr` modify where hooks run.
  - Prefer `+data.server.ts` when data should only load on the server, `+data.client.ts` when it must run in the browser, and `+data.shared.ts` only when both environments are intentional.
  - Use `.ssr.ts` for SSR-only hooks that should not run during client-side navigation/pageContext requests.
- If Vike reports a wrong-environment import, fix the import boundary instead of suppressing it.
- When a non-client page needs to render a `.client` component permanently (not just inside an event handler), use a small wrapper that dynamically imports the `.client` module inside `useEffect`. This keeps the browser-only module out of the SSR bundle while still showing the UI after hydration:
  ```tsx
  function ClientOnlyWrapper(props) {
    const [Component, setComponent] = useState(null);
    useEffect(() => {
      import("./MyComponent.client").then((m) =>
        setComponent(() => m.MyComponent),
      );
    }, []);
    if (!Component) return <Skeleton />;
    return <Component {...props} />;
  }
  ```

## Zero (Rocicorp)

Zero is the primary API for app data (see `MIGRATION_PLAN.md`).

### File layout

- `drizzle-zero.config.ts` — controls which Drizzle tables/columns are exposed to Zero. Keep better-auth credential/session tables and token columns out of the browser-replicated schema.
- `src/zero/schema.gen.ts` — generated. **Do not edit.** Regenerate with `bun run zero:schema:gen` after any change to `database/drizzle/schema/*.schema.ts`.
- `src/zero/schema.ts` — re-exports `schema`, `zql`, row types, and `ZeroContext`. Import schema-related symbols from here, not from `schema.gen.ts`, so the file the generator writes can change without touching consumers.
- `src/zero/context.ts` — `ZeroContext { id, orgID, role, systemRole }`. Registers the context with Zero's `DefaultTypes`. Importing `./schema` already pulls this in.
- `src/zero/queries.ts` — shared query registry built with `defineQueries`/`defineQuery`. Browser-safe. Use Zod for `args` validation.
- `src/zero/mutators.ts` — shared mutator registry built with `defineMutators`/`defineMutator`. Browser-safe. Mutators must be `async` and `await` all `tx.mutate.*` writes.
- `src/zero/mutators.server.ts` — server-only override registry passed to the `/api/zero/mutate` endpoint. Use this for hard validation, audit logs, and side-effects that should not run optimistically.
- `src/zero/db-provider.server.ts` — `zeroDrizzle(schema, db)` adapter wired to the existing Drizzle client. Used by `handleMutateRequest`.
- `src/zero/client.ts` — `createZeroOptions({ userID, context })` builder. Reads `VITE_ZERO_CACHE_URL` from `import.meta.env`.
- `src/zero/zero-provider.client.tsx` — React `<ZeroProvider>` wrapper. Browser-only; mounted via the dynamic-import gate in `pages/+Layout.tsx`.
- `server/zero/context.server.ts` — `resolveZeroAuth(headers)` derives `ZeroContext` from the better-auth session. **Always** use this; never trust client-supplied identity.
- `server/zero/handler.server.ts` — Hono router that mounts `/api/zero/query` and `/api/zero/mutate`. Already registered in `server/hono.ts`.
- `server/dashboard/handler.server.ts` — authenticated `GET /api/dashboard/overview` (SQL aggregation, not Zero sync).

### Runtime boundaries

- `schema.ts`, `queries.ts`, `mutators.ts`, `context.ts`, `client.ts` are isomorphic. **Do not import** Drizzle, the auth instance, `pg`, `postgres`, or anything under `server/**` from these files.
- Anything that talks to Drizzle/auth/log lives in `*.server.ts` files.
- The React provider is `*.client.tsx`. Mount it through the dynamic-import wrapper documented in the **Vike** section so it stays out of the SSR bundle.

### Adding a query

1. Add an entry to `src/zero/queries.ts` using `defineQuery`. Validate `args` with Zod when the query accepts inputs.
2. Read identity from `ctx`, never from `args`. When `!ctx`, return an empty query (use the `cmpLit(false, "=", true)` deny-all predicate); do not throw.
3. The query is automatically reachable from `/api/zero/query` because the handler dispatches by name via `mustGetQuery(queries, name)`.
4. Consume it from React: `const [rows] = useQuery(queries.<name>(args))`.

### Adding a mutator

1. Add an entry to `src/zero/mutators.ts` using `defineMutator(zodSchema, async ({ tx, args, ctx }) => { ... })`.
2. Validate identity vs `args.organizationId` (or equivalent) inside the mutator. Throw on mismatch — Zero rolls back the optimistic write and surfaces the error to the client.
3. If the mutation needs hard server-side checks or side-effects, override the mutator in `src/zero/mutators.server.ts` using `defineMutators(sharedMutators, { ... })`. The server-side override gets the Drizzle transaction at `tx.dbTransaction.wrappedTransaction`.
4. Always `await` every `tx.mutate.*` call. An unawaited write breaks transactionality.
5. Consume from React: `const zero = useZero(); zero.mutate(mutators.<group>.<name>(args))`.

### Auth and permissions

- `resolveZeroAuth` projects the better-auth session into `ZeroContext`. Authenticated users **without** an active organization receive partial context (`orgID: null`, `email` set) so org-selection and join-link flows work.
- Org-scoped queries/mutators must gate on `ctx?.orgID`; auth-only flows (e.g. `organization.selection`, `organization.joinLinkRedeem`) use `ctx.id` / `ctx.email` instead.
- Logged-out callers receive `userID: null` and an undefined context; queries and mutators must handle that case explicitly (deny by default).
- Cookie auth requires `zero-cache` to forward browser cookies to `/api/zero/*`. Set `ZERO_QUERY_FORWARD_COOKIES=true` and `ZERO_MUTATE_FORWARD_COOKIES=true` locally and in production.
- `/login` and `/join` mount `ZeroProviderGate` with `allowAnonymous` so public queries like `organization.joinLinkPreview` work before sign-in.

## UI

- Reuse components from `components/ui` before adding new primitives.
- Use lucide icons for icon buttons and UI affordances when available.
- Auth and organization-selection screens are full-screen app surfaces, not pages inside the default sidebar layout.
- Keep mobile and desktop layouts responsive, with no overlapping text or controls.

## Documentation Hygiene

- If you add a new architectural convention, API module pattern, dev command, integration, or non-obvious workflow, update this file in the same change.
- If a convention becomes obsolete, remove or revise it instead of leaving conflicting guidance.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles mapped to the default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
