import { Button } from "@mantine/core";
import {
  LogOut,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { PosTableSessionState } from "../pos-page-context";
import type { PosTableOrderItemStatus } from "../sale-modes/types";
import type { CartItem, CartTotals } from "../types";
import { formatCurrency } from "../utils";
import { CartItemCard } from "./cart-item-card";
import { SaleSuccessNotice } from "./sale-success-notice";
import { buildTableItemStatusBadge } from "./table-item-status.shared";

const noop = () => {
  /* intentionally no-op for read-only overlays */
};

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
    <div className="flex shrink-0 items-center justify-between gap-2 border-zinc-800 border-b p-4">
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

function CartSummary({ totals }: { totals: CartTotals }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm text-zinc-400">
        <span>Subtotal</span>
        <span className="text-zinc-200 tabular-nums">
          {formatCurrency(totals.subTotal)}
        </span>
      </div>
      <div className="flex justify-between text-sm text-zinc-400">
        <span>Impuestos</span>
        <span className="text-zinc-200 tabular-nums">
          {formatCurrency(totals.tax)}
        </span>
      </div>
      {totals.discountAmount > 0 && (
        <div className="flex justify-between text-red-400 text-sm">
          <span>Descuento</span>
          <span className="tabular-nums">
            -{formatCurrency(totals.discountAmount)}
          </span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-zinc-800/80 border-t pt-2">
        <span className="font-bold text-base text-white">Total</span>
        <span className="font-bold text-[var(--color-voltage)] text-xl tabular-nums">
          {formatCurrency(totals.totalAmount)}
        </span>
      </div>
    </div>
  );
}

function CartEmptyState({
  message,
  isTable,
}: {
  message: string;
  isTable: boolean;
}) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-zinc-500">
      <div className="flex size-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
        {isTable ? (
          <UtensilsCrossed className="size-5 text-zinc-600" />
        ) : (
          <Search className="size-5 text-zinc-600" />
        )}
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function CartFooter({
  cart,
  isQuickSaleMode,
  onCheckout,
  onSendToKitchen,
  tableSession,
}: {
  cart: CartItem[];
  isQuickSaleMode: boolean;
  onCheckout: () => void;
  onSendToKitchen?: () => void;
  tableSession?: PosTableSessionState | null;
}) {
  return (
    <div className="space-y-3">
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
        leftSection={isQuickSaleMode ? <Zap className="size-4" /> : undefined}
        onClick={onCheckout}
      >
        {tableSession ? "Cobrar mesa" : "Cobrar"}
      </Button>
    </div>
  );
}

function CartItemList({
  items,
  readOnly,
  showDiscount,
  emptyMessage,
  isTable,
  itemStatusById,
  onRemoveItem,
  onUpdateItemDiscount,
  onUpdateQuantity,
}: {
  items: CartItem[];
  readOnly: boolean;
  showDiscount: boolean;
  emptyMessage: string;
  isTable: boolean;
  itemStatusById?: Record<string, PosTableOrderItemStatus>;
  onRemoveItem: (cartItemId: string) => void;
  onUpdateItemDiscount: (cartItemId: string, value: string) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
}) {
  return (
    <div className="space-y-1 py-2">
      {items.map((item) => {
        const itemStatus = itemStatusById?.[item.id];
        const itemReadOnly =
          readOnly || Boolean(itemStatus && itemStatus !== "draft");
        return (
          <CartItemCard
            item={item}
            key={item.id}
            onRemove={itemReadOnly ? noop : () => onRemoveItem(item.id)}
            onUpdateDiscount={
              itemReadOnly
                ? noop
                : (value) => onUpdateItemDiscount(item.id, value)
            }
            onUpdateQuantity={
              itemReadOnly ? noop : (delta) => onUpdateQuantity(item.id, delta)
            }
            readOnly={itemReadOnly}
            showDiscount={showDiscount}
            statusBadge={buildTableItemStatusBadge(itemStatus)}
          />
        );
      })}
      {items.length === 0 && (
        <CartEmptyState isTable={isTable} message={emptyMessage} />
      )}
    </div>
  );
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
  const [enterSnapshot, setEnterSnapshot] = useState<{
    cart: CartItem[];
    totalItems: number;
    totals: CartTotals;
  } | null>(null);
  const [exitSnapshot, setExitSnapshot] = useState<{
    tableSession: PosTableSessionState;
    cart: CartItem[];
    totalItems: number;
    totals: CartTotals;
  } | null>(null);
  const [animClass, setAnimClass] = useState<
    "cart-slide-in" | "cart-slide-out" | ""
  >("");

  const prevTableSession = useRef(tableSession);
  const prevCart = useRef(cart);
  const prevTotalItems = useRef(totalItems);
  const prevTotals = useRef(totals);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wasTable = Boolean(prevTableSession.current);
  const isTable = Boolean(tableSession);

  if (!wasTable && isTable) {
    setEnterSnapshot({
      cart: prevCart.current,
      totalItems: prevTotalItems.current,
      totals: prevTotals.current,
    });
    setExitSnapshot(null);
    setAnimClass("cart-slide-in");
  } else if (wasTable && !isTable && prevTableSession.current) {
    setEnterSnapshot(null);
    setExitSnapshot({
      tableSession: prevTableSession.current,
      cart: prevCart.current,
      totalItems: prevTotalItems.current,
      totals: prevTotals.current,
    });
    setAnimClass("cart-slide-out");
  }

  prevTableSession.current = tableSession;
  prevCart.current = cart;
  prevTotalItems.current = totalItems;
  prevTotals.current = totals;

  useEffect(() => {
    if (!animClass) {
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setEnterSnapshot(null);
      setExitSnapshot(null);
      setAnimClass("");
      timerRef.current = null;
    }, 350);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [animClass]);

  const baseCart = enterSnapshot?.cart ?? cart;
  const baseTotalItems = enterSnapshot?.totalItems ?? totalItems;
  const baseTotals = enterSnapshot?.totals ?? totals;
  const baseTableSession = enterSnapshot ? null : tableSession;

  let emptyCartMessage = "Escanea o selecciona un producto";
  if (baseTableSession) {
    emptyCartMessage = baseTableSession.isLoading
      ? "Cargando la cuenta de la mesa…"
      : "Agrega productos a la mesa";
  }

  const exitEmptyCartMessage = exitSnapshot?.tableSession.isLoading
    ? "Cargando la cuenta de la mesa…"
    : "Agrega productos a la mesa";

  return (
    <div
      className={cn(
        "relative flex min-h-0 w-[380px] shrink-0 flex-col overflow-hidden border-zinc-800 border-l",
        className
      )}
    >
      {/* Base layer: always rendered */}
      <div className="flex min-h-0 flex-1 flex-col">
        <CartPanelHeader
          hasItems={baseCart.length > 0}
          onClearCart={onClearCart}
          onExitTable={onExitTable}
          tableSession={baseTableSession}
          totalItems={baseTotalItems}
        />

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-2 py-1",
            baseTableSession && "bg-[#0f0f0f]"
          )}
        >
          <CartItemList
            emptyMessage={emptyCartMessage}
            isTable={Boolean(baseTableSession)}
            itemStatusById={baseTableSession?.itemStatusById}
            items={baseCart}
            onRemoveItem={onRemoveItem}
            onUpdateItemDiscount={onUpdateItemDiscount}
            onUpdateQuantity={onUpdateQuantity}
            readOnly={false}
            showDiscount={!baseTableSession}
          />
        </div>

        <div className="shrink-0 border-zinc-800 border-t bg-[#0a0a0a] p-4">
          <CartSummary totals={baseTotals} />
          <div className="mt-3">
            <CartFooter
              cart={baseCart}
              isQuickSaleMode={Boolean(isQuickSaleMode)}
              onCheckout={onCheckout}
              onSendToKitchen={onSendToKitchen}
              tableSession={baseTableSession}
            />
          </div>
        </div>
      </div>

      {/* Enter overlay: new table content sliding up over the normal cart */}
      {enterSnapshot && (
        <div
          className={cn(
            "absolute inset-0 z-10 flex min-h-0 flex-1 flex-col bg-[#0f0f0f]",
            animClass === "cart-slide-in" &&
              "animate-[cart-slide-in_300ms_ease-out_both]"
          )}
        >
          <CartPanelHeader
            hasItems={cart.length > 0}
            onClearCart={onClearCart}
            onExitTable={onExitTable}
            tableSession={tableSession}
            totalItems={totalItems}
          />

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f0f0f] px-2 py-1">
            <CartItemList
              emptyMessage={emptyCartMessage}
              isTable={Boolean(tableSession)}
              itemStatusById={tableSession?.itemStatusById}
              items={cart}
              onRemoveItem={noop}
              onUpdateItemDiscount={noop}
              onUpdateQuantity={noop}
              readOnly
              showDiscount={false}
            />
          </div>

          <div className="shrink-0 border-zinc-800 border-t bg-[#0a0a0a] p-4">
            <CartSummary totals={totals} />
            <div className="mt-3">
              <CartFooter
                cart={cart}
                isQuickSaleMode={Boolean(isQuickSaleMode)}
                onCheckout={onCheckout}
                onSendToKitchen={onSendToKitchen}
                tableSession={tableSession}
              />
            </div>
          </div>
        </div>
      )}

      {/* Exit overlay: old table content sliding down to reveal normal order */}
      {exitSnapshot && (
        <div
          className={cn(
            "absolute inset-0 z-10 flex min-h-0 flex-1 flex-col bg-[#0f0f0f]",
            animClass === "cart-slide-out" &&
              "animate-[cart-slide-out_300ms_ease-out_forwards]"
          )}
        >
          <CartPanelHeader
            hasItems={exitSnapshot.cart.length > 0}
            onClearCart={onClearCart}
            onExitTable={onExitTable}
            tableSession={exitSnapshot.tableSession}
            totalItems={exitSnapshot.totalItems}
          />

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f0f0f] px-2 py-1">
            <CartItemList
              emptyMessage={exitEmptyCartMessage}
              isTable
              items={exitSnapshot.cart}
              onRemoveItem={noop}
              onUpdateItemDiscount={noop}
              onUpdateQuantity={noop}
              readOnly
              showDiscount={false}
            />
          </div>

          <div className="shrink-0 border-zinc-800 border-t bg-[#0a0a0a] p-4">
            <CartSummary totals={exitSnapshot.totals} />
            <div className="mt-3">
              <Button
                className="mt-2 h-12 rounded-xl bg-[var(--color-voltage)]! font-bold text-base text-black! hover:bg-[#c9e605]"
                disabled
                fullWidth
              >
                Cobrar mesa
              </Button>
            </div>
          </div>
        </div>
      )}

      <SaleSuccessNotice token={saleSuccessToken} />
    </div>
  );
}
