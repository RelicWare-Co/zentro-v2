# Plan 006: Reduce the production container to runtime dependencies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 22136cf..HEAD -- deploy/app/Dockerfile package.json bun.lock scripts/migrate.ts +server.ts drizzle.config.ts drizzle-zero.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `22136cf`, 2026-06-24

## Why this matters

The published `ghcr.io/relicware-co/zentro-app:latest` image is 1,016 MB.
Its final `node_modules` layer alone is 801 MB, while the built application is
only 2.99 MB. The final image currently copies the dependency tree used to
build, type-check, test, package Electron, and generate schemas. The runtime
only needs the server bundle, migrations, and their production dependencies.

Separating those dependency sets should reduce deployment transfer, cold-start
time, and the production attack surface without changing browser bundles or
the Electron app.

## Current state

- `deploy/app/Dockerfile` — production multi-stage image. The `install` stage
  runs a full install and `release` copies it unchanged:

  ```dockerfile
  FROM base AS install
  COPY package.json bun.lock ./
  COPY desktop/package.json ./desktop/package.json
  RUN bun install --frozen-lockfile --ignore-scripts

  FROM base AS release
  ENV NODE_ENV=production
  COPY package.json bun.lock ./
  COPY --from=install /app/node_modules node_modules
  COPY --from=build /app/dist dist
  COPY --from=build /app/database database
  COPY --from=build /app/scripts scripts
  ```

- `scripts/migrate.ts` — the production entrypoint executes this script. It
  imports only `drizzle-orm/postgres-js` and `postgres`; it does not import
  `drizzle-kit`, `drizzle-seed`, or `drizzle-zero`.
- `package.json` — `drizzle-kit`, `drizzle-seed`, and `drizzle-zero` are in
  `dependencies`, even though their only callers are `drizzle.config.ts`,
  `scripts/seed-products.ts`, and `drizzle-zero.config.ts`, respectively.
- `package.json` also declares `@mantine/form` and `scheduler`; there are no
  application imports of either. `@mantine/hooks` is not a removal candidate:
  it is a peer dependency of `@mantine/core`.
- `dotenv` must remain available to the server: `+server.ts` imports
  `dotenv/config`. Printer packages and `qz-tray` are dynamically imported in
  the POS printing code and must remain dependencies.

The repository uses Bun, Conventional Commits, and Ultracite. The production
entrypoint is `scripts/docker-entrypoint.sh`; it runs migrations by default,
so the release image must retain the migration runtime.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `bun install` | Lockfile and manifest synchronized; exit 0 |
| Focused tests | `bun test tests/pos-checkout.test.ts` | 2 passing tests |
| Typecheck | `bunx tsc --noEmit` | exit 0, no errors |
| Lint | `bun run check` | exit 0, no fixes needed |
| Integration tests | `bun test` | all tests pass |
| Build optimized image | `docker buildx build --platform linux/amd64 --file deploy/app/Dockerfile --tag zentro-app:optimized --load .` | exit 0 |
| Inspect size | `docker image inspect zentro-app:optimized --format '{{.Size}}'` | materially below 1,016,293,640 bytes |
| Runtime smoke test | `docker run --rm --platform linux/amd64 --entrypoint bun zentro-app:optimized run db:migrate` | migration succeeds against an explicitly supplied disposable test DB |

## Scope

**In scope**:

- `deploy/app/Dockerfile`
- `package.json`
- `bun.lock`
- a focused test only if a new test seam is required to validate a moved or
  removed runtime dependency
- `docs/deployment/docker.md` only if the build/release contract changes

**Out of scope**:

- Changing the Bun base image, operating system, or application architecture.
- Removing `@mantine/hooks`, `dotenv`, printer drivers, `qz-tray`, or any
  package reached by a dynamic import.
- Removing `@rocicorp/zero`; it is used by both the client and server Zero
  handlers and needs a separate runtime-bundle investigation.
- Publishing a new image or changing Bunny deployment configuration.

## Git workflow

- Work from a dedicated branch using the repository's `codex/` prefix.
- Use Conventional Commits, for example: `perf(docker): install production dependencies in release image`.
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Establish the current image baseline

