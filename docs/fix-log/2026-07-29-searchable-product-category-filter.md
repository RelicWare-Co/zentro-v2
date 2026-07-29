# Searchable product category filter

## Symptom

The category filter on the products tab was a non-searchable Mantine `Select`.
It was populated by `products.categories`, which returns only the first 500
categories, so a category beyond that cap could not be selected there.

## Root cause

The product form already used the bounded, query-backed `categoryOptions`
query, but the table filter used the general category list instead. The select
also did not opt into Mantine's searchable mode.

## Solution

- Make the table category filter searchable.
- Query `categoryOptions` from the filter with deferred search text and its
  50-result limit instead of rendering the global category list.
- Load the selected category separately so its label remains available after a
  search changes.

## Verification

- Added a browser regression test that types in the category filter.
- Extended the Zero query test with 550 categories and verifies that searching
  finds a category beyond the former 500-row source list.
- Ran the focused product integration suite.
