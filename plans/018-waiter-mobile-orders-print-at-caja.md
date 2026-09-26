# Plan 018: Órdenes de mesero desde el móvil con impresión en la caja activa

## Contexto

Un mesero debe poder tomar una orden desde su teléfono y que la comanda se
imprima en la impresora de la **caja activa** (la máquina con turno abierto y
QZ Tray + impresora configurada). La superficie del mesero debe ser
**mobile-first 100%**.

### Qué existe hoy (verificado)

- **Módulo de restaurantes completo** (`features/restaurants/`): áreas →
  mesas → órdenes → ítems (con modificadores/notas) → comandas (kitchen
  tickets) con snapshots para correcciones. Mutadores server-authoritative
  (`sendToKitchen`, `addOrderItem`, …) y queries Zero (`restaurants.layout`,
  `openOrders`, `kitchenBoard`, `tableById`).
- **Hooks POS-agnósticos reutilizables** en
  `features/restaurants/hooks/use-restaurants.ts`:
  `useRestaurantBootstrap`, `useRestaurantTableDetail`,
  `useSendRestaurantOrderToKitchenMutation`, etc.
- **Impresión 100% client-side** (`features/pos/printing/`): el navegador
  que envía a cocina imprime en SU impresora local vía QZ Tray (o WebUSB/
  Serial/Bluetooth) con fallback a PDF. El teléfono del mesero no tiene
  impresora → hoy imprimiría PDF o fallaría. El printer-manager ya
  auto-reconecta al imprimir (`reconnectSaved` interno).
- **`restaurantKitchenTicket.printedAt`** existe en el schema Drizzle y Zero
  pero **nunca se actualiza** — no hay bucle de confirmación de impresión.
- **Turnos con terminal**: `shift` tiene `terminalId`/`terminalName`. Puede
  haber **varias cajas activas simultáneamente** (usuarios distintos).
  `queries.shifts.active` = turno abierto del usuario actual → una máquina
  "sabe" que es caja porque su usuario tiene turno abierto.
- **Flujo de mesa hoy**: overlay dentro del POS desktop
  (`restaurant-pos-overlay.tsx` + `use-pos-table-order.ts` de 893 líneas,
  acoplado a los contextos del POS). Helpers compartidos extraíbles:
  `createItemMutationQueue`, `getEffectiveItemQuantity`,
  `buildOrderItemUpdateInput` (`features/pos/table-order-item-edits.shared.ts`)
  y `buildPendingKitchenPrintItems` (privado en `use-pos-table-order.ts`).
- Helpers UI compartidos: `restaurants-ui.shared.ts`
  (`getTableOccupancyStatus`, `countFloorStats`, …) y
  `restaurants.shared.ts` (`buildRestaurantBootstrap`,
  `buildRestaurantTableDetail`, `mapRestaurantKitchenTicket`).
- Settings por org: `restaurants.kitchen.printTicketsEnabled` /
  `autoPrintOnSend` (`restaurants-settings.shared.ts`). Impresora por org en
  localStorage de cada máquina (`printer-settings.local.client.ts`).
- **Los mutadores de Zero no devuelven datos al cliente**: la firma es
  `Promise<void>` y `/api/zero/mutate` responde `result: {}` salvo error. Las
  confirmaciones (p. ej. "gané el claim") deben llegar por **filas
  replicadas**, nunca por el retorno del mutador.
- **Catálogo POS reusable**: `usePosProducts`, `usePosModifierProducts` y
  `usePosCategories` (`features/pos/hooks/use-pos-catalog.ts`).
- **`useSalesWindow()`** (`features/shifts/hooks/use-shifts.ts`) expone si la
  org tiene turnos abiertos (`kind: 'open' | 'closed' | 'none'`).

### Gap

No existe: (1) superficie de mesero mobile-first, (2) mecanismo para que una
orden tomada en el teléfono se imprima en **otra** máquina (la caja activa).

## Decisiones de producto (confirmadas por el usuario)

| Pregunta | Decisión |
|---|---|
| Formato impreso en caja | **Comanda** (reusar `buildKitchenTicketDocument`) |
| Varias cajas activas | **Solo una imprime**: claim atómico con **token de claim**; la ganadora se confirma leyendo la fila replicada (Zero no devuelve resultados de mutadores) |
| Sin caja activa | **Encolar**: el ticket queda pendiente e imprime cuando una caja abra turno (si `autoPrintOnSend`) |
| Alcance fase 1 | **Mesas completo**: salón → abrir orden → ítems con modificadores/notas → enviar a cocina → ver estado de impresión. Cobro/cierre de cuenta queda solo en la caja |
| Pestaña de pedidos + sonido | La caja necesita **ver los pedidos del salón en pantalla** (pestaña "Salón" en `/pedidos`) y **alerta sonora** al llegar uno. Es el canal cuando **no hay impresora** |
| Sin impresora | El pedido llega igual a la bandeja + sonido; el cajero lo **atiende en pantalla** ("Atender sin imprimir") o imprime si la caja tiene impresora |
| `autoPrintOnSend=false` | La caja **no auto-imprime**: el ticket queda en la bandeja Salón y el cajero pulsa "Imprimir" |
| `printTicketsEnabled=false` | El pedido **sí** llega a la bandeja + sonido; no hay auto-impresión ni botón "Imprimir"; el cajero atiende en pantalla ("Atender sin imprimir") |
| Orden cerrada/cancelada con ticket pendiente | El claim lo marca `skipped`; además, cerrar/cancelar la orden marca `skipped` los pendientes de caja |