Record the current image size and final-layer size from
`ghcr.io/relicware-co/zentro-app:latest`. Confirm that the `release` stage is
the Docker build target and that migrations execute with only `drizzle-orm`
and `postgres`.

**Verify**: `docker history --format '{{.Size}}\t{{.CreatedBy}}' ghcr.io/relicware-co/zentro-app:latest` shows an approximately 801 MB `node_modules` copy layer.

### Step 2: Split build and runtime dependency installation

In `deploy/app/Dockerfile`, retain the current full `install` stage for the
`build` stage. Add a separate production-install stage that copies the root
manifest, lockfile, and workspace manifest, then runs:

```dockerfile
RUN bun install --frozen-lockfile --production --ignore-scripts
```

Change only the `release` stage to copy `node_modules` from this new stage.
Do not change the `build`, `dev`, or `migrate` stages until runtime verification
has passed; the existing `migrate` target is also a useful full-dependency tool
image for local/CI migration work.

**Verify**: build `zentro-app:optimized`; it must complete without lockfile or
workspace resolution errors.

### Step 3: Move build-only packages and remove confirmed orphans

Move `drizzle-kit`, `drizzle-seed`, and `drizzle-zero` from `dependencies` to
`devDependencies`; they are invoked only by local/CI generation, seed, and
Drizzle configuration tooling. Remove `@mantine/form` and direct `scheduler`
only after confirming no application, desktop, or build configuration imports
them. Run `bun install` so `bun.lock` reflects the manifest.

Do not move `dotenv`: the server bootstrap imports it. Do not remove
`@mantine/hooks`: `@mantine/core` declares it as a peer dependency.

**Verify**: `bunx tsc --noEmit && bun run check && bun test` all exit 0.

### Step 4: Prove the runtime image works

Build the optimized image again after the manifest changes. Run its server
with `RUN_MIGRATIONS=false` and a disposable/non-production configuration;
check that `GET /` returns a successful HTTP status. Separately execute
`bun run db:migrate` inside the release image against a disposable Postgres
database to prove the runtime retains migration dependencies.

Compare image size to the recorded baseline and inspect Docker history. Record
the before/after values in the PR description or deployment documentation.

**Verify**: the release image is materially smaller than 1,016 MB, starts the
server, and runs migrations successfully.

## Test plan

- Existing POS checkout regression: `bun test tests/pos-checkout.test.ts`.
- Full integration suite: `bun test`.
- Type and lint gates: `bunx tsc --noEmit` and `bun run check`.
- Container contract: build the Linux/amd64 image, HTTP smoke test it, and run
  migrations against disposable Postgres.

## Done criteria

- [ ] The release stage copies a production-only dependency tree.
- [ ] `drizzle-kit`, `drizzle-seed`, and `drizzle-zero` are not production
  dependencies.
- [ ] `@mantine/form` and direct `scheduler` are removed only if the source
  import audit remains empty.
- [ ] Full tests, typecheck, and Ultracite pass.
- [ ] Linux/amd64 image starts and runs migrations.
- [ ] Final image size and Docker history prove a material reduction.
- [ ] `plans/README.md` row is marked DONE.

## STOP conditions

- Stop if `bun install --production` omits a package required by `bun run
  start` or `bun run db:migrate`; do not promote that package back without
  documenting the exact runtime import.
- Stop if the optimized image cannot start or fails migrations against a
  disposable database.
- Stop if a candidate package has dynamic imports, framework peer requirements,
  or desktop-only imports not captured by the root search.
- Stop if the image size does not materially decrease after the production
  dependency split; inspect the largest dereferenced package paths before
  pursuing base-image changes.

## Maintenance notes

- Any new production CLI invoked by `scripts/docker-entrypoint.sh` must remain
  in `dependencies`; build/generation CLIs belong in `devDependencies`.
- Keep the app image tag immutable; publish only after the container smoke and
  migration checks pass.
- A future deeper optimization can investigate why `@rocicorp/zero` brings a
  large transitive tree into the app runtime, but it is deliberately out of
  scope because Zero is currently used on both client and server paths.
