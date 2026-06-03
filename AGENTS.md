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

- Git on Windows: the repo uses LF line endings (`.gitattributes`). If `git status` lists hundreds of files with no real diff after cloning on Windows, run `bun run git:fix-eol` once (sets `core.autocrlf=false` in this clone and clears CRLF noise).
- Install dependencies with `bun install`.
- Run the dev server with `bun run dev`.
- Build with `bun run build`.
- Run a built production server with `bun run start`; production startup must use Bun, not Node.
- Type-check with `bunx tsc --noEmit`.
- Run tests with `bun test`.
- Desktop Electron wrapper commands:
  - `bun run desktop:dev` — open Electron against `ZENTRO_DESKTOP_WEB_URL` or `http://localhost:3000` by default; run `bun run dev` separately first.
  - `bun run desktop:make` — package desktop installers with Electron Forge; set `ZENTRO_DESKTOP_WEB_URL` in `desktop/.env` or the shell before packaging.
  - `bun run desktop:make:msix` — build a Windows MSIX only (must run on Windows 10/11 with Windows SDK; output under `desktop/out/make/msix/`). Configure Store identity and `ZENTRO_MSIX_WINDOWS_KIT_VERSION` via `desktop/msix/.env.example`; see `desktop/README.md`.
  - `bun run desktop:make:win` — Windows Squirrel + MSIX makers for x64.
  - `bun run desktop:check` — type-check and Ultracite-check the Electron workspace.
 - `bun run --cwd desktop icons` — regenerate `desktop/assets/icon.*` from `desktop/assets/logo-icon.svg` (requires ImageMagick).
- Playwright E2E (web; specs in `tests/e2e/`, see `tests/e2e/README.md`):
  - `bun run e2e:playwright` — run all flows (starts app + zero-cache via config when not already running; requires Postgres).
  - `bun run e2e:playwright:smoke` — specs tagged `@smoke` only.
  - Set `PLAYWRIGHT_LOGIN_EMAIL`, `PLAYWRIGHT_LOGIN_PASSWORD`, and `PLAYWRIGHT_ORG_NAME` in the shell (legacy `MAESTRO_*` names still work as fallbacks).
- Database commands:
  - `bun run db:generate`
  - `bun run db:migrate`
  - `bun run db:push`
  - `bun run db:studio`
- Zero commands (see `MIGRATION_PLAN.md` for the surface-by-surface plan):
  - `bun run zero:schema:gen` regenerates `src/zero/schema.gen.ts` from the Drizzle schema using `drizzle-zero.config.ts`. Run it after **any** change to `database/drizzle/schema/*.schema.ts`.
  - `bun run zero:dev` starts `zero-cache-dev`. Run it in a separate terminal alongside `bun run dev`. It reads `ZERO_QUERY_URL` / `ZERO_MUTATE_URL` from `.env` (defaults point at `http://localhost:3000/api/zero/*`) and requires `ZERO_QUERY_FORWARD_COOKIES=true` / `ZERO_MUTATE_FORWARD_COOKIES=true` for better-auth cookies.
  - Postgres must be up first (`docker compose up -d`) and configured with `wal_level=logical` — already done in the committed `docker-compose.yml`. That compose file runs a one-shot `db-migrate` job after Postgres is healthy and only then starts **zero-cache** on port `4848` (réplica en volumen `zentro_zero_data`; callbacks a `host.docker.internal:3000`). Alternativa: `docker compose up -d postgres` + `bun run db:migrate` + `bun run zero:dev`.

## Code Quality (Ultracite)

- This project uses **Ultracite** with the **Biome** backend for zero-config linting and formatting.
- Configuration lives in `biome.jsonc` and extends `ultracite/biome/core`, `ultracite/biome/react`, and `ultracite/biome/vitest`.
- **Commands**:
  - `bun run check` — read-only lint/format check.
  - `bun run fix` — auto-fix issues. Run this before committing if you touched JS/TS/JSON/CSS files.