## Enfoque

### A. Relay de impresión vía Zero (sin nueva infraestructura)

La caja ya es un cliente Zero con QZ Tray e impresora configurada. Zero ya
replica las comandas. El "print job" **es** el kitchen ticket mismo.

**Schema** — columnas nuevas en `restaurant_kitchen_ticket`:

- `print_target` text NOT NULL default `'sender'` (`'sender'` = flujo actual,
  imprime quien envía; `'caja'` = encolar para la caja)
- `print_status` text nullable: `null` (legacy/sender) | `'pending'` |
  `'printing'` | `'printed'` | `'failed'` | `'skipped'`
- `print_claimed_by` text nullable — **token del intento de claim** (UUID).
  Identifica a la caja ganadora y evita duplicados entre cajas y entre
  pestañas de la misma caja.
- `print_claimed_at` timestamptz nullable — TTL de recuperación de claims
  huérfanos. **No usar `updated_at`**: cocina lo bumpea con
  `refreshKitchenTicketStatus`.
- `printed_by_terminal` text nullable (auditoría; `terminalName` del turno)
- `printed_at` ya existe

Regenerar `zero/schema.gen.ts` (`bun run zero:schema:gen`) y exponer columnas
en `drizzle-zero.config.ts`. Tickets viejos quedan `print_target='sender'`,
`print_status=null` → la caja nunca los reclama (sin inundación al desplegar).

**`sendToKitchen`**: el args schema gana `printTarget:
z.enum(['sender','caja']).optional()` (default `'sender'`). Con
`printTarget='caja'` el runner **siempre** estampa `print_target='caja'` y
`print_status='pending'` — el enrutamiento a la bandeja no depende de settings
de impresión; la impresión se gatea en el claim y en el watcher (ver
decisiones). El POS no cambia (no pasa `printTarget` → comportamiento actual
intacto).

**Mutadores server-authoritative nuevos** (runners en archivo nuevo
`features/restaurants/restaurant-print-operations.server.ts`):

- `claimKitchenTicketPrint({ ticketId, claimToken })`:
  1. `SELECT … FROM kitchen_ticket JOIN order … WHERE ticket.id/org
     FOR UPDATE` (bloquea ticket y orden: serializa con cerrar/cancelar y con
     otros claims, igual que `runUpdateRestaurantOrderItemStatus`).
  2. Valida módulo accesible, `printTicketsEnabled=true` y **usuario con turno
     abierto** (query a `shift` en la misma tx).
  3. Si la orden no está `open` o el ticket está `served/cancelled` → update
     condicional `pending/printing → skipped` y termina.
  4. Si el ticket es reclamable (`pending`, o `printing` con
     `print_claimed_at < now()-2min`) → update condicional a `printing` +
     `print_claimed_by=claimToken` + `print_claimed_at=now()`.
  5. En cualquier otro caso no escribe (otra caja es dueña).
  **No lanza por contención**: el watcher confirma leyendo la fila replicada.
- `markKitchenTicketPrinted({ ticketId, claimToken, terminalName })`:
  `printing + token → printed` + `printedAt` + `printedByTerminal`. Si no
  afecta filas (claim expirado/robado) lanza, para que la caja no asuma éxito.
- `failKitchenTicketPrint({ ticketId, claimToken })`: `printing + token →
  failed` (reintentable).
- `requeueKitchenTicketPrint({ ticketId })`: `failed → pending` + limpia claim
  (`print_claimed_by=null`, `print_claimed_at=null`). Guard: solo `failed`.
- `acknowledgeKitchenTicketPrint({ ticketId })`: `pending/failed → skipped` +
  limpia claim — "atendida sin imprimir", el camino formal de cajas **sin
  impresora** o con impresión deshabilitada. Guard: solo `pending`/`failed`.
  No exige turno (permite limpiar la bandeja desde cualquier sesión de caja;
  si se quiere restringir, reusar el guard de claim).

Todos los runners validan org + módulo y que el ticket pertenezca a la org.

**Cómo confirma la caja ganadora** (crítico, Zero no devuelve resultados):

