# Plan: correcciones del review de filtros y ordenamiento admin

## Contexto

Los cambios sin confirmar implementan la mayor parte de `plans/admin-filters-sorting.md`, pero el review encontró seis brechas antes de considerarlos listos: el filtro de módulos ignora entitlements predeterminados, las opciones de organizaciones/usuarios no escalan, faltan controles y órdenes prometidos, el resumen histórico puede devolver/renderizar datos sin límite, la tabla de ventas no permite abrir detalles con teclado y las pruebas no cubren los contratos críticos.

El objetivo de este plan es corregir esas brechas sin cambiar la regla de negocio ya adoptada: cobrado es `sum(payment.appliedAmount)` para ventas no canceladas, los listados permanecen server-side y el estado reproducible continúa en la URL.

## Enfoque

1. Calcular el estado efectivo del módulo `restaurants` al filtrar organizaciones, usando el entitlement explícito cuando exista y `defaultEntitlementStatus` cuando no exista.
2. Sustituir catálogos completos o truncados por endpoints administrativos de opciones buscables y paginadas. Los valores seleccionados deben resolverse aunque no estén en la primera página de resultados.
3. Completar los controles faltantes sin crear otro sistema de UI: verificación de email en Usuarios; creación y cobrado histórico en el orden de Organizaciones; estado en el orden de Importaciones.
4. Hacer que la tendencia del resumen use granularidad y límites según el rango, y limitar el ranking de organizaciones; conservar métricas totales server-side.
5. Convertir la apertura de venta en una acción semántica accesible mediante botón/enlace dentro de la fila, sin hacer interactiva la fila completa.
6. Añadir pruebas de builders, rutas protegidas y UI/URL que demuestren filtros, orden estable, paginación, defaults y permisos.

## Archivos a modificar

- `features/admin/admin.schema.ts` — contratos para orden histórico y consultas/respuestas paginadas de opciones.
- `features/admin/admin-query-params.server.ts` — parseo validado de búsquedas/paginación de opciones.
- `features/admin/build-admin-organizations-list.server.ts` — entitlement efectivo y orden por cobrado histórico.
- `features/admin/build-admin-overview-filtered.server.ts` — granularidad temporal y ranking acotado.
- `features/admin/build-admin-sales.server.ts` — retirar catálogos completos del payload principal.
- `features/admin/build-admin-users.server.ts` — retirar el catálogo completo de organizaciones del payload principal.
- `features/admin/components/admin-users-table.tsx` — filtro de email verificado.
- `features/admin/components/admin-organizations-tab.tsx` — orden por creación e histórico.
- `features/admin/components/admin-overview-tab.tsx` — gráfica adaptable a la granularidad y ranking limitado.
- `features/admin/components/admin-sales-tab.tsx` — opciones buscables y apertura accesible del detalle.
- `features/admin/hooks/use-admin-platform.ts`, `features/admin/hooks/use-admin-users.ts` y `features/admin/hooks/use-admin-sales.ts` — hooks de opciones paginadas/buscables.
- `features/product-imports/components/admin-product-imports-tab.tsx` — selector de organizaciones escalable y orden por estado.
- `server/admin/handler.server.ts` — endpoints de opciones y sus permisos/no-cache.
- `tests/admin-filters.test.ts` — cobertura de filtros, agregados, orden y paginación.
- `tests/e2e/admin/product-import.spec.ts` y/o un nuevo `tests/e2e/admin/admin-filters.spec.ts` — URL, accesibilidad y flujos de filtros.
- Migración e índices de Drizzle sólo si `EXPLAIN ANALYZE` demuestra una necesidad adicional; no agregar índices especulativos.

## Reutilización

- `features/admin/admin-filters.shared.ts` para paginación, fechas y límites comunes.
- `features/admin/admin-url-state.ts` para preservar parámetros desconocidos y resetear página al cambiar filtros.
- `features/admin/admin-modules.server.ts` y `features/settings/organization-environment.shared.ts` para mantener la misma semántica de entitlement efectivo que usa el resto de la aplicación.
- `features/restaurants/restaurants.module.ts` como fuente del `defaultEntitlementStatus`; no duplicar el valor `granted` en SQL o UI.
- `features/admin/components/admin-page-states.tsx` para estados de carga/error.
- Mantine `Select`, `TextInput`, `Pagination`, `ActionIcon`/`Button` y los componentes de tabla existentes; no crear primitives paralelos.
- React Query y `ADMIN_QUERY_ROOT_KEY` para caché e invalidaciones.
- Los helpers E2E de `tests/e2e/helpers/` y los patrones de locators accesibles descritos en `tests/e2e/README.md`.

## Pasos

- [x] **1. Corregir el filtro efectivo de módulos.** Cambiar la consulta de organizaciones para que `moduleKey` considere todos los módulos registrados y que `moduleStatus` compare el estado efectivo: entitlement explícito o default de la definición. Asegurar que una organización sin fila explícita aparezca al filtrar `restaurants + granted`, y que una fila `blocked` la excluya.

