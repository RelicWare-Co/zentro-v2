# Revisión de arquitectura — Zentro v2

> Fecha: 2026-10-17 · Alcance: 78.524 líneas TS/TSX de producto + 20.134 de tests · 11 ADRs · 253 líneas de `AGENTS.md`
>
> Este documento es una opinión, no un veredicto. La intención es señalar dónde el coste marginal de la arquitectura actual va a crecer más rápido que el valor, y qué haría distinto si empezara hoy con el mismo producto.

---

## 0. Resumen ejecutivo

**Veredicto: el proyecto está por encima del 90% de los codebases de POS que se ven en producción.** La disciplina es real, no de fachada: 0 `any`, 0 `@ts-ignore`, 0 `console.*` en producto, escrituras autoritativas en servidor, dinero en enteros, 11 ADRs, 37 tests de integración y 16 specs de Playwright. Eso no se improvisa.

El problema no es la calidad del código. Es que **la forma del sistema no coincide con la forma del negocio**, y esa brecha se está pagando en tres sitios concretos:

1. **Zero se usa como bus universal de escritura.** Un motor de sincronización está haciendo de RPC, de cola de trabajos y de mecanismo de exclusión mutua (claim tokens de impresión). Eso fuerza contorsiones documentadas en el propio `AGENTS.md`: *"mutators que necesitan el grafo completo deben ser server-only/no-op en el cliente"* y *"los mutators de Zero no devuelven datos, así que el ganador del claim se confirma leyendo la fila replicada"*.
2. **Electron es un envoltorio de una URL remota.** Para un POS esto es el talón de Aquiles: sin red no hay venta (ADR-0005 lo admite), y la impresión depende de QZ Tray o de WebUSB/Serial/Bluetooth desde el navegador.
3. **El POS resolvió un god provider con 9 contextos.** Es una mejora real, pero ataca el síntoma. Un flujo de venta es una máquina de estados, no un árbol de contextos: por eso sigue habiendo un `pos-page-compat-context.tsx`, un `cart-panel.tsx` de 1.163 líneas y un ADR en estado *Proposed*.

**Lo que yo cambiaría, en una frase:** mantener el 80% del stack, separar *lecturas sincronizadas* (Zero) de *comandos de dinero* (RPC tipado idempotente), y hacer que el desktop sea el runtime real del POS en lugar de una pestaña con marco.

---

## 1. Inventario medido

| Área                   | Archivos | Líneas | Observación                                                                   |
| ---------------------- | -------: | -----: | ----------------------------------------------------------------------------- |
| `features/`            |      401 | 67.827 | 19 dominios; `pos` (12.670/72), `restaurants` (10.244/39), `admin` (8.164/37) |
| `zero/`                |       16 |  4.256 | 3.124 son `schema.gen.ts` generado                                            |
| `database/`            |       12 |  1.913 | 11 archivos de schema Drizzle                                                 |
| `server/`              |       15 |  1.494 | Solo transporte, como manda el contrato                                       |
| `pages/`               |       37 |  1.057 | Capa fina — buena señal                                                       |
| `components/` + `lib/` |       22 |  1.977 | Cross-cutting acotado                                                         |
| `tests/`               |       75 | 20.134 | 37 integración + 16 E2E                                                       |

**Ratio producto:test ≈ 3.9:1.** Sano. El problema no es cantidad, es *qué* se testea (ver §3.7).

Archivos por encima de 600 líneas que concentran riesgo: `cart-panel.tsx` (1.163), `product-imports.server.ts` (1.083), `printer-manager.client.ts` (966), `admin-product-imports-tab.tsx` (939), `local-printer-settings-card.client.tsx` (774), `restaurants.shared.ts` (753), `use-pos-table-order.ts` (729), `create-sale.server.ts` (664).

---

## 2. Lo que no tocaría

Antes de criticar, lo que está genuinamente bien y conviene defender de cualquier refactor:

