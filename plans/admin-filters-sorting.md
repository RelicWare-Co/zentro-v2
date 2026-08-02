# Plan: filtros y ordenamiento integral del panel de admin

## Contexto

La solicitud es agregar filtros y opciones de ordenamiento a todos los apartados actuales de administración y sumar una vista administrativa de ventas: resumen/dashboard, organizaciones, usuarios, importaciones y ventas. El objetivo es consultar grandes volúmenes sin cargar todo en el navegador, con métricas de ventas consistentes y una navegación reproducible.

Hallazgos iniciales:

- La página principal se compone en `features/admin/admin-page.tsx` y monta pestañas de resumen, usuarios, organizaciones e importaciones.
- Usuarios se divide entre `features/admin/components/admin-users-tab.tsx` y `features/admin/components/admin-users-table.tsx`; existe un hook dedicado en `features/admin/hooks/use-admin-users.ts`.
- Organizaciones se carga/renderiza en `features/admin/components/admin-organizations-tab.tsx` y usa `features/admin/hooks/use-admin-platform.ts`.
- El backend de plataforma está centralizado en `server/admin/handler.server.ts`, con builders separados para overview y organizaciones.
- El dominio de ventas ya tiene filtros de fecha, monto, estado, cajero, terminal, medio de pago y saldo en `features/sales/sales.schema.ts`, `features/sales/sales.queries.ts` y `features/sales/sales.shared.ts`; actualmente ordena ventas por `createdAt` descendente y usa paginación por cursor.
- Organizaciones ya exponen `createdAt`, ingresos de hoy/30 días, conteo de ventas y `lastSaleAt`, pero el endpoint devuelve todas y el nombre/slug se filtran localmente en `admin-organizations-tab.tsx`.
- Usuarios ya tienen búsqueda y paginación server-side mediante Better Auth, siempre ordenados por `createdAt` descendente; sus métricas de ventas deberán resolverse con un endpoint/consulta administrativa propia porque `listUsers` no devuelve agregados de `sale`.
- Importaciones ya tienen filtro server-side por organización y paginación offset en `loadProductImportHistory`, pero sólo ordenan por fecha descendente y la UI conserva estado local.
- El resumen ya calcula ingresos como `sale.totalAmount - sale.passThroughTotalAmount` para ventas no canceladas, mientras los reportes distinguen además ingresos netos después de impuestos; para esta iniciativa, “ingresos/ventas netas pagadas” significa `sum(payment.appliedAmount)` asociado a ventas no canceladas, incluyendo pagos parciales y excluyendo canceladas.
- El valor por defecto de los listados será últimos 30 días, con acceso explícito al acumulado histórico; cuando el administrador elija un rango, las métricas de periodo respetarán esos filtros. Las columnas históricas se mantendrán identificadas como contexto separado.
- Las métricas por usuario y organización respetarán los filtros activos; el alcance histórico sólo se mostrará como columna/preset explícito y no se mezclará silenciosamente con el rango seleccionado.
- En Usuarios, el filtro de organización se basará en membresía actual; al seleccionarlo, los usuarios mostrados serán sus miembros y sus métricas de ventas/cobros se acotarán a esa organización. La vista de ventas mantendrá un filtro independiente de organización para ventas históricas.
- Las tarjetas, tendencias y rankings de Resumen también cambiarán con los filtros activos, no sólo las tablas.
- La nueva pestaña de ventas será de consulta y detalle únicamente, sin anular ni mutar ventas desde platform-admin.
- Se decidió persistir filtros, orden y paginación en URL además del estado local, ejecutar consultas/agregados server-side y cubrir los cuatro apartados existentes más una vista de ventas administrativas.

## Decisiones funcionales

