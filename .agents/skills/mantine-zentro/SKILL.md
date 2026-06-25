---
name: mantine-zentro
description: Build, modify, or review React UI in zentro-v2 with Mantine. Use for any task that introduces or changes visual components, forms, inputs, overlays, menus, tables, theming, styling, responsive layouts, or Mantine accessibility behavior in this project.
---

# Mantine for Zentro

Use Mantine as Zentro's component system and theme layer. Keep project rules in `AGENTS.md` authoritative; use Mantine's official LLM documentation to verify current component APIs and behavior.

## Workflow

1. Inspect the related feature and the existing UI before changing it. For shared visual behavior, inspect `lib/mantine-theme.ts`; for provider and stylesheet order, inspect `pages/+Layout.tsx`.
2. Select an existing Mantine component before creating custom UI. Reuse the local `components/ui` helpers only when they already fit the cross-cutting use case.
3. When Mantine API details, Styles API selectors, accessibility behavior, or composition are relevant, open `https://mantine.dev/llms.txt` and follow only the linked page for the component or concern. Do not copy `llms-full.txt` into the repository.
4. Keep shared tokens and global component defaults in `lib/mantine-theme.ts`; keep one-off layout and visual adjustments local to the feature.
5. Verify keyboard access, labels and accessible names, focus behavior for overlays, and mobile/desktop layouts. Run the narrowest relevant check after changing code.

## Styling Rules

- Keep the sole application `MantineProvider` in `pages/+Layout.tsx`, using `mantineTheme` and `mantineCssVariablesResolver`.
- Add reusable tokens through `brandColors`, `brandColorCssVars`, or `cssVariablesResolver`; add reusable component defaults with `Component.extend` in `theme.components`.
- Use Mantine's supported `classNames`, `styles`, and Styles API selectors for component customization. Use CSS modules or Tailwind utility classes through `className`/`classNames` for local layout and visual adjustments.
- Never style against Mantine private CSS variables (`--_*`). Use public Mantine variables or project-owned `--zentro-*` variables instead.
- Keep Mantine base styles before Tailwind. Do not add another provider or alter the established import order to fix local styles.
- Do not introduce shadcn, `components.json`, new `components/ui` primitives, or a parallel design system. Use Lucide for available icon affordances.

## Project Constraints

- Preserve the light-only color scheme unless the task explicitly expands product support for color schemes.
- Treat authentication and organization-selection views as full-screen surfaces, outside the default sidebar shell.
- Respect Vike environment boundaries: do not pull browser-only APIs into an isomorphic component merely for a Mantine interaction.
- If official Mantine guidance conflicts with `AGENTS.md` or existing Zentro patterns, follow the project rule and adapt with supported Mantine APIs.
