# Product catalog pagination beyond 1,000 rows

## Symptom

Organizations with more than 1,000 active products could only see the first
1,000 in the inventory product table. The pagination footer treated that
truncated result as the complete catalog, so its total and navigation controls
were incorrect.

## Root cause

`useProductsQueries` always requested `products.search` with `limit: 1000`.
It then sliced that incomplete array itself and configured TanStack Table for
manual pagination with the truncated array length as `rowCount`.

Manual pagination also disables TanStack Table's automatic page-index reset,
which could leave the controls pointing at an empty or out-of-range page after
the result set changed.

## Solution

- Let `products.search` remain unbounded when the caller does not request a
  limit. Explicitly limited consumers such as product pickers and POS retain
  their existing caps.
- Load the complete filtered inventory catalog and use TanStack Table's
  client-side pagination row model.
- Replace the custom arrow-only footer with Mantine's controlled, responsive
  `Pagination`, including direct page selection, edge controls, Spanish
  accessible names, and a valid `Página 0 de 0` empty state.

## Verification

- Added an integration regression test that inserts 2,005 products and verifies
  an unbounded `products.search` returns all 2,005 rows.
- Ran the focused product integration suite.
- Ran TypeScript, Ultracite, and the production build.
