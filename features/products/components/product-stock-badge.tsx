import { Badge } from "@/components/ui/badge";
import type { Product } from "@/features/products/hooks/use-products";

export function ProductStockBadge({ product }: { product: Product }) {
  if (!product.trackInventory) {
    return (
      <span className="font-medium text-xs text-zinc-500 uppercase tracking-wider">
        Sin seguimiento
      </span>
    );
  }

  let className: string;
  let stockLabel: string;
  if (product.stock <= 0) {
    className = "border-red-500/20 bg-red-500/10 text-red-300";
    stockLabel = "Sin stock";
  } else if (product.stock < 10) {
    className = "border-amber-500/20 bg-amber-500/10 text-amber-300";
    stockLabel = "Stock bajo";
  } else {
    className = "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    stockLabel = "En stock";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-zinc-200">{product.stock}</span>
      <Badge className={className} variant="outline">
        {stockLabel}
      </Badge>
    </div>
  );
}
