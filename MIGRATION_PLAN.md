# Migración oRPC → Zero

> **Estado actual:** Fundación instalada. Aún no hay rutas migradas; `oRPC` y `Zero` coexisten.
> **Última actualización:** generada por el agente al sentar la base inicial de Zero.

Este documento reemplaza al plan anterior. Su única autoridad es el código del repositorio: si algún paso aquí queda desactualizado, ajusta el documento en el mismo cambio que lo desactualice.

## 1. Resumen de la migración

Vamos a reemplazar la API hecha con **oRPC + TanStack Query** por **Zero (Rocicorp)** como capa de sincronización query-driven sobre Postgres. El objetivo no es un *big bang*: oRPC y Zero conviven mientras movemos surface por surface (POS, sales, inventory, etc.) hacia Zero.

Reglas de oro:

- **No tumbamos oRPC hasta que la última pantalla esté en Zero.** Cada PR migra una *feature surface* completa o lo deja claramente fuera del alcance.
- **El servidor manda.** La validación, autorización y reglas de negocio viven en mutadores y queries del servidor, no en el cliente.
- **Postgres sigue siendo la fuente de la verdad.** Drizzle sigue siendo la capa SQL. Zero solo añade ZQL y sync; no intentamos *rehacer* el dominio.
- **Sin escrituras offline.** Si Zero está `disconnected`/`error`/`needs-auth`, las escrituras se rechazan. No diseñamos features que dependan de offline writes.

## 2. Stack tras la migración

| Capa | Antes | Después |
| --- | --- | --- |
| Reads/cache | oRPC + TanStack Query | Zero (`useQuery` con queries nombradas) |
| Writes | oRPC mutations | Zero `mutators` (cliente optimista + server autoritativo) |
| Permissions | Middlewares oRPC (`authMiddleware`, `requireOrgMiddleware`) | `ctx` derivado en endpoints `/api/zero/*` + filtros server-side en queries y mutators |
| DB | Drizzle (postgres-js) | Igual; Drizzle se reutiliza desde `zeroDrizzle` |
| Real-time | n/a | Sync continuo via `zero-cache` |
| OpenAPI | Scalar en `/api/docs` | Se mantiene **solo** para integraciones externas; clientes web dejan de consumirlo |

Nota: durante la migración, los componentes/feature *clients* deben evitar mezclar oRPC y Zero para los mismos datos. Una ruta vive en uno **o** en el otro, nunca medio-medio.

## 3. Arquitectura de archivos

```
src/zero/
  schema.gen.ts            # Generado por `bun run zero:schema:gen` (drizzle-zero + drizzle-zero.config.ts). NO editar a mano.
  schema.ts                # Re-export de schema.gen.ts + `zql` builder + module augmentation.
  context.ts               # ZeroContext { id, orgID, role, systemRole } compartido cliente/servidor.
  queries.ts               # Queries compartidas (cliente + servidor) usando `defineQueries`.
  mutators.ts              # Mutators compartidos (optimistic + server) usando `defineMutators`.
  mutators.server.ts       # Override server-only (validación dura, side-effects).
  db-provider.server.ts    # `zeroDrizzle(schema, db)` para el endpoint /api/zero/mutate.
  client.ts                # Helpers para construir las opciones del ZeroProvider.
  zero-provider.client.tsx # Wrapper client-only para Vike, monta <ZeroProvider>.

server/zero/
  context.server.ts        # Construye ZeroContext desde la sesión better-auth.
  handler.server.ts        # `handleQueryRequest` + `handleMutateRequest` con auth y log.
```

Convenciones:

- La app está en full CSR (`ssr: false` en `pages/+config.ts`). El servidor sigue existiendo para Hono, auth, Vike pageContext y endpoints Zero.
- `drizzle-zero.config.ts` define qué tablas/columnas entran al schema Zero. No incluir tablas better-auth con credenciales/sesiones (`account`, `session`, `verification`) ni columnas tipo token.
- Archivos `.server.ts` nunca se importan desde código cliente (Vike lo hace cumplir).
- `schema.ts`, `queries.ts`, `mutators.ts`, `context.ts` y `client.ts` son *isomórficos*: deben ser seguros para el bundle del browser. No importes Drizzle, `pg`, `postgres`, ni `auth` desde ellos.
- `mutators.ts` define la versión optimista; `mutators.server.ts` re-exporta y sobrescribe lo que necesite escribir contra Drizzle/auth/log directamente.

