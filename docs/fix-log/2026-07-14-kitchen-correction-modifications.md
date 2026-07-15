# Correcciones de cocina como modificaciones

## Síntoma

Cambiar el comentario o la cantidad de un ítem ya enviado a cocina se mostraba
como una anulación seguida de una nueva preparación. Las reducciones sólo
mostraban el delta, sin indicar la cantidad anterior y la nueva.

## Causa raíz

Las líneas inmutables de `restaurant_kitchen_ticket_line` sólo distinguían
`prepare` y `cancel`. Un cambio de comentario generaba ambas líneas y un cambio
de cantidad se reducía a un delta absoluto; el KDS, la impresión y el resumen
del POS las mostraban de forma independiente.

## Solución

- Se agregó la operación inmutable `modify` con instantáneas de cantidad,
  comentario y modificadores anteriores.
- Las correcciones de un ítem enviado crean una sola línea `modify`; las altas
  y anulaciones reales conservan `prepare` y `cancel`.
- El KDS y la impresión muestran la modificación, incluyendo transiciones como
  `2 → 1`, y permiten confirmarla sin cambiar el estado de preparación del
  ítem.
- El resumen de envío del POS separa modificaciones de altas y anulaciones.

## Verificación

- `bun test tests/kitchen-ticket.test.ts tests/restaurants.test.ts tests/concurrency.test.ts`
- `bun run check`
- `bunx tsc --noEmit`
