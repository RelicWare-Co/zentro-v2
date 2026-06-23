# Plan de migración shadcn → Mantine

> **Estado:** Migración funcional completa; documentación y convenciones futuras actualizadas.
> **Decisión final:** Mantine es el sistema de componentes y theme. Tailwind v4 coexiste como capa utilitaria/layout y aliases de tokens legacy.
> **Stack relevante:** React 19, Vike (`ssr: false`, client-rendered), Mantine **9.3.2**, Tailwind v4.

## Registro de progreso

- **Fase 1 (fundación) — ✅** `MantineProvider` (`forceColorScheme="light"`) en `pages/+Layout.tsx`,
  `lib/mantine-theme.ts` (escalas `voltage`/`carbon`, radius 0.625rem, overrides `theme.components`,
  `mantineCssVariablesResolver`), `postcss.config.cjs`
  con `postcss-preset-mantine` (pipeline propio, separado de `@tailwindcss/vite`).
  `@mantine/core/styles.css` importado antes de `tailwind.css`.
- **Decisión del eje — Modalidad A (coexistencia).** El POC de `customers` confirmó que Mantine
  (estructura/comportamiento) + Tailwind (layout/spacing) conviven sin conflicto de reset en
  build. Los estilos oscuros puntuales de superficies POS/modales se preservan con overrides
  centralizados en `lib/mantine-theme.ts` (`theme.components`, `classNames`, `styles`).
  Se mantiene `sonner` por ahora.
- **Fase 3 — ✅ completa.** Todas las features del plan migradas a Mantine (Modalidad A):
  `customers`, `credit`, `restaurants`, `auth` (no-op: 100% Tailwind), `settings`, `products`,
  `organization`, `dashboard` (charts siguen en recharts), `pos`/`posv2` (flujo crítico).
  Además `kitchen` (página suelta fuera de la tabla del plan). tsc + ultracite + build OK en cada commit.
- **Combobox** (Popover+Command shadcn): migrado a `Select searchable` (filtros) y al primitivo
  `Combobox` de Mantine (customer-picker con trigger e ítems custom de dos líneas).
- **Patrones POS:** inputs con estilo de marca preservado vía `classNames={{ input }}`; vaul Drawer
  móvil → Mantine `Drawer position="bottom"`; `Button asChild`+Link → `Button component={Link}`.

- **Features fuera de la tabla del plan — ✅** `shifts`, `sales`, `admin` migradas (mismos patrones).
  `admin` mantiene un helper local de tabla por dentro (era el único punto pendiente, ver abajo);
  `dropdown-menu`→`Menu` de Mantine en `admin-users-table`.
- **Misceláneos — ✅** `zero-connection-boundary` (Button) y `data-table-pagination`
  (ActionIcon/Select) migrados a Mantine.
- **Fase 6 (limpieza) — ✅** Eliminados **58** archivos `components/ui/*` muertos (cierre verificado
  por closure desde el código vivo). `sidebar.tsx` resultó ser **código muerto**: el layout real
  (`app-layout.tsx`) ya era Tailwind puro, así que **no hizo falta** el rebuild a `AppShell`.
  Deps removidas: `shadcn`, `@base-ui/react`, `radix-ui`, `cmdk`, `vaul`, `react-day-picker`,
  `embla-carousel-react`, `input-otp`, `class-variance-authority`, `react-resizable-panels`,
  `tw-animate-css`, imports `shadcn/tailwind.css`, imports `tw-animate-css`, y `components.json`.
  El árbol de UI vivo es ahora **Mantine + Tailwind**.
- **Fase 7 (documentación/convenios) — ✅** `AGENTS.md`, `README.md` y este plan documentan que
  Mantine reemplaza a shadcn como sistema de UI. `components/ui` queda solo para helpers locales
  vivos y no debe usarse como registry/generador shadcn.

