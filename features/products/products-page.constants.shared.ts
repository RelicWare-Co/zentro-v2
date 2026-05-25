export const UNCATEGORIZED_FILTER_VALUE = "uncategorized";

export const PRODUCTS_TAB_VALUES = ["products", "categories"] as const;

export type ProductsTab = (typeof PRODUCTS_TAB_VALUES)[number];

export const DEFAULT_PRODUCTS_PAGE_SIZE = 20;
