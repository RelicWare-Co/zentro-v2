import { Heart, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/features/pos/types";
import { formatCurrency } from "@/features/pos/utils";

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
        disabled={!isActiveShift && isOutOfStock}
        className={cn(
          "w-full text-left flex flex-col items-center rounded-xl border p-3 md:p-4 transition-all h-full",
          "bg-[var(--color-card)] border-[var(--color-border)]",
          "hover:border-[var(--color-voltage)]/50 hover:shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]",
          isOutOfStock && "opacity-60"
        )}
      >
        {/* Quantity badge */}
        {quantity > 0 && (
          <div className="absolute top-2 right-2 z-10 bg-[var(--color-voltage)] text-black text-[10px] font-bold px-2 py-0.5 rounded-md">
            x{quantity}
          </div>
        )}

        {/* Icon centered */}
        <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-xl bg-[var(--color-muted)] border border-[var(--color-border)] mb-3">
          <Package className="h-5 w-5 md:h-6 md:w-6 text-[var(--color-muted-foreground)]" />
        </div>

        {/* Name centered */}
        <h3 className="text-sm md:text-[15px] font-semibold text-center text-[var(--color-foreground)] line-clamp-2 leading-snug mb-1">
          {product.name}
        </h3>

        {/* Price */}
        <p
          className={cn(
            "text-base md:text-lg font-bold tabular-nums mt-auto pt-2",
            "text-[var(--color-foreground)] dark:text-[var(--color-voltage)]"
          )}
        >
          {formatCurrency(product.price)}
        </p>

        {/* Stock row */}
        <div className="flex items-center justify-center mt-2 pt-2 border-t border-[var(--color-border)] w-full">
          {stockLabel ? (
            <span
              className={cn(
                "text-[11px] md:text-xs font-medium",
                product.stock > 0
                  ? "text-[var(--color-muted-foreground)] dark:text-[var(--color-voltage)]"
                  : "text-red-500"
              )}
            >
              {stockLabel}
            </span>
          ) : (
            <span className="text-[11px] md:text-xs text-transparent">.</span>
          )}
        </div>
      </button>

      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          type="button"
          disabled={isTogglingFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className="absolute bottom-3 right-3 md:bottom-4 md:right-4 p-1.5 rounded-md hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)] disabled:opacity-50"
        >
          <Heart
            className={cn(
              "h-4 w-4 md:h-5 md:w-5 transition-colors",
              product.isFavorite
                ? "fill-red-500 text-red-500"
                : "text-[var(--color-muted-foreground)] hover:text-red-400"
            )}
          />
        </button>
      )}
    </div>
  );
}
