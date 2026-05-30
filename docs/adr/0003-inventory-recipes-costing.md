# ADR 0003: Extend inventory from stock counts to recipes and costing

## Status

Proposed

## Date

2026-05-29

## Context

The current inventory model tracks products, categories, stock, stock thresholds, and inventory movements. Sales decrement stock for sold products and modifiers when inventory tracking is enabled.

That is enough for retail-style stock tracking, but it is not enough for restaurants or margin-sensitive businesses. Restaurants sell menu items that consume ingredients through recipes. They buy ingredients in one unit, prepare in another, waste some quantity, and sell finished products whose cost depends on recipe quantities and yield.

Without recipes, units of measure, purchasing, supplier costs, waste, and cost layers, reports can show revenue but not reliable gross margin or food cost.

## Decision

Introduce an inventory costing module that separates sellable products from stockable ingredients and recipes.

Products may remain the catalog items shown in POS. Inventory should gain deeper concepts for:

- stock item or ingredient;
- unit of measure and conversion;
- supplier and purchase receipt;
- cost layer or weighted average cost;
- recipe and recipe component quantities;
- preparation/batch production;
- waste/spoilage/adjustment reason codes;
- stock movement source links to sale, restaurant item, purchase, production, or adjustment.

Sales of recipe-backed products should decrement ingredient inventory through the recipe, not only decrement the product row.

## Consequences

This improves reporting quality and makes the restaurant module economically useful. It also increases data-entry burden, so the UI should allow businesses to start simple and adopt recipes gradually.

The current product stock model can remain as the simple mode. Recipe-backed products should opt into the deeper inventory path without forcing every small store to configure ingredients.

## Implementation Notes

- Add tables for stock item, unit, unit conversion, supplier, purchase receipt, purchase receipt line, recipe, recipe component, and inventory cost layer or weighted-average snapshot.
- Keep existing `product.trackInventory` behavior for simple retail products.
- Add `product.inventoryMode` or equivalent to distinguish simple-stock, recipe-backed, and non-stock products.
- Add stock movement source fields so Kardex can trace movements back to sales, restaurant service items, purchases, waste, and adjustments.
- Add margin reports only after cost data is reliable.

## Related Files

- `database/drizzle/schema/inventory.schema.ts`
- `server/sales/create-sale.server.ts`
- `features/products/`
- `features/inventory/`
- `features/restaurants/`
