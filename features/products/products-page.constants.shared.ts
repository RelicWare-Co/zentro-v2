export const UNCATEGORIZED_FILTER_VALUE = "uncategorized";

export const PRODUCTS_TAB_VALUES = [
  "products",
  "categories",
  "kardex",
] as const;

export const PRODUCT_STOCK_FILTER_VALUES = [
  "all",
  "debt",
  "out",
  "low",
  "ok",
] as const;

export type ProductStockFilterValue =
  (typeof PRODUCT_STOCK_FILTER_VALUES)[number];

export type ProductsTab = (typeof PRODUCTS_TAB_VALUES)[number];

export const DEFAULT_PRODUCTS_PAGE_SIZE = 20;
