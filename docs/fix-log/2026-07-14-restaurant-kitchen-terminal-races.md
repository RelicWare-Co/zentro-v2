# Correcciones de comandas: carreras terminales

## Síntoma

Una anulación enviada como corrección podía volver a marcarse lista o despachada al procesar después una línea `prepare` del ticket inicial. Además, un alta concurrente podía insertarse en una orden que acababa de cerrarse o cancelarse, dos primeras órdenes podían competir por el mismo consecutivo y el KDS aceptaba transiciones retrasadas o regresivas.

## Causa raíz

El ítem anulado conservaba el identificador del ticket anterior, por lo que la protección que compara el ticket de la línea con el ticket actual seguía coincidiendo. La reutilización de una orden abierta para agregar ítems no volvía a bloquearla antes del `INSERT`, y la creación inicial no serializaba el consecutivo por organización. Por último, el mutador de estado de cocina no validaba el estado terminal de la línea.

## Solución

- La anulación queda vinculada al ticket de corrección que la emitió.
- Las altas reutilizan una orden existente solo después de bloquearla y confirmar que sigue abierta.
- La creación de órdenes bloquea la mesa y el consecutivo de la organización para serializar altas iniciales concurrentes.
- KDS bloquea y valida que tanto el ticket como la orden permanezcan activos, espera la respuesta del servidor y no permite regresar una línea terminal.
- Se añadieron regresiones para la línea histórica tras una anulación, carreras de altas con dos transacciones y actualizaciones KDS sobre órdenes terminales o líneas ya despachadas.

## Verificación

- `bun test tests/restaurants.test.ts tests/concurrency.test.ts`
- `bunx tsc --noEmit`
- `bun run check`
- `bun test`
