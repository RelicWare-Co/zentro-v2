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
        "bg-[var(--color-card)] border-[var(--color-border)]",
        "hover:border-[var(--color-voltage)]/50 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]",
        isOutOfStock && "opacity-60"
      )}
    >
      {/* Icon / Image Placeholder */}
      <div className="shrink-0">
        <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)]">
          <Package className="h-4 w-4 md:h-5 md:w-5 text-[var(--color-muted-foreground)]" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm md:text-base font-semibold text-[var(--color-foreground)] truncate">
          {product.name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          {stockLabel && (
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
          )}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="text-sm md:text-base font-bold tabular-nums text-[var(--color-foreground)] dark:text-[var(--color-voltage)]">
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
          className="shrink-0 p-1.5 rounded-md hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)] disabled:opacity-50"
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
    </button>
  );
}
