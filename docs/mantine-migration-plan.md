# Plan de migración shadcn → Mantine

> **Estado:** En progreso (rama `feat/mantine-migration`).
> **Decisiones del usuario:** migración **incremental por feature**; el eje **Tailwind (eliminar vs. coexistir)** se decide tras un POC comparativo.
> **Stack relevante:** React 19, Vike (`ssr: false`, client-rendered), Tailwind v4, Mantine **9.3.2** instalado.

## Registro de progreso

- **Fase 1 (fundación) — ✅** `MantineProvider` (forceColorScheme light) en `pages/+Layout.tsx`,
  `lib/mantine-theme.ts` (escalas `voltage`/`carbon`, radius 0.625rem), `postcss.config.cjs`
  con `postcss-preset-mantine` (pipeline propio, separado de `@tailwindcss/vite`).
  `@mantine/core/styles.css` importado antes de `tailwind.css`.
- **Decisión del eje — Modalidad A (coexistencia).** El POC de `customers` confirmó que Mantine
  (estructura/comportamiento) + Tailwind (layout/spacing) conviven sin conflicto de reset en
  build. El tema dark (void/carbon/voltage) se preserva con overrides `styles` centralizados en
  `lib/mantine-dark.ts` (darkInput/Select/Drawer/Modal). Se mantiene `sonner` por ahora.
- **Fase 3 features migradas:** `customers` ✅, `credit` ✅, `restaurants` ✅, `auth` ✅ (no-op:
  100% Tailwind, sin shadcn), `settings` ✅, `products` ✅. (tsc + ultracite + build OK por feature).
- **Pendiente:** organization, dashboard (charts), pos (último, virtualización + sidebar).
- **Diferido a Fase 4:** `components/ui/table` + `data-table-pagination` (productos los siguen usando);
  combobox shadcn (Popover+Command) ya migrado a `Select searchable`.
- **Patrones establecidos:** `lib/mantine-dark.ts` (darkInput/Select/Drawer/Modal); `Card`/`CardHeader`
  shadcn → contenedor Tailwind o helper local (`SettingsCard`); `Dialog`→`Modal`, `Sheet`→`Drawer`,
  `Select` shadcn→`Select` Mantine (`data`), `Switch.onCheckedChange`→`onChange(e.currentTarget.checked)`,
  `Tabs`→`Tabs` Mantine, `Empty`→div, `Button asChild`→`component="a"`, `Badge tt="none"`.
  La capa de primitivas (Fase 2a) se descarta — la migración directa por feature resulta más fiel
  porque cada feature pasa estilos de marca propios vía `className`/`styles`.

## 1. Diagnóstico (medido sobre el repo)

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

## 3. Fases

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
- Si **Tailwind-out:** barrido feature por feature de los `className` restantes → props/CSS Modules; mover tokens de marca; eliminar `tailwindcss`, `tw-animate-css`, `@tailwindcss/vite`, `tailwind-merge`, `class-variance-authority`, `clsx` y `cn()`.
- Si **Coexistencia:** mantener Tailwind solo para layout; documentar la frontera (Mantine = componentes, Tailwind = spacing/grid).

### Fase 6 — Limpieza y deps
Eliminar según alcance: `shadcn`, `radix-ui`, `@base-ui/react`, `cmdk`, `vaul`, `sonner`, `input-otp`, `react-day-picker`, `embla-carousel-react`, `class-variance-authority`, `tailwind-merge`, `cn()` y los 63 archivos `components/ui`. Borrar `components.json` y el script `shadcn`. Actualizar `AGENTS.md` (sección UI) y este doc a "completado".

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
1. [ ] Mapear componentes shadcn usados → Mantine (ver tabla §7).
2. [ ] Migrar imports/JSX de componentes.
3. [ ] Resolver `className` según modalidad.
4. [ ] Portar lógica de formularios a `@mantine/form` si aplica.
5. [ ] `bunx tsc --noEmit` + `bun run check`.
6. [ ] Verificación visual + `bun run e2e:playwright:smoke`.
7. [ ] Commit por feature (rama incremental).

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
