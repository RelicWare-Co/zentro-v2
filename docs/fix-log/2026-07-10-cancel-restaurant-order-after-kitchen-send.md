# Cancelar órdenes de restaurante enviadas a cocina

## Síntoma

Después de enviar una orden de mesa a cocina, POSv1 solo permitía cobrarla. Si el cliente se retiraba, la mesa no podía liberarse sin crear una venta.

## Causa raíz

Los ítems enviados cambiaban de `draft` a `sent` o `ready`, y el POS bloqueaba su eliminación. El módulo de restaurantes no tenía una mutación para cancelar la orden completa.

## Solución

- Se agregó el estado `cancelled` para órdenes, ítems y tickets de cocina.
- La cancelación registra usuario, fecha y motivo en la orden, sin crear venta ni afectar inventario.
- POSv1 muestra una acción de cancelación con confirmación y motivo obligatorio para una mesa activa.
- Las consultas existentes de mesas y cocina excluyen automáticamente las órdenes que ya no están abiertas.

## Verificación

- `bun test tests/restaurants.test.ts`
- `bunx tsc --noEmit`
