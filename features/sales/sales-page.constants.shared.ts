export const SALES_VIEW_VALUES = ["today", "history"] as const;
export const DEFAULT_SALES_VIEW = "today" as const;

export const SALE_STATUS_VALUES = ["completed", "credit", "cancelled"] as const;
export const SALE_BALANCE_STATUS_VALUES = ["with_balance", "settled"] as const;

export type SalesView = (typeof SALES_VIEW_VALUES)[number];
