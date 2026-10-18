# Server crashes at boot after upgrading `@vikejs/hono` to 0.4

## Symptom

`bun run start` exited immediately with:

```text
error: [@vikejs/hono] Wrong installation: GET /api/zero/context was registered
before vike(app), but vike(app) should be called before registering the app's
routes — see https://vike.dev/server
```

`bunx tsc --noEmit` and `bun run build` passed, so the regression only appeared
on a real boot.

## Cause

`@vikejs/hono` 0.4 mounts Vike's server handlers through `app.notFound()` and
installs a guard middleware. `assertNoRouteBefore()` throws when any concrete
route was registered before `vike(app)` (`node_modules/@vikejs/hono/dist/index.js`).
`server/hono.ts` called `vike(app, [dbMiddleware])` at the end, after every
`app.route(...)`.

## Solution

Moved `vike(app, [dbMiddleware])` above the better-auth handler and all API
routes in `server/hono.ts`, with a comment explaining the ordering constraint.
The evlog middleware and `app.onError()` stay before it: `app.use()` registers
`ALL`/`*` and does not trip the check, so logging still wraps every request.

## Verification

- `bun run build` then `bun run start` boots without errors.
- `curl /` → 301 to `/dashboard`, `/login` → 200 HTML, `/api/zero/context` → 200,
  `/api/auth/ok` → 200.