- **Módulos por feature con frontera de runtime por sufijo** (`.server.ts` / `.client.ts` / `.shared.ts`). Esto es mejor que el 95% de los monolitos React que existen. La regla "lógica de dominio → feature; transporte → `server/`" es correcta y está aplicada.
- **Escrituras autoritativas en servidor.** El patrón mutator optimista + override en `*.mutators.server.ts` con `defineZentroServerMutator` extrayendo la transacción Drizzle es exactamente lo que se debe hacer con dinero.
- **Dinero en enteros (centavos), nunca floats.** Y precios congelados en `sale_item.unitPrice` / `taxRate`. Eso es contabilidad, no CRUD.
- **Desnormalización deliberada de `organizationId`** en `sale_item`, `sale_item_modifier`, `payment`, con índices. Decisión correcta para reportes multi-tenant.
- **`lib/domain-values.shared.ts` como fuente única de normalización.** Un solo lugar para `normalizeOptionalString`, `resolveTimestamp`, etc. Elimina una clase entera de bugs.
- **Cultura de documentación:** ADRs con contexto/decisión/consecuencias, `fix-log` por bug, `plans/`, `AGENTS.md` como contrato operativo. Esto es lo que hace que un equipo de 5 no se convierta en 5 codebases.
- **Módulos con entitlements** (`features/modules/`). La base para vender planes por features ya existe y está bien aislada.
- **Biome/Ultracite + lefthook + CI.** Cero deuda de formato, cero bikeshedding.

---

## 3. Los siete problemas estructurales, por coste esperado

### 3.1 Zero está haciendo de RPC, de cola y de lock distribuido

**Evidencia en el repo:**

- `AGENTS.md` §Zero: *"Haz que los mutators que necesitan el grafo completo de relaciones para contabilidad/liquidación sean server-only/no-op en el cliente"*. Es decir: el cliente ejecuta un mutator que **no hace nada**, y la verdad ocurre en el servidor. El usuario ve una escritura optimista que es ficción hasta que llega el round-trip.
- *"El ganador del claim se confirma leyendo la fila replicada (los mutators de Zero no devuelven datos)"*. Se implementó un lock distribuido con `print_claimed_by` + TTL de 2 minutos sobre una tabla replicada, porque el mutator no puede devolver un resultado.
- La cola de impresión de cocina vive en Postgres (`restaurant_kitchen_ticket` con `print_target`/`print_status`). Un ticket de cocina viaja del móvil del mesero → internet → Postgres → internet → caja, para imprimir a 3 metros de distancia.

**Por qué es el problema #1:** cada uno de esos workarounds es correcto *dado Zero*, pero juntos convierten un motor de sync en un sistema de mensajería con semántica de consistencia accidental. Y el coste crece de forma no lineal: el día que necesites devolver el `saleId` al cliente, o el `CUFE` de la factura DIAN, o el vuelto calculado por el servidor, no hay dónde ponerlo.

**Qué haría:** dos caminos de escritura explícitos.

| Camino                          | Qué pasa por ahí                                                                             | Garantías                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Zero mutators**               | UI de bajo riesgo: carrito, notas, favoritos, filtros, borradores, presencia                 | Optimista, offline-tolerante, sin valor legal                    |
| **Comandos RPC** (`oRPC` + Zod) | `create-sale`, `cancel-sale`, `close-shift`, `record-credit-charge`, `issue-fiscal-document` | Idempotente, transaccional, devuelve resultado tipado, auditable |

Los comandos no son un retroceso a oRPC: son la capa que faltó. La migración M5 eliminó `server/orpc/**` completo y con ello la capacidad de tener una operación que **devuelva algo**. Se puede tener Zero para el 80% del estado y 6 comandos RPC para el 20% que mueve dinero.

### 3.2 Electron es un envoltorio, no un runtime

`desktop/src/main.ts` carga `ZENTRO_DESKTOP_WEB_URL` y cae a `localhost:3000`. Tiene `sandbox: true`, `contextIsolation: true` y guards de navegación — bien hecho, pero es un navegador con icono propio. Las consecuencias:

