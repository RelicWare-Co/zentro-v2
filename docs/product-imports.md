# Product imports

Product imports are platform-admin operations that copy external catalogs into a
target organization. They use REST instead of a Zero mutator because the acting
platform administrator does not need an active membership in the target
organization.

## Standard Zentro XLSX v1

Download the current template from the admin panel or from:

```text
GET /api/admin/product-imports/importers/zentro-standard-xlsx/template
```

The workbook contains `Instrucciones`, `Productos`, `_catalogos`, and `_zentro`.
Do not rename or remove these sheets. `_zentro` identifies format version `1`.

The `Productos` sheet uses these exact columns, in order:

| Column | Required | Default | Notes |
| --- | --- | --- | --- |
| `nombre` | Yes | — | Product name. |
| `categoria` | No | None | Reuses a case-insensitive match or creates the category. |
| `sku` | No | None | Must be unique among active products and within the file. |
| `codigo_barras` | No | None | Letters, digits, and hyphens; maximum 64 characters. |
| `precio` | Yes | — | Non-negative integer COP value. Ingredients must use `0`. |
| `costo` | No | `0` | Non-negative integer COP value. |
| `impuesto` | No | `0` | Integer percentage from 0 to 100. |
| `stock_inicial` | No | `0` | Non-negative integer. Requires inventory tracking. |
| `stock_minimo` | No | Organization default | Optional non-negative integer. |
| `cantidad_reorden` | No | None | Optional non-negative integer. |
| `controla_inventario` | No | `SI` | `SI` or `NO`. Passthrough products must use `NO`. |
| `es_modificador` | No | `NO` | Ingredients and passthrough products must use `NO`. |
| `es_insumo` | No | `NO` | Ingredients require price `0` and revenue treatment. |
| `tratamiento_contable` | No | `revenue` | `revenue` or `passthrough`. |
| `autosalida_habilitada` | No | `NO` | Available for `passthrough`; requires an enabled payment method. |
| `metodo_pago_autosalida` | No | `cash` | Organization payment-method identifier. |

Boolean parsing accepts `SI`, `SÍ`, `NO`, `true`, `false`, `yes`, `1`, and `0`
without regard to case or surrounding whitespace. Formulas are rejected; the
workbook must contain literal values. Files are limited to 5 MiB and 5,000
non-empty product rows.

## Programa 1

The `programa-1` adapter accepts the product export as `.csv` or `.xlsx`. CSV is
preferred because it preserves long `SKU/Código` values as text. Some XLSX
exports convert long identifiers to imprecise numbers; those rows are rejected
with `unsafe_identifier_precision` and should be retried using the CSV export.

Source values are mapped as follows:

| Programa 1 | Zentro canonical field | Rule |
| --- | --- | --- |
| `Producto` | `name` | Required. |
| `Categoría` | `categoryName` | Optional. |
| `SKU/Código` | `sku` | Preserved as one source identifier; `barcode` stays empty. |
| `Precio venta` | `price` | Parses the exported COP value. |
| `Precio compra` | `cost` | Parses the exported COP value. |
| `Inventario actual` | `initialStock` | Parses the numeric quantity before `Unidad`. |
| `Impuesto` | `taxRate` | Empty, `NO RESPONSABLE`, and `Exento` map to `0`; percentages are parsed. |
| `Tipo de producto` | — | V1 accepts only `Sencillo`. |

Program 1 products default to revenue treatment, inventory tracking enabled,
not modifier, not ingredient, and no automatic payout. Export footer rows are
ignored. XLSX formulas are rejected.

## Processing model

1. `preview` parses the selected importer into `ProductImportDocumentV1`, runs
   row and organization validations, and stores an audit batch without changing
   the catalog.
2. Invalid batches cannot be committed. A ready batch has no row errors.
3. `commit` serializes imports per organization, revalidates the batch, creates
   missing categories and products, records initial-stock movements, and
   completes everything in one database transaction.
4. Completed batches are idempotent. The same file hash cannot be imported
   again into the same organization, regardless of the selected importer.

The original file is never stored. History retains its filename, size, SHA-256
hash, normalized rows, row issues, actor, and result indefinitely.

## Adding an importer

1. Implement `ProductImporter` under `features/product-imports/`. `parse` must
   return a validated `document: ProductImportDocumentV1` plus `sourceRows`.
   Every valid source row references exactly one `document.products` entry by
   `productIndex`; invalid source rows use `null` and retain their diagnostics.
   The orchestrator validates the document and the one-to-one mapping again.
2. Validate source-specific syntax inside the adapter. Leave organization
   conflicts, category resolution, payment methods, persistence, and commit
   behavior to the shared orchestrator.
3. Register the adapter in `product-importer-registry.server.ts`. The admin UI
   discovers it through the descriptors endpoint; it must not hard-code the new
   format.
4. Provide `template: { build, fileName, mimeType }` only when the source format
   has a downloadable template. The endpoint and browser download use this
   metadata without format-specific branching. Reopen and parse generated
   workbooks in tests.
5. Add parser fixtures plus integration coverage proving the adapter produces
   the same canonical behavior.

Import-audit tables are deliberately excluded from `drizzle-zero.config.ts`.
Catalog tables remain replicated, so completed imports appear through the
existing Zero product and inventory queries.
