export type StockStatus = "untracked" | "debt" | "out" | "low" | "ok";

export interface StockStatusInput {
  lowStockThreshold: number;
  minStock?: number | null;
  stock: number;
  trackInventory: boolean;
}

export function getEffectiveStockThreshold({
  minStock,
  lowStockThreshold,
}: Pick<StockStatusInput, "minStock" | "lowStockThreshold">) {
  if (
    typeof minStock === "number" &&
    Number.isFinite(minStock) &&
    minStock >= 0
  ) {
    return Math.trunc(minStock);
  }
  return Math.max(0, Math.trunc(lowStockThreshold));
}

export function getStockStatus(input: StockStatusInput): StockStatus {
  if (!input.trackInventory) {
    return "untracked";
  }

  const stock = Math.trunc(input.stock);
  if (stock < 0) {
    return "debt";
  }
  if (stock === 0) {
    return "out";
  }

  const threshold = getEffectiveStockThreshold(input);
  if (stock <= threshold) {
    return "low";
  }

  return "ok";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  untracked: "Sin seguimiento",
  debt: "Stock negativo",
  out: "Sin stock",
  low: "Stock bajo",
  ok: "En stock",
};
