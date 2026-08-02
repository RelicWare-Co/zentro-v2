# Plan: correcciones de mesa y salida segura

## Contexto

El flujo actual permite editar ítems de una mesa ya enviada a cocina. La mutación actualiza `restaurant_order_item` inmediatamente, mientras `sentQuantity`/`sentNotes` conservan el estado enviado. Al pulsar **Salir**, el POS sólo limpia el estado local; no revierte la mutación persistida. La mesa reaparece con cambios pendientes y el cierre/cobro es rechazado hasta enviar o resolver la corrección.

También existe una cola por ítem en `features/pos/table-order-item-edits.shared.ts`; `clear()` sólo elimina referencias de la cola y no cancela promesas ya iniciadas o encadenadas.

## Decisión

- Si no hay cambios pendientes, **Salir** abandona la mesa inmediatamente.
- Si existen altas en borrador, cambios de cantidad/notas o cancelaciones de ítems enviados, **Salir** muestra: «Hay cambios sin enviar. ¿Deseas descartarlos?».
- **Cancelar** mantiene al usuario en la mesa sin modificar nada.
- **Descartar** espera la cola, ejecuta `discardPendingKitchenChanges` y abandona sólo si el servidor confirma.
- Si el servidor falla, la mesa permanece abierta y se permite reintentar.

## Enfoque

Mantener el modelo actual de mutaciones inmediatas, pero agregar una operación server-authoritative `discardPendingKitchenChanges` que restaure el snapshot enviado (`sentQuantity`, `sentNotes`, `sentModifiersSnapshot`) y quite `pendingCancellation`; los ítems `draft` pendientes se eliminan sin tocar tickets históricos. La interfaz decide entre salida inmediata y confirmación usando `hasPendingKitchenChanges`; al confirmar el descarte, la salida espera las mutaciones en vuelo antes de restaurar. Así se corrigen tanto la persistencia accidental como la carrera de la cola sin convertir el flujo de envío a cocina en una operación local nueva.

## Archivos a modificar

- `features/pos/hooks/use-pos-table-order.ts` — ciclo de vida de edición, salida, restauración y cola de mutaciones.
- `features/pos/table-order-item-edits.shared.ts` — contrato de snapshots/cola cancelable y helpers puros.
- `features/restaurants/restaurant-order-items.server.ts` — restauración server-authoritative de cambios pendientes.
- `features/restaurants/restaurant-mutations.server.ts` — exponer la operación de restauración si se incorpora un mutator nuevo.
- `features/restaurants/restaurants.mutators.ts` — schema/mutator Zero para descartar correcciones.
- `features/restaurants/restaurants.mutators.server.ts` — registro de la mutación server-side.
- `features/restaurants/hooks/use-restaurants.ts` — hook para ejecutar la mutación y esperar confirmación del servidor.
- `features/pos/components/cart-panel.tsx` — estado/confirmación y acción visible de descarte, si aplica.
- `features/pos/sale-modes/types.ts`, `features/pos/sale-modes/counter-sale-adapter.ts`, `features/pos/pos-cart-context.tsx`, `features/pos/pos-page-compat-context.tsx` y `features/restaurants/table-sale-mode.ts` — ciclo de vida asíncrono y nuevas capacidades de sesión/adaptador.
- `tests/table-order-item-edits.test.ts` — pruebas de snapshot, descarte y cancelación de cola.
- `tests/restaurants.test.ts` — pruebas de persistencia, restauración y cierre de orden.
- `docs/fix-log/YYYY-MM-DD-...md` — síntoma, causa raíz, solución y verificación.

## Reutilización

- Separar en `usePosTableOrder` la salida con descarte de la limpieza terminal usada después de cobrar/cancelar.
- `useTableSaleAdapter.exit()` para esperar el descarte y resetear pagos/descuento junto con la mesa.
- `runUpdateRestaurantOrderItem()` y `lockOpenRestaurantOrder()` para mantener validaciones y autoridad server-side.
- `hasPendingKitchenChange()` / `buildRestaurantOpenOrder()` para conservar la definición existente de cambios pendientes.
- `waitForZeroMutation(..., { awaitServer: true })` en `features/restaurants/hooks/use-restaurants.ts`.
- Componentes Mantine existentes (`Modal`, `Button`, `Textarea`) y los patrones de `CartPanel`.

## Pasos

- [x] Confirmar que **Salir** abandona inmediatamente si no hay pendientes y pide confirmación antes de descartar altas en borrador, cambios de cantidad/notas y cancelaciones pendientes.
- [x] Agregar `discardPendingKitchenChanges` al contrato Zero y delegarlo a una operación server-side que bloquee la orden abierta, restaure ítems `sent` desde sus snapshots y elimine ítems `draft` pendientes; la operación debe ser idempotente y no modificar tickets históricos.
- [x] Añadir el hook de mutación con `awaitServer: true`, propagando errores sin abandonar la mesa si el servidor no confirma el descarte.
- [x] Modelar el estado de salida (`isDiscardingChanges`) en `usePosTableOrder`; capturar el `orderId`, drenar la cola de mutaciones antes del descarte y limpiar refs/cola/mesa sólo después del éxito. Mantener rutas separadas para cierre/cancelación exitosos, que ya terminan la orden y no deben intentar restaurarla.
- [x] Impedir nuevas ediciones, envíos, cobros o cambios de mesa durante el descarte; convertir `SaleModeAdapter.exit`, `enterTableMode` y `exitTableMode` en operaciones esperables, manteniendo una limpieza local separada para las rutas de cobro/cancelación ya completadas.
- [x] Integrar en `CartPanel` y sus variantes móvil/escritorio un modal de confirmación con el resumen de altas en borrador, modificaciones y cancelaciones; `Cancelar` conserva la mesa, `Descartar` muestra carga y deshabilita duplicados, y los errores permiten reintentar sin salir.
- [x] Cubrir cantidad, nota, cancelación de ítem enviado y alta en borrador; verificar que salir y reentrar muestra el estado enviado, que enviar una corrección sí la conserva y que cobrar deja de quedar bloqueado mediante las pruebas de restaurantes y de cola.
- [x] Añadir el fix log y ejecutar las verificaciones enfocadas y globales.

## Verificación

- `bun test tests/table-order-item-edits.test.ts`
- `bun test tests/restaurants.test.ts`
- `bunx tsc --noEmit`
- `bun run check`
- Prueba manual/E2E: abrir mesa sin pendientes → pulsar salir; verificar salida inmediata.
- Prueba manual/E2E: abrir mesa → enviar a cocina → cambiar cantidad/nota, agregar borrador y marcar cancelación → pulsar salir; verificar el diálogo, que Cancelar no modifica nada y que Descartar restaura el último estado enviado antes de abandonar.
- Prueba manual/E2E: editar → enviar corrección → salir → volver a entrar; verificar que la corrección sí permanece y el pedido no queda bloqueado.
- Prueba manual/E2E: eliminar/restaurar un ítem enviado y verificar que no queda oculto permanentemente.