## 4. Endpoints de Zero en Hono

Zero requiere dos endpoints HTTP autoritativos:

- `POST /api/zero/query` → `handleQueryRequest({ handler, schema, request, userID })`.
- `POST /api/zero/mutate` → `handleMutateRequest({ dbProvider, handler, request, userID })`.

Reglas de integración con Hono:

1. Se montan **antes** del catch-all `/api/*` que sirve a oRPC.
2. Derivan `ZeroContext` con `auth.api.getSession({ headers })` y una verificación real de membresía (`member`).
3. El logger `evlog` viene de `c.get('log')` igual que en oRPC. No usar `console.*`.
4. Errores no controlados se dejan caer al `app.onError` global (mismo `parseError(...)`).

## 5. Variables de entorno

Locales (`.env`, ya configurado salvo donde se indique):

- `DATABASE_URL` – conexión Postgres usada por Drizzle/`better-auth`/migraciones.
- `ZERO_UPSTREAM_DB` – misma BD que `DATABASE_URL`, con `wal_level=logical`.
- `VITE_ZERO_CACHE_URL` – URL pública del `zero-cache` para el navegador (default `http://localhost:4848`).
- `ZERO_QUERY_URL` – debe apuntar al app server (`http://localhost:3000/api/zero/query` en dev).
- `ZERO_MUTATE_URL` – idem para `/api/zero/mutate`.

Producción:

- `zero-cache` corre en un subdominio que reciba las cookies de la app (better-auth). Evitar `SameSite=None` para cookies de auth.
- Variables `ZERO_QUERY_FORWARD_COOKIES=true` y `ZERO_MUTATE_FORWARD_COOKIES=true` son obligatorias para que `zero-cache` reenvíe las cookies de sesión al app server.

## 6. Comandos

| Comando | Qué hace |
| --- | --- |
| `bun run zero:schema:gen` | Genera `src/zero/schema.gen.ts` desde el schema de Drizzle. |
| `bun run zero:dev` | Levanta `zero-cache-dev` con `ZERO_QUERY_URL`/`ZERO_MUTATE_URL` apuntando al app server. |
| `bun run dev` | Sigue levantando Vike + Hono. Ejecutar **en otra terminal** junto a `zero:dev`. |
| `docker compose up -d` | Postgres con `wal_level=logical`. Requerido por Zero. |

## 7. Plan de migración por *surface*

Cada checklist se completa surface a surface. Marcar el ítem solo cuando esté en `main` y los tests pasen. Si una migración requiere cambios de schema, primero migra la columna en Drizzle (`bun run db:generate` + `db:migrate`) y vuelve a generar `schema.gen.ts`.

### M0 · Fundación (estado actual)

- [x] Postgres con replicación lógica vía `docker-compose.yml`.
- [x] `.env`/`.env.example` con variables Zero.
- [x] `package.json` declara `@rocicorp/zero` + `drizzle-zero` y scripts `zero:*`.
- [x] `src/zero/schema.gen.ts` generado.
- [x] `src/zero/{schema,context,queries,mutators,client,zero-provider.client}.ts` creados.
- [x] `server/zero/{context,handler}.server.ts` montados en Hono antes que oRPC.
- [x] `<ZeroProvider>` activo en `pages/(app)/+Layout.tsx` (solo rutas autenticadas, sin renderizar children fuera del provider).
- [x] `bunx tsc --noEmit` y `bun run check` verdes.

### M1 · Lecturas de catálogo (low risk)

- [ ] **Products**: query `productsByOrg`, hook `useProducts`. Reemplaza `orpcQuery.products.*.queryOptions()`.
- [ ] **Categories**: query `categoriesByOrg`.
- [ ] **Customers (read-only)**: query `customersByOrg`.

