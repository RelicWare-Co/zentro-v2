import { Button } from "@mantine/core";
import {
  LogOut,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { PosTableSessionState } from "../pos-page-context";
import type { CartItem, CartTotals } from "../types";
import { formatCurrency } from "../utils";
import { CartItemCard } from "./cart-item-card";
import { SaleSuccessNotice } from "./sale-success-notice";
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
          className="shrink-0 text-zinc-400! hover:bg-white/5 hover:text-white!"
          leftSection={<LogOut className="size-4" />}
          onClick={onExitTable}
          size="compact-sm"
          variant="subtle"
        >
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
        className="text-red-400! hover:bg-red-400/10 hover:text-red-300!"
        color="red"
        disabled={!hasItems}
        leftSection={<Trash2 className="size-4" />}
        onClick={onClearCart}
        size="compact-sm"
        variant="subtle"
      >
        Limpiar
      </Button>
    </div>
  );
}

interface CartPanelProps {
  cart: CartItem[];
  className?: string;
  isQuickSaleMode?: boolean;
  onCheckout: () => void;
  onClearCart: () => void;
  onExitTable?: () => void;
  onRemoveItem: (cartItemId: string) => void;
  onSendToKitchen?: () => void;
  onUpdateItemDiscount: (cartItemId: string, value: string) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  saleSuccessToken: number | null;
  tableSession?: PosTableSessionState | null;
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
  onExitTable,
  onSendToKitchen,
  isQuickSaleMode,
  tableSession,
  className,
  saleSuccessToken,
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
        "relative flex min-h-0 w-[380px] shrink-0 flex-col overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)]",
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
              className="border-zinc-700! text-zinc-300! hover:border-zinc-500 hover:text-white"
              disabled={
                tableSession.draftItemsCount === 0 ||
                tableSession.isSendingToKitchen
              }
              fullWidth
              leftSection={<Send aria-hidden="true" className="size-4" />}
              onClick={onSendToKitchen}
              type="button"
              variant="outline"
            >
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
            className="mt-2 h-12 rounded-xl bg-[var(--color-voltage)]! font-bold text-base text-black! hover:bg-[#c9e605]"
            disabled={cart.length === 0}
            fullWidth
            leftSection={
              isQuickSaleMode ? <Zap className="size-4" /> : undefined
            }
            onClick={onCheckout}
          >
            {tableSession ? "Cobrar mesa" : "Cobrar"}
          </Button>
        </div>
      </div>

      <SaleSuccessNotice token={saleSuccessToken} />
    </div>
  );
}