1. El watcher ve un ticket `pending` y genera `claimToken =
   crypto.randomUUID()`.
2. Llama `claimKitchenTicketPrint` y espera `result.server`; si el server
   rechaza (sin turno, módulo apagado), descarta el intento sin toast.
3. Espera (timeout ~5 s) a que la fila replicada por `pendingPrints` muestre
   `print_status='printing'` y `print_claimed_by === claimToken`. Si no llega
   (otra caja ganó, el TTL lo recuperó o quedó `skipped`), no imprime.
4. Imprime con `printKitchenTicketAtCaja` (timeout 30 s) y llama
   `markKitchenTicketPrinted` con el token; ante error,
   `failKitchenTicketPrint` con el token.

**Query Zero nueva** `restaurants.pendingPrints` (watcher): tickets
`print_target='caja'` con `print_status IN ('pending','printing')`, ticket
`status IN ('sent','ready')`, `whereExists('order', status='open')`,
relaciones `lines`, `order.table.area`, orden por `createdAt` asc y
**`limit(50)`**; `denyQuery(zql.restaurantKitchenTicket)` sin ctx.

**Watcher de la caja** — `features/restaurants/hooks/use-caja-print-queue.client.ts`
+ componente mudo `components/caja-print-queue-watcher.client.tsx` montado en
`pages/(app)/+Layout.tsx` **con import dinámico** (el layout no es client;
mismo patrón que `ClientZeroProviderGate` en `pages/+Layout.tsx`).

Gates separados (no confundirlos):

- **Suscripción + alerta sonora**: `useActiveShift()` (turno abierto del
  usuario). Una caja sin impresora **sí** suena y notifica.
- **Claim + impresión**: además `readPosLocalPrinterSettings(orgId)` con
  `outputMode='device'` y `savedDevices[connectionType]` presente (o QZ
  `printerName`). El teléfono del cajero no reclama.
- **Auto-impresión**: además `autoPrintOnSend=true` y
  `printTicketsEnabled=true` (metadata de la org). Con
  `autoPrintOnSend=false` el watcher no reclama; el cajero imprime desde la
  bandeja. Con `printTicketsEnabled=false` no hay impresión automática ni
  manual.
- **Anti-bucle**: set de `ticketId`s intentados en la sesión (ref) +
  confirmación por token. Procesa de a uno.
- **Mapeo** de filas a `KitchenTicketPrintPayload` con el helper compartido
  `buildKitchenTicketPrintPayload` (extraído en el paso 7), no copiado.

**Skip automático**: el claim marca `skipped` tickets de órdenes
cerradas/canceladas, y `runCloseRestaurantOrder` / `runCancelRestaurantOrder`
marcan `skipped` los tickets de caja `pending/printing` al cerrar/cancelar
(evita filas pendientes eternas).

**Visibilidad para el mesero**: `printTarget`/`printStatus`/`printClaimedBy`/
`printedAt` fluyen por la query `openOrders` existente (relación
`kitchenTickets`) → chips de estado en la orden: "En cola" / "Imprimiendo" /
"Impresa ✓" / "Falló — Reimprimir" / "Omitida". Badge "Sin caja activa"
cuando `useSalesWindow().data.kind !== 'open'`.

### A2. Bandeja "Pedidos → Salón" en la caja + alerta sonora (canal sin impresora)

`/pedidos` ya es la bandeja de pedidos en línea (`features/orders`). Se
convierte en página con pestañas Mantine: **"En línea"** (inbox actual,
intacto) | **"Salón"** (nueva, componente de `features/restaurants`).

**Query Zero nueva** `restaurants.salonTickets({ from })`: tickets
`print_target='caja'` con `createdAt >= from` (inicio del día local), todas
las status de impresión, relaciones `lines`, `order.table.area`, orden desc y
**`limit(100)`**; `denyQuery` sin ctx. La bandeja la usa para el historial
(pending, printing, failed, skipped y printed de hoy).

- **`features/restaurants/components/salon-orders-inbox.tsx`**: tarjetas de
  comandas del salón con mesa/área/hora, líneas (producto, cantidad, notas,
  modificadores), chip de estado de impresión y acciones:
  - **"Imprimir"** (`pending`/`failed`, solo si la caja tiene impresora
    configurada y `printTicketsEnabled`): ejecuta el mismo camino
    claim → confirmación por token → `printKitchenTicketAtCaja` → mark/fail
    que el watcher (helper compartido), **independiente de
    `autoPrintOnSend`**. Para `failed` primero `requeue → pending`.
  - **"Atender sin imprimir"** (`pending`/`failed → skipped`) — el camino
    formal para cajas sin impresora: el pedido se atiende en pantalla.
  - **"Reimprimir"** del mesero = `requeue` (su teléfono no imprime; la caja
    lo recoge si `autoPrintOnSend` o el cajero pulsa "Imprimir").
  - Expandir detalle de la comanda en pantalla
    (`salon-ticket-detail.tsx`, reusa `buildKitchenTicketDocument`).
