import { Badge } from "@/components/ui/badge";
import {
  getStockStatus,
  STOCK_STATUS_LABELS,
} from "@/features/inventory/stock-status.shared";
import type { Product } from "@/features/products/hooks/use-products";

export function ProductStockBadge({
  lowStockThreshold,
  product,
}: {
  lowStockThreshold: number;
  product: Product;
}) {
  const status = getStockStatus({
    trackInventory: product.trackInventory,
    stock: product.stock,
    minStock: product.minStock,
    lowStockThreshold,
  });

  if (status === "untracked") {
    return (
      <span className="font-medium text-xs text-zinc-500 uppercase tracking-wider">
        {STOCK_STATUS_LABELS.untracked}
      </span>
    );
  }

  const classNameByStatus = {
    out: "border-red-500/20 bg-red-500/10 text-red-300",
    low: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    ok: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  } as const;

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-zinc-200">{product.stock}</span>
      <Badge className={classNameByStatus[status]} variant="outline">
        {STOCK_STATUS_LABELS[status]}
      </Badge>
    </div>
  );
}
