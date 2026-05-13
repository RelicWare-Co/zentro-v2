# Worker Batch 1 Results

## Files Fixed

- components/ui/breadcrumb.tsx
- components/ui/button-group.tsx
- components/ui/calendar.tsx
- components/ui/carousel.tsx
- components/ui/chart.tsx

## Changes Made

### breadcrumb.tsx

- Changed `BreadcrumbPage` element from `<span>` to `<a>` with `tabIndex={0}`
- Removed `role="link"` (now implicit via semantic element)
- Updated type from `React.ComponentProps<"span">` to `React.ComponentProps<"a">`

### button-group.tsx

- Changed `ButtonGroup` element from `<div>` to `<fieldset>`
- Removed `role="group"` (now implicit via semantic element)
- Updated type from `React.ComponentProps<"div">` to `React.ComponentProps<"fieldset">`

### calendar.tsx

- Replaced `import * as React from "react"` with named imports (`createContext`, `useContext`, `useEffect`, `useRef`, `type ComponentProps`, `type Ref`)
- Extracted 4 nested components from inside `Calendar` to top-level:
  - `CalendarRoot`
  - `CalendarChevron`
  - `CalendarDayButtonWrapper`
  - `CalendarWeekNumber`
- Added `CalendarLocaleContext` to pass `locale` to `CalendarDayButton` without nested component definitions
- Wrapped `DayPicker` with `CalendarLocaleContext.Provider`
- Updated `CalendarDayButton` to use `useRef`/`useEffect` instead of `React.useRef`/`React.useEffect`

### carousel.tsx

- Replaced `import * as React from "react"` with named imports (`createContext`, `use`, `useCallback`, `useEffect`, `useState`, `type ComponentProps`, `type KeyboardEvent`)
- Changed carousel wrapper from `<div role="region">` to `<section role="region">`
- Changed `CarouselItem` from `<div role="group">` to `<fieldset>`
- Updated all `React.` prefixed calls to direct imports

### chart.tsx

- Replaced `import * as React from "react"` with named imports
- Replaced `import * as RechartsPrimitive from "recharts"` with named imports (`Legend`, `ResponsiveContainer`, `Tooltip`, plus type-only imports)
- Extracted `ChartTooltipItem` top-level component from `ChartTooltipContent` to reduce cognitive complexity from 28 to below 20
- Changed `payload.flatMap(...)` to `payload.map(...)` returning null for skipped items (cleaner with extracted component)
- Updated all `React.` and `RechartsPrimitive.` references to direct imports

## Verification

- `bunx biome check` on all 5 files: **0 errors**
- `tsc --noEmit`: **no errors in these files**
