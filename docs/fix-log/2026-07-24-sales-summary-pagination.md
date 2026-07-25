# Totales de ventas dependían de la paginación

## Síntoma

En la página de ventas, la cantidad de ventas, el ingreso y el saldo
pendiente cambiaban al cargar otra página o aumentar la cantidad de filas
visibles. Esto afectaba tanto la vista del turno actual como el historial
completo.

## Causa raíz

`SalesPageProvider` calculaba las métricas reduciendo
`salesQuery.data.data`. Esa colección contiene únicamente la página
solicitada por el cursor y el límite de la lista, no todas las ventas que
coinciden con los filtros. Por eso las métricas crecían conforme se cargaban
más registros.

## Solución

- Se agregó un resumen autoritativo en
  `features/sales/build-sales-summary.server.ts`. Este agrega en PostgreSQL
  todas las ventas que coinciden con los filtros, independientemente de la
  paginación.
- Se expuso el resumen mediante `POST /api/sales/summary` y se consume con
  TanStack Query.
- La clave del resumen excluye cursor y tamaño de página, por lo que navegar
  o cambiar la cantidad de filas no modifica las métricas.
- Los contadores y tarjetas ahora usan `salesCount`, `totalRevenue` y
  `totalPending` del resumen.
- Las mutaciones de creación y cancelación invalidan el resumen después de
  confirmarse en el servidor.

## Verificación

```sh
DATABASE_URL=postgresql://zentro:zentro@localhost:5432/zentro \
  bun test tests/sales-summary.test.ts
```

La prueba carga una y tres filas del mismo turno y verifica que el resumen
permanezca en tres ventas y 60.000 de ingreso. También verifica el total
histórico de cuatro ventas y 100.000.