- **Lefthook** runs `ultracite fix` automatically on pre-commit for staged `.{js,jsx,ts,tsx,json,jsonc,css}` files and re-stages fixes. Do not disable `stage_fixed`.
- `package.json` runs `scripts/install-lefthook.mjs` from `prepare` via Bun; it installs lefthook only when `.git` exists so Railway/tarball installs do not fail.
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
- Vike client routing is enabled (`clientRouting: true`) so organization changes can update the client Zero context and navigate without a full page reload.
- Server: Hono through `@vikejs/hono`.
- Styling: Tailwind CSS v4, shadcn/radix-style UI components in `components/ui`.
- Auth: better-auth with organization support.
- Database: Drizzle ORM over PostgreSQL (`drizzle-orm/postgres-js`). Postgres runs locally with `wal_level=logical` (see `docker-compose.yml`) so Zero can mirror it via logical replication.
- Server state: Zero (`@rocicorp/zero`) for replicated reads/writes + TanStack Query for ephemeral server fetches (dashboard overview).
- API: Zero query/mutate endpoints (`/api/zero/*`) and authenticated REST helpers (`/api/dashboard/*`, `/api/auth/*`).
- Desktop: Electron Forge + Vite workspace under `desktop/`; currently a hardened wrapper around the configured web URL, not an embedded offline server.
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
- `src/zero/client.ts` — `createZeroOptions({ userID, context, cacheURL })` builder. In production, `server/runtime-config.server.ts` reads `ZERO_CACHE_URL` or `VITE_ZERO_CACHE_URL` and exposes it through `/api/runtime-config`; `ZeroProviderGate` uses that runtime value before opening a Zero websocket so static Vike HTML cannot freeze the localhost fallback.
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

### Inventory (products + Kardex)

- Paginated movement history uses `queries.products.movements.list` with cursor `{ createdAt, id }`, `limit + 1` fetch, and client helpers in `features/products/inventory-movements.shared.ts` (mirror `features/sales/sales.shared.ts`).
- Stock alert UI must use `getStockStatus` from `features/inventory/stock-status.shared.ts` with `minStock ?? organization.settings.inventory.lowStockThreshold`.
- Product fields `minStock` and `reorderQuantity` are optional integers on `product`; regenerate Zero schema after Drizzle changes.

### Adding a mutator

1. Add an entry to `src/zero/mutators.ts` using `defineMutator(zodSchema, async ({ tx, args, ctx }) => { ... })`.
2. Validate identity vs `args.organizationId` (or equivalent) inside the mutator. Throw on mismatch — Zero rolls back the optimistic write and surfaces the error to the client.
3. If the mutation needs hard server-side checks or side-effects, override the mutator in `src/zero/mutators.server.ts` using `defineMutators(sharedMutators, { ... })`. The server-side override gets the Drizzle transaction at `tx.dbTransaction.wrappedTransaction`.
4. Mutators that need complete relationship graphs for accounting/settlement (e.g. `shifts.close`) must be server-only/no-op on the client; client mutator reads only see locally cached rows.
5. Always `await` every `tx.mutate.*` call. An unawaited write breaks transactionality.
6. Consume from React: `const zero = useZero(); zero.mutate(mutators.<group>.<name>(args))`.

### Auth and permissions

- `resolveZeroAuth` projects the better-auth session into `ZeroContext`. Authenticated users **without** an active organization receive partial context (`orgID: null`, `email` set) so org-selection and join-link flows work.
- Org-scoped queries/mutators must gate on `ctx?.orgID`; auth-only flows (e.g. `organization.selection`, `organization.joinLinkRedeem`) use `ctx.id` / `ctx.email` instead.
- Logged-out callers receive `userID: null` and an undefined context; queries and mutators must handle that case explicitly (deny by default).
- Cookie auth requires `zero-cache` to forward browser cookies to `/api/zero/*`. Set `ZERO_QUERY_FORWARD_COOKIES=true` and `ZERO_MUTATE_FORWARD_COOKIES=true` locally and in production.
- `/login` and `/join` mount `ZeroProviderGate` with `allowAnonymous` so authenticated join-link redemption can use Zero before an active org is selected. Public join-link preview must use the sanitized REST endpoint `GET /api/organization/join-link-preview?token=...`, not a Zero query, because ZQL returns full rows.

### Docker deployment

