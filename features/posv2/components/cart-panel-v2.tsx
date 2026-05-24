import { Check, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CartItem, CartTotals, PaymentMethod } from "@/features/pos/types";
import { formatCurrency } from "@/features/pos/utils";
import { CheckoutSectionV2 } from "@/features/posv2/components/checkout-section-v2";
import {
  posV2OrderBorder,
  posV2OrderPanelBg,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";
import { CartItemCardV2 } from "./cart-item-card-v2";

interface CartPanelV2Props {
  canFinalize: boolean;
  canReturnCashChange: boolean;
  cart: CartItem[];
  cashChangeDue: number;
  checkoutError: Error | null;
  className?: string;
  isActiveShift: boolean;
  isProcessingCheckout: boolean;
  onAddPaymentMethod: () => void;
  onCheckout: () => void;
  onClearCart: () => void;
  onRemoveItem: (cartItemId: string) => void;
  onRemovePaymentMethod: (index: number) => void;
  onUpdateItemDiscount: (cartItemId: string, value: string) => void;
  onUpdatePayment: (
    index: number,
    field: "method" | "amount" | "reference",
    value: string
  ) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  paymentDifference: number;
  paymentMethodOptions: Array<{
    id: string;
    label: string;
    requiresReference: boolean;
  }>;
  payments: PaymentMethod[];
  totalItems: number;
  totalPaid: number;
  totals: CartTotals;
}

export function CartPanelV2({
  cart,
  totalItems,
  totals,
  payments,
  paymentMethodOptions,
  totalPaid,
  paymentDifference,
  canReturnCashChange,
  cashChangeDue,
  canFinalize,
  isProcessingCheckout,
  checkoutError,
  isActiveShift,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemDiscount,
  onClearCart,
  onUpdatePayment,
  onAddPaymentMethod,
  onRemovePaymentMethod,
  onCheckout,
  className,
}: CartPanelV2Props) {
  const { subTotal, tax, discountAmount, totalAmount } = totals;
  const hasDiscount = discountAmount > 0;

  return (
    <div
      className={cn(
        "grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-[rgba(255,255,255,0.06)] border-l",
        posV2OrderPanelBg,
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b p-3",
          posV2OrderBorder,
          posV2OrderPanelBg
        )}
      >
        <div>
          <h2 className="font-semibold text-base text-white leading-none">
            Orden Actual
          </h2>
          <p className="mt-1 text-[#6b6b6b] text-xs">{totalItems} artículos</p>
        </div>
        <Button
          aria-label="Limpiar carrito"
          className="h-8 rounded-lg px-2 font-medium text-red-400 text-xs transition-all hover:bg-red-400/10 hover:text-red-300"
          disabled={cart.length === 0}
          onClick={onClearCart}
          variant="ghost"
        >
          <Trash2 className="mr-1 size-4" />
          Limpiar
        </Button>
      </div>

      {/* Items — only this row scrolls */}
      <div
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain",
          posV2OrderPanelBg
        )}
      >
        <div className="space-y-1.5 px-2 py-2">
          {cart.map((item) => (
            <CartItemCardV2
              item={item}
              key={item.id}
              onRemove={() => onRemoveItem(item.id)}
              onUpdateDiscount={(value) => onUpdateItemDiscount(item.id, value)}
              onUpdateQuantity={(delta) => onUpdateQuantity(item.id, delta)}
            />
          ))}

          {cart.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-[#6b6b6b]">
              <div className="flex size-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)]">
                <Search className="size-4 text-[#3d3d3d]" />
              </div>
              <p className="text-sm">Escanea o selecciona un producto</p>
            </div>
          )}
        </div>
      </div>

      {/* Checkout — pinned bottom row */}
      {cart.length > 0 ? (
        <div
          className={cn(
            "border-t shadow-[0_-4px_16px_rgba(0,0,0,0.25)]",
            posV2OrderBorder,
            posV2OrderPanelBg
          )}
        >
          <div className="space-y-2.5 px-3 pt-3 pb-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[#6b6b6b] text-sm">
                <span>Subtotal</span>
                <span className="text-white tabular-nums">
                  {formatCurrency(subTotal)}
                </span>
              </div>
              <div className="flex justify-between text-[#6b6b6b] text-sm">
                <span>Impuestos</span>
                <span className="text-white tabular-nums">
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

              <div
                className={cn(
                  "mt-1.5 flex items-center justify-between border-t pt-2",
                  posV2OrderBorder
                )}
              >
                <span className="font-semibold text-sm text-white">Total</span>
                <span className="font-bold text-[#dfff06] text-lg tabular-nums">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            <CheckoutSectionV2
              canReturnCashChange={canReturnCashChange}
              cashChangeDue={cashChangeDue}
              error={checkoutError}
              onAddPaymentMethod={onAddPaymentMethod}
              onRemovePaymentMethod={onRemovePaymentMethod}
              onUpdatePayment={onUpdatePayment}
              paymentDifference={paymentDifference}
              paymentMethodOptions={paymentMethodOptions}
              payments={payments}
              totalAmount={totalAmount}
              totalPaid={totalPaid}
            />
          </div>

          <div className="px-3 pb-2">
            <Button
              className="h-9 w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#151515] font-semibold text-white text-xs shadow-none transition-all hover:border-[rgba(255,255,255,0.2)] hover:bg-[#1a1a1a] disabled:opacity-40"
              disabled={!canFinalize || isProcessingCheckout || !isActiveShift}
              onClick={onCheckout}
              type="button"
            >
              <Check className="mr-1.5 size-3.5" />
              {isProcessingCheckout
                ? "Procesando..."
                : `Cobrar — ${formatCurrency(totalAmount)}`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