- [x] **2. Diseñar opciones administrativas escalables.** Añadir contratos Zod para `resource`, `search`, `page`, `pageSize` y respuesta `{ items, total, hasNext }`. Exponer endpoints protegidos para organizaciones y usuarios/vendedores; aceptar la lista de IDs seleccionados para resolver valores fuera de la página actual. Mantener límites máximos y orden estable por nombre + ID.

- [x] **3. Migrar los consumidores de opciones.** Eliminar de las respuestas principales de ventas y usuarios los catálogos completos. Conectar Select buscables con consultas debounced, conservar la opción elegida mientras cambia la búsqueda y usar el mismo endpoint en Importaciones y en el asistente de nueva importación. No limitar silenciosamente a las primeras 100 organizaciones.

- [x] **4. Completar Usuarios.** Añadir el Select triestado de email verificado/no verificado/todos conectado a `actions.setEmailVerified`, URL `u_emailVerified`, reset de página y limpiar filtros. Verificar que las tarjetas y el total correspondan a la consulta filtrada y que los labels indiquen claramente ese alcance.

- [x] **5. Completar ordenamiento.** Añadir `historicalPaidAmount` al whitelist, expresión SQL y UI de Organizaciones; ofrecer también volver a ordenar por `createdAt`. Añadir `status` al selector de orden de Importaciones. Mantener dirección asc/desc y desempate por ID en todos los casos.

- [x] **6. Acotar y adaptar el resumen.** Definir granularidad server-side: diaria para rangos cortos, semanal para rangos intermedios y mensual para histórico/rangos largos. Devolver como máximo una cantidad acotada de puntos y un ranking top-N documentado, sin alterar las métricas totales del periodo. Hacer la gráfica responsive al número de buckets, mostrar el rango/granularidad y ofrecer acceso a Organizaciones para el listado completo.

- [x] **7. Corregir accesibilidad del detalle de ventas.** Quitar la interacción `onClick` de `<Table.Tr>` y añadir una columna/acción con botón de nombre accesible `Ver detalle de venta …`. Confirmar foco visible, activación con Enter/Espacio y cierre/focus restoration del `Drawer` mediante Mantine.

- [x] **8. Ampliar pruebas de builders y contratos.** Cubrir entitlement default/override, filtro de verificación, filtros combinados, todos los campos de orden, empate por ID, segunda página, resúmenes independientes de la página, rangos abiertos/válidos y opciones buscables con más de 100 organizaciones.

- [x] **9. Probar autorización y caché de rutas.** Añadir pruebas HTTP para `/api/admin/users`, `/api/admin/sales`, detalle y opciones: platform-admin obtiene 200; usuario organizacional obtiene 403; parámetros inválidos obtienen 400; respuestas incluyen `private, no-store` y no filtran datos sensibles en logs.

- [x] **10. Completar E2E de URL y teclado.** Probar filtros individuales/combinados, orden asc/desc, cambio de página, recarga con restauración, limpiar sólo parámetros admin, organización fuera de las primeras 100 y apertura/cierre del detalle de venta usando teclado. Mantener el flujo de importación existente independiente.

- [x] **11. Validar rendimiento antes de agregar índices.** Ejecutar `EXPLAIN (ANALYZE, BUFFERS)` con datos representativos para usuarios, organizaciones, ventas, overview y opciones. Confirmar ausencia de escaneos históricos repetidos evitables y N+1. Si se agrega una migración, actualizar schema, snapshot/journal y ejecutar `bunx zero-deploy-permissions` conforme a las reglas del repositorio.

## Verificación

1. Calidad estática:
   - `bunx tsc --noEmit`
   - `bun run check`
   - `git diff --check`
2. Pruebas unitarias/integración:
   - `bun test tests/admin-filters.test.ts`
   - `bun run test`
3. E2E, con Postgres activo y Chromium instalado:
   - `bunx playwright test tests/e2e/admin/admin-filters.spec.ts`
   - `bunx playwright test tests/e2e/admin/product-import.spec.ts`
4. Validación manual:
   - abrir una URL compartida de cada pestaña, recargar y confirmar estado;
   - seleccionar una organización fuera de las primeras 100;
   - comparar `granted` por default contra override `blocked`;
   - recorrer filtros, headers, paginación y detalle exclusivamente con teclado;
   - comprobar en modo histórico que la gráfica mantiene un número acotado de puntos y que los totales coinciden con SQL.
5. Rendimiento:
   - guardar los planes `EXPLAIN ANALYZE` relevantes en la descripción del PR o evidencia de revisión;
   - confirmar límites de respuesta y ausencia de catálogos completos en los payloads principales.

## Criterio de terminado

El trabajo queda listo cuando los seis hallazgos del review están cubiertos por pruebas, ningún filtro queda truncado por un límite silencioso, las consultas mantienen orden determinista y payload acotado, y todos los comandos de verificación aplicables pasan. Si la solución de opciones requiere una decisión de producto sobre búsqueda global versus opciones dependientes de los filtros activos, detenerse y solicitar definición antes de improvisar.
