import { Heart, Package } from "lucide-react";
import type { Product } from "@/features/pos/types";
import { calculatePriceWithTax, formatCurrency } from "@/features/pos/utils";
import { cn } from "@/lib/utils";

interface ProductGridCardProps {
  isActiveShift: boolean;
  isOutOfStock: boolean;
  isTogglingFavorite?: boolean;
  onSelect: () => void;
  onToggleFavorite?: (productId: string) => void;
  product: Product;
  quantity: number;
}

export function ProductGridCard({
  product,
  quantity,
  isOutOfStock,
  isActiveShift: _isActiveShift,
  onSelect,
  onToggleFavorite,
  isTogglingFavorite,
}: ProductGridCardProps) {
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
          "flex h-full w-full flex-col items-center rounded-xl border p-3 text-left transition-all md:p-4",
          "border-[rgba(255,255,255,0.06)] bg-[#151515]",
          "hover:border-[#dfff06]/40 hover:shadow-[0_0_20px_rgba(223,255,6,0.08)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06]",
          isOutOfStock && "opacity-45"
        )}
        onClick={onSelect}
        type="button"
      >
        {/* Quantity badge */}
        {quantity > 0 && (
          <div className="absolute top-2 right-2 z-10 rounded-md bg-[#dfff06] px-2 py-0.5 font-bold text-[10px] text-black">
            x{quantity}
          </div>
        )}

        {/* Icon centered */}
        <div className="mb-3 flex size-11 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1c1c1c] md:h-12 md:w-12">
          <Package className="size-4 text-[#3d3d3d] md:h-5 md:w-5" />
        </div>

        {/* Name centered */}
        <h3 className="mb-0.5 line-clamp-2 text-center font-medium text-white text-xs leading-snug md:text-sm">
          {product.name}
        </h3>

        {/* Price */}
        <p className="mt-auto pt-2 font-bold text-sm text-white tabular-nums md:text-[15px]">
          {formatCurrency(calculatePriceWithTax(product))}
        </p>

        {/* Stock row */}
        <div className="mt-2 flex w-full items-center justify-between border-[rgba(255,255,255,0.06)] border-t pt-2">
          {stockLabel ? (
            <span
              className={cn(
                "font-medium text-[10px] md:text-[11px]",
                product.stock > 0 ? "text-[#dfff06]" : "text-red-500"
              )}
            >
              {stockLabel}
            </span>
          ) : (
            <span />
          )}
        </div>
      </button>

      {onToggleFavorite && (
        <button
          aria-label={
            product.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
          }
          aria-pressed={product.isFavorite}
          className="absolute right-2 bottom-2 z-10 rounded p-1 hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dfff06] disabled:opacity-50"
          disabled={isTogglingFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          type="button"
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
  );
}