- Full production deployment documentation lives in `docs/deployment/docker.md`. Update that document when service topology, variables, domains, build commands, rollout order, or Zero operating procedures change.
- Production topology: one app/API container (`deploy/app/Dockerfile`), one zero-cache container (`deploy/zero-cache/Dockerfile`), and external managed Postgres with `wal_level=logical`. Compose deploy: `deploy/docker-compose.prod.yml` + `deploy/.env.production` (see `deploy/.env.production.example`).
- QA on Coolify uses `deploy/docker-compose.qa.yml`, which includes its own Postgres service, separate Postgres/Zero volumes, and a public Postgres host-port mapping controlled by `QA_POSTGRES_PORT`. Use `deploy/.env.qa.example` as the QA variable template.
- Build from Git or CI with dockerfile path `deploy/app/Dockerfile` or `deploy/zero-cache/Dockerfile` and build context at the repository root.
- Database migrations run in `scripts/docker-entrypoint.sh` before `bun run start` when `RUN_MIGRATIONS=true` (default). The entrypoint uses `set -euo pipefail` so migration failures stop the container and block health-check promotion.
- Attach persistent storage at `/data` on the zero-cache service (`ZERO_REPLICA_FILE=/data/replica.db`). Configure the volume in the platform, not via a `VOLUME` instruction in the Dockerfile.
- Use sibling custom domains for cookie auth, for example `app.example.com` and `zero.example.com`. Configure the app with `BETTER_AUTH_COOKIE_DOMAIN=example.com`, `BETTER_AUTH_TRUSTED_ORIGINS=https://app.example.com,https://zero.example.com`, and `ZERO_CACHE_URL=https://zero.example.com`.
- Configure zero-cache with `ZERO_QUERY_FORWARD_COOKIES=true` and `ZERO_MUTATE_FORWARD_COOKIES=true`. `ZERO_QUERY_URL` and `ZERO_MUTATE_URL` should point to the app's `/api/zero/query` and `/api/zero/mutate` endpoints.
- `ZERO_ADMIN_PASSWORD` is **required** on zero-cache in production; without it the container exits before serving traffic.

## Desktop (Electron)

- Keep Electron code inside `desktop/`; the web app remains the source of truth for product behavior.
- `desktop/src/main.ts` loads `ZENTRO_DESKTOP_WEB_URL` when set. In development, it falls back to `http://localhost:3000`; packaged builds must bake a real web URL through `desktop/.env` or the shell.
- The desktop app must keep `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and same-origin navigation guards unless there is a reviewed reason to change them.
- Use `desktop/src/preload.ts` for minimal desktop affordances only. Mirror any browser-visible shape in `types/zentro-desktop.d.ts`. Do not expose broad Node/Electron APIs to the remote web surface; sandboxed preload code cannot import arbitrary Node built-ins.
- The desktop splash/offline shell lives under `desktop/src/renderer/`, loads before the remote web app, and may reuse root UI primitives/styles (`components/ui`, `pages/tailwind.css`) without adding web app routes.
- `desktop/src/main.ts` injects a baseline CSP for the configured web origin only when the server response does not already provide one. The baseline must allow third-party analytics script origins used in `pages/+Head.tsx` (currently Umami).
- MSIX / Microsoft Store: `@electron-forge/maker-msix` (experimental) is configured in `desktop/forge.config.ts` via `desktop/forge.msix.ts`; use the configured `msix` target, not a raw `@electron-forge/maker-msix` target, so package identity/assets/signing options are preserved. Builds require Windows + Windows SDK. Store publisher/package identity come from Partner Center (`ZENTRO_MSIX_PUBLISHER`, `ZENTRO_MSIX_PACKAGE_IDENTITY`), and `ZENTRO_MSIX_WINDOWS_KIT_VERSION` must match an installed SDK version under `C:\Program Files (x86)\Windows Kits\10\bin\`. Optional custom manifest: copy `desktop/msix/Package.appxmanifest.example` → `Package.appxmanifest`. CI: `.github/workflows/desktop-msix.yml`.

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

### Playwright testing

Use `.agents/skills/playwright-testing` as the project-local goto before adding, configuring, writing, running, or debugging Playwright tests.
