# Restaurar zonas especiales de restaurantes

## Síntoma

Las organizaciones que ya tenían activo el módulo de restaurantes antes de
agregar las zonas `Domicilios` y `Recogida` no las recibían automáticamente.

## Causa raíz

El alta idempotente de zonas sólo se ejecutaba al guardar la configuración de
la organización con el módulo de restaurantes habilitado. El cambio que agregó
las zonas no incluyó un backfill de datos para organizaciones existentes.

## Solución

- Se agregó una mutación protegida para administradores y owners que crea sólo
  las zonas especiales faltantes.
- Ajustes muestra el botón **Crear zonas faltantes** cuando Restaurantes está
  activo.
- La operación es idempotente: conserva las zonas existentes y no duplica
  `Domicilios` ni `Recogida`.

## Verificación

- `bun test tests/restaurants.test.ts`
- `bunx tsc --noEmit`
- `bunx ultracite check features/restaurants/restaurant-areas.server.ts features/restaurants/restaurants.mutators.ts features/restaurants/restaurants.mutators.server.ts features/restaurants/hooks/use-restaurants.ts features/restaurants/components/restaurant-module-settings-card.tsx tests/helpers/zero-restaurants.ts tests/restaurants.test.ts`