### M2 · Mutaciones simples

- [ ] **Customers (CRUD)** → mutators `customers.create/update/delete`. Borra `server/orpc/routers/customers.ts`.
- [ ] **Products (CRUD)** → mutators `products.create/update/delete`. Borra `server/orpc/routers/products.ts`.
- [ ] **Restaurants areas/tables** → mutators correspondientes.

### M3 · Flujo POS (alto riesgo, alta visibilidad)

- [ ] **Shifts open/close** → mutators con validación de caja, fold de `shiftClosure`.
- [ ] **Cash movements** → mutator atómico con shift activo.
- [ ] **Sales (create-sale)**: convertir `server/sales/create-sale.server.ts` en un mutator server-only que escribe `sale` + `saleItem` + `payment` + `inventoryMovement` en una sola transacción.
- [ ] Sustituir `useSalesPage` para que renderice desde Zero.

### M4 · Crédito y reportes

- [ ] **Credit accounts** queries + mutators.
- [ ] **Dashboard / reportes**: queries derivadas. Si los reportes son agregaciones pesadas, mantenerlos como REST en oRPC y solo leer datos primarios via Zero.

### M5 · Limpieza

- [ ] Borrar `server/orpc/routers/*` que ya estén migrados.
- [ ] Quitar `dbMiddleware` y `requireOrgMiddleware` muertos.
- [ ] Quitar dependencias `@orpc/*` del `package.json` cuando no queden consumidores.
- [ ] Eliminar `pages/+Layout.tsx → QueryClientProvider` si TanStack Query ya no se usa para datos de servidor (puede quedarse para estado client-only).

## 8. Patrones obligatorios

### 8.1 Definir una query nueva

```ts
// src/zero/queries.ts
import { defineQueries, defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from './schema';

export const queries = defineQueries({
  productsByOrg: defineQuery(
    z.object({ orgID: z.string() }),
    ({ args, ctx }) => {
      // Permission: solo leer datos de la org del usuario autenticado.
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

### 8.2 Definir un mutator nuevo

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

### 8.3 Override server-only (con Drizzle)

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
        // tx.dbTransaction.wrappedTransaction es la transacción Drizzle.
        // úsala solo si la versión optimista no aplica (validación dura, side-effects).
        await sharedMutators.customers.create.fn({ tx, args, ctx });
      },
    ),
  },
});
```

### 8.4 Consumir en React (Vike)

```tsx
// features/customers/use-customers.ts
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/src/zero/queries';

export function useCustomers(orgID: string) {
  const [rows, status] = useQuery(queries.customersByOrg({ orgID }));
  return { rows, status };
}
```

## 9. Anti-patterns

- ❌ Importar `@/database/drizzle/db` o `@/server/auth` desde archivos sin `.server.ts`.
- ❌ Pasar credenciales por args del cliente (`userID` viene **siempre** de la sesión validada en el handler).
- ❌ Usar `RPCLink`/`RPCHandler` de oRPC. El proyecto se mantiene en OpenAPI transport mientras oRPC siga vivo.
- ❌ Marcar un mutator `async` y olvidar `await tx.mutate.*` — rompe la transacción.
- ❌ Asumir escrituras offline.
- ❌ Eliminar tests de oRPC antes de tener cobertura equivalente en Zero (mutator tests + smoke).

## 10. Checklist de PR de migración

Cuando muevas una *surface*:

1. [ ] Agrega/actualiza queries y mutators compartidos (`src/zero/*`).
2. [ ] Si hay reglas de negocio duras, agrega override en `mutators.server.ts`.
3. [ ] Reemplaza los hooks `orpcQuery.<x>.*` por `useQuery(queries.<x>(...))`.
4. [ ] Borra el router/contract oRPC correspondiente (o márcalo como deprecated solo si hay consumidores externos).
5. [ ] Actualiza tests (`tests/<surface>.test.ts`).
6. [ ] Verifica `bunx tsc --noEmit` y `bun run check`.
7. [ ] Marca el ítem en este `MIGRATION_PLAN.md`.
