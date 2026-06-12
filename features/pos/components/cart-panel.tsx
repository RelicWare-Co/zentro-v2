import {
  LogOut,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";
import type { PosTableSessionState } from "../pos-page-context";
import type { CartItem, CartTotals } from "../types";
import { formatCurrency } from "../utils";
import { CartItemCard } from "./cart-item-card";
import { buildTableItemStatusBadge } from "./table-item-status.shared";

function CartPanelHeader({
  hasItems,
  onClearCart,
  onExitTable,
  tableSession,
  totalItems,
}: {
  hasItems: boolean;
  onClearCart: () => void;
  onExitTable?: () => void;
  tableSession?: PosTableSessionState | null;
  totalItems: number;
}) {
  if (tableSession) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-2 border-zinc-800 border-b bg-[#0f0f0f] p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UtensilsCrossed
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--color-voltage)]"
            />
            <h2 className="truncate font-semibold text-lg text-white leading-none">
              {tableSession.tableName}
            </h2>
          </div>
          <p className="mt-1 truncate text-xs text-zinc-400">
            {tableSession.areaName}
            {tableSession.orderNumber
              ? ` · Orden #${tableSession.orderNumber}`
              : ""}
            {` · ${totalItems} artículos`}
          </p>
        </div>
        <Button
          aria-label="Salir de la mesa"
          className="h-8 shrink-0 rounded-md px-2 font-medium text-xs text-zinc-400 transition-all hover:bg-white/5 hover:text-white"
          onClick={onExitTable}
          variant="ghost"
        >
          <LogOut className="mr-1 size-4" />
          Salir
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-zinc-800 border-b bg-[#0f0f0f] p-4">
      <div>
        <h2 className="font-semibold text-lg text-white leading-none">
          Orden Actual
        </h2>
        <p className="mt-1 text-xs text-zinc-400">{totalItems} artículos</p>
      </div>
      <Button
        aria-label="Limpiar carrito"
        className="h-8 rounded-md px-2 font-medium text-red-400 text-xs transition-all hover:bg-red-400/10 hover:text-red-300"
        disabled={!hasItems}
        onClick={onClearCart}
        variant="ghost"
      >
        <Trash2 className="mr-1 size-4" />
        Limpiar
      </Button>
    </div>
  );
}

interface CartPanelProps {
  cart: CartItem[];
  className?: string;
  deliveryInfo: string;
  isQuickSaleMode?: boolean;
  onCheckout: () => void;
  onClearCart: () => void;
  onDeliveryInfoChange: (value: string) => void;
  onExitTable?: () => void;
  onRemoveItem: (cartItemId: string) => void;
  onSendToKitchen?: () => void;
  onUpdateItemDiscount: (cartItemId: string, value: string) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  tableSession?: PosTableSessionState | null;
  totalItems: number;
  totals: CartTotals;
}

export function CartPanel({
  cart,
  deliveryInfo,
  totalItems,
  totals,
  onDeliveryInfoChange,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemDiscount,
  onClearCart,
  onCheckout,
  onExitTable,
  onSendToKitchen,
  isQuickSaleMode,
  tableSession,
  className,
}: CartPanelProps) {
  const { subTotal, tax, discountAmount, totalAmount } = totals;
  const hasDiscount = discountAmount > 0;

  let emptyCartMessage = "Escanea o selecciona un producto";
  if (tableSession) {
    emptyCartMessage = tableSession.isLoading
      ? "Cargando la cuenta de la mesa…"
      : "Agrega productos a la mesa";
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-[380px] shrink-0 flex-col overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)]",
        className
      )}
    >
      <CartPanelHeader
        hasItems={cart.length > 0}
        onClearCart={onClearCart}
        onExitTable={onExitTable}
        tableSession={tableSession}
        totalItems={totalItems}
      />

      {/* Items */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f0f0f] px-2 py-1">
        <div className="space-y-1 py-2">
          {cart.map((item) => {
            const itemStatus = tableSession?.itemStatusById[item.id];
            return (
              <CartItemCard
                item={item}
                key={item.id}
                onRemove={() => onRemoveItem(item.id)}
                onUpdateDiscount={(value) =>
                  onUpdateItemDiscount(item.id, value)
                }
                onUpdateQuantity={(delta) => onUpdateQuantity(item.id, delta)}
                readOnly={Boolean(itemStatus && itemStatus !== "draft")}
                showDiscount={!tableSession}
                statusBadge={buildTableItemStatusBadge(itemStatus)}
              />
            );
          })}

          {cart.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-zinc-500">
              <div className="flex size-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                {tableSession ? (
                  <UtensilsCrossed className="size-5 text-zinc-600" />
                ) : (
                  <Search className="size-5 text-zinc-600" />
                )}
              </div>
              <p className="text-sm">{emptyCartMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="shrink-0 border-zinc-800 border-t bg-[#0a0a0a] p-4">
        <div className="space-y-3">
          {tableSession ? null : (
            <div className="space-y-1.5">
              <label
                className="font-medium text-xs text-zinc-400"
                htmlFor="pos-delivery-info"
              >
                Info domicilio
              </label>
              <Textarea
                className="min-h-16 resize-none border-zinc-800 bg-[#0f0f0f] text-sm text-white placeholder:text-zinc-600"
                id="pos-delivery-info"
                maxLength={280}
                onChange={(event) => onDeliveryInfoChange(event.target.value)}
                placeholder="Dirección, referencia o instrucciones"
                value={deliveryInfo}
              />
            </div>
          )}

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

          {tableSession ? (
            <Button
              className="w-full border-zinc-700 bg-transparent text-zinc-100 hover:bg-white/5"
              disabled={
                tableSession.draftItemsCount === 0 ||
                tableSession.isSendingToKitchen
              }
              onClick={onSendToKitchen}
              type="button"
              variant="outline"
            >
              <Send aria-hidden="true" className="size-4" />
              {tableSession.isSendingToKitchen
                ? "Enviando a cocina..."
                : `Enviar a cocina${
                    tableSession.draftItemsCount > 0
                      ? ` (${tableSession.draftItemsCount})`
                      : ""
                  }`}
            </Button>
          ) : null}

          <Button
            className="mt-2 h-12 w-full rounded-xl bg-[var(--color-voltage)] font-bold text-base text-black shadow-[0_4px_14px_rgba(201,230,5,0.2)] transition-all hover:bg-[#c9e605] hover:shadow-[0_6px_20px_rgba(201,230,5,0.3)]"
            disabled={cart.length === 0}
            onClick={onCheckout}
          >
            {isQuickSaleMode ? (
              <span className="flex items-center gap-1.5">
                <Zap className="size-4" />
                {tableSession ? "Cobrar mesa" : "Cobrar"}
              </span>
            ) : (
              <span>{tableSession ? "Cobrar mesa" : "Cobrar"}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