- Filtros completos por apartado: búsqueda y estado/rol en usuarios; organización, estado, fechas y métricas en ventas; nombre/slug, fechas, actividad, módulos y métricas en organizaciones; organización, formato, estado, actor y fechas en importaciones.
- Orden descendente inicial por fecha más reciente, con dirección ascendente/descendente y desempate estable por identificador. Se podrán ordenar usuarios por creación, nombre, última venta y cobrado; organizaciones por creación, nombre, última venta, cobrado del periodo, cobrado histórico y miembros; ventas por fecha, total, cobrado, organización y vendedor; importaciones por creación, finalización, estado y resultados.
- Las tarjetas, tendencias y rankings del resumen se actualizarán con el periodo/organización/filtros seleccionados; se conservará un modo “histórico” explícito para comparación.
- Si durante la implementación aparece una ambigüedad de producto no resoluble por el código (por ejemplo, una acción administrativa adicional), se detendrá antes de inventar una regla.

## Enfoque

Construir una capa administrativa server-side, tipada con Zod y protegida por `requirePlatformAdmin`, que exponga listados paginados con filtros, orden estable y agregados calculados en SQL. Mantener React Query para caché/estado de carga y sincronizar un modelo serializable de filtros con la URL; al cambiar cualquier filtro u orden, resetear la página/cursor. Centralizar una expresión/helper de ventas válidas y cobro aplicado para que overview, organizaciones, usuarios y ventas no diverjan. Usar `totalAmount - passThroughTotalAmount` sólo como importe de venta contable y `payment.appliedAmount` para “cobrado”; excluir `sale.status = cancelled` de ingresos y documentar la regla.

El paquete inicial será: usuarios con nombre/email, rol, suspendido, verificado, organización por membresía, fecha de alta, existencia/fecha de última venta y rangos de cobrado; organizaciones con nombre/slug, fecha de alta, módulos, actividad, última venta y rangos de cobrado; ventas con búsqueda, organización, vendedor, terminal, estado, fecha, medio de pago, saldo y rango de total/cobrado; importaciones con organización, formato, estado, actor, fechas y rangos de filas/resultados. El resumen compartirá periodo, organización y orden/ranking con la vista de organizaciones, sin duplicar lógica de agregación, y sus tarjetas/gráficos reflejarán la selección activa.

Reutilizar las consultas de ventas y controles existentes, pero no reutilizar a ciegas la lista de ventas org-scoped: la vista administrativa necesita `organizationId`, joins a organización/usuario/turno, agregados por usuario/organización y autorización de plataforma. Los listados de usuarios, organizaciones, ventas e importaciones deberán ordenar server-side con un desempate determinista por `id`, incluir estados vacíos/error/carga y ofrecer un botón de limpiar filtros.

Contratos y API propuestos:

- Extender `admin.schema.ts` con enums de orden por recurso, dirección, rango de fechas `YYYY-MM-DD`, filtros normalizados, `page/pageSize` acotados y respuestas con `items`, `total`, `page`, `pageSize`, `hasNext`, `summary` y `filterOptions` cuando corresponda.
- Mantener `GET /api/admin/overview`, `GET /api/admin/organizations`, `GET /api/admin/organizations/:id` y `GET /api/admin/product-imports`, pero aceptar parámetros validados y devolver agregados de la consulta; agregar `GET /api/admin/users`, `GET /api/admin/sales` y `GET /api/admin/sales/:id` para datos enriquecidos/detalle.
- Las mutaciones existentes de Better Auth seguirán usándose para crear/editar/banear/rol/password/sesiones/impersonación; el endpoint de lectura de usuarios sólo añadirá métricas y no duplicará esas acciones.
- Las métricas usarán una subconsulta agregada de pagos por `saleId`, `coalesce(sum(payment.appliedAmount), 0)`, `sale.status <> 'cancelled'` y límites de rango; filtrar por medio de pago selecciona ventas que tengan ese medio, pero el cobrado de la fila suma todos los pagos aplicados de esa venta.
- Usar paginación por página/offset acotado para conservar la navegación y URL actual de admin/importaciones, con `pageSize` máximo y orden determinista; reutilizar `useCursorListPagination` sólo donde el listado de ventas lo necesite o cuando las consultas de alto volumen lo justifiquen.
- Crear un helper de estado de URL de admin con nombres de parámetros por pestaña, valores por defecto omitidos, serialización segura y preservación de parámetros desconocidos; no usar estado global ni cargar todos los registros para filtrar en cliente.
- Para evitar que una pestaña bloqueada por usuarios impida ver el resumen, separar el loading/error de la carga inicial de usuarios y cargar cada pestaña bajo demanda o con su propio estado.

