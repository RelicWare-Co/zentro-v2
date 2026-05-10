import { Heart, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/features/pos/types";
import { formatCurrency } from "@/features/pos/utils";

interface ProductListItemProps {
  product: Product;
  quantity: number;
  isOutOfStock: boolean;
  isActiveShift: boolean;
  onSelect: () => void;
  onToggleFavorite?: (productId: string) => void;
  isTogglingFavorite?: boolean;
}

export function ProductListItem({
  product,
  quantity,
  isOutOfStock,
  isActiveShift,
  onSelect,
  onToggleFavorite,
  isTogglingFavorite,
}: ProductListItemProps) {
  const stockLabel = product.trackInventory
    ? product.stock > 0
      ? `${product.stock} Unids.`
      : "Sin Stock"
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left flex items-center gap-3 md:gap-4 rounded-xl border p-3 md:p-4 transition-all",
        "bg-[#151515] border-[rgba(255,255,255,0.06)]",
        "hover:border-[#dfff06]/40 hover:shadow-[0_0_20px_rgba(223,255,6,0.08)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06]",
        isOutOfStock && "opacity-45"
      )}
    >
      {/* Icon */}
      <div className="shrink-0">
        <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-lg bg-[#1c1c1c] border border-[rgba(255,255,255,0.06)]">
          <Package className="h-4 w-4 md:h-5 md:w-5 text-[#3d3d3d]" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm md:text-[15px] font-medium text-white truncate">
          {product.name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          {stockLabel && (
            <span
              className={cn(
                "text-[10px] md:text-[11px] font-medium",
                product.stock > 0 ? "text-[#dfff06]" : "text-red-500"
              )}
            >
              {stockLabel}
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="text-sm md:text-base font-bold text-white tabular-nums">
          {formatCurrency(product.price)}
        </p>
      </div>

      {/* Favorite */}
      {onToggleFavorite && (
        <button
          type="button"
          disabled={isTogglingFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className="shrink-0 p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06] disabled:opacity-50"
        >
          <Heart
            className={cn(
              "h-4 w-4 md:h-5 md:w-5 transition-colors",
              product.isFavorite
                ? "fill-red-500 text-red-500"
                : "text-[#3d3d3d] hover:text-red-400"
            )}
          />
        </button>
      )}
    </button>
  );
}
