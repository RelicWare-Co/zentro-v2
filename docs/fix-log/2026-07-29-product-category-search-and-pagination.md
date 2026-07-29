# Product category search and pagination layout

## Symptom

- Opening the category filter searched for `Todas las categorías` instead of
  showing the available categories.
- Opening the category picker in the product form searched for
  `Sin categoría`.
- When the product table had more than one page, the pagination controls
  collapsed into a vertical strip and were clipped by the right edge of the
  table footer.

## Root cause

Mantine `Select` uses the selected option label as the controlled
`searchValue`. Both product category pickers forwarded that same state to the
remote Zero category-options query, so the idle display label became a real
search term.

Mantine responsive pagination uses inline-size container queries. The
pagination root was an auto-sized, shrinkable flex item at the `sm` breakpoint,
so its contained intrinsic width collapsed to zero and Mantine's internal
controls wrapped vertically.

## Solution

- Track whether each category dropdown is open. Only forward `categorySearch`
  to the remote query while the dropdown is open, and clear it when opening so
  the full option list is shown.
- Associate the product-form category label and input for accessible lookup.
- Let the pagination actions group consume the remaining footer width and make
  the responsive pagination root a growing flex item with a definite used
  width.

## Verification

- Added a Playwright regression with an isolated organization, one category,
  and 21 products.
- The regression verifies that both category pickers open with an empty search
  value and show the seeded category.
- It verifies that typed category filtering still finds the category.
- At 1165 by 720 and 390 by 844 viewports, it verifies that the four pagination
  navigation controls share one row and stay within the table footer.