### Pendiente
- **Helpers locales sin deps externas (se conservan):** `components/ui/{table, virtual-table,
  virtual-list, data-table-pagination, sonner}`. `table.tsx` es un `<table>` estilado sin
  shadcn/radix; `virtual-*` usan `@tanstack/react-virtual`; `sonner.tsx` envuelve `sonner`.
  Consumidos por products/customers/credit/admin/organization (tablas) y `+Layout` (Toaster).
  No bloquean nada; migrarlos a Mantine `Table`/`@mantine/notifications` es opcional (evaluar
  fidelidad visual primero).
- **Verificación visual pendiente:** todo se validó de forma estática (tsc + ultracite + `vike build`).
  Falta un pase visual + `bun run e2e:playwright:smoke` antes de mergear.
- **Patrones establecidos:** `lib/mantine-theme.ts` centraliza `brandColors`, `brandColorCssVars`,
  `mantineTheme`, `mantineCssVariablesResolver` y overrides de `theme.components`; `Card`/`CardHeader`
  shadcn → contenedor Tailwind o helper local (`SettingsCard`); `Dialog`→`Modal`, `Sheet`→`Drawer`,
  `Select` shadcn→`Select` Mantine (`data`), `Switch.onCheckedChange`→`onChange(e.currentTarget.checked)`,
  `Tabs`→`Tabs` Mantine, `Empty`→div, `Button asChild`→`component="a"`, `Badge tt="none"`.
  La capa de primitivas (Fase 2a) se descarta — la migración directa por feature resulta más fiel
  porque cada feature pasa estilos de marca propios vía `className`/`styles`.

## Convenciones futuras

- **Mantine primero.** Para nueva UI, usa componentes de `@mantine/core` y configura comportamiento
  visual compartido en `lib/mantine-theme.ts`. No generes nuevos primitivos shadcn ni reintroduzcas
  `components.json`, el script `shadcn`, `@base-ui/react`, `tw-animate-css`, `shadcn/tailwind.css`
  o imports de `tw-animate-css`.
- **Provider único.** `pages/+Layout.tsx` monta `MantineProvider` con `theme={mantineTheme}`,
  `cssVariablesResolver={mantineCssVariablesResolver}` y `forceColorScheme="light"`. Mantine
  components deben renderizar dentro de ese provider.
- **Theme y Styles API.** Usa `createTheme`, `theme.components` y `Component.extend` para defaults
  globales. Para ajustes locales usa props Mantine (`className`, `classNames`, `style`, `styles`)
  y los selectores documentados de Styles API. Las props `styles` sirven para objetos inline;
  usa `classNames`/CSS cuando necesites pseudo-clases, media queries o estados complejos.
- **CSS variables públicas.** Define variables propias mediante `mantineCssVariablesResolver`
  cuando deban salir del theme hacia CSS global/Tailwind. No dependas de variables privadas de
  Mantine (`--_*`): son API interna y pueden cambiar o desaparecer en releases menores/parches.
- **Tailwind en coexistencia.** Tailwind v4 queda para layout, spacing, sizing, responsive utilities
  y aliases de tokens legacy. `pages/tailwind.css` mapea `--color-*` a variables Mantine/Zentro con
  fallback porque `desktop/src/renderer/styles.css` lo importa sin `MantineProvider`.
- **`components/ui` no es shadcn.** Solo conserva helpers locales cross-cutting todavía vivos
  (`table`, `virtual-table`, `virtual-list`, `data-table-pagination`, `sonner`). Nuevos componentes
  compartidos deben preferir Mantine; si un helper local sigue siendo necesario, documenta por qué
  no encaja como composición directa de Mantine.
- **`cn()` sigue existiendo.** `tailwind-merge`, `clsx` y `cn()` permanecen por helpers locales y
  composición condicional de clases. No los elimines como parte de la limpieza shadcn.

## 1. Diagnóstico histórico

Esta sección conserva el snapshot inicial que guio la migración. Para trabajo nuevo, la fuente
vigente es `Convenciones futuras` y el registro de progreso de arriba.

