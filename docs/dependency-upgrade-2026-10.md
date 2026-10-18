# Actualización de dependencias — octubre 2026

Rama: `chore/dependency-upgrade` (sin commit al momento de escribir esto).

## Resultado

- **51 paquetes** actualizados a su última versión publicada (raíz + workspace `desktop`).
- Todo el árbol queda en `latest` **excepto `ultracite`** (7.8.3 → 8.0.1), diferido con plan en la sección [Diferido](#diferido-ultracite-8).
- Gates verdes tras los cambios: `bunx tsc --noEmit`, `bun run check`, `bun run build`, `bun run zero:schema:gen`, `bun run db:generate`, `bun run desktop:check` y `bun run desktop:package`.
- Se detectaron **4 breaking changes reales** que ni el typecheck ni el build detectaban (arranque del server, better-auth, encoder térmico y empaquetado desktop). Todos resueltos y verificados en runtime.

## Matriz de versiones

### Raíz

| Paquete                                       | Antes            | Después | Tipo                                     |
| --------------------------------------------- | ---------------- | ------- | ---------------------------------------- |
| `@mantine/core` · `hooks` · `notifications`   | 9.5.1            | 9.7.3   | minor                                    |
| `@point-of-sale/receipt-printer-encoder`      | 3.0.3            | 4.0.1   | **major**                                |
| `@point-of-sale/webbluetooth-receipt-printer` | 2.0.0            | 2.1.0   | minor                                    |
| `@rocicorp/zero`                              | 1.9.0            | 1.11.0  | minor                                    |
| `@tanstack/react-query`                       | 5.101.4          | 5.104.4 | patch                                    |
| `@tanstack/react-table`                       | 8.21.3           | 9.3.1   | **major**                                |
| `@tanstack/react-virtual`                     | 3.14.10          | 3.14.21 | patch                                    |
| `@universal-middleware/core`                  | 0.4.18           | 0.7.1   | **major 0.x**                            |
| `@vikejs/hono`                                | 0.2.1            | 0.4.1   | **major 0.x**                            |
| `better-auth`                                 | 1.7.1            | 1.7.10  | patch (breaking de facto)                |
| `dotenv`                                      | 17.4.2           | 18.0.8  | **major**                                |
| `drizzle-orm`                                 | 0.45.2           | 0.45.4  | patch                                    |
| `evlog`                                       | 2.26.0           | 2.33.0  | minor                                    |
| `hono`                                        | 4.13.3           | 4.13.13 | patch (requerido por `@vikejs/hono` 0.4) |
| `lucide-react`                                | 1.33.0           | 1.59.0  | minor                                    |
| `qz-tray`                                     | 2.2.6            | 2.3.0   | minor                                    |
| `react` · `react-dom`                         | 19.2.8           | 19.3.1  | minor                                    |
| `tailwind-merge`                              | 3.6.0            | 3.7.0   | minor                                    |
| `vike`                                        | 0.4.260          | 0.4.268 | patch (pin exacto)                       |
| `vike-react`                                  | 0.6.26           | 0.6.29  | patch                                    |
| `zod`                                         | 4.4.3            | 4.6.7   | minor                                    |
| `@biomejs/biome`                              | 2.5.2            | 2.5.15  | patch (pin exacto)                       |
| `@playwright/test`                            | 1.62.1           | 1.64.1  | minor                                    |
| `@rolldown/plugin-babel`                      | 0.2.3            | 0.2.4   | patch                                    |
| `@types/node`                                 | 26.2.0           | 26.6.5  | minor                                    |
| `@types/react` · `@types/react-dom`           | 19.2.18 / 19.2.4 | 19.3.0  | minor                                    |
| `@vitejs/plugin-react`                        | 6.1.0            | 6.1.2   | patch                                    |
| `bun-types`                                   | 1.4.0            | 1.4.3   | patch                                    |
| `drizzle-kit`                                 | 0.31.10          | 0.31.11 | patch                                    |
| `drizzle-zero`                                | 0.19.0           | 0.21.0  | **major 0.x**                            |
| `lefthook`                                    | 2.1.10           | 2.2.2   | minor                                    |
| `node-gyp`                                    | 13.0.1           | 13.1.0  | minor                                    |
| `postcss`                                     | 8.5.26           | 8.5.30  | patch                                    |
| `typescript`                                  | 6.0.3            | 7.0.2   | **major**                                |
| `vite`                                        | 8.2.2            | 8.3.4   | minor                                    |

### `desktop/`

| Paquete                           | Antes         | Después       | Tipo        |
| --------------------------------- | ------------- | ------------- | ----------- |
| `electron`                        | 42.3.0        | 44.9.0        | **major**   |
| `@electron-forge/*` (11 paquetes) | 7.11.2        | 8.0.1         | **major**   |
| `@electron/fuses`                 | 1.8.0         | 2.1.3         | **major**   |
| `@types/node`                     | 25.9.3        | 26.6.5        | **major**   |
| `typescript`                      | 6.0.3         | 7.0.2         | **major**   |
| `vite` · `@vitejs/plugin-react`   | 8.2.2 / 6.1.0 | 8.3.4 / 6.1.2 | minor/patch |

## Breaking changes revisados y cómo se resolvieron

### 1. `@vikejs/hono` 0.4 exige llamar `vike(app)` antes de registrar rutas

- **Cambio:** desde 0.4 el adaptador monta los handlers de Vike con `app.notFound()` y añade un guard en la cadena de middlewares; si encuentra una ruta concreta registrada antes, lanza en el arranque: `Wrong installation: GET /api/zero/context was registered before vike(app)`.
- **Impacto:** el server de producción arrancaba y moría; `build` y `tsc` pasaban igual.
- **Solución:** en `server/hono.ts`, `vike(app, [dbMiddleware])` se mueve antes de `/api/auth/*` y de todos los `app.route(...)`.
- **Lockstep obligatorio:** `@vikejs/hono` 0.4.1 declara peers `vike ^0.4.268` y `hono ^4.13.13`, por eso los cuatro (`vike`, `@vikejs/hono`, `hono`, `@universal-middleware/core`) se subieron juntos.
- **Notas de `vike` 0.4.268:** requiere Vite ≥ 7.1 (usamos 8.3.4) y cambia la sintaxis de rutas de `+middleware` a rou3 1.x (`*` captura el resto del path). El repo no tiene archivos `+middleware` con path, así que no aplica.

### 2. `better-auth` 1.7.10 rechaza `account.issuer` con `SCHEMA_MISMATCH`

- **Cambio:** 1.7.0–1.7.2 añadieron `account.issuer` obligatorio; **1.7.3 lo revirtió**. Desde entonces better-auth valida el schema en runtime y falla toda request si encuentra una columna obligatoria que nunca escribe.
- **Impacto:** `/api/auth/*` devolvía 500 (`Required columns Better Auth never writes: account.issuer`).
- **Solución:** se quita `issuer` del schema Drizzle y su índice único, y se genera la migración `0025_rich_red_wolf.sql` (dropea índice y columna). Nadie en el código leía esa columna.

### 3. `receipt-printer-encoder` 4 lanza si el mapping de codepage no aplica al lenguaje

- **Cambio:** v4 valida `codepageMapping` contra la tabla del lenguaje. `star-prnt` solo acepta `star`; `star-line` no tiene tabla y además explota con `codepageMapping: undefined` (`Object.keys(undefined)`).
- **Impacto:** cualquier impresión a impresora Star habría lanzado `Unknown codepage mapping` (el default histórico era `epson` para todos los lenguajes). Es un fallo que solo aparece en hardware real.
- **Solución:** `resolveCodepageMapping(language, value)` en `encode-thermal-receipt.client.ts`: whitelist para `esc-pos`, `star` para `star-prnt`, opción omitida para `star-line`. Los valores libres de settings que no existan caen a `epson` en vez de romper la impresión.
- **Extra:** v4 ya publica tipos, así que se eliminó la declaración ambiente del encoder en `types/pos-printer.d.ts` (se conservan las de `-status`, `webserial` y `webbluetooth`).
- **Verificación:** smoke test ejecutado con las 4 combinaciones de layout × 3 lenguajes; todas generan bytes.
- **Pendiente de hardware:** v4 cambia el flujo de bytes (sin comandos de estilo redundantes, sin line feed en líneas de solo estado, tablas validadas contra el ancho de papel). Conviene reimprimir un ticket real en 58 mm y 80 mm antes de promover.

### 4. `@tanstack/react-table` 9 exige registro explícito de features

- **Cambio:** `useReactTable` → `useTable`, features declarativas (`tableFeatures`), `getVisibleCells()` pasa a depender de `columnVisibilityFeature`.
- **Solución en `products-table.tsx`:** `tableFeatures({ rowPaginationFeature, paginatedRowModel: createPaginatedRowModel() })`, `createColumnHelper<typeof features, Product>()`, columnas envueltas en `columnHelper.columns([...])` (necesario para que infiera los tipos por columna) y `row.getAllCells()` en lugar de `getVisibleCells()` (la tabla no tiene visibilidad de columnas configurada).
- No se usó la capa `@tanstack/react-table/legacy` a propósito: incluye todas las features y deja el bundle más grande que v8.

### 5. `electron-forge` 8 es ESM-only y emite `.cjs`

- **Cambios que aplican:** `main` y `preload` se emiten como `.cjs`; `@electron-forge/plugin-fuses` exige `@electron/fuses` 2.x; Node ≥ 22.17; el plugin de Vite sale de experimental y apunta a Vite 8.
- **Solución:** `desktop/package.json` → `"main": ".vite/build/main.cjs"` y `desktop/src/main.ts` → `preload: path.join(__dirname, "preload.cjs")`.
- **Verificación:** `bun run desktop:package` completa y genera `.vite/build/main.cjs` + `preload.cjs`.
- **Electron 44:** se revisaron las breaking changes (clipboard reescrito y fuera del renderer, macOS 12 fuera, sin ia32/armv7l, `setBadgeCount`/`setProgressBar` eliminados). El main process no usa ninguna de esas APIs.

### 6. `typescript` 7 (port nativo)

- **Cambios relevantes:** no hay API programática en 7.0; `types: []` por defecto; `rootDir` por defecto `./`; `strict` por defecto `true`; se eliminan `moduleResolution: node/classic`, `baseUrl`, `esModuleInterop: false`, entre otros.
- **Impacto en el repo:** el `tsconfig.json` ya declara `strict`, `types` y `moduleResolution: Bundler`, y no usa `baseUrl`. `tsc`, `drizzle-kit generate`, `drizzle-zero generate`, `vike build` y `electron-forge package` funcionan con 7.0.2.
- **Riesgo abierto:** cualquier herramienta futura que haga `require("typescript")` fallará. Si pasa, el patrón soportado es aliasar: `"typescript": "npm:@typescript/typescript6@^6"` + `"@typescript/native": "npm:typescript@^7"`.

### 7. `dotenv` 18

Quita `.env.vault`, el preload y los tips; el log de inyección va a stderr. Solo se usa `config()` en `playwright.config.ts` y `desktop/forge.msix.ts`; se añadió `quiet: true` para no ensuciar la salida de Playwright.

### 8. `drizzle-zero` 0.21

El schema generado gana `uniqueKeys` por tabla (aditivo, sin cambios de API). `zero/schema.gen.ts` se regeneró y el diff son solo esas líneas.

### 9. `@biomejs/biome` 2.5.15

Cambió el formato de `test.each([...] as const)(...)` (2 archivos de test reformateados) y activó `noUnsafeOptionalChaining` (1 caso en `tests/reports.test.ts`, corregido leyendo el valor a una variable antes de castear).

## Diferido: ultracite 8

`ultracite` 8.0.1 exige `@biomejs/biome ^2.5.0` (compatible) pero **activa reglas nuevas que el repo no cumple**: 3.852 diagnósticos.

| Regla                                       | Casos | ¿Auto-fix?                      |
| ------------------------------------------- | ----- | ------------------------------- |
| `assist/source/useSortedKeys`               | 2.965 | sí (reordena claves de objetos) |
| `lint/performance/noJsxPropsBind`           | 536   | no                              |
| `lint/style/useDestructuring`               | 120   | parcial                         |
| `lint/style/useConsistentMethodSignatures`  | 52    | no                              |
| `lint/suspicious/noUnnecessaryConditions`   | 50    | no                              |
| `lint/suspicious/noShadow`                  | 33    | no                              |
| `lint/performance/noAwaitInLoops`           | 25    | no                              |
| `lint/suspicious/noLeakedRender`            | 21    | no                              |
| `lint/suspicious/noEqualsToNull`            | 16    | no                              |
| `lint/style/noIncrementDecrement`           | 14    | parcial                         |
| `lint/style/useErrorCause`                  | 7     | no                              |
| `lint/correctness/noUndeclaredDependencies` | 6     | no                              |
| Otros                                       | ~12   | mixto                           |

Adoptar 8 en el mismo cambio que la actualización de versiones habría producido un diff de ~3.000 objetos reordenados y ~500 refactors de JSX, imposible de revisar junto al bump. Se mantiene `ultracite` 7.8.3 en raíz y `desktop/` (misma versión en ambos, para no partir el estándar).

### Plan de adopción

**Fase 0 — preparación (hecho)**  
`ultracite` 7.8.3 + `@biomejs/biome` 2.5.15, `bun run check` verde.

**Fase 1 — `useSortedKeys` (PR propio, mecánico)**

1. Subir `ultracite` a 8.0.1 en una rama dedicada.
2. `bun run fix` para aplicar las 2.965 ordenaciones.
3. Revisar el diff por directorio (`features/`, `server/`, `tests/`) — el orden de claves no cambia comportamiento, pero sí puede mover líneas en snapshots o fixtures.
4. Verificar `tsc`, `build` y `bun test`.
5. Si el ruido es inaceptable, alternativa: desactivar solo esa acción en `biome.jsonc` con un override y documentarlo.


**Fase 2 — `noJsxPropsBind` (decisión de producto)**  
La regla marca cada handler inline (`onClick={() => ...}`), que es el patrón dominante en el repo y que React Compiler ya memoiza (`"use no memo"` solo aparece donde se desactiva). Opciones:

- (a) desactivarla en `biome.jsonc` para `features/**/*.tsx` y documentar el motivo;
- (b) refactor caso por caso con `useCallback`/handlers estables (~536 sitios).  
  Recomendación: (a), porque el repo depende de React Compiler y (b) no aporta rendimiento medible.

**Fase 3 — resto de reglas (~200 casos)**  
Orden por riesgo: `useErrorCause` (7) y `noEqualsToNull` (16) primero (correctitud), luego `noShadow` (33) y `noUnnecessaryConditions` (50), luego `useDestructuring` (120) y `useConsistentMethodSignatures` (52), al final `noAwaitInLoops` (25) y `noLeakedRender` (21).  
`noUndeclaredDependencies` (6) puede requerir declarar deps reales en `desktop/package.json`.

**Fase 4 — higiene del preset**  
Revisar los cambios de 8.0.0 que no son reglas: `AGENTS.md` como fuente única de reglas para agentes (`ultracite init` migra bloques), `compat/compat` a error con targets "Baseline widely available" (definir `browserslist` propio si hace falta) y reglas type-aware ahora opt-in.

**Criterio de cierre:** `bun run check` verde con `ultracite@8` y sin overrides nuevos salvo los documentados en `biome.jsonc`.

## Verificación ejecutada

| Comando                                              | Resultado                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `bunx tsc --noEmit` (raíz)                           | OK                                                                                             |
| `bunx tsc --noEmit` (`desktop/`)                     | OK                                                                                             |
| `bun run check` / `bunx ultracite check .` (desktop) | OK                                                                                             |
| `bun run build`                                      | OK                                                                                             |
| `bun run zero:schema:gen`                            | OK (solo `uniqueKeys` nuevos)                                                                  |
| `bun run db:generate`                                | OK (`No schema changes`)                                                                       |
| `bun run start` + `curl`                             | `/` → 301 a `/dashboard`, `/login` → 200 HTML, `/api/zero/context` → 200, `/api/auth/ok` → 200 |
| `bun run desktop:package`                            | OK (emite `main.cjs` y `preload.cjs`)                                                          |

**No ejecutado (bloqueado por entorno):**

- `bun test` — requiere Postgres (`docker compose up -d postgres`); Docker no estaba corriendo.
- Playwright E2E — requiere app + zero-cache + DB.
- `bun run zero:dev` y zero-cache en runtime.
- `desktop:make` / `desktop:make:msix` — requieren firma y, para MSIX, Windows + Windows SDK.

## Follow-ups

1. **Runtime con DB real:** levantar Postgres y zero-cache, correr `bun test` y el E2E smoke; verificar Zero 1.11 en el flujo POS (el bump 1.9 → 1.11 pasó typecheck y build, pero no se ejercitó contra zero-cache).
2. **Impresión real:** reimprimir un ticket en 58 mm y 80 mm con impresora ESC/POS y Star para validar el nuevo flujo de bytes de v4.
3. **Unicidad de `account`:** al dropear `account_issuer_accountId_uidx` queda sin índice único. Antes de añadir `uniqueIndex(providerId, accountId)`, comprobar duplicados:


   ```sql
   SELECT provider_id, account_id, count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;
   ```
4. **Desktop en Windows:** `desktop:make:win` y MSIX no se validaron en esta máquina.
5. **TypeScript 7:** si alguna herramienta futura necesita la API programática, usar el alias a `@typescript/typescript6` documentado arriba.
