# Maestro E2E (web)

End-to-end flows for Zentro in the browser via [Maestro](https://maestro.mobile.dev).

## Prerequisites

1. Postgres: `docker compose up -d`
2. App: `bun run dev` (default `http://localhost:3000`)
3. Zero cache (for authenticated data): `bun run zero:dev`
4. Maestro CLI installed (`brew install mobile-dev-inc/tap/maestro`)

## Environment

Set credentials before running flows that sign in or pick an organization:

```bash
export MAESTRO_BASE_URL=http://localhost:3000
export MAESTRO_LOGIN_EMAIL=you@example.com
export MAESTRO_LOGIN_PASSWORD=your-password
export MAESTRO_ORG_NAME="Your Organization Name"
```

Optional for `auth/create-organization.yaml`:

```bash
export MAESTRO_NEW_ORG_NAME="Maestro Test Store"
```

See `.env.example` for documented variable names.

## Commands

```bash
bun run e2e:maestro          # all flows
bun run e2e:maestro:smoke    # flows tagged smoke
bun run e2e:maestro:validate # static YAML checks (no browser)
```

## Layout

| Path | Purpose |
|------|---------|
| `auth/` | Login, register, org selection, org creation |
| `products/` | Product CRUD smoke flows |
| `subflows/` | Shared steps (not run directly) |
| `config.yaml` | Discovery, tags, defaults, output dir |

Flows are isolated: each top-level flow launches the app and signs in when needed.

After login, org selection is detected by the heading **Elige Cómo Quieres Entrar** (not the badge alone).

Product flows target `data-testid` on the create-product sheet (`product-form-name`, `product-form-price`, etc.). Do not use `tapOn: "0"` — precio, costo, impuesto y stock comparten el placeholder `0` y Maestro puede enfocar el campo equivocado (p. ej. nombre).
