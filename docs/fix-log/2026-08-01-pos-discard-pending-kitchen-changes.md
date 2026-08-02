# Descarte seguro de cambios pendientes en mesas POS

## Síntoma

Salir de una mesa después de cambiar cantidad, nota, cancelar un ítem enviado o agregar un producto en borrador no restauraba el pedido original. Al volver a entrar quedaban cambios pendientes y el cobro podía ser rechazado. Las mutaciones en vuelo también podían continuar después de abandonar la mesa.

## Causa raíz

`usePosTableOrder.exitTable()` sólo limpiaba refs y la cola local. Las ediciones ya habían sido persistidas en `restaurant_order_item`, mientras los snapshots enviados a cocina permanecían intactos. Además, `clear()` no esperaba ni cancelaba promesas encadenadas.

## Solución

- Se agregó el mutator Zero `discardPendingKitchenChanges`, con una operación server-side idempotente que bloquea la orden abierta.
- Los ítems enviados se restauran desde `sentQuantity`/`sentNotes`, las cancelaciones pendientes se desmarcan y los ítems `draft` se eliminan.
- Los tickets históricos no se modifican.
- La salida espera la cola (`drain`) y sólo limpia la sesión después de la confirmación del servidor.
- Se agregaron estados y guards para impedir nuevas ediciones, envíos, cobros o cambios de mesa durante el descarte.
- POS muestra confirmación con resumen de altas, modificaciones y cancelaciones; cancelar conserva la mesa y los errores permiten reintentar.
- Las rutas de cobro y cancelación exitosas conservan una limpieza local separada.

## Verificación

- `bun test tests/table-order-item-edits.test.ts tests/restaurants.test.ts`
- `bunx tsc --noEmit`
- `bun run check`