- **Sin red, no hay POS.** El ADR-0005 lo reconoce y propone una cola local, pero no está implementada y no hay `idempotencyKey` en `sale` (grep de "idempot" en el repo: 0 resultados).
- **La impresión es frágil por diseño.** `@point-of-sale/webusb-receipt-printer`, `webbluetooth-receipt-printer`, `webserial-receipt-printer` + `qz-tray` + un endpoint de firma (`server/qz/`) + `qz/certs/` + un script PowerShell. Eso son **cuatro** caminos de impresión distintos, cada uno con su modo de fallo, y QZ Tray exige un daemon instalado y firma de certificados en cada máquina.
- **La lógica de impresión vive en el renderer** (`printer-manager.client.ts`, 966 líneas), donde no hay acceso fiable a drivers.

**Qué haría:** el desktop es *el* producto en el local, no un atajo.

- **Store local SQLite** (libSQL / `better-sqlite3`) con las tablas de catálogo, turno activo y ventas pendientes.
- **Cola de ventas con `idempotencyKey` UUID** desde el primer commit, no después.
- **Impresión en el proceso main** con `node-thermal-printer` / ESC-POS sobre USB, red o serial. Se elimina QZ Tray entero (y con él el daemon, los certificados y el endpoint de firma).
- **Modo contingencia explícito** con estados `pending_sync | accepted | rejected | repair_required` en la venta, como ya describe el ADR-0005 — pero implementado, no aspiracional.
- La web sigue siendo el producto para administración, reportes y catálogo público. El POS corre en desktop-first.

### 3.3 El POS: 9 contextos donde debería haber una máquina de estados

`features/pos/` son 12.670 líneas en 72 archivos, con `pos-modal-context`, `pos-catalog-context`, `pos-shift-context`, `pos-customer-context`, `pos-sale-mode-context`, `pos-cart-context`, `pos-checkout-context`, `pos-page-context`, `pos-page-compat-context`.

El ADR-0010 describe honestamente el problema (un provider de 733 líneas, `PosPageState` con 40+ campos, `useMemo` con 60+ dependencias) y propone 8 sub-contextos. Pero la causa raíz no era el tamaño del provider: era que **un flujo de venta se modeló como estado de React**. Un checkout tiene estados discretos y transiciones prohibidas:

```
idle → cart → checkout → paying → authorized → completed
                    ↓
              shift_required | credit_pending | failed(retry)
```

Eso es literalmente una máquina de estados. Modelarlo con contextos anidados obliga a codificar las transiciones en el orden de composición (`PosSaleMode` consume `modal + catalog + shift + customer`), que es exactamente el acoplamiento que el ADR intentaba eliminar. El resultado: un `useMemo` de 60 dependencias se convirtió en 8 `useMemo` de 8 dependencias, más un compat layer que sigue vivo.

**Qué haría:**

- **XState v5** para el flujo de venta (`posSaleMachine`): estados, guards (`hasOpenShift`, `isCreditAllowed`), acciones (`persistSale`, `printReceipt`). Testeable sin React, sin mocks de contexto, con visualizador.
- **Zustand** para el estado efímero que no es flujo (búsqueda, paginación, UI de modales), con selectores por campo para evitar re-renders.
- **Un solo provider** que monta la máquina y expone `usePosSelector`. Los 9 contextos desaparecen; el `cart-panel.tsx` de 1.163 líneas se parte por responsabilidad (líneas, totales, acciones).
- Efecto secundario: el ADR-0010 pasa de *Proposed* a *Superseded* y se borra el compat layer. Deuda cerrada, no diferida.


### 3.4 Un solo paquete: las fronteras de feature no las aplica el tooling

Hoy `features/` es una convención verificada por revisión humana. Nada impide que `features/pos` importe `features/admin/admin.schema.ts`. Con 401 archivos y 19 dominios, la convención aguanta hasta que no aguanta, y cuando falla ya es tarde.

