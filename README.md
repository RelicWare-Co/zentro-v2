Generated with [vike.dev/new](https://vike.dev/new) ([version 625](https://www.npmjs.com/package/create-vike/v/0.0.625)) using this command:

```sh
bun create vike@latest --react --tailwindcss --shadcn-ui --hono --drizzle --shadcnUi
```

## Contents

- [Vike](#vike)
  - [Plus files](#plus-files)
  - [Routing](#routing)
  - [SSR](#ssr)
  - [HTML Streaming](#html-streaming)
- [shadcn/ui](#shadcnui)
  - [Configuration](#configuration)
  - [Add Components to Your Project](#add-components-to-your-project)

## Vike

This app is ready to start. It's powered by [Vike](https://vike.dev) and [React](https://react.dev/learn).

### Plus files

[The + files are the interface](https://vike.dev/config) between Vike and your code.

- [`+config.ts`](https://vike.dev/settings) — Settings (e.g. `<title>`)
- [`+Page.tsx`](https://vike.dev/Page) — The `<Page>` component
- [`+data.ts`](https://vike.dev/data) — Fetching data (for your `<Page>` component)
- [`+Layout.tsx`](https://vike.dev/Layout) — The `<Layout>` component (wraps your `<Page>` components)
- [`+Head.tsx`](https://vike.dev/Head) - Sets `<head>` tags
- [`/pages/_error/+Page.tsx`](https://vike.dev/error-page) — The error page (rendered when an error occurs)
- [`+onPageTransitionStart.ts`](https://vike.dev/onPageTransitionStart) and `+onPageTransitionEnd.ts` — For page transition animations

### Routing

[Vike's built-in router](https://vike.dev/routing) lets you choose between:

- [Filesystem Routing](https://vike.dev/filesystem-routing) (the URL of a page is determined based on where its `+Page.jsx` file is located on the filesystem)
- [Route Strings](https://vike.dev/route-string)
- [Route Functions](https://vike.dev/route-function)

### SSR

SSR is enabled by default. You can [disable it](https://vike.dev/ssr) for all or specific pages.

### HTML Streaming

You can [enable/disable HTML streaming](https://vike.dev/stream) for all or specific pages.

## shadcn/ui

Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.

### Configuration

see [shadcn/ui theming](https://ui.shadcn.com/docs/theming)

Base Configuration can be found in `components.json` file.

> \[!NOTE]
> changes to the `components.json` file **will not** be reflected in existing components. Only new components will be affected.

### Add Components to Your Project

**Example:** add a component to your project.
`bun shadcn add button`

use the `<Button />` component in your project:
`import { Button } from "@/components/ui/button";`

more [shadcn/ui components](https://ui.shadcn.com/docs/components/accordion)

