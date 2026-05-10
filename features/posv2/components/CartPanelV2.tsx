import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import type { CartItem, CartTotals } from "@/features/pos/types";
import { formatCurrency } from "@/features/pos/utils";
import { CartItemCardV2 } from "./CartItemCardV2";

interface CartPanelV2Props {
  cart: CartItem[];
  totalItems: number;
  totals: CartTotals;
  isActiveShift: boolean;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onUpdateItemDiscount: (cartItemId: string, value: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  className?: string;
}

export function CartPanelV2({
  cart,
  totalItems,
  totals,
  isActiveShift,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemDiscount,
  onClearCart,
  onCheckout,
  className,
}: CartPanelV2Props) {
  const { subTotal, tax, discountAmount, totalAmount } = totals;
  const hasDiscount = discountAmount > 0;

  return (
    <div
      className={cn(
        "w-[380px] bg-[#111111] flex flex-col shrink-0 min-h-0 overflow-hidden border-l border-[rgba(255,255,255,0.06)]",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between shrink-0 bg-[#111111]">
        <div>
          <h2 className="text-base font-bold text-white leading-none">
            Orden Actual
          </h2>
          <p className="text-xs text-[#6b6b6b] mt-1">{totalItems} artículos</p>
        </div>
        <Button
          variant="ghost"
          onClick={onClearCart}
          disabled={cart.length === 0}
          className="text-red-400 hover:text-red-300 hover:bg-red-400/10 font-medium h-8 px-2 text-xs rounded-lg transition-all"
          aria-label="Limpiar carrito"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      </div>

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 bg-[#111111]">
        <div className="space-y-1.5 py-2">
          {cart.map((item) => (
            <CartItemCardV2
              key={item.id}
              item={item}
              onUpdateQuantity={(delta) => onUpdateQuantity(item.id, delta)}
              onRemove={() => onRemoveItem(item.id)}
              onUpdateDiscount={(value) => onUpdateItemDiscount(item.id, value)}
            />
          ))}

          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-[#6b6b6b] space-y-2">
              <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.04)] flex items-center justify-center border border-[rgba(255,255,255,0.06)]">
                <Search className="h-4 w-4 text-[#3d3d3d]" />
              </div>
              <p className="text-sm">Escanea o selecciona un producto</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="p-4 bg-[#0a0a0a] border-t border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-[#6b6b6b]">
              <span>Subtotal</span>
              <span className="text-white tabular-nums">
                {formatCurrency(subTotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-[#6b6b6b]">
              <span>Impuestos</span>
              <span className="text-white tabular-nums">
                {formatCurrency(tax)}
              </span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-sm text-red-400">
                <span>Descuento</span>
                <span className="tabular-nums">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-[rgba(255,255,255,0.08)] mt-2">
              <span className="font-bold text-base text-white">Total</span>
              <span className="font-bold text-xl text-[#dfff06] tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <Button
            className="w-full h-11 bg-[#dfff06] hover:bg-[#c9e605] text-black font-bold text-sm rounded-xl transition-all shadow-[0_4px_14px_rgba(201,230,5,0.15)] hover:shadow-[0_6px_20px_rgba(201,230,5,0.25)]"
            disabled={cart.length === 0 || !isActiveShift}
            onClick={onCheckout}
          >
            Cobrar
          </Button>
        </div>
      </div>
    </div>
  );
}