Además, `bunx tsc --noEmit` compila 98k líneas de una vez, y `bun run check` recorre todo. El feedback loop crece linealmente con el repo.

**Qué haría:** monorepo con Bun workspaces + Turborepo.

```
apps/
  web/          # Vike + Hono (admin, reportes, catálogo público)
  desktop/      # Electron + SQLite + impresión nativa
  worker/       # jobs: importaciones, reportes, reintentos fiscales
packages/
  db/           # Drizzle schema + migraciones + cliente
  domain/       # puro: totales, impuestos, turnos. Cero I/O. 100% testeable
  contracts/    # Zod: inputs/outputs de comandos y queries
  sync/         # Zero: schema, slices, registries
  ui/           # Mantine theme + primitivas compartidas
  config/       # tsconfig, biome, tailwind
```

Las fronteras pasan a ser **físicas**: `packages/domain` no puede importar `packages/db` porque no está en sus dependencias. El grafo de paquetes es la documentación de la arquitectura, y Turborepo cachea typecheck/lint/test por paquete.

### 3.5 Dos sistemas de estilos, y el segundo existe por un motivo que ya no aplica

`AGENTS.md`: *"Mantine es el sistema de componentes. Tailwind v4 permanece para utilidades de layout y alias de tokens legacy"*. Y luego: *"`pages/tailwind.css` mapea alias a variables de Mantine con fallbacks **porque el renderer offline de Electron importa el CSS sin `MantineProvider`**"*.

Es decir: Tailwind sobrevive porque el shell offline de Electron no monta Mantine. Eso no es una razón para tener dos sistemas en toda la app — es una razón para arreglar el shell offline. Hoy se paga en bundle, en impredecibilidad de especificidad y en que nadie sabe qué capa controla el espaciado.

**Qué haría:** Mantine como única capa en superficies de producto; el splash de Electron se resuelve con 40 líneas de CSS propio, no con un framework de utilidades. Se borra `tailwind-merge`, `clsx` deja de ser necesario para composición condicional (Mantine tiene `classNames`/`styles`), y el CSS servido baja de forma medible.

### 3.6 Errores como strings, sin códigos, y sin idempotencia

En `create-sale.server.ts`:

```ts
throw new Error("El cliente seleccionado no existe o está inactivo");
throw new Error(`Producto no encontrado o inactivo en la organización actual: ${productId}`);
```

Tres problemas en una línea:

1. **El mensaje es la API.** No hay código (`CUSTOMER_NOT_FOUND`), así que el cliente no puede decidir qué hacer — solo mostrar el texto. En un POS, "cliente inactivo" debe abrir el selector de clientes, no un toast rojo.
2. **Sin i18n.** El texto está en español hardcodeado en el servidor.
3. **Señal de control por excepción** para casos de negocio esperados. `throw` para "producto no existe" significa que el happy path y el error comparten tipo de retorno.

Y no hay `idempotencyKey` en `sale`. El commit `fix(pos): guard sale finalize against double submit` es un guard **de cliente**: dos pestañas, un reintento de red o un timeout con escritura exitosa siguen produciendo una venta duplicada. En un POS eso es un descuadre de caja.

**Qué haría:**

- `Result<T, DomainError>` tipado (`neverthrow`) para errores de negocio; `throw` solo para lo inesperado.
- `DomainError` con `code`, `params`, `userAction`. El cliente mapea código → comportamiento, no string → toast.
- `idempotencyKey uuid unique` en `sale`, `payment`, `shift_closure` y documentos fiscales. Se genera en el cliente, se reenvía en el reintento, el servidor devuelve la venta existente si ya la procesó.
- Mensajes en el cliente, vía diccionario; el servidor solo emite códigos.

### 3.7 La deuda de superficie

Cosas pequeñas que no rompen nada pero enseñan al que llega que el repo tiene capas geológicas:

