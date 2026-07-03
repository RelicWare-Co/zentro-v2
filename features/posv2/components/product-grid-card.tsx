import { Heart, Package } from "lucide-react";
import { usePosPage } from "@/features/pos/pos-page-context";
import type { Product } from "@/features/pos/types";
import { calculatePriceWithTax, formatCurrency } from "@/features/pos/utils";
import {
  posV2AccentBg,
  posV2AccentFocusRing,
  posV2AccentHoverBorder,
  posV2AccentSelectedBorder,
  posV2AccentSoftShadow,
  posV2AccentText,
  posV2IconText,
  posV2MutedText,
  posV2OrderBorderSubtle,
  posV2OrderCarbonBg,
  posV2OrderSurfaceBg,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";

export function ProductGridCard({
  product,
  quantity,
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

  const isInCart = quantity > 0;

  return (
    <div className="relative">
      <button
        className={cn(
          "flex h-full w-full flex-col items-center rounded-xl border p-3 text-left transition-all md:p-4",
          posV2OrderBorderSubtle,
          posV2OrderSurfaceBg,
          posV2AccentHoverBorder,
          posV2AccentSoftShadow,
          posV2AccentFocusRing,
          isInCart && posV2AccentSelectedBorder,
          isOutOfStock && "opacity-45"
        )}
        onClick={onSelect}
        type="button"
      >
        {quantity > 0 ? (
          <div
            className={cn(
              "absolute top-2 right-2 z-10 rounded-md px-2 py-0.5 font-bold text-[10px] text-black",
              posV2AccentBg
            )}
          >
            x{quantity}
          </div>
        ) : null}

        <div
          className={cn(
            "mb-3 flex size-11 items-center justify-center rounded-lg border md:h-12 md:w-12",
            posV2OrderBorderSubtle,
            posV2OrderCarbonBg
          )}
        >
          <Package className={cn("size-4 md:h-5 md:w-5", posV2IconText)} />
        </div>

        <h3 className="mb-0.5 line-clamp-2 text-center font-medium text-white text-xs leading-snug md:text-sm">
          {product.name}
        </h3>

        <p
          className={cn(
            "mt-1 text-center font-medium text-[10px] md:text-[11px]",
            posV2MutedText
          )}
        >
          {product.categoryName}
        </p>

        <p className="mt-auto pt-2 font-bold text-sm text-white tabular-nums md:text-[15px]">
          {formatCurrency(calculatePriceWithTax(product))}
        </p>

        <div
          className={cn(
            "mt-2 flex w-full items-center justify-between border-t pt-2",
            posV2OrderBorderSubtle
          )}
        >
          {stockLabel ? (
            <span
              className={cn(
                "font-medium text-[10px] leading-[1.2] md:text-[11px]",
                product.stock > 0 ? posV2AccentText : "text-red-500"
              )}
            >
              {stockLabel}
            </span>
          ) : (
            <span className="block min-h-[12.2px] md:min-h-[13.2px]" />
          )}
        </div>
      </button>

      <button
        aria-label={
          product.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
        }
        aria-pressed={product.isFavorite}
        className={cn(
          "absolute right-2 bottom-2 z-10 rounded p-0.5 disabled:opacity-50",
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
            "size-3.5 transition-colors",
            product.isFavorite
              ? "fill-red-500 text-red-500"
              : `${posV2IconText} hover:text-red-400`
          )}
        />
      </button>
    </div>
  );
}