- Pestaña visible para miembros con módulo restaurantes accesible
  (`useModuleCapabilities`); la pestaña "En línea" no cambia.

**Alerta sonora** (`features/restaurants/salon-alert.client.ts`):

- Campana de dos tonos sintetizada con WebAudio (`OscillatorNode`) — **sin
  assets de audio**. `AudioContext` se desbloquea con la primera interacción
  del cajero; si el navegador la bloquea, no crash (best-effort).
- Gatillo: el watcher detecta tickets **nuevos** en `pendingPrints` (diff por
  id contra estado visto) → suena + notificación Mantine "Nuevo pedido del
  salón — Mesa X" con acción "Ver pedidos" → `/pedidos`.
- Gating de sonido: solo máquinas cuyo **usuario tiene turno abierto** (la
  caja); **no depende de tener impresora** (la caja sin impresora también
  suena). El teléfono del mesero (sin turno) nunca suena.
- Anti-spam: estado "visto" persistido en localStorage por org; al cargar,
  si hay backlog pendiente suena **una vez** (no una por ticket); en sesión,
  un sonido por ticket nuevo; requeue también alerta.
- `pedidos en línea` puede reusar el mismo módulo de alerta después (fuera de
  alcance aquí).

### B. Superficie mesero mobile-first

Ruta nueva `pages/(app)/restaurante/+Page.tsx` ("Salón"), ítem de nav del
módulo en `restaurants.module.ts` (`getNavigation` — icon
`utensils-crossed`, order 35, visible cuando el módulo es accesible; queda
junto a Cocina, order 36). Gate client con `useModuleCapabilities` (patrón de
la pestaña/`AppLayout`; `/kitchen` no usa ese hook, su error viene de
`buildKitchenBoard`).

Archivos nuevos en `features/restaurants/components/waiter/`:

1. **`waiter-floor-view.tsx`** — salón: pestañas/scroll horizontal de áreas,
   grid de tarjetas de mesa (reusar `getTableOccupancyStatus`,
   `countFloorStats` de `restaurants-ui.shared.ts`), botones táctiles ≥44px,
   `app-safe-area`, chip de conteo "N pendientes por enviar".
2. **`waiter-table-order-view.tsx`** — orden de la mesa: lista de ítems con
   qty ±, notas, modificadores, estado por ítem (draft/sent/ready/served);
   barra inferior fija "Enviar a cocina (N ítems)"; sección de comandas
   enviadas con chips de estado de impresión + botón "Reimprimir" en `failed`.
3. **`waiter-product-picker.tsx`** — bottom sheet (Mantine `Drawer`
   position="bottom"): búsqueda, categorías, tarjeta de producto,
   modificadores y notas por ítem. Reusa `usePosProducts`,
   `usePosModifierProducts` y `usePosCategories`
   (`features/pos/hooks/use-pos-catalog.ts`) — mismo catálogo del POS, sin
   duplicar queries.
4. **`features/restaurants/waiter-order.shared.ts`** — mover aquí
   `buildPendingKitchenPrintItems` (hoy privado en
   `use-pos-table-order.ts:229`) + extraer `buildKitchenTicketPrintPayload`
   (el mapping inline de `use-pos-table-order.ts:401-431`); POS y watcher
   importan desde aquí (refactor mínimo, sin cambio de comportamiento).
5. **`use-waiter-table-order.ts`** — hook de la superficie: reusa mutaciones
   de `use-restaurants.ts` + `createItemMutationQueue` /
   `getEffectiveItemQuantity` / `buildOrderItemUpdateInput`. NO reusa
   `use-pos-table-order` (acoplado a contextos del POS). Envío a cocina
   siempre con `printTarget: 'caja'`; el hook no puede leer el resultado del
   mutador → el estado de impresión se sigue por `openOrders`.

Creación rápida de zonas/mesas desde el salón (solo managers, mismo gate
server-side que el POS): CTA "Crear zona" cuando no hay zonas, "Crear mesa"
cuando la zona activa está vacía, botón "Agregar mesa" en el encabezado y
tarjeta quick-add al final del grid cuando hay mesas. Reusa
`restaurant-setup-dialogs.tsx` (`CreateRestaurantAreaDialog`,
`CreateRestaurantTableDialog`, `QuickAddTableCard`); los miembros no managers
ven la indicación de pedir a un administrador.

Construcción con skill `$mantine-zentro` (obligatorio para UI en este repo).
Mobile-first: viewport real, safe-area insets, acciones primarias en bottom
bar, sheets en vez de modales, sin dependencia de hover.

### C. Edge cases (resueltos)

