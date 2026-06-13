# Zentro

Sistema de gestión comercial con punto de venta (POS), inventario, ventas, clientes, crédito, turnos, restaurantes y cocina. Multi-organización, sincronización en tiempo real con Rocicorp Zero y autenticación con better-auth.

## Características

- **POS** — catálogo, carrito, checkout, descuentos, pagos mixtos, crédito, impresión térmica y escaneo de códigos de barras
- **Ventas** — historial, filtros avanzados y detalle de transacciones
- **Inventario** — productos, categorías, Kardex y alertas de stock bajo
- **Clientes** — CRUD y búsqueda
- **Crédito** — cuentas por cobrar, ledger y pagos
- **Turnos** — apertura, cierre y arqueo de caja
- **Restaurantes** — mesas, planta y configuración del módulo
- **Cocina** — pantalla de pedidos (KDS)
- **Organización** — selección de org, miembros, invitaciones y control de acceso por módulo
- **Dashboard** — resumen operativo con agregaciones REST

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | [Vike](https://vike.dev) + [React 19](https://react.dev) (CSR, routing cliente) |
| Servidor | [Hono](https://hono.dev) vía `@vikejs/hono` |
| Datos | [Rocicorp Zero](https://zero.rocicorp.dev) (queries/mutators + `zero-cache`) |
| Lecturas efímeras | TanStack Query (dashboard, preview de join link) |
| Base de datos | [Drizzle ORM](https://orm.drizzle.team) sobre PostgreSQL |
| Auth | [better-auth](https://www.better-auth.com) con soporte multi-organización |
| UI | Tailwind CSS v4 + shadcn/ui |
| Runtime | [Bun](https://bun.sh) |
| Desktop | Electron Forge + Vite (wrapper de la web) |
| Logging | [evlog](https://evlog.dev) |
| Calidad | Ultracite (Biome) + Lefthook |

## Requisitos

- [Bun](https://bun.sh) (runtime y gestor de paquetes)
- [Docker](https://www.docker.com) (PostgreSQL local con replicación lógica para Zero)

## Desarrollo local

### 1. Instalar dependencias

```sh
bun install
```

### 2. Configurar entorno

```sh
cp .env.example .env
```

Revisa `DATABASE_URL`, `ZERO_UPSTREAM_DB`, `VITE_ZERO_CACHE_URL` y las URLs de query/mutate. Las cookies de better-auth deben reenviarse a los endpoints Zero (`ZERO_QUERY_FORWARD_COOKIES` / `ZERO_MUTATE_FORWARD_COOKIES`).

### 3. Levantar PostgreSQL y zero-cache

```sh
docker compose up -d
```

Postgres usa `wal_level=logical` (requerido por Zero). El mismo comando levanta **zero-cache** en http://localhost:4848 (réplica en el volumen `zentro_zero_data`). La app sigue en el host con `bun run dev`; zero-cache llama a `/api/zero/*` en `host.docker.internal:3000`.

Si prefieres zero-cache en proceso local en lugar del contenedor, omite el servicio `zero-cache` (`docker compose up -d postgres`) y usa `bun run zero:dev` en el paso 5.

### 4. Migrar la base de datos

```sh
bun run db:migrate
```

Opcional: `bun run db:seed` para datos de prueba.

### 5. Iniciar la app

```sh
bun run dev          # Vike + Hono en http://localhost:3000
```

Con `docker compose up -d`, zero-cache ya corre en el contenedor. Si no lo levantaste ahí, en otra terminal:

```sh
bun run zero:dev     # zero-cache en http://localhost:4848
```

### 6. App desktop (opcional)

Con la app web corriendo en `http://localhost:3000`, abre el wrapper Electron en otra terminal:

```sh
bun run desktop:dev
```

Para empaquetar, define `ZENTRO_DESKTOP_WEB_URL` con la URL pública de la web en `desktop/.env` o en el shell y ejecuta:

```sh
bun run desktop:make
```

Ver [desktop/README.md](desktop/README.md) para detalles de seguridad y configuración.

Tras cambios al schema de Drizzle (`database/drizzle/schema/*.schema.ts`):

```sh
bun run db:generate
bun run db:migrate
bun run zero:schema:gen
```

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/login` | Inicio de sesión y registro |
| `/join` | Unirse a una organización vía enlace |
| `/organization` | Selección y administración de organización |
| `/dashboard` | Panel principal |
| `/pos` | Punto de venta |
| `/posv2` | POS alternativo (v2) |
| `/shifts` | Turnos de caja |
| `/sales` | Historial y reportes de ventas |
| `/customers` | Gestión de clientes |
| `/credit` | Cuentas por cobrar |
| `/products` | Catálogo e inventario |
| `/restaurants` | Gestión de restaurante |
| `/kitchen` | Pantalla de cocina |
| `/settings` | Configuración de la organización |

## Comandos

| Comando | Descripción |
| --- | --- |
| `bun run dev` | Servidor de desarrollo |
| `bun run build` | Build de producción |
| `bun run start` | Servidor de producción (Bun) |
| `bun run check` | Lint y formato (Ultracite) |
| `bun run fix` | Auto-fix de lint/formato |
| `bun run desktop:dev` | Abrir el wrapper Electron contra la web local/configurada |
| `bun run desktop:make` | Generar instalables desktop con Electron Forge |
| `bun run test` | Tests unitarios (Bun) |
| `bun run e2e:playwright` | E2E con Playwright |
| `bun run e2e:playwright:smoke` | E2E solo specs `@smoke` |
| `bun run db:generate` | Generar migraciones Drizzle |
| `bun run db:migrate` | Aplicar migraciones |
| `bun run db:studio` | Drizzle Studio |
| `bun run zero:schema:gen` | Regenerar schema Zero desde Drizzle |
| `bun run zero:dev` | zero-cache en desarrollo |

## Tests E2E

Playwright levanta la app y zero-cache automáticamente si no hay nada escuchando en los puertos 3000 y 4848. Ver [tests/e2e/README.md](tests/e2e/README.md).

```sh
export PLAYWRIGHT_LOGIN_EMAIL=you@example.com
export PLAYWRIGHT_LOGIN_PASSWORD=your-password
export PLAYWRIGHT_ORG_NAME="Your Organization"

bun run e2e:playwright
```

## Despliegue

Producción con contenedores Docker (app Bun + zero-cache + Postgres externo con `wal_level=logical`). Guía completa en [docs/deployment/docker.md](docs/deployment/docker.md).

## Estructura del proyecto

```
pages/              Rutas Vike (+Page, +guard, +Layout)
zero/               Schema, composition roots y provider de Zero
features/           UI, lógica y slices Zero por dominio (pos, sales, products, …)
server/             Hono: auth, Zero handlers, REST auxiliares
database/drizzle/   Schema y migraciones PostgreSQL
components/ui/      Componentes shadcn/ui
tests/e2e/          Playwright E2E
deploy/             Dockerfiles y Compose de producción
desktop/            App Electron Forge que envuelve la versión web
```

Convenciones de arquitectura, Zero, Vike y comandos para contribuidores: [AGENTS.md](AGENTS.md).
