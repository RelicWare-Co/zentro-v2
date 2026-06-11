# Migración oRPC → Zero

> **Estado:** Migración **completa** (2026-05-23). Toda la app lee y escribe vía Zero. TanStack Query queda solo para lecturas REST efímeras (dashboard, preview de join link), wrappers `useMutation` sobre mutators Zero, y `queryClient.clear()` al cambiar sesión.
>
> **Convenciones vigentes:** [AGENTS.md](AGENTS.md) (arquitectura Zero, comandos, Vike, despliegue). Este documento conserva el historial de la migración y patrones de código de referencia.

## Resumen

| Capa | Antes | Ahora |
| --- | --- | --- |
| Reads/cache | oRPC + TanStack Query | Zero (`useQuery` con queries nombradas) |
| Writes | oRPC mutations | Zero mutators (cliente optimista + servidor autoritativo) |
| Permissions | Middlewares oRPC | `ZeroContext` en `/api/zero/*` + filtros en queries/mutators |
| DB | Drizzle (postgres-js) | Igual; `zeroDrizzle` en el endpoint mutate |
| Real-time | n/a | Sync continuo vía `zero-cache` |
| OpenAPI / Scalar | `/api/docs` | **Eliminado** — sin API oRPC pública |

Reglas que siguen vigentes:

- **El servidor manda.** Validación, autorización y reglas de negocio en mutators/queries del servidor.
- **Postgres es la fuente de verdad.** Drizzle para SQL; Zero añade ZQL y sync.
- **Sin escrituras offline.** Si Zero está `disconnected`/`error`/`needs-auth`, las escrituras se rechazan.

## Arquitectura de archivos

```
src/zero/
  schema.gen.ts            # Generado — `bun run zero:schema:gen`. NO editar.
  schema.ts                # Re-export + zql + tipos.
  context.ts               # ZeroContext { id, orgID, role, systemRole }.
  queries.ts               # defineQueries / defineQuery.
  mutators.ts              # defineMutators / defineMutator (optimistic).
  mutators.server.ts       # Overrides server-only.
  db-provider.server.ts    # zeroDrizzle(schema, db).
  client.ts                # createZeroOptions.
  zero-provider.client.tsx # <ZeroProvider> (client-only).

server/zero/
  context.server.ts        # resolveZeroAuth desde better-auth.
  handler.server.ts        # POST /api/zero/query y /api/zero/mutate.
```

Ver [AGENTS.md — Zero](AGENTS.md) para límites de importación, auth y despliegue.

## Endpoints Zero en Hono

- `POST /api/zero/query` → `handleQueryRequest`
- `POST /api/zero/mutate` → `handleMutateRequest`

Integración: `resolveZeroAuth` deriva identidad desde cookies better-auth; logging con `evlog` (`c.get('log')`).

## Variables de entorno (desarrollo)

- `DATABASE_URL` / `ZERO_UPSTREAM_DB` — Postgres con `wal_level=logical`.
- `VITE_ZERO_CACHE_URL` — URL pública de zero-cache (default `http://localhost:4848`).
- `ZERO_QUERY_URL` / `ZERO_MUTATE_URL` — callbacks al app server (`http://localhost:3000/api/zero/*`).
- `ZERO_QUERY_FORWARD_COOKIES=true` y `ZERO_MUTATE_FORWARD_COOKIES=true` — obligatorias para reenviar cookies de sesión.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `docker compose up -d` | Postgres + migraciones + zero-cache (app en host con `bun run dev`). |
| `bun run zero:dev` | zero-cache en proceso local (alternativa al contenedor). |
| `bun run zero:schema:gen` | Regenera `src/zero/schema.gen.ts` tras cambios en Drizzle. |
| `bun run dev` | Vike + Hono en `:3000`. |

## Historial de migración (completo)

<details>
<summary>M0–M5 — todas las surfaces migradas</summary>

### M0 · Fundación
- [x] Postgres con replicación lógica, schema Zero, handlers Hono, `<ZeroProvider>` en layout.

### M1 · Lecturas de catálogo
- [x] Products, categories, customers (read-only).

### M2 · Mutaciones simples
- [x] Customers, products, restaurants (reads + mutations).

### M3 · Flujo POS
- [x] Shifts, cash movements, POS catalog, sales (create/list/detail/cancel).

### M4 · Crédito y reportes
- [x] Credit, dashboard overview (REST), organization (14 endpoints).

### M5 · Limpieza
- [x] Eliminado `server/orpc/**` y dependencias `@orpc/*`.
- [x] TanStack Query consolidado en `TanstackQueryProvider` para REST efímero y mutaciones Zero.

</details>

## Patrones de referencia

### Definir una query

```ts
// src/zero/queries.ts
import { defineQueries, defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from './schema';

export const queries = defineQueries({
  productsByOrg: defineQuery(
    z.object({ orgID: z.string() }),
    ({ args, ctx }) => {
      if (!ctx || ctx.orgID !== args.orgID) {
        return zql.product.where(({ cmpLit }) => cmpLit(false, '=', true));
      }
      return zql.product
        .where('organizationId', args.orgID)
        .where('deletedAt', 'IS', null)
        .orderBy('name', 'asc');
    },
  ),
});
```

### Definir un mutator

```ts
// src/zero/mutators.ts
import { defineMutators, defineMutator } from '@rocicorp/zero';
import { z } from 'zod';

export const createCustomerArgsSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  organizationId: z.string(),
});

export const mutators = defineMutators({
  customers: {
    create: defineMutator(
      createCustomerArgsSchema,
      async ({ tx, args, ctx }) => {
        if (!ctx || ctx.orgID !== args.organizationId) {
          throw new Error('Forbidden');
        }
        const now = Date.now();
        await tx.mutate.customer.insert({
          ...args,
          createdAt: now,
          updatedAt: now,
        });
      },
    ),
  },
});
```

### Override server-only

```ts
// src/zero/mutators.server.ts
import { defineMutator, defineMutators } from '@rocicorp/zero';
import {
  createCustomerArgsSchema,
  mutators as sharedMutators,
} from './mutators';

export const serverMutators = defineMutators(sharedMutators, {
  customers: {
    create: defineMutator(
      createCustomerArgsSchema,
      async ({ tx, args, ctx }) => {
        await sharedMutators.customers.create.fn({ tx, args, ctx });
      },
    ),
  },
});
```

### Consumir en React

```tsx
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/src/zero/queries';

export function useProducts(orgID: string) {
  const [rows, status] = useQuery(queries.productsByOrg({ orgID }));
  return { rows, status };
}
```

## Anti-patterns

- ❌ Importar Drizzle, auth o `server/**` desde archivos sin `.server.ts`.
- ❌ Pasar credenciales por args del cliente (`userID` viene de la sesión en el handler).
- ❌ Olvidar `await` en `tx.mutate.*` — rompe la transacción.
- ❌ Asumir escrituras offline.
- ❌ Eliminar tests antes de tener cobertura equivalente en Zero.

## Checklist para nuevas surfaces Zero

1. [ ] Agregar/actualizar queries y mutators en `src/zero/*`.
2. [ ] Override en `mutators.server.ts` si hay reglas duras o side-effects.
3. [ ] Consumir con `useQuery` / `zero.mutate` en features.
4. [ ] Regenerar schema si hubo cambios Drizzle (`db:generate`, `db:migrate`, `zero:schema:gen`).
5. [ ] Tests en `tests/*.test.ts` o helpers `tests/helpers/zero-*.ts`.
6. [ ] `bunx tsc --noEmit` y `bun run check`.