| Métrica | Valor |
| --- | --- |
| Componentes shadcn en `components/ui` | 63 |
| Archivos que consumen `@/components/ui` | 139 |
| Sentencias de import a shadcn | 347 |
| `className=` en `features/` + `pages/` | ~2.474 |
| Archivos usando `cn()` | 83 |
| Archivos con colores de marca Tailwind (`voltage`/`carbon`/`void`/`photon`) | 149 |
| `components/ui/sidebar.tsx` | 697 líneas (bloque custom) |
| Dark mode | 0 usos (tema único) |

**Conclusión central:** shadcn ya es código propio (copiado, sobre Radix/base-ui). Quitar el paquete `shadcn` es trivial. El costo real es **Tailwind**: Mantine 9 no usa Tailwind (usa CSS variables + CSS Modules + PostCSS preset + Styles API). Los ~2.474 `className` repartidos por las features son el 80% del trabajo.

### Lo que ayuda
- Tema único, sin dark mode → un solo `theme` Mantine.
- `ssr: false` → sin la complejidad de SSR/hydration de Mantine.
- Provider único en `pages/+Layout.tsx` envolviendo todo.
- Mantine integra forms, hooks, dates y charts → permite borrar deps sueltas al final.

### Lo que duele (sin equivalente 1:1)
- `sidebar.tsx` (697 LOC) → reconstruir con `AppShell`.
- Virtualización (`virtual-table`, `virtual-product-catalog`, `virtual-list`) atada a `@tanstack/react-virtual` + estilos shadcn → re-estilar a mano.
- `chart.tsx` (wrapper recharts) → `@mantine/charts` es opinado.
- `command` (cmdk), `input-otp`, `drawer` (vaul) → Mantine tiene Spotlight/PinInput/Drawer con APIs distintas, no drop-in.
- 149 archivos con colores de marca por Tailwind → portar tokens al theme.

## 2. Las dos modalidades (el eje a decidir con el POC)

**Modalidad A — Coexistencia (Mantine + Tailwind).** Componentes Mantine; utilidades Tailwind para layout/spacing. Menor costo, migración incremental real. Riesgo: doble theming, conflictos entre Tailwind preflight y el reset de Mantine, bundle mayor.

**Modalidad B — Tailwind-out (limpio).** Reescribir los ~2.474 `className` a props Mantine / CSS Modules; tokens de marca al theme. Alto costo (semanas), resultado consistente con un solo sistema de estilos.

> **POC (Fase 0):** migrar `customers` en Modalidad A + reescribir un formulario en Modalidad B, correr ambos y comparar antes de comprometer el eje.

## 3. Fases históricas

Las fases siguientes documentan cómo se ejecutó la migración. No deben leerse como instrucciones
para crear UI nueva.

### Fase 0 — POC y decisión
- Rama `poc/mantine-customers`. Instalar Mantine, montar provider/theme.
- `customers` (8 archivos, 10 componentes shadcn distintos, 70 classNames, 747 LOC) en Modalidad A.
- `customer-form` también en Modalidad B.
- **Salida:** decisión del eje Tailwind + estimación de esfuerzo por feature calibrada con datos reales.

### Fase 1 — Fundación
1. Deps: `@mantine/core @mantine/hooks @mantine/form`, `postcss-preset-mantine postcss-simple-vars` (+ `@mantine/notifications`, `@mantine/dates`, `@mantine/charts`, `@mantine/modals`, `@mantine/spotlight`, `@mantine/carousel` según se necesiten).
2. PostCSS config con `postcss-preset-mantine`. Verificar convivencia con Tailwind v4 (`@tailwindcss/vite`) — Tailwind v4 no usa PostCSS por defecto, así que el preset de Mantine corre en su propio pipeline; validar orden de capas CSS y reset.
3. `theme.ts`: mapear marca → `colors` (escala `voltage` de 10 tonos desde `#dfff06`), `primaryColor`, `defaultRadius` (= `--radius` 0.625rem), `fontFamily`. Forzar `colorScheme: 'light'` (no hay dark).
4. Montar `<MantineProvider theme={theme}>` + `<Notifications/>` en `pages/+Layout.tsx`, envolviendo dentro de `TanstackQueryProvider`. Importar `@mantine/core/styles.css` antes de `tailwind.css`.
5. Sustituir `<Toaster>` (sonner) por `@mantine/notifications` o mantener sonner temporalmente (decisión en POC).

