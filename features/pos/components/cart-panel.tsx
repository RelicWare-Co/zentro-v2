import { Search, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import type { CartItem, CartTotals } from "../types";
import { formatCurrency } from "../utils";
import { CartItemCard } from "./cart-item-card";

interface CartPanelProps {
  cart: CartItem[];
  className?: string;
  isQuickSaleMode?: boolean;
  onCheckout: () => void;
  onClearCart: () => void;
  onRemoveItem: (cartItemId: string) => void;
  onUpdateItemDiscount: (cartItemId: string, value: string) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  totalItems: number;
  totals: CartTotals;
}

export function CartPanel({
  cart,
  totalItems,
  totals,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemDiscount,
  onClearCart,
  onCheckout,
  isQuickSaleMode,
  className,
}: CartPanelProps) {
  const { subTotal, tax, discountAmount, totalAmount } = totals;
  const hasDiscount = discountAmount > 0;

  return (
    <div
      className={cn(
        "flex min-h-0 w-[380px] shrink-0 flex-col overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-zinc-800 border-b bg-[#0f0f0f] p-4">
        <div>
          <h2 className="font-semibold text-lg text-white leading-none">
            Orden Actual
          </h2>
          <p className="mt-1 text-xs text-zinc-400">{totalItems} artículos</p>
        </div>
        <Button
          aria-label="Limpiar carrito"
          className="h-8 rounded-md px-2 font-medium text-red-400 text-xs transition-all hover:bg-red-400/10 hover:text-red-300"
          disabled={cart.length === 0}
          onClick={onClearCart}
          variant="ghost"
        >
          <Trash2 className="mr-1 size-4" />
          Limpiar
        </Button>
      </div>

      {/* Items */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f0f0f] px-2 py-1">
        <div className="space-y-1 py-2">
          {cart.map((item) => (
            <CartItemCard
              item={item}
              key={item.id}
              onRemove={() => onRemoveItem(item.id)}
              onUpdateDiscount={(value) => onUpdateItemDiscount(item.id, value)}
              onUpdateQuantity={(delta) => onUpdateQuantity(item.id, delta)}
            />
          ))}

          {cart.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-zinc-500">
              <div className="flex size-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                <Search className="size-5 text-zinc-600" />
              </div>
              <p className="text-sm">Escanea o selecciona un producto</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="shrink-0 border-zinc-800 border-t bg-[#0a0a0a] p-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span className="text-zinc-200 tabular-nums">
                {formatCurrency(subTotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Impuestos</span>
              <span className="text-zinc-200 tabular-nums">
                {formatCurrency(tax)}
              </span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-red-400 text-sm">
                <span>Descuento</span>
                <span className="tabular-nums">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-zinc-800/80 border-t pt-2">
              <span className="font-bold text-base text-white">Total</span>
              <span className="font-bold text-[var(--color-voltage)] text-xl tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <Button
            className="mt-2 h-12 w-full rounded-xl bg-[var(--color-voltage)] font-bold text-base text-black shadow-[0_4px_14px_rgba(201,230,5,0.2)] transition-all hover:bg-[#c9e605] hover:shadow-[0_6px_20px_rgba(201,230,5,0.3)]"
            disabled={cart.length === 0}
            onClick={onCheckout}
          >
            {isQuickSaleMode ? (
              <span className="flex items-center gap-1.5">
                <Zap className="size-4" />
                Cobrar
              </span>
            ) : (
              "Cobrar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
