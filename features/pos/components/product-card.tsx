import { Heart } from "lucide-react";
import { usePosPage } from "@/features/pos/pos-page-context";
import type { Product } from "@/features/pos/types";
import { formatCurrency } from "@/features/pos/utils";

export function ProductCard({
  product,
  quantity,
  onSelect,
}: {
  product: Product;
  quantity: number;
  onSelect: () => void;
}) {
  const { state, actions, meta } = usePosPage();
  const isOutOfStock = product.trackInventory && product.stock <= 0;
  const outOfStockAlert = isOutOfStock && state.isActiveShift;
  const noShiftAlert = !state.isActiveShift;

  return (
    <div className="relative">
      <button
        className={`relative block w-full cursor-pointer overflow-hidden rounded-xl border border-zinc-800/80 bg-[#151515] p-3 text-left transition-all hover:border-[var(--color-voltage)]/50 hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)] group${state.isActiveShift ? "" : "ring-1 ring-amber-500/20"}
				`}
        onClick={onSelect}
        type="button"
      >
        {quantity > 0 ? (
          <div className="absolute top-0 right-0 z-10 rounded-tr-xl rounded-bl-lg bg-[var(--color-voltage)] px-2 py-0.5 font-bold text-[10px] text-black">
            x{quantity}
          </div>
        ) : null}

        <div className="mt-3 w-full">
          <h3
            className="line-clamp-2 font-semibold text-sm text-white leading-snug transition-colors group-hover:text-[var(--color-voltage)]"
            title={product.name}
          >
            {product.name}
          </h3>
          <p className="mt-1 font-medium text-[11px] text-zinc-500">
            {product.categoryName}
          </p>
          {product.trackInventory ? (
            <p
              className={`mt-1 font-medium text-[10px] ${
                isOutOfStock ? "text-red-400" : "text-zinc-500"
              }`}
            >
              Stock: {product.stock}
            </p>
          ) : null}
        </div>

        <div className="mt-3">
          <p className="font-bold text-[15px] text-white tabular-nums tracking-tight">
            {formatCurrency(product.price)}
          </p>
          {outOfStockAlert ? (
            <p className="mt-1 font-medium text-[10px] text-amber-400">
              La venta puede dejar stock negativo
            </p>
          ) : null}
          {noShiftAlert ? (
            <p className="mt-1 font-medium text-[10px] text-amber-400">
              Abre el turno para vender
            </p>
          ) : null}
        </div>
      </button>

      <button
        aria-label={
          product.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
        }
        aria-pressed={product.isFavorite}
        className="absolute top-1.5 left-1.5 z-10 rounded-md p-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={meta.isTogglingFavorite}
        onClick={(event) => {
          event.stopPropagation();
          actions.toggleProductFavorite(product.id);
        }}
        type="button"
      >
        <Heart
          className={`size-4 transition-colors ${
            product.isFavorite
              ? "fill-red-500 text-red-500"
              : "text-zinc-600 hover:text-red-400"
          }`}
        />
      </button>
    </div>
  );
}