### Fase 2 — Capa de primitivas
Dos sub-estrategias (elegir en POC):
- **2a (adaptador):** reescribir cada `components/ui/<x>.tsx` para que re-exporte/envuelva el componente Mantine equivalente, **manteniendo la misma API y firma**. Ventaja: los 139 archivos consumidores no cambian sus imports; se migra por debajo. Limitación: solo funciona donde la API shadcn ≈ Mantine (button, input, badge, card, alert...).
- **2b (reemplazo directo):** cambiar imports en cada feature a `@mantine/core`. Más limpio, más invasivo.

Recomendado: **2a para los primitivos de alto uso** (button, input, badge, select, label, card, alert, dialog→Modal, separator→Divider, switch, checkbox, textarea, tooltip, skeleton→Skeleton, spinner→Loader) para neutralizar de golpe la mayoría de los 347 imports; **2b para los complejos**.

### Fase 3 — Migración por feature (orden por riesgo ascendente)

| Orden | Feature | Archivos | classNames | Notas |
| --- | --- | --- | --- | --- |
| 1 | `customers` (POC) | 8 | 70 | Validación del patrón |
| 2 | `credit` | 8 | 93 | Tablas + diálogos simples |
| 3 | `restaurants` | 6 | 202 | 14 componentes shadcn distintos |
| 4 | `auth` | 10 | 92 | Custom (sin shadcn) → buen test puro de Tailwind-out |
| 5 | `settings` | 16 | 192 | Formularios → `@mantine/form` |
| 6 | `products` | 17 | 192 | 17 componentes distintos; algo de virtualización |
| 7 | `organization` | 26 | 285 | Mayor superficie |
| 8 | `dashboard` | — | — | **Charts** → `@mantine/charts` |
| 9 | `pos` / `posv2` | — | — | **Último**: virtualización + flujo crítico en producción |

Por cada feature: migrar componentes → reescribir classNames según modalidad elegida → verificación visual → `bunx tsc --noEmit` + `bun run check` → smoke e2e (`bun run e2e:playwright:smoke`).

### Fase 4 — Componentes difíciles (en paralelo, antes de tocar `pos`)
- **Sidebar → `AppShell`:** reconstruir `app-layout.tsx` + `sidebar.tsx` (697 LOC) con `AppShell.Navbar`. Es el ítem de mayor esfuerzo individual.
- **Virtual tables/catalog/list:** mantener `@tanstack/react-virtual`, re-estilar contenedores con Mantine `Table`/`ScrollArea`.
- **`chart.tsx`:** evaluar `@mantine/charts` (usa recharts por debajo) vs. mantener recharts directo.
- **`command` (cmdk) → Spotlight/Combobox**, **`input-otp` → PinInput**, **`drawer` (vaul) → Drawer**, **`resizable`:** mantener `react-resizable-panels` (Mantine no tiene equivalente).

### Fase 5 — Ejecución del eje Tailwind
- **Decisión ejecutada: Coexistencia.** Mantine = componentes, theme y Styles API. Tailwind = layout,
  spacing/grid/sizing, responsive utilities y aliases de tokens legacy.
- `tailwind-merge`, `clsx` y `cn()` se conservan mientras existan helpers locales y composición
  condicional de clases.

### Fase 6 — Limpieza y deps
Completado: eliminados `shadcn`, `@base-ui/react`, `radix-ui`, `cmdk`, `vaul`, `input-otp`,
`react-day-picker`, `embla-carousel-react`, `class-variance-authority`, `tw-animate-css`,
imports `shadcn/tailwind.css`, imports `tw-animate-css`, `components.json` y el script `shadcn`.
Se conservan `sonner`, `tailwind-merge`, `clsx`, `cn()` y helpers locales vivos bajo
`components/ui`.

