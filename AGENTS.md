# Repository Instructions

## Start here

Read the section for the task at hand before editing. `AGENTS.md` defines repository rules; linked documents hold detailed runbooks.

| Task | Required starting point |
| --- | --- |
| Feature or server behavior | [Architecture](#architecture), then [Feature modules](#feature-modules) and [Server app shell](#server-app-shell) |
| React UI, forms, styling, or responsiveness | [UI](#ui) and `$mantine-zentro` |
| Zero schema, query, or mutator | [Zero Rocicorp](#zero-rocicorp) and `MIGRATION_PLAN.md` when porting from `../zentro-reborn` |
| Browser E2E tests | `$playwright-testing` and `tests/e2e/README.md` |
| Desktop Electron | [Desktop](#desktop-electron) and `desktop/README.md` |
| Docker, Coolify, or Zero operations | [Docker deployment](#docker-deployment) and `docs/deployment/docker.md` |

## Working agreement

- Use conventional commits when creating git commits.
- Keep changes scoped to the requested behavior. Do not rewrite unrelated code or revert user changes.
- Prefer existing project patterns over introducing new abstractions.
- Before porting behavior from `../zentro-reborn`, read `MIGRATION_PLAN.md` (migración oRPC→Zero completa) and follow the Zero patterns in this file and `zero/*`.
- If unsure about Vike behavior, consult local docs/dependencies first. If that is not enough, clone or inspect the [official Vike repository](https://github.com/vikejs/vike).
- Update this file when a change materially changes a durable project convention, architecture, workflow, command, or integration pattern. Put step-by-step operational detail in its focused documentation instead.

## Development and verification

- Git on Windows: the repo uses LF line endings (`.gitattributes`). If `git status` lists hundreds of files with no real diff after cloning on Windows, run `bun run git:fix-eol` once (sets `core.autocrlf=false` in this clone and clears CRLF noise).
- Install dependencies with `bun install`.
- Run the dev server with `bun run dev`.
- Build with `bun run build`.
- Run a built production server with `bun run start`; production startup must use Bun, not Node.
- Type-check with `bunx tsc --noEmit`.
- Run integration tests with `bun test`. The script is intentionally scoped to `tests/*.test.ts`, requires Postgres (`docker compose up -d postgres`), and excludes Playwright specs under `tests/e2e/`.
- CI (`.github/workflows/ci.yml`) runs typecheck, Ultracite, and the integration-test gate on pushes to `main`/`prod` and pull requests.

### Database and Zero local workflow

- Database commands: `bun run db:generate`, `bun run db:migrate`, `bun run db:push`, and `bun run db:studio`.
- Run `bun run zero:schema:gen` after **any** change to `database/drizzle/schema/*.schema.ts`; it regenerates `zero/schema.gen.ts` from the Drizzle schema using `drizzle-zero.config.ts`.
- Run `bun run zero:dev` alongside `bun run dev`. It reads `ZERO_QUERY_URL` / `ZERO_MUTATE_URL` from `.env` (defaults point at `http://localhost:3000/api/zero/*`) and requires `ZERO_QUERY_FORWARD_COOKIES=true` / `ZERO_MUTATE_FORWARD_COOKIES=true` for better-auth cookies.
- Start Postgres first (`docker compose up -d`). It must use `wal_level=logical`, already configured in `docker-compose.yml`. That compose file runs `db-migrate` after Postgres is healthy and starts `zero-cache` on port `4848`; alternatively run `docker compose up -d postgres`, `bun run db:migrate`, and `bun run zero:dev`.

### Focused workflows

- Desktop commands and MSIX prerequisites: `desktop/README.md`. Common commands: `bun run desktop:dev`, `bun run desktop:make`, `bun run desktop:make:msix`, `bun run desktop:make:win`, and `bun run desktop:check`.
- Browser E2E commands and bootstrap auth behavior: `tests/e2e/README.md`. Use `$playwright-testing` before adding or changing Playwright tests.

### Code quality (Ultracite)

- This project uses **Ultracite** with the **Biome** backend for zero-config linting and formatting. Configuration lives in `biome.jsonc` and extends `ultracite/biome/core`, `ultracite/biome/react`, and `ultracite/biome/vitest`.
- Run `bun run check` for a read-only lint/format check. Run `bun run fix` before committing after touching JS/TS/JSON/CSS files.
- Lefthook runs `ultracite fix` on staged `.{js,jsx,ts,tsx,json,jsonc,css}` files and re-stages fixes. Do not disable `stage_fixed`.
- `package.json` runs `scripts/install-lefthook.mjs` from `prepare` via Bun; it installs lefthook only when `.git` exists so Railway/tarball installs do not fail.
- Do not create legacy config files (`.eslintrc.*`, `.prettierrc.*`) or manually override formatting rules. Change `biome.jsonc` only within the Ultracite preset system when rules need changing.
- Follow Ultracite standards: prefer `const`, destructuring, optional chaining, nullish coalescing, template literals, `for...of`, concise arrows, and `async`/`await`. Await every promise in async functions.
- Use explicit types when they clarify intent, `unknown` instead of `any`, and `as const` for immutable values. Rely on narrowing.
- Do not leave `console.log`, `debugger`, or `alert` in production code. Use evlog on the server; avoid committed client debug logs. CLI scripts under `scripts/*.ts` may use prefixed `console.log`.
- Keep React components as function components, hooks top-level with correct dependency arrays, and components outside other component definitions. Use semantic HTML, labels, headings, alt text, and keyboard affordances. Do not leave `.only` or `.skip` in tests.

## Architecture

### Stack

- App framework: Vike with React, configured as full CSR (`ssr: false` in `pages/+config.ts`). Client routing is enabled so organization changes can update the client Zero context and navigate without a full page reload.
- Server: Hono through `@vikejs/hono`; logging: evlog with the `evlog/vite` plugin and `evlog/hono` middleware.
- UI: Mantine is the component system and theme layer. Tailwind CSS v4 remains for layout utilities and legacy token aliases; `components/ui` is not a shadcn registry.
- Auth: better-auth with organization support. Database: Drizzle ORM over PostgreSQL (`drizzle-orm/postgres-js`), with `wal_level=logical` for Zero replication.
- Server state: Zero for replicated reads/writes and TanStack Query for ephemeral server fetches (dashboard overview).
- API: Zero query/mutate endpoints (`/api/zero/*`) and authenticated REST helpers (`/api/dashboard/*`, `/api/auth/*`).
- Desktop: Electron Forge + Vite under `desktop/`; it is a hardened wrapper around the configured web URL, not an embedded offline server.

### Feature modules

Each domain is co-located under `features/<domain>/` (see `docs/adr/0006-co-locate-domains-into-feature-modules.md`). A feature owns the whole concept: contract, reads, writes, server-authoritative logic, and UI.

**Dividing line:** domain logic → feature; transport / wiring → `server/`.

Files in a feature follow `<domain>.<role>.ts`, with Vike environment suffixes carrying the runtime seam:

```
features/sales/
  sales.schema.ts            # Zod contract — isomorphic, browser-safe
  sale-totals.shared.ts     # pure calculation helpers — isomorphic, testable without DB
  create-sale.server.ts      # authoritative server write logic (orchestrates operations)
  cancel-sale.server.ts
  sales.shared.ts            # client helpers
  hooks/ · components/ · sales-page.tsx
features/shifts/
  shift-operations.server.ts # reusable server operations (assertOpenCashierShift, etc.)
features/settings/
  payment-methods.server.ts  # reusable server operations (loadOrganizationSettings, etc.)
features/inventory/
  inventory-operations.server.ts  # reusable server operations (applyInventoryDeltas, etc.)
features/credit/
  credit-operations.server.ts     # reusable server operations (recordCreditSaleCharge, etc.)
```

- **Schemas:** `features/<domain>/<domain>.schema.ts` — the Zod contract for that domain. Import from `@/features/<domain>/<domain>.schema`, not a top-level `schemas/` tree.
- **Server logic:** `features/<domain>/*.server.ts` — Drizzle writes, SQL aggregation, audit logs, and other authoritative behavior. These may live anywhere in the feature folder; the `.server.ts` suffix enforces the Vike boundary.
- **Operation modules:** `features/<domain>/<domain>-operations.server.ts` — reusable server-side operations that encapsulate cross-feature logic (shift validation, inventory deltas, credit charges, payment method validation). Server write logic (e.g. `create-sale.server.ts`) should orchestrate these operations instead of redefining the logic inline.
- **Pure shared helpers:** `features/<domain>/*.shared.ts` — isomorphic, browser-safe helpers. Pure calculation functions (e.g. `sale-totals.shared.ts`) that don't need DB access can be extracted here for unit testability.
- **Cross-feature schemas:** a schema lives with its owning domain. Non-owning consumers may import browser-safe `*.schema.ts` files across features. Examples: `customers` (customers + POS), `pos` (POS + shifts), and `modules` (Zero registry + admin).
- `lib/` and `components/ui/` are for genuinely cross-cutting code only.
- **Normalization helpers:** `lib/domain-values.shared.ts` is the canonical source for `normalizeOptionalString`, `normalizeRequiredString`, `normalizeNumber`, `toNonNegativeInteger`, `toInteger`, `toPositiveInteger`, `resolveDate`, and `resolveTimestamp`. Import from `@/lib/domain-values.shared` or `@/zero/sdk` (which re-exports them). Do not duplicate these in feature modules.

### Server app shell

Top-level `server/` is **transport and wiring only** — do not add domain-logic subfolders there. Domain `.server.ts` files live in `features/<domain>/`.

What stays in `server/`:

- `server/hono.ts` — Hono app and route registration
- `server/auth.ts` — better-auth wiring
- `server/db-middleware.ts`
- `server/runtime-config.server.ts`
- `server/zero/` — `handler.server.ts` (`/api/zero/*`) and `context.server.ts` (`resolveZeroAuth`)
- `server/qz/` — QZ signing endpoint
- `server/dashboard/handler.server.ts` — REST transport for `GET /api/dashboard/overview`; calls `features/dashboard/*.server.ts`
- `server/admin/handler.server.ts` — REST transport for platform-admin endpoints; calls `features/admin/*.server.ts`
- `server/organization/handler.server.ts` — REST transport for org endpoints such as join-link preview; calls `features/organization/*.server.ts`

### Logging (evlog)

- The `evlog/vite` plugin in `vite.config.ts` initializes the logger with `service: 'zentro'`.
- The Hono app uses `evlog()` middleware from `evlog/hono`, exposing a request-scoped logger through `c.get('log')`.
- Use `c.get('log').set({ ... })` to enrich the request wide event with structured data.
- Use `createError({ message, status, why, fix, link })` from `evlog` for structured errors; handle them in Hono's `app.onError` with `parseError()`.
- Use `c.get('log').info()`, `.warn()`, or `.error()` in Hono handlers instead of `console.log` / `console.error`.

### Vike

- Pages live under `pages/**`; route guards use Vike guard files such as `+guard.ts`.
- Keep server-only behavior behind the Hono/Vike server boundary. Components and browser code must not import database tables, auth server modules, or server-only procedure implementations.
- Use Vike environment suffixes to enforce runtime boundaries:
  - `.server.ts` / `.server.tsx` — secrets, database access, auth server logic, server handlers, filesystem/process usage, and anything that must never enter the client bundle.
  - `.client.ts` / `.client.tsx` — code that requires `window`, `document`, browser storage, or DOM-only libraries.
  - For Vike `+` files, `.server`, `.client`, `.shared`, and `.ssr` modify hook runtime; prefer `+data.server.ts` or `+data.client.ts`, using `+data.shared.ts` only intentionally.
  - `.ssr.ts` — SSR-only hooks that must not run during client navigation/pageContext requests.
- Fix wrong-environment imports at the boundary; do not suppress them.
- When a non-client page needs to render a `.client` component permanently, dynamically import it inside a small `useEffect` wrapper so the browser-only module stays out of the SSR bundle:

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

### Zero (Rocicorp)

Zero is the primary API for app data. Migration history lives in `MIGRATION_PLAN.md`.

#### File layout

- `drizzle-zero.config.ts` controls the Drizzle tables/columns exposed to Zero. Keep better-auth credential/session tables and token columns out of the browser-replicated schema.
- `zero/schema.gen.ts` is generated: do not edit it. Regenerate it with `bun run zero:schema:gen` after changes to `database/drizzle/schema/*.schema.ts`.
- `zero/schema.ts` re-exports `schema`, `zql`, row types, and `ZeroContext`. Import schema symbols from here, not `schema.gen.ts`.
- `zero/context.ts` defines `ZeroContext { id, orgID, role, systemRole }` and registers it with Zero's `DefaultTypes`.
- `zero/sdk.ts` is the internal Zero SDK facade (isomorphic). Feature slices and Zero composition roots import `defineZentroQuery`, `defineZentroMutator`, typed registry helpers, and shared auth/normalization helpers from here instead of importing `defineQuery` / `defineMutator` directly from `@rocicorp/zero`.
- `zero/sdk.server.ts` is the server-only SDK extension. It exports `defineZentroServerMutator` (reduces boilerplate for server-backed mutators by extracting `drizzleTx`, validating context, and providing typed `auth`) and `requireServerDrizzleTransaction` (extracts the Drizzle transaction from a Zero mutator transaction). Server mutator files (`*.mutators.server.ts`) should use `defineZentroServerMutator` instead of manually checking `ctx` and `dbTransaction`.
- `zero/queries.shared.ts` and `zero/mutators.shared.ts` hold browser-safe cross-slice helpers.
- **Feature slices:** `features/<domain>/<domain>.queries.ts` exports `<domain>Queries`; `*.mutators.ts` exports `<domain>Mutators`; `*.mutators.server.ts` contains server-authoritative overrides when needed. See `docs/adr/0007-split-zero-registries-into-feature-slices.md`.
- **Composition roots:** `zero/queries.ts`, `zero/mutators.ts`, and `zero/mutators.server.ts` only assemble feature slices into the registries Zero dispatches.
- `zero/db-provider.server.ts` wires `zeroDrizzle(schema, db)` to the Drizzle client. `zero/client.ts` builds `createZeroOptions({ userID, context, cacheURL })` and gets production cache configuration through `/api/runtime-config`.
- `zero/zero-provider.client.tsx` is the browser-only React provider, mounted through the dynamic-import gate in `pages/+Layout.tsx`.
- `server/zero/context.server.ts` derives identity with `resolveZeroAuth(headers)`. Always use it; never trust client-supplied identity.
- `server/zero/handler.server.ts` mounts `/api/zero/query` and `/api/zero/mutate`. `server/dashboard/handler.server.ts` transports the authenticated dashboard overview and delegates aggregation to `features/dashboard/build-overview.server.ts`.

#### Dependency and runtime boundaries

- Feature slices import `@/zero/schema` plus `@/zero/sdk` for Zero definitions and shared helpers. They must not import composed registries.
- Composition roots import feature slices and assemble the registry. Hooks and components import the composed registry, not individual slices.
- `zero/schema.ts`, feature `*.queries.ts` / `*.mutators.ts`, the shared helpers, `zero/context.ts`, `zero/client.ts`, and `features/*/*.schema.ts` are isomorphic. Do not import Drizzle, auth, `pg`, `postgres`, or `server/**` there.
- Drizzle/auth/log code belongs in `features/*/*.server.ts` or app-shell `*.server.ts` files. Mount the React provider through the Vike dynamic-import wrapper.

#### Adding a query

1. Add a `defineZentroQuery` entry from `@/zero/sdk` to `features/<domain>/<domain>.queries.ts`; validate arguments with Zod when it accepts input.
2. Register a new domain slice in `zero/queries.ts`.
3. Read identity from `ctx`, never arguments. When `!ctx`, return a deny-all empty query with `cmpLit(false, "=", true)`; do not throw.
4. The handler makes it reachable at `/api/zero/query` via `mustGetQuery(queries, name)`.
5. Consume it with `const [rows] = useQuery(queries.<name>(args))`.

#### Adding a mutator

1. Add a `defineZentroMutator` entry from `@/zero/sdk` to `features/<domain>/<domain>.mutators.ts` and await every `tx.mutate.*` call.
2. Register a new domain slice in `zero/mutators.ts`.
3. Validate identity against `args.organizationId` (or equivalent). Throw on mismatch so Zero rolls back the optimistic write and surfaces the error.
4. Use `features/<domain>/<domain>.mutators.server.ts` plus `zero/mutators.server.ts` for hard server checks or side effects. Use `defineZentroServerMutator` from `@/zero/sdk.server` to reduce boilerplate — it extracts the Drizzle transaction, validates context, and provides `{ drizzleTx, args, auth: { organizationId, userId, zeroContext } }`. Delegate authoritative work to feature `*.server.ts` helpers or `*-operations.server.ts` modules. For mutators that use Zero's own `tx.mutate` / `tx.run` (ZQL) instead of Drizzle, continue using `defineZentroMutator` from `@/zero/sdk`.
5. Make mutators that need complete relationship graphs for accounting/settlement server-only/no-op on the client; client mutators can see only locally cached rows.
6. Consume them with `const zero = useZero(); zero.mutate(mutators.<group>.<name>(args))`.

#### Auth, permissions, and inventory

- `resolveZeroAuth` gives authenticated users without an active organization partial context (`orgID: null`, `email` set) so organization-selection and join-link flows work.
- Org-scoped queries/mutators gate on `ctx?.orgID`; auth-only flows use `ctx.id` / `ctx.email`. Logged-out callers have `userID: null` and undefined context; deny by default.
- `zero-cache` must forward browser cookies to `/api/zero/*` with `ZERO_QUERY_FORWARD_COOKIES=true` and `ZERO_MUTATE_FORWARD_COOKIES=true` locally and in production.
- `/login` and `/join` mount `ZeroProviderGate` with `allowAnonymous`. Public join-link preview uses the sanitized REST endpoint `GET /api/organization/join-link-preview?token=...`, not Zero, because ZQL returns full rows.
- Inventory movement history uses `queries.products.movements.list` with cursor `{ createdAt, id }`, `limit + 1` fetch, and `features/products/inventory-movements.shared.ts`. Stock-alert UI uses `getStockStatus` from `features/inventory/stock-status.shared.ts` with `minStock ?? organization.settings.inventory.lowStockThreshold`.
- `product.minStock` and `product.reorderQuantity` are optional integers; regenerate the Zero schema after their Drizzle schema changes.

## Product surfaces

### UI

- Mantine (`@mantine/core`) is the default for new UI components, forms, overlays, menus, inputs, tables where practical, and theme-level styling.
- Use the project-local `$mantine-zentro` skill for every task that adds, changes, or reviews visual UI, forms, overlays, theming, styling, or responsive layouts. It supplies the Mantine-specific workflow and current official documentation; these repository rules remain authoritative.
- Keep the app-level `MantineProvider` in `pages/+Layout.tsx`, wired with `theme={mantineTheme}` and `cssVariablesResolver={mantineCssVariablesResolver}` from `lib/mantine-theme.ts`.
- Keep brand tokens and shared Mantine overrides in `lib/mantine-theme.ts`: `brandColors`, `brandColorCssVars`, `mantineTheme`, `mantineCssVariablesResolver`, and `theme.components` overrides.
- Customize Mantine with `Component.extend`, `classNames`, `styles`, and supported Styles API selectors. Prefer CSS modules or Tailwind utilities through `className`/`classNames` for layout and local adjustments.
- Use `cssVariablesResolver` for project-owned CSS variables. Never style against Mantine private `--_*` variables.
- Tailwind v4 is a utility/layout layer and compatibility surface for legacy tokens. `pages/tailwind.css` maps aliases to Mantine/Zentro variables with fallbacks because the Electron offline renderer imports it without `MantineProvider`.
- `components/ui` only holds existing cross-cutting helpers (table, virtual-table, virtual-list, data-table-pagination, and sonner wrappers). Do not generate new shadcn primitives, reintroduce `components.json`, or add shadcn packages/scripts.
- `tailwind-merge`, `clsx`, and `cn()` remain allowed for existing helpers and conditional class composition. Use Lucide icons for available icon affordances.
- Authentication and organization-selection screens are full-screen app surfaces, not pages inside the default sidebar layout. Keep mobile and desktop layouts responsive without overlapping text or controls.

### Desktop (Electron)

- Keep Electron code inside `desktop/`; the web app is the source of truth for product behavior.
- `desktop/src/main.ts` loads `ZENTRO_DESKTOP_WEB_URL` when set and falls back to `http://localhost:3000` in development. Packaged builds must bake a real web URL through `desktop/.env` or the shell.
- Keep `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and same-origin navigation guards unless there is a reviewed reason to change them.
- Use `desktop/src/preload.ts` only for minimal desktop affordances, mirroring browser-visible shape in `types/zentro-desktop.d.ts`. Do not expose broad Node/Electron APIs to the remote web surface.
- The splash/offline shell under `desktop/src/renderer/` loads before the remote web app and may reuse root UI helpers/styles without adding web routes.
- `desktop/src/main.ts` adds a baseline CSP only when the server response has none; it must allow the analytics script origins used in `pages/+Head.tsx` (currently Umami).
- For MSIX, use the configured `msix` target through `desktop/forge.msix.ts`, not a raw maker target. Builds require Windows + Windows SDK; follow `desktop/README.md` for Store identity, manifest, and CI details.

## Docker deployment

- `docs/deployment/docker.md` is the full production and QA runbook. Update it when service topology, variables, domains, build commands, rollout order, or Zero operating procedures change.
- Production is one app/API container (`deploy/app/Dockerfile`), one zero-cache container (`deploy/zero-cache/Dockerfile`), and external managed Postgres with `wal_level=logical`. Use `deploy/docker-compose.prod.yml` and `deploy/.env.production`; use `deploy/docker-compose.host-ports.yml` only for direct Compose runs that intentionally need host bindings.
- Coolify supplies `deploy/.env.production` values through its UI and must not publish host ports. QA uses `deploy/docker-compose.qa.yml`, dedicated Postgres/Zero volumes, and `QA_POSTGRES_PORT`; use `deploy/.env.qa.example` as its variable template.
- Build with Dockerfiles under `deploy/app/` or `deploy/zero-cache/` using the repository root as build context. `scripts/docker-entrypoint.sh` runs migrations before `bun run start` when `RUN_MIGRATIONS=true`; migration failure must block promotion.
- Attach persistent storage at `/data` on zero-cache (`ZERO_REPLICA_FILE=/data/replica.db`). Use sibling custom domains for cookie auth, configure the root cookie domain and both trusted origins, and set `ZERO_CACHE_URL` to the public zero-cache URL.
- Set `ZERO_QUERY_FORWARD_COOKIES=true`, `ZERO_MUTATE_FORWARD_COOKIES=true`, and a required `ZERO_ADMIN_PASSWORD` in production. The query/mutate URLs point to the app's `/api/zero/*` endpoints.

## Documentation and agent workflows

- Update this file for durable conventions; revise or remove obsolete rules rather than leaving conflicting guidance.
- For every non-trivial bug or diagnostic fix, add `docs/fix-log/YYYY-MM-DD-descriptive-fix-name.md` with symptom, root cause, solution, and verification.
- Issues and PRDs live as GitHub issues. See `docs/agents/issue-tracker.md`.
- Read `docs/agents/triage-labels.md` before applying or creating triage labels; only default GitHub labels currently exist.
- Domain context is `AGENTS.md`, `MIGRATION_PLAN.md`, `docs/adr/`, and `plans/`; there is no root `CONTEXT.md`. See `docs/agents/domain.md`.
- Use `.agents/skills/playwright-testing` before adding, configuring, writing, running, or debugging Playwright tests.