| # | Caso | Manejo |
|---|---|---|
| 1 | Sin caja activa al enviar | Ticket queda `pending`; badge "Sin caja activa" (`useSalesWindow().data.kind !== 'open'`); al abrir turno, el watcher imprime si `autoPrintOnSend` |
| 2 | Varias cajas activas | Claim atómico (`FOR UPDATE` + update condicional) con token; solo imprime quien ve su token en la fila replicada |
| 3 | Impresora de la caja falla / QZ caído | `failed` + toast en caja + chip en mesero + "Reimprimir"/"Imprimir"; visible en bandeja Salón |
| 3b | **Caja sin impresora configurada** | No reclama, pero **sí** suena y llega a la bandeja; "Atender sin imprimir" o imprime si configura impresora |
| 3c | **Cajero con turno abierto también en su teléfono** | Suena en ambos (ambos son "caja activa" por definición del sistema); solo el dispositivo con impresora reclama. Aceptado por diseño |
| 3d | Backlog tras abrir la caja horas después | Un solo sonido de alerta al cargar (no uno por ticket); la bandeja muestra el conteo pendiente |
| 4 | Caja se queda "colgando" en printing (crash/pestaña cerrada) | TTL 2 min sobre `print_claimed_at`; el siguiente claim reclama `printing` viejo |
| 5 | Doble tap / reenvío duplicado | Ya cubierto: unique `(orderId, sequenceNumber)` + `ticketId` generado por el cliente + "no hay ítems pendientes" |
| 6 | Mesero sin conexión | Zero encola mutaciones y las envía al reconectar; banner de estado de conexión en la UI |
| 7 | Pestaña de caja en background | Zero reconecta al enfocar y drena la cola (impresión tardía pero correcta) |
| 8 | Tickets viejos con `printedAt null` | Query filtra `print_target='caja'` (columna nueva; viejos = `'sender'`) |
| 9 | Edición de ítems con comanda ya enviada | Ya resuelto por snapshots de `kitchen_ticket_line` (flujo de correcciones) |
| 10 | Orden cancelada **o cerrada** con ticket pendiente | Claim marca `skipped`; cerrar/cancelar la orden marca `skipped` los pendientes de caja; `pendingPrints` excluye órdenes no abiertas |
| 11 | Varias correcciones seguidas | Cada ticket imprime por separado (secuencia), como hoy |
| 12 | Teléfono del cajero con turno abierto | Gate local del watcher: sin impresora `device` configurada en localStorage → no reclama (sí suena: es su turno) |
| 13 | Mesero sin módulo restaurantes / sin org | `requireRestaurantModuleAccess` server-side ya existe; gate client por capabilities |
| 14 | `printTicketsEnabled=false` en la org | El pedido llega a bandeja + sonido; sin auto-impresión ni botón "Imprimir"; "Atender sin imprimir" |
| 15 | Caja en otra página (no /pos) | Watcher montado en el layout `(app)` → imprime desde cualquier página de la caja |
| 16 | `autoPrintOnSend=false` | No auto-imprime; el ticket queda `pending` y el cajero pulsa "Imprimir" en la bandeja |
| 17 | `markPrinted` no llega (offline tras imprimir) | La fila queda `printing` → TTL 2 min → posible reimpresión (duplicado aceptado antes que perder la comanda) |
| 18 | Dos pestañas de la misma caja | Compiten por el claim; el token garantiza una sola impresión |

## Archivos a modificar

**Schema / Zero**
- `database/drizzle/schema/restaurant.schema.ts` — 5 columnas nuevas
  (`print_target`, `print_status`, `print_claimed_by`, `print_claimed_at`,
  `printed_by_terminal`)
- `database/drizzle/migrations/*` — `bun run db:generate` + `bun run db:migrate`
- `drizzle-zero.config.ts` — exponer columnas
- `zero/schema.gen.ts` — regenerado (`bun run zero:schema:gen`)
- `features/restaurants/restaurants.schema.ts` — contrato Zod (printTarget en
  input; printStatus/printClaimedBy en output)
- `features/restaurants/restaurants.shared.ts` — tipos/filas de tickets;
  `mapRestaurantKitchenTicket` expone los campos de impresión

**Lógica server**
- `features/restaurants/restaurant-kitchen-tickets.server.ts` — estampar
  print_target/print_status en `runSendRestaurantOrderToKitchen`
- `features/restaurants/restaurant-print-operations.server.ts` — **NUEVO**:
  runners claim (FOR UPDATE + TTL `print_claimed_at` + guards + skip de orden
  cerrada/cancelada) / markPrinted / fail / requeue / acknowledge con token
- `features/restaurants/restaurant-order-closing.server.ts` — marcar
  `skipped` los tickets de caja `pending/printing`
- `features/restaurants/restaurant-order-cancellation.server.ts` — idem
- `features/restaurants/restaurant-mutations.server.ts` — barrel de runners
- `features/restaurants/restaurants.mutators.ts` — schemas de args + 5
  mutadores nuevos (claim/mark/fail/requeue/acknowledge)