- **`database/drizzle/db.ts` exporta `dbSqlite()` que devuelve Postgres.** Es un alias de compatibilidad de una implementación anterior. Un nombre que miente es peor que un nombre feo.
- **`ts-router-project/node_modules/`** en la raíz: resto de un experimento.
- **`MIGRATION_PLAN.md` en la raíz** cuando la migración terminó en mayo. Es historia, no arquitectura; debería vivir en `docs/history/`.
- **`pos-page-compat-context.tsx`** vivo con un ADR que dice que se borra en el paso 9.
- **`zero/schema.gen.ts` versionado** y regenerado a mano. Si alguien cambia el schema Drizzle y olvida `zero:schema:gen`, el bug aparece en runtime, no en CI.
- **CI de 775 bytes**: typecheck + lint + tests. Sin `build`, sin E2E en PR, sin detección de drift de migraciones, sin chequeo de que `schema.gen.ts` esté al día.

**Qué haría:** un sprint de "limpieza de superficie" de dos días, más un CI que falle por: build roto, `schema.gen.ts` desactualizado (`git diff --exit-code` tras regenerar), migraciones sin commitear (`drizzle-kit check`), y bundle inicial por encima del presupuesto.

---

## 4. La arquitectura que yo habría hecho

### 4.1 Capas y dirección de dependencias

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web (Vike)          apps/desktop (Electron+SQLite)     │
│  ───────────────────      ──────────────────────────────     │
│  páginas, routing         shell, store local, impresión      │
└───────────────┬──────────────────────────┬──────────────────┘
                │                          │
        ┌───────▼────────┐        ┌────────▼─────────┐
        │  READS (Zero)  │        │ COMMANDS (oRPC)  │
        │  sync + cache  │        │ idempotentes     │
        │  optimista     │        │ transaccionales  │
        └───────┬────────┘        └────────┬─────────┘
                │                          │
        ┌───────▼──────────────────────────▼─────────┐
        │           packages/domain (puro)           │
        │  totales · impuestos · turnos · crédito    │
        │  sin I/O · sin React · sin DB              │
        └───────────────────┬────────────────────────┘
                            │
        ┌───────────────────▼────────────────────────┐
        │  packages/db (Drizzle + Postgres)          │
        │  packages/sync (Zero schema + slices)      │
        └────────────────────────────────────────────┘
```

**Regla dura:** `domain` no importa `db`. `db` no importa `apps`. Las features de UI no importan features de UI. Todo lo demás lo aplica el grafo de paquetes, no un documento.

### 4.2 Flujo de una venta (lo que hoy no existe explícito)

```
Cajero pulsa Cobrar
  → posSaleMachine: checkout → paying
  → cliente genera idempotencyKey (uuid v7)
  → POST /rpc/create-sale  { idempotencyKey, items, payments, shiftId }
      ├─ auth: resolveZeroAuth → orgID, role
      ├─ guard: turno abierto, caja del terminal correcta
      ├─ domain: buildPreparedItems + validateReceiptTotals (puro, testeado)
      ├─ tx:  sale + sale_item + payment + inventory_delta + credit_charge
      ├─ tx:  outbox → fiscal_document (pending) · print_job (pending)
      └─ return { saleId, receiptNumber, changeDue, fiscalStatus }
  → máquina: paying → completed
  → impresión local (desktop) o fallback PDF
  → si timeout: reintento con la MISMA idempotencyKey → devuelve la venta existente
