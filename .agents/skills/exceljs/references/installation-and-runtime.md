# Installation and runtime

## Contents

- Package choice
- Version verification
- Imports
- Bun and Node
- Browser generation
- TypeScript fork extensions
- Output handling
- Authoritative sources

## Package choice

Install the maintained fork with the target project's package manager:

```bash
bun add @protobi/exceljs
npm install @protobi/exceljs
pnpm add @protobi/exceljs
yarn add @protobi/exceljs
```

The fork is intended to be API-compatible with upstream ExcelJS. The scoped package is required for fork features. Do not accidentally import `exceljs` after installing `@protobi/exceljs`.

## Version verification

Check the installed and published versions before depending on a recently added fork feature:

```bash
bun pm ls @protobi/exceljs
npm view @protobi/exceljs version
```

Inspect `node_modules/@protobi/exceljs/FORK.md` or the repository release history when behavior is version-sensitive. Prefer a released npm version over a GitHub branch for normal production use. Pin an exact version only when reproducible output or a known regression requires it.

## Imports

Use the default import in ESM/Bun projects:

```ts
import ExcelJS from "@protobi/exceljs";
```

Use CommonJS when required by the project:

```js
const ExcelJS = require("@protobi/exceljs");
```

Avoid legacy ES5 imports unless the runtime genuinely needs them. Modern Node and Bun do not require the old polyfill path.

## Bun and Node

Both runtimes can use the document API. Use `node:fs`, `node:path`, and streams through their standard compatible interfaces. Always `await` `readFile`, `writeFile`, `writeBuffer`, CSV I/O, worksheet protection, and streaming workbook commits.

For HTTP responses, write a buffer and set the XLSX MIME type:

```ts
const bytes = await workbook.xlsx.writeBuffer();
return new Response(bytes, {
  headers: {
    "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "content-disposition": 'attachment; filename="report.xlsx"',
  },
});
```

Sanitize user-provided filenames and never permit directory traversal.

## Browser generation

Use only the document workbook in browsers; the streaming reader/writer is not bundled for browser use. Write a buffer, create a Blob, and trigger a download. Keep large exports server-side to avoid blocking the UI and exhausting browser memory.

```ts
const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
```

## TypeScript fork extensions

The package's main declaration file may lag fork-only runtime APIs such as `addPivotTable` and `addFormCheckbox`. Copy `assets/protobi-exceljs-extensions.d.ts` into a source directory included by `tsconfig.json`. Do not use broad `any` casts when a narrow module augmentation can document the actual API.

Confirm runtime support in the installed package even when declarations compile. For bleeding-edge fork features, inspect source/tests rather than assuming README prose and types are synchronized.

## Output handling

Create parent directories explicitly. Write important outputs to a temporary sibling path, reopen and validate them, then rename to the requested final path. This prevents a failed serialization from leaving a misleading partial deliverable.

Avoid overwriting an input workbook during the first pass. Preserve the original until round-trip verification succeeds.

## Authoritative sources

Use primary fork sources when a capability may have changed:

- Repository and full API guide: <https://github.com/protobi/exceljs>
- Fork releases and limitations: <https://github.com/protobi/exceljs/blob/master/FORK.md>
- Published TypeScript declarations: <https://github.com/protobi/exceljs/blob/master/index.d.ts>
- Pivot runtime validation: <https://github.com/protobi/exceljs/blob/master/lib/doc/pivot-table.js>
- Form-checkbox runtime API: <https://github.com/protobi/exceljs/blob/master/lib/doc/form-checkbox.js>

Check the installed package source when reproducibility matters; the repository master branch can be ahead of npm.
