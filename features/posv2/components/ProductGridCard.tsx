import { Heart, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/features/pos/types";
import { calculatePriceWithTax, formatCurrency } from "@/features/pos/utils";

interface ProductGridCardProps {
  product: Product;
  quantity: number;
  isOutOfStock: boolean;
  isActiveShift: boolean;
  onSelect: () => void;
  onToggleFavorite?: (productId: string) => void;
  isTogglingFavorite?: boolean;
}

export function ProductGridCard({
  product,
  quantity,
  isOutOfStock,
  isActiveShift,
  onSelect,
  onToggleFavorite,
  isTogglingFavorite,
}: ProductGridCardProps) {
  const stockLabel = product.trackInventory
    ? product.stock > 0
      ? `${product.stock} Unids.`
      : "Sin Stock"
    : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full text-left flex flex-col items-center rounded-xl border p-3 md:p-4 transition-all h-full",
          "bg-[#151515] border-[rgba(255,255,255,0.06)]",
          "hover:border-[#dfff06]/40 hover:shadow-[0_0_20px_rgba(223,255,6,0.08)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06]",
          isOutOfStock && "opacity-45"
        )}
      >
        {/* Quantity badge */}
        {quantity > 0 && (
          <div className="absolute top-2 right-2 z-10 bg-[#dfff06] text-black text-[10px] font-bold px-2 py-0.5 rounded-md">
            x{quantity}
          </div>
        )}

        {/* Icon centered */}
        <div className="flex size-11 md:h-12 md:w-12 items-center justify-center rounded-lg bg-[#1c1c1c] border border-[rgba(255,255,255,0.06)] mb-3">
          <Package className="size-4 md:h-5 md:w-5 text-[#3d3d3d]" />
        </div>

        {/* Name centered */}
        <h3 className="text-xs md:text-sm font-medium text-center text-white line-clamp-2 leading-snug mb-0.5">
          {product.name}
        </h3>

        {/* Price */}
        <p className="text-sm md:text-[15px] font-bold text-white tabular-nums mt-auto pt-2">
          {formatCurrency(calculatePriceWithTax(product))}
        </p>

        {/* Stock row */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.06)] w-full">
          {stockLabel ? (
            <span
              className={cn(
                "text-[10px] md:text-[11px] font-medium",
                product.stock > 0 ? "text-[#dfff06]" : "text-red-500"
              )}
            >
              {stockLabel}
            </span>
          ) : (
            <span />
          )}

          {onToggleFavorite && (
            <button
              type="button"
              disabled={isTogglingFavorite}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(product.id);
              }}
              className="p-1 rounded hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06] disabled:opacity-50"
            >
              <Heart
                className={cn(
                  "size-3.5 transition-colors",
                  product.isFavorite
                    ? "fill-red-500 text-red-500"
                    : "text-[#3d3d3d] hover:text-red-400"
                )}
              />
            </button>
          )}
        </div>
      </button>
    </div>
  );
}