```

Diferencia clave con hoy: **el servidor devuelve datos**. El cliente no tiene que releer la fila replicada para saber qué pasó, ni confirmar quién ganó un claim leyendo el estado del sync.

### 4.3 Dónde vive cada cosa

| Concepto | Hoy | Propuesta |
|---|---|---|
| Lecturas de catálogo, ventas, turnos | Zero `useQuery` | Zero `useQuery` (sin cambios) |
| Carrito, notas, filtros, UI | Zero mutators + 9 contextos | Zustand + XState, sin tocar el servidor |
| Crear/cancelar venta, cerrar turno, cargo a crédito | Zero mutator server-only | Comando oRPC idempotente |
| Impresión | Cola en tabla replicada + QZ/WebUSB | Job local en desktop, `pg-boss` para el servidor |
| Factura DIAN | ADR-0001 sin implementar | Bounded context con port/adapter |
| Reportes pesados | REST `/api/dashboard` | `apps/worker` + `pg-boss` + tabla materializada |

---

## 5. Stack: qué mantengo, qué cambio, qué añado

### Mantengo sin discusión

| Tecnología | Por qué |
|---|---|
| **TypeScript** (6.x) | 0 `any` en 78k líneas demuestra que la disciplina funciona |
| **Postgres** | Replicación lógica, índices, transacciones. Correcto para POS multi-tenant |
| **Drizzle** | Schema tipado, migraciones versionadas, SQL real cuando hace falta |
| **better-auth** | Organizaciones + sesiones sin reinventarlo |
| **Bun** | Runtime, test runner, install. Rápido y ya es la convención |
| **Zod v4** | Contratos isomórficos; la base de los comandos |
| **Zero** | Para lecturas sincronizadas es la mejor opción del mercado. Solo hay que dejar de pedirle lo que no hace |
| **Biome/Ultracite + lefthook** | Cero fricción, cero configuración |
| **Playwright** | 16 specs ya escritos, buena base |
| **Mantine** | Ya está adoptado y el theme está centralizado |

### Cambio

| Hoy | Propuesta | Motivo |
|---|---|---|
| Vike CSR-only | Vike con **SSR por página** en superficies públicas | `/o/@slug` es un catálogo público renderizado en cliente: invisible para Google. Vike soporta `ssr: true` por página; no hay que reescribir nada |
| Zero para escrituras de dinero | **oRPC** para comandos + Zero para reads | Ver §3.1. Devuelve resultados, permite idempotencia, no finge |
| 9 contextos de POS | **XState v5 + Zustand** | Un checkout es una máquina de estados (§3.3) |
| Mantine + Tailwind | **Solo Mantine** | El shell offline se resuelve con CSS propio (§3.5) |
| Electron envoltorio | **Electron + SQLite local + sync** | El POS debe vender sin red (§3.2) |
| QZ Tray + WebUSB/Serial/BT | **Impresión nativa en el main process** | Un camino en vez de cuatro; sin daemon ni certificados |
| `throw new Error("texto")` | **`Result<T, DomainError>` con códigos** | El cliente decide, no adivina (§3.6) |
| Un `package.json` | **Bun workspaces + Turborepo** | Fronteras físicas + cache de CI (§3.4) |
| `bun test` + Playwright | **+ fast-check** para totales e impuestos | El dinero es donde los bugs se esconden; property-based encuentra los redondeos que ningún ejemplo encuentra |


### Añado

| Tecnología | Para qué | Por qué esa y no otra |
|---|---|---|
| **pg-boss** | Jobs: importaciones de producto, reportes, reintentos fiscales | Cola sobre Postgres. No añade Redis a la infra, que ya es de por sí complicada (app + zero-cache + managed PG) |
| **XState v5** | Flujo de venta, turno, checkout | Inspeccionable, testeable sin React, con diagrama vivo |
| **OpenTelemetry + Sentry** | Trazas del comando de venta, errores de cliente | Hoy `evlog` da logs estructurados pero no hay traza de "esta venta tardó 4s, ¿en qué se fue?" |
| **fast-check** | Property tests de totales, impuestos, split payments | Complementa los 37 tests de integración con casos que nadie escribió |
| **`idempotencyKey` + outbox** | Reintentos seguros, efectos secundarios fiables | El patrón outbox resuelve impresión y fiscal sin acoplar la transacción |

### Lo que explícitamente **no** haría

- **No reescribiría en Next.js.** Vike funciona y el problema no es el router.
- **No metería microservicios.** Un POS de este tamaño en 4 servicios es un impuesto sin retorno.
- **No metería GraphQL.** Ya hay Zero + comandos tipados; GraphQL sería una tercera capa de contrato.
- **No haría event sourcing completo.** Tentador en POS, pero el coste de proyecciones y replay no se paga hasta que hay multi-sucursal con consolidación fiscal.
- **No metería Effect en todo el codebase.** Sí en `packages/domain` si el equipo lo quiere, pero imponerlo en 401 archivos existentes es un año de trabajo sin valor de producto.

---

## 6. Plan de migración (sin big bang)

Cada fase es shippable sola y se puede parar sin dejar el repo a medias.

| Fase | Qué | Esfuerzo | Señal de que valió |
|---|---|---|---|
| **0. Superficie** | Borrar `dbSqlite`, `ts-router-project`, mover `MIGRATION_PLAN.md`; CI con build + drift de migraciones + `schema.gen` al día | 2 días | CI falla si el schema generado está viejo |
| **1. Idempotencia** | `idempotencyKey` único en `sale`/`payment`; reintento devuelve la venta existente | 3 días | Test que simula doble submit concurrente y produce 1 venta |
| **2. Comandos** | oRPC para `create-sale`, `cancel-sale`, `close-shift`, `credit-charge`. Zero se queda con reads + UI | 2 semanas | El mutator de venta deja de ser `no-op` en cliente |
| **3. POS** | XState para checkout; migrar consumidores; borrar los 9 contextos y el compat layer | 3 semanas | `cart-panel.tsx` < 300 líneas; ADR-0010 *Superseded* |
| **4. Monorepo** | Extraer `packages/{db,domain,contracts,sync,ui}`; `apps/{web,desktop}` | 2 semanas | `tsc` por paquete < 5s; import cross-feature imposible |
| **5. Desktop local-first** | SQLite local, cola de ventas, impresión nativa en main, borrar QZ | 4 semanas | Vender con el WiFi apagado y reconciliar al volver |
| **6. Fiscal DIAN** | Bounded context con port/adapter; outbox; estados de documento | 4-6 semanas | ADR-0001 implementado, no aspiracional |

**Orden recomendado:** 0 → 1 → 2 → 4 → 3 → 5 → 6. El monorepo antes de tocar el POS, porque mover 12.670 líneas dentro de un paquete es mucho más seguro que moverlas mientras se reescribe el estado.

---

## 7. Métricas para saber si mejoró

Sin esto, cualquier refactor es una opinión con git history.

| Métrica | Hoy (estimado) | Objetivo |
|---|---|---|
| Archivos > 600 líneas | 8 | ≤ 3 |
| `tsc --noEmit` completo | ~20-40s | < 5s por paquete afectado |
| Venta con red caída | imposible | posible + reconciliable |
| Ventas duplicadas por doble submit | posible | imposible (unique index) |
| Bundle inicial | desconocido | medido y con presupuesto en CI |
| p95 de `create-sale` | desconocido | medido con OTel |
| Caminos de impresión | 4 | 1 |
| ADRs en *Proposed* con deuda viva | 3 | 0 |

---

## 8. Conclusión

Este proyecto no necesita una reescritura. Necesita **tres decisiones** que hoy están implícitas y deberían ser explícitas:

1. **Zero sincroniza estado; los comandos mueven dinero.** Son dos problemas distintos y merecen dos caminos.
2. **El desktop es el runtime del POS**, no una pestaña. Si el negocio no puede vender sin internet, el producto no está terminado.
3. **El flujo de venta es una máquina de estados**, no un árbol de contextos. Modelarlo bien elimina el ADR-0010 en lugar de refinarlo.

Todo lo demás —el monorepo, el SSR del catálogo, el CI, la limpieza— es consecuencia mecánica de esas tres decisiones. Y la base sobre la que se apoyan (features co-locadas, escrituras autoritativas, dinero en enteros, tests de integración, ADRs) ya está construida y es mejor que la media. Eso es lo difícil, y ya está hecho.
