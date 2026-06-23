import { Heart, Package } from "lucide-react";
import { usePosPage } from "@/features/pos/pos-page-context";
import type { Product } from "@/features/pos/types";
import { calculatePriceWithTax, formatCurrency } from "@/features/pos/utils";
import {
  posV2AccentFocusRing,
  posV2AccentHoverBorder,
  posV2AccentSoftShadow,
  posV2AccentText,
  posV2IconText,
  posV2MutedText,
  posV2OrderBorderSubtle,
  posV2OrderCarbonBg,
  posV2OrderHoverSurface,
  posV2OrderSurfaceBg,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

export function ProductListItem({
  product,
  quantity: _quantity,
  onSelect,
}: {
  product: Product;
  quantity: number;
  onSelect: () => void;
}) {
  const { actions, meta } = usePosPage();
  const isOutOfStock = product.trackInventory && product.stock <= 0;

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
          "flex w-full items-center gap-3 rounded-xl border p-3 pr-12 text-left transition-all md:gap-4 md:p-4",
          posV2OrderBorderSubtle,
          posV2OrderSurfaceBg,
          posV2AccentHoverBorder,
          posV2AccentSoftShadow,
          posV2AccentFocusRing,
          isOutOfStock && "opacity-45"
        )}
        onClick={onSelect}
        type="button"
      >
        <div className="shrink-0">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg border md:h-11 md:w-11",
              posV2OrderBorderSubtle,
              posV2OrderCarbonBg
            )}
          >
            <Package className={cn("size-4 md:h-5 md:w-5", posV2IconText)} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-sm text-white md:text-[15px]">
            {product.name}
          </h3>
          <p
            className={cn(
              "mt-0.5 font-medium text-[10px] md:text-[11px]",
              posV2MutedText
            )}
          >
            {product.categoryName}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {stockLabel ? (
              <span
                className={cn(
                  "font-medium text-[10px] md:text-[11px]",
                  product.stock > 0 ? posV2AccentText : "text-red-500"
                )}
              >
                {stockLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-bold text-sm text-white tabular-nums md:text-base">
            {formatCurrency(calculatePriceWithTax(product))}
          </p>
        </div>
      </button>

      <button
        aria-label={
          product.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
        }
        aria-pressed={product.isFavorite}
        className={cn(
          "absolute top-1/2 right-3 z-10 -translate-y-1/2 rounded-md p-1.5 disabled:opacity-50",
          posV2OrderHoverSurface,
          posV2AccentFocusRing
        )}
        disabled={meta.isTogglingFavorite}
        onClick={(event) => {
          event.stopPropagation();
          actions.toggleProductFavorite(product.id);
        }}
        type="button"
      >
        <Heart
          className={cn(
            "size-4 transition-colors md:h-5 md:w-5",
            product.isFavorite
              ? "fill-red-500 text-red-500"
              : `${posV2IconText} hover:text-red-400`
          )}
        />
      </button>
    </div>
  );
}