- `features/restaurants/restaurants.mutators.server.ts` — overrides server
- `features/restaurants/restaurants.queries.ts` — `pendingPrints` y
  `salonTickets({ from })`

**Caja (watcher, bandeja y alerta)**
- `features/restaurants/printing/print-kitchen-ticket.ts` —
  `printKitchenTicketAtCaja()` sin fallback PDF (timeout 30 s)
- `features/restaurants/hooks/use-caja-print-attempt.client.ts` — **NUEVO**
  (claim → espera token → imprime → mark/fail; compartido por watcher y
  bandeja)
- `features/restaurants/hooks/use-caja-print-queue.client.ts` — **NUEVO**
- `features/restaurants/salon-alert.client.ts` — **NUEVO** (campana WebAudio +
  diff/seen-state; sin assets)
- `features/restaurants/components/salon-orders-inbox.tsx` — **NUEVO**
  (pestaña Salón: tarjetas de comandas + acciones Imprimir/Atender)
- `features/restaurants/components/salon-ticket-detail.tsx` — **NUEVO**
  (visualización en pantalla de la comanda, reusa
  `buildKitchenTicketDocument`)
- `components/caja-print-queue-watcher.client.tsx` — **NUEVO** (componente
  mudo; monta el hook + alerta)
- `pages/(app)/+Layout.tsx` — montar el watcher con import dinámico
- `pages/(app)/pedidos/+Page.tsx` — pestañas "En línea" | "Salón" (composición;
  el inbox actual se extrae a componente sin cambio de comportamiento)

**Mesero (UI mobile)**
- `pages/(app)/restaurante/+Page.tsx` — **NUEVO**
- `features/restaurants/components/waiter/waiter-floor-view.tsx` — **NUEVO**
- `features/restaurants/components/waiter/waiter-table-order-view.tsx` — **NUEVO**
- `features/restaurants/components/waiter/waiter-product-picker.tsx` — **NUEVO**
- `features/restaurants/waiter-order.shared.ts` — **NUEVO** (mueve
  `buildPendingKitchenPrintItems` + extrae `buildKitchenTicketPrintPayload`)
- `features/pos/hooks/use-pos-table-order.ts` — importa los helpers movidos
- `features/restaurants/hooks/use-restaurants.ts` — hooks de mutación nuevos
  (claim/mark/fail/requeue/acknowledge) + `printTarget` en sendToKitchen +
  hooks de `pendingPrints`/`salonTickets`
- `features/restaurants/restaurants.module.ts` — nav "Salón"
- Reusa el catálogo del POS (`usePosProducts`, `usePosModifierProducts`,
  `usePosCategories`) — sin archivo nuevo

**Tests**
- `tests/restaurants.test.ts` o `tests/restaurant-print-queue.test.ts` —
  casos nuevos (abajo)
- `tests/helpers/zero-restaurants.ts` — helpers `...ViaZero` para
  claim/mark/fail/requeue/acknowledge
- `tests/zero-registry-keys.test.ts` — agregar `restaurants.pendingPrints` y
  `restaurants.salonTickets` a `EXPECTED_QUERY_PATHS`; los 5 mutadores a
  `EXPECTED_MUTATOR_PATHS` y `EXPECTED_SERVER_MUTATOR_OVERRIDE_PATHS`

**Fuera de alcance (fase 1)**
- Cerrar cuenta / cobrar desde el móvil (queda en la caja)
- Impresión en varias cajas simultáneamente
- Rol "mesero" específico (cualquier miembro con módulo accesible)
- Reimpresión manual de comandas ya impresas desde la caja (solo `failed`)

## Reutilización (no escribir de nuevo)

- `buildKitchenTicketDocument` + `KitchenTicketPrintPayload`
  (`features/restaurants/printing/`)
- `getPosPrinterManager().printReceipt()` — ya auto-reconecta
  (`features/pos/printing/printer-manager.client.ts`)
- Mutaciones y queries de restaurantes (`features/restaurants/hooks/use-restaurants.ts`,
  `restaurants.queries.ts`) — sin duplicar
- `createItemMutationQueue`, `getEffectiveItemQuantity`,
  `buildOrderItemUpdateInput` (`features/pos/table-order-item-edits.shared.ts`)
- `getTableOccupancyStatus`, `countFloorStats` (`restaurants-ui.shared.ts`)
- `buildRestaurantBootstrap` / `buildRestaurantTableDetail` /
  `mapRestaurantKitchenTicket` (`restaurants.shared.ts`)
- `useActiveShift()` y `useSalesWindow()` (`features/shifts/hooks/use-shifts.ts`)
  para gate de caja y badge del mesero
- `usePosProducts`, `usePosModifierProducts`, `usePosCategories`
  (`features/pos/hooks/use-pos-catalog.ts`) para el selector de productos
