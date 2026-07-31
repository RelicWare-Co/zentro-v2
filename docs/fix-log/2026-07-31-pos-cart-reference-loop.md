# POS cart reference loop

## Symptom

Abrir una mesa ocupada o agregar el primer producto podía provocar un bucle de renders en el checkout POS y el error de actualización máxima de React.

## Cause

`useRestaurantTableDetail` reconstruía el detalle de la mesa, `usePosTableOrder` producía un nuevo carrito y `usePosCheckout` reiniciaba la mutación de venta al detectar solo el cambio de referencia. El efecto de métodos de pago también podía devolver un array nuevo sin cambios reales.

## Solution

`usePosCheckout` ahora compara una firma estable de los datos semánticos del carrito antes de llamar a `reset()`, incluyendo líneas, productos, cantidades, precios, impuestos, descuentos, notas y modificadores. La proyección de `useRestaurantTableDetail` quedó memoizada y el efecto de métodos de pago conserva el array actual cuando ningún método cambió.

## Verification

- `bun test tests/*.test.ts` — 328 passed.
- `bunx tsc --noEmit` — passed.
- `bun run check` — passed.
- `git diff --check` — passed.
