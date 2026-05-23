import { Heart, Package } from "lucide-react";
import type { Product } from "@/features/pos/types";
import { calculatePriceWithTax, formatCurrency } from "@/features/pos/utils";
import { cn } from "@/lib/utils";

interface ProductListItemProps {
  isActiveShift: boolean;
  isOutOfStock: boolean;
  isTogglingFavorite?: boolean;
  onSelect: () => void;
  onToggleFavorite?: (productId: string) => void;
  product: Product;
  quantity: number;
}

export function ProductListItem({
  product,
  quantity: _quantity,
  isOutOfStock,
  isActiveShift: _isActiveShift,
  onSelect,
  onToggleFavorite,
  isTogglingFavorite,
}: ProductListItemProps) {
  function getStockLabel() {
    if (!product.trackInventory) {
      return null;
    }
    if (product.stock > 0) {
      return `${product.stock} Unids.`;
    }
    return "Sin Stock";
  }

  const stockLabel = getStockLabel();

  return (
    <div className="relative">
      <button
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all md:gap-4 md:p-4",
          "border-[rgba(255,255,255,0.06)] bg-[#151515]",
          "hover:border-[#dfff06]/40 hover:shadow-[0_0_20px_rgba(223,255,6,0.08)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06]",
          isOutOfStock && "opacity-45",
          onToggleFavorite && "pr-12"
        )}
        onClick={onSelect}
        type="button"
      >
        {/* Icon */}
        <div className="shrink-0">
          <div className="flex size-10 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1c1c1c] md:h-11 md:w-11">
            <Package className="size-4 text-[#3d3d3d] md:h-5 md:w-5" />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-sm text-white md:text-[15px]">
            {product.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-2">
            {stockLabel && (
              <span
                className={cn(
                  "font-medium text-[10px] md:text-[11px]",
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
          <p className="font-bold text-sm text-white tabular-nums md:text-base">
            {formatCurrency(calculatePriceWithTax(product))}
          </p>
        </div>
      </button>

      {onToggleFavorite && (
        <button
          aria-label={
            product.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
          }
          aria-pressed={product.isFavorite}
          className="absolute top-1/2 right-3 z-10 -translate-y-1/2 rounded-md p-1.5 hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06] disabled:opacity-50"
          disabled={isTogglingFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          type="button"
        >
          <Heart
            className={cn(
              "size-4 transition-colors md:h-5 md:w-5",
              product.isFavorite
                ? "fill-red-500 text-red-500"
                : "text-[#3d3d3d] hover:text-red-400"
            )}
          />
        </button>
      )}
    </div>
  );
}