## Archivos a modificar

- `features/admin/admin-page.tsx` — agregar la pestaña administrativa de ventas y mantener navegación coherente.
- `features/admin/admin-page-context.tsx` y `features/admin/admin-url-state.ts` — estado compartido, lectura/escritura de URL, pestaña activa y filtros/paginación/orden por recurso.
- `features/admin/admin.schema.ts` y `features/admin/admin-filters.shared.ts` — contratos Zod, enums/whitelists, defaults, serialización y reglas comunes de filtros.
- `features/admin/hooks/use-admin-users.ts` y `features/admin/components/admin-users-table.tsx` — filtros/orden server-side, columnas de ventas/actividad y controles de tabla.
- `features/admin/hooks/use-admin-platform.ts`, `features/admin/components/admin-organizations-tab.tsx` y `features/admin/components/admin-overview-tab.tsx` — parámetros de consulta, controles y ordenamiento de organizaciones/rankings.
- `features/admin/build-admin-overview.server.ts` y `features/admin/build-admin-organizations.server.ts` — agregados y listados paginados server-side, incluyendo periodo de 30 días, histórico explícito y métricas de cobro aplicado.
- `features/admin/admin-sales.shared.ts` — helper server-side compartido para cláusulas de venta válida, cobro aplicado, rangos, saldo y orden whitelisted, si evita duplicación entre usuarios/organizaciones/ventas.
- `features/admin/build-admin-users.server.ts` — nuevo builder para usuarios con agregados de ventas, filtros y orden seguro; conservar Better Auth para las mutaciones CRUD existentes.
- `features/admin/build-admin-sales.server.ts` y `features/admin/components/admin-sales-tab.tsx` — nuevo listado administrativo de ventas y resumen filtrado.
- `features/admin/hooks/use-admin-sales.ts` — consulta React Query, resumen, opciones, paginación y detalle administrativo.
- `server/admin/handler.server.ts` — endpoints administrativos para usuarios/ventas y query params validados.
- `features/product-imports/product-imports.server.ts`, `features/product-imports/hooks/use-product-imports.ts` y `features/product-imports/components/admin-product-imports-tab.tsx` — filtros, orden, URL y paginación del historial.
- `features/product-imports/product-imports.schema.ts` — ampliar contrato de historial si se exponen filtros/orden.
- `features/admin/components/admin-list-controls.tsx` — controles compartidos de búsqueda, filtros, ordenar, limpiar y paginación, si el patrón se confirma al integrar.
- `database/drizzle/schema/auth.schema.ts`, `database/drizzle/schema/sales.schema.ts` y/o migraciones — sólo si el análisis de índices confirma que son necesarios para la escala.
- `tests/admin*.test.ts`, `tests/product-imports.test.ts`, `tests/sales*.test.ts` y pruebas E2E admin — cobertura de contratos, agregados, orden, paginación y permisos.

## Reutilización