## 4. Riesgos
- **Conflicto de reset CSS** Tailwind preflight ↔ Mantine: validar en Fase 1; puede requerir desactivar preflight o aislar capas.
- **Regresión visual en POS (producción):** mitigado dejando `pos` para el final con smoke e2e por feature.
- **Pixel-parity:** Mantine no replicará exactamente el look shadcn/radix-nova; aceptar deriva de diseño o presupuestar ajuste fino del theme.
- **Bundle:** en coexistencia se cargan dos sistemas; medir con `vike build`.
- **APIs no drop-in** (Modal vs Dialog, notifications vs sonner, PinInput vs input-otp): cada una necesita refactor de llamadas, no solo de import.

## 5. Estimación gruesa
- Fundación + POC: ~1–2 días.
- Primitivas (Fase 2a): ~2–3 días.
- Features 1–7: ~0.5–2 días c/u según modalidad (Tailwind-out ~2–3×).
- Sidebar/AppShell: ~1–2 días.
- Dashboard + POS: ~3–5 días (lo más riesgoso).
- **Total orientativo:** 3–5 semanas de trabajo enfocado en Tailwind-out; ~2–3 en coexistencia.

## 6. Checklist por feature

Checklist histórico usado durante la migración. Antes de mergear esta rama todavía falta el pase
visual/smoke indicado abajo y el commit final de los cambios actuales.

1. [x] Mapear componentes shadcn usados → Mantine (ver tabla §7).
2. [x] Migrar imports/JSX de componentes.
3. [x] Resolver `className` según modalidad.
4. [x] Portar lógica de formularios a `@mantine/form` si aplica.
5. [x] `bunx tsc --noEmit` + `bun run check`.
6. [ ] Verificación visual + `bun run e2e:playwright:smoke`.
7. [ ] Commit final de la rama antes de mergear.

## 7. Mapeo de componentes (shadcn → Mantine)

| shadcn | Mantine | Drop-in? |
| --- | --- | --- |
| button, button-group | Button, Button.Group | ✅ |
| input, textarea, label, field | TextInput, Textarea (label/error como props) | ⚠️ API distinta |
| select, native-select | Select, NativeSelect | ⚠️ |
| combobox | Combobox / Autocomplete | ⚠️ |
| badge | Badge | ✅ |
| card | Card / Paper | ✅ |
| alert | Alert | ✅ |
| dialog | Modal | ⚠️ |
| alert-dialog | `@mantine/modals` openConfirmModal | ⚠️ |
| sheet, drawer | Drawer | ⚠️ |
| tabs | Tabs | ⚠️ |
| switch / checkbox / radio-group | Switch / Checkbox / Radio.Group | ⚠️ |
| popover / hover-card | Popover / HoverCard | ✅ |
| dropdown-menu / menubar / context-menu | Menu | ⚠️ |
| tooltip | Tooltip | ✅ |
| separator | Divider | ✅ |
| skeleton / spinner | Skeleton / Loader | ✅ |
| scroll-area | ScrollArea | ✅ |
| progress / slider | Progress / Slider | ✅ |
| accordion / collapsible | Accordion / Collapse | ⚠️ |
| avatar / breadcrumb / pagination / kbd / aspect-ratio | Avatar / Breadcrumbs / Pagination / Kbd / AspectRatio | ✅ |
| toggle / toggle-group | SegmentedControl / ActionIcon | ⚠️ |
| calendar | `@mantine/dates` DatePicker | ⚠️ |
| chart | `@mantine/charts` o recharts directo | ⚠️ |
| carousel | `@mantine/carousel` | ⚠️ |
| command | `@mantine/spotlight` / Combobox | ⚠️ |
| input-otp | PinInput | ⚠️ |
| sonner | `@mantine/notifications` | ⚠️ |
| sidebar | AppShell (reconstrucción) | ❌ |
| resizable | `react-resizable-panels` (mantener) | ❌ |
| virtual-* | `@tanstack/react-virtual` (mantener, re-estilar) | ❌ |
| navigation-menu / empty / item / data-table-pagination | composición manual | ❌ |