- `useModuleCapabilities` (`features/modules/hooks/use-module-capabilities.ts`)
- Skill `$mantine-zentro` para toda la UI nueva

## Pasos

- [x] 1. Schema: columnas `print_target`/`print_status`/`print_claimed_by`/
      `print_claimed_at`/`printed_by_terminal` en `restaurant.schema.ts`;
      `bun run db:generate` + `db:migrate`; `drizzle-zero.config.ts`;
      `bun run zero:schema:gen`; contrato Zod y shared types (chips).
- [x] 2. Server: `sendToKitchen` estampa `print_target='caja'` +
      `print_status='pending'` cuando `printTarget='caja'` (sin gatear por
      settings).
- [x] 3. Server: `restaurant-print-operations.server.ts` con claim
      (FOR UPDATE + TTL `print_claimed_at` + guard turno abierto +
      `printTicketsEnabled` + skip orden cerrada/cancelada), markPrinted/fail
      con token, requeue/acknowledge; cerrar/cancelar orden marcan `skipped`
      los pendientes; wire en mutadores server; schemas Zod;
      `tests/zero-registry-keys.test.ts` actualizado.
- [x] 4. Queries `restaurants.pendingPrints` (limit 50) y
      `restaurants.salonTickets({ from })` (limit 100) + hooks en
      `use-restaurants.ts`.
- [x] 5. `printKitchenTicketAtCaja()` sin fallback PDF (timeout 30 s). Nota:
      `printReceipt()` abre cajón si `openDrawerAfterPrint` (comportamiento
      preexistente del auto-print del POS); si se quiere evitar en comandas,
      usar una variante sin apertura.
- [x] 6. Watcher `use-caja-print-queue.client.ts` + `use-caja-print-attempt.ts`
      + componente mudo montado con import dinámico en
      `pages/(app)/+Layout.tsx`; gates separados (turno / impresora /
      `printTicketsEnabled` / `autoPrintOnSend`), confirmación por token,
      anti-bucle.
- [x] 6b. Alerta sonora `salon-alert.client.tsx` (WebAudio, sin assets,
      anti-spam por localStorage) conectada al watcher; gate solo por turno
      abierto; notificación Mantine con acción "Ver pedidos".
- [x] 6c. Bandeja: extraer inbox actual de `/pedidos` a componente;
      pestañas "En línea" | "Salón"; `salon-orders-inbox.tsx` con acciones
      Imprimir / Atender sin imprimir / detalle en pantalla.
- [x] 7. Mover `buildPendingKitchenPrintItems` y extraer
      `buildKitchenTicketPrintPayload` a `waiter-order.shared.ts`; POS importa
      desde ahí; `bun test` verde.
- [x] 8. UI mesero: floor view → table order view → product picker (skill
      `$mantine-zentro`), con chips de impresión y badge "sin caja"; catálogo
      reusado del POS.
- [x] 9. Ruta `/restaurante` + nav en `restaurants.module.ts` + gate por
      capabilities.
- [x] 10. Tests de integración: claims (con segunda conexión/cliente al mismo
      `databaseUrl` — el helper usa `postgres(..., { max: 1 })` y serializa;
      o dejar explícito que es secuencial), skip de orden cerrada/cancelada,
      token obligatorio en mark/fail, requeue solo desde `failed`,
      acknowledge solo desde `pending/failed`, estampado de
      `printTarget='caja'`, límites de queries. Helpers en
      `tests/helpers/zero-restaurants.ts`.
- [x] 11. Verificación final (abajo) + fix-log
      `docs/fix-log/` si aplica (no aplica: es una feature, no un fix) +
      actualizar `plans/README.md`.

## Verificación

- [x] `bunx tsc --noEmit` → exit 0
- [x] `bun run fix && bun run check` → exit 0
- [x] `docker compose up -d postgres && bun run test` → todo pasa (incluye tests
      nuevos de print queue, registry keys y `kitchen-print-queue`); 378 pass /
      0 fail contra el Postgres local. Ojo: `bun test` a secas arrastra los
      specs de Playwright de `tests/e2e/` y falla; usar el script `bun run test`.
- [x] Revisión de código del diff sin commitear (2026-09-26) y aplicación de
      arreglos. Ver "Revisión posterior" abajo.

## Revisión posterior (2026-09-26)

Revisión estricta del diff sin commitear contra este plan. Correcciones
aplicadas:

1. **La bandeja "Pedidos → Salón" no imprimía nada.** `handlePrint` pasaba
   `() => salonTickets.data`, el array congelado en el closure del render, así
   que `waitForClaimConfirmation` nunca veía `printStatus='printing'` y
   terminaba en `skipped` sin aviso al usuario. Ahora usa un ref actualizado
   por efecto, igual que el watcher.
