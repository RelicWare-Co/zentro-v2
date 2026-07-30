# Product pagination controlled state

## Symptom

After a product filter changed the result set, the table rows and inventory
total updated but the pagination footer kept the previous row count, page
count, and active page. An empty result could therefore still show controls for
the previous two-page result.

The footer also rendered `Página 0 de 0` when it did receive an empty result.

## Root cause

`DataTablePagination` received only TanStack Table's mutable table instance.
That instance keeps a stable object identity while its internal options change,
so React Compiler could reuse the pagination subcomponent render even when the
observable row and pagination values had changed.

The empty-result fallback manually converted TanStack's zero pages into a
display value of zero. Mantine's controlled `Pagination` requires its value to
remain between page 1 and the supplied total.

## Solution

- Make `DataTablePagination` explicitly controlled with primitive `rowCount`,
  `pageCount`, `pageIndex`, and `pageSize` props plus page-change callbacks.
- Keep the TanStack table instance out of the presentational component so
  React can track every value that affects its render.
- Do not render a page label when there are zero pages; keep the one-page label
  and Mantine's responsive controls for multi-page results.

## Verification

- Extended the focused Playwright products regression to select a category
  with no products and verify the footer updates to zero without rendering
  `Página 0 de 0`.
- Verified next and previous navigation change the visible product rows.
- Rechecked the pagination layout at 1165 by 720 and 390 by 844 viewports.