- `features/admin/hooks/use-admin-users.ts` y las acciones Better Auth existentes para mantener CRUD, sesiones e impersonación; sustituir sólo la lectura del listado si hace falta enriquecerla con métricas.
- `features/admin/build-admin-overview.server.ts` y `features/admin/build-admin-organizations.server.ts` para conservar las reglas actuales de ventanas horarias y ventas no canceladas.
- `server/admin/handler.server.ts`, `requirePlatformAdmin`, `resolveDashboardTimeZone` y `features/admin/admin.schema.ts` para autorización, timezone y validación.
- `features/sales/sales.schema.ts`, `features/sales/sales.queries.ts`, `features/sales/sales.shared.ts`, `features/sales/components/sales-advanced-filters.tsx` y `features/sales/sales-formatters.shared.ts` para filtros, labels, importes, estados, paginación y formato ya probados.
- `features/reports/build-report.server.ts` y `features/dashboard/sales-aggregation.server.ts` como referencia de SQL para `grossSales`, `netRevenue`, impuestos, pagos y exclusión de canceladas.
- `loadProductImportHistory`, `ProductImportHistorySchema` y `useProductImportHistoryQuery` para el patrón de historial paginado server-side.
- `useCursorListPagination`, `buildListRangeLabel`, `Table`, `Pagination`, `Select`, `TextInput`, `Badge` y `DashboardPanelShell` antes de crear primitives nuevos.

## Pasos

- [x] Confirmar alcance inicial: resumen, organizaciones, usuarios, importaciones y nueva vista administrativa de ventas; server-side; URL + estado local.
- [x] Cerrar decisiones funcionales: filtros completos, 30 días + histórico, cobros aplicados, métricas que respetan filtros activos, URL + estado local, server-side y ventas sólo consulta/detalle.
- [x] Inventariar tablas, relaciones, índices, consultas, endpoints y componentes de cada apartado; definir los filtros de organización por membresía y el alcance de métricas por ventas.
- [x] Diseñar contratos Zod compartidos: filtros por pestaña, campos de orden permitidos, dirección, paginación, rangos/periodos, `total`, agregados y opciones de filtros; mantener compatibilidad de detalle y mutaciones existentes.
- [x] Crear el helper de ventas admin y builders de usuarios/ventas; adaptar overview/organizaciones/importaciones con whitelist de orden, desempate por `id`, joins/agregados SQL, timezone validado y límites máximos.
- [x] Agregar endpoints Hono, parseo de query params, respuestas no-cache privadas y logs de recurso/filtros sin registrar información sensible.
- [x] Integrar sincronización URL/estado, pestaña activa, reset de página al cambiar filtros/orden, filtros avanzados, headers clicables, indicadores de orden, limpiar filtros y opciones server-side.
- [x] Añadir estados de carga/error/vacío, mantener overlays y acciones existentes, y abrir detalle de organización/venta sin perder el contexto de consulta.
- [x] Añadir pruebas unitarias/integración para cobros parciales, crédito, cancelaciones/reversiones, filtros combinados, orden, totales independientes de la página y aislamiento de platform-admin; añadir E2E para URL y UI.
- [x] Verificar índices y planes de consulta con datos representativos, regresiones y consistencia entre resumen, organizaciones, usuarios y ventas.

## Verificación

- Tests enfocados de admin, usuarios, ventas y consultas/agregados.
- `bunx tsc --noEmit` y `bun run check`.
- E2E con filtros individuales, filtros combinados, orden ascendente/descendente, rangos sin resultados, paginación y recarga/URL.
- Validación manual de permisos de platform-admin y aislamiento por organización; comprobar que un usuario con rol organizacional sin `systemRole=admin` recibe 403 y que un administrador no ve datos fuera de los filtros seleccionados.
- Manual: abrir una URL con filtros/orden/página, recargar y compartirla; verificar que la selección se restaura, que limpiar filtros elimina sólo los parámetros de admin y que cambiar filtros vuelve a la primera página.
- Manual: comparar cobro aplicado de una venta pagada, crédito parcial, crédito sin pago y venta cancelada; verificar que las reversiones de una cancelación no vuelven a sumar.
- Rendimiento: usar datos representativos, revisar `EXPLAIN`/`EXPLAIN ANALYZE`, confirmar límites de respuesta, ausencia de consultas N+1 y agregar índices/migración sólo cuando el plan lo justifique.