2. **Cada comanda abría el cajón de dinero.** `printKitchenTicketAtCaja` llamaba
   `printReceipt` heredaba `openDrawerAfterPrint`. `printReceipt` acepta ahora
   `{ openCashDrawer }` y las comandas lo pasan en `false`.
3. **Confirmación de claim y elegibilidad sin cobertura.** Extraídas a
   `features/restaurants/kitchen-print-queue.shared.ts` (puras, isomórficas) y
   cubiertas por `tests/kitchen-print-queue.test.ts` (18 casos, incluido el de
   regresión del punto 1).
4. **`attemptPrint` se recreaba en cada render** (los objetos de TanStack
   `useMutation` no son estables), lo que reiniciaba el watcher de la cola a
   mitad del procesamiento. La implementación se guarda en un ref.
5. **Claim huérfano irrecuperable.** Una fila en `printing` con
   `print_claimed_at IS NULL` no era reclamable ni en JS (exigía timestamp) ni
   en SQL (`lt` con `NULL` no es `true`), así que quedaba en `printing` para
   siempre. Ahora ambas ramas tratan `NULL` como reclamable.
6. **`accepted` no significaba "gané el claim"** (el servidor no lanza por
   contención). Renombrado a `serverAccepted`, documentado, y el hook ahora
   espera también `result.client` como el resto de mutaciones del repo.
7. `lastAttemptAt` poda sus marcadores de comandas que ya no están en cola.
   `thermal-receipt.tsx` (fondo blanco) es un cambio global de tema, no un
   cambio de impresión: queda fuera del alcance de este plan.

### Segunda tanda (2026-09-26)

8. **El arreglo del cajón no tenía test.** `printReceipt` depende del driver
   real, así que se extrajo la *decisión* a `shouldOpenCashDrawer` en
   `features/pos/printing/receipt-layout.shared.ts` (puro, isomórfico) y se
   cubrió en `tests/pos-cash-drawer.test.ts`. El caso clave es comanda +
   ajuste global `true` → `false`.
9. **`printedByTerminal` era un campo de auditoría controlado por el cliente**
   (lo enviaba el navegador en `markPrinted`). Ahora el servidor lo deriva del
   turno abierto del usuario y el parámetro `terminalName` desaparece del
   schema del mutador. Si ya no hay turno abierto se guarda `null` en vez de
   fallar: la comanda ya salió físicamente y perder el dato es preferible a
   reportar un fallo de impresión.
10. **"Comandas del salón de hoy" se congelaba al cruzar medianoche**
    (`useMemo(..., [])` se evaluaba al montar). Ahora `useStartOfToday()`
    recalcula al recuperar el foco y cada minuto.

Nota: se descartó la duda sobre el skip de `printStatus` fuera de
transacción en close/cancel. `zeroDrizzle` abre una transacción de Postgres y
expone `tx.dbTransaction.wrappedTransaction` (ver `zero/db-provider.server.ts`),
así que los statements del mutador ya son atómicos.

Pendiente de la revisión manual: la impresión real con dos clientes sigue sin
probarse en este entorno.
- [ ] Manual (pendiente en este entorno), dos clientes (navegador desktop como
      "caja" con turno abierto e impresora `device`/QZ configurada — con
      `outputMode: 'pdf'` la caja no reclama; DevTools mobile como "mesero"):
  1. Mesero abre `/restaurante`, elige mesa, agrega ítems con modificadores
     y notas, envía a cocina → la caja imprime la comanda sola y el mesero
     ve "Impresa ✓".
  2. Sin turno abierto: badge "Sin caja activa"; abrir turno en caja →
     imprime lo pendiente.
  3. Impresora de caja caída: chip "Falló" en mesero + Reimprimir funciona.
  4. Dos cajas con turno: solo una copia impresa. Dos pestañas de la misma
     caja: solo una copia.
  5. POS desktop envía a cocina como hoy (imprime local, no encola).
  6. **Caja sin impresora**: mesero envía → suena alerta + llega a
     `/pedidos → Salón`; cajero expande la comanda y "Atender sin imprimir";
     el ticket sale de la lista de pendientes.
  7. `autoPrintOnSend=false`: el ticket queda en la bandeja y el cajero
     imprime con "Imprimir".
  8. `printTicketsEnabled=false`: el pedido llega a la bandeja + suena; no
     hay botón "Imprimir"; "Atender sin imprimir" lo cierra.
  9. Orden cerrada con ticket pendiente: el ticket queda `skipped` y no se
     imprime al abrir caja.
  10. Sonido: un ticket nuevo en sesión → un sonido; backlog al cargar → un
      solo sonido; el teléfono del mesero nunca suena.
  11. Pestaña "En línea" de `/pedidos` funciona exactamente igual que antes.
  12. Responsive 360–430 px: sin overflow, botones ≥44px, safe-area en iOS.
