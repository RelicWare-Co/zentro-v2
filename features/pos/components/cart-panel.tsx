import { Button } from "@mantine/core";
import {
  LogOut,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

type AnimationClass =
  | "cart-slide-in"
  | "cart-slide-out"
  | "mesas-slide-out"
  | "mesas-slide-in"
  | "";

interface AnimationState {
  animClass: AnimationClass;
  enterSnapshot: {
    cart: CartItem[];
    totalItems: number;
    totals: CartTotals;
  } | null;
  exitSnapshot: {
    tableSession: PosTableSessionState;
    cart: CartItem[];
    totalItems: number;
    totals: CartTotals;
  } | null;
  mesasSnapshot: {
    cart: CartItem[];
    totalItems: number;
    totals: CartTotals;
  } | null;
}

function useCartAnimation(
  tableSession: PosTableSessionState | null | undefined,
  isTableSelectorOpen: boolean | undefined,
  cart: CartItem[],
  totalItems: number,
  totals: CartTotals
) {
  const [enterSnapshot, setEnterSnapshot] =
    useState<AnimationState["enterSnapshot"]>(null);
  const [exitSnapshot, setExitSnapshot] =
    useState<AnimationState["exitSnapshot"]>(null);
  const [mesasSnapshot, setMesasSnapshot] =
    useState<AnimationState["mesasSnapshot"]>(null);
  const [animClass, setAnimClass] = useState<AnimationClass>("");

  const prevTableSession = useRef(tableSession);
  const prevCart = useRef(cart);
  const prevTotalItems = useRef(totalItems);
  const prevTotals = useRef(totals);
  const prevIsTableSelectorOpen = useRef(isTableSelectorOpen);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wasTable = Boolean(prevTableSession.current);
  const isTable = Boolean(tableSession);
  const wasTableSelectorOpen = Boolean(prevIsTableSelectorOpen.current);
  const isTableSelectorOpenNow = Boolean(isTableSelectorOpen);

  let nextAnimClass: AnimationClass = "";
  let nextEnterSnapshot: AnimationState["enterSnapshot"] = null;
  let nextExitSnapshot: AnimationState["exitSnapshot"] = null;
  let nextMesasSnapshot = mesasSnapshot;

  if (!wasTable && isTable) {
    nextEnterSnapshot = {
      cart: prevCart.current,
      totalItems: prevTotalItems.current,
      totals: prevTotals.current,
    };
    nextAnimClass = "cart-slide-in";
  } else if (wasTable && !isTable && prevTableSession.current) {
    nextExitSnapshot = {
      tableSession: prevTableSession.current,
      cart: prevCart.current,
      totalItems: prevTotalItems.current,
      totals: prevTotals.current,
    };
    nextAnimClass = "cart-slide-out";
  } else if (!wasTableSelectorOpen && isTableSelectorOpenNow && !isTable) {
    nextMesasSnapshot = {
      cart: prevCart.current,
      totalItems: prevTotalItems.current,
      totals: prevTotals.current,
    };
    nextAnimClass = "mesas-slide-out";
  } else if (
    wasTableSelectorOpen &&
    !isTableSelectorOpenNow &&
    mesasSnapshot &&
    !isTable
  ) {
    nextAnimClass = "mesas-slide-in";
  }

  if (nextAnimClass) {
    setEnterSnapshot(nextEnterSnapshot);
    setExitSnapshot(nextExitSnapshot);
    setMesasSnapshot(nextMesasSnapshot);
    setAnimClass(nextAnimClass);
  }

  prevTableSession.current = tableSession;
  prevCart.current = cart;
  prevTotalItems.current = totalItems;
  prevTotals.current = totals;
  prevIsTableSelectorOpen.current = isTableSelectorOpen;

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
      setMesasSnapshot(null);
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

  return {
    ...computeBaseValues({
      animClass,
      cart,
      enterSnapshot,
      isTable,
      isTableSelectorOpenNow,
      tableSession,
      totalItems,
      totals,
    }),
    animClass,
    enterSnapshot,
    exitSnapshot,
    mesasSnapshot,
  };
}

const blankTotals: CartTotals = {
  subTotal: 0,
  tax: 0,
  discountAmount: 0,
  itemsDiscountAmount: 0,
  saleDiscountAmount: 0,
  totalAmount: 0,
};

function computeBaseValues(args: {
  animClass: AnimationClass;
  cart: CartItem[];
  enterSnapshot: AnimationState["enterSnapshot"];
  isTable: boolean;
  isTableSelectorOpenNow: boolean;
  tableSession: PosTableSessionState | null | undefined;
  totalItems: number;
  totals: CartTotals;
}) {
  const {
    animClass,
    cart,
    enterSnapshot,
    isTable,
    isTableSelectorOpenNow,
    tableSession,
    totalItems,
    totals,
  } = args;

  const isMesasAnimating =
    animClass === "mesas-slide-out" || animClass === "mesas-slide-in";
  const shouldShowBlankBase = isTableSelectorOpenNow && !isTable;
  const showBlankState = shouldShowBlankBase && !isMesasAnimating;
  const useBlankForBase = shouldShowBlankBase && animClass !== "mesas-slide-in";

  const baseCart = enterSnapshot?.cart ?? (useBlankForBase ? [] : cart);
  const baseTotalItems =
    enterSnapshot?.totalItems ?? (useBlankForBase ? 0 : totalItems);
  const baseTotals =
    enterSnapshot?.totals ?? (useBlankForBase ? blankTotals : totals);

  let baseTableSession: PosTableSessionState | null | undefined = tableSession;
  if (enterSnapshot) {
    baseTableSession = null;
  } else if (useBlankForBase) {
    baseTableSession = null;
  }

  return {
    animClass,
    baseCart,
    baseTableSession,
    baseTotalItems,
    baseTotals,
    showBlankState,
    useBlankForBase,
  };
}

function CartOverlay({
  animClass,
  cart,
  isQuickSaleMode,
  onCheckout,
  onClearCart,
  onExitTable,
  onSendToKitchen,
  totals,
  totalItems,
  tableSession,
}: {
  animClass: string;
  cart: CartItem[];
  isQuickSaleMode: boolean;
  onCheckout: () => void;
  onClearCart: () => void;
  onExitTable?: () => void;
  onSendToKitchen?: () => void;
  totals: CartTotals;
  totalItems: number;
  tableSession?: PosTableSessionState | null;
}) {
  const emptyMessage = getEmptyCartMessage(false, tableSession ?? null);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex min-h-0 flex-1 flex-col bg-[#0f0f0f]",
        animClass
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
          emptyMessage={emptyMessage}
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
          {tableSession ? (
            <Button
              className="mt-2 h-12 rounded-xl bg-[var(--color-voltage)]! font-bold text-base text-black! hover:bg-[#c9e605]"
              disabled
              fullWidth
            >
              Cobrar mesa
            </Button>
          ) : (
            <CartFooter
              cart={cart}
              isQuickSaleMode={isQuickSaleMode}
              onCheckout={onCheckout}
              onSendToKitchen={onSendToKitchen}
              tableSession={tableSession}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface CartPanelProps {
  cart: CartItem[];
  className?: string;
  isQuickSaleMode?: boolean;
  isTableSelectorOpen?: boolean;
  onCancelTableOrder?: () => Promise<void>;
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
  onCancelTableOrder,
  onCheckout,
  onSendToKitchen,
  tableSession,
}: {
  cart: CartItem[];
  isQuickSaleMode: boolean;
  onCancelTableOrder?: () => Promise<void>;
  onCheckout: () => void;
  onSendToKitchen?: () => void;
  tableSession?: PosTableSessionState | null;
}) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancelOrder = useCallback(async () => {
    if (!onCancelTableOrder) {
      return;
    }
    setIsCancelling(true);
    try {
      await onCancelTableOrder();
      setShowCancelConfirm(false);
    } catch {
      // Error is handled by the mutation hook
    } finally {
      setIsCancelling(false);
    }
  }, [onCancelTableOrder]);

  return (
    <div className="space-y-3">
      {showCancelConfirm && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/50 p-3">
          <p className="mb-2 text-red-200 text-sm">
            ¿Cancelar toda la orden? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <Button
              color="gray"
              disabled={isCancelling}
              onClick={() => setShowCancelConfirm(false)}
              size="compact-sm"
              variant="default"
            >
              Volver
            </Button>
            <Button
              color="red"
              loading={isCancelling}
              onClick={() => {
                handleCancelOrder().catch(() => undefined);
              }}
              size="compact-sm"
            >
              {isCancelling ? "Cancelando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      )}

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

      {tableSession?.orderId && !showCancelConfirm && (
        <Button
          className="text-red-400! hover:bg-red-400/10 hover:text-red-300!"
          color="red"
          fullWidth
          onClick={() => setShowCancelConfirm(true)}
          size="compact-sm"
          variant="subtle"
        >
          Cancelar orden
        </Button>
      )}
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

function getEmptyCartMessage(
  showBlankState: boolean,
  baseTableSession: PosTableSessionState | null | undefined
): string {
  if (showBlankState) {
    return "Selecciona una mesa";
  }
  if (baseTableSession) {
    return baseTableSession.isLoading
      ? "Cargando la cuenta de la mesa…"
      : "Agrega productos a la mesa";
  }
  return "Escanea o selecciona un producto";
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
  onCancelTableOrder,
  onExitTable,
  onSendToKitchen,
  isQuickSaleMode,
  isTableSelectorOpen,
  tableSession,
  className,
  saleSuccessToken,
}: CartPanelProps) {
  const anim = useCartAnimation(
    tableSession,
    isTableSelectorOpen,
    cart,
    totalItems,
    totals
  );

  const emptyCartMessage = getEmptyCartMessage(
    anim.showBlankState,
    anim.baseTableSession
  );

  return (
    <div
      className={cn(
        "relative flex min-h-0 w-[380px] shrink-0 flex-col overflow-hidden border-zinc-800 border-l",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {!anim.useBlankForBase && (
          <CartPanelHeader
            hasItems={anim.baseCart.length > 0}
            onClearCart={onClearCart}
            onExitTable={onExitTable}
            tableSession={anim.baseTableSession}
            totalItems={anim.baseTotalItems}
          />
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-2 py-1",
            anim.baseTableSession && "bg-[#0f0f0f]",
            anim.useBlankForBase && "flex flex-col items-center justify-center"
          )}
        >
          <CartItemList
            emptyMessage={emptyCartMessage}
            isTable={Boolean(anim.baseTableSession)}
            itemStatusById={anim.baseTableSession?.itemStatusById}
            items={anim.baseCart}
            onRemoveItem={onRemoveItem}
            onUpdateItemDiscount={onUpdateItemDiscount}
            onUpdateQuantity={onUpdateQuantity}
            readOnly={false}
            showDiscount={!anim.baseTableSession}
          />
        </div>

        {!anim.useBlankForBase && (
          <div className="shrink-0 border-zinc-800 border-t bg-[#0a0a0a] p-4">
            <CartSummary totals={anim.baseTotals} />
            <div className="mt-3">
              <CartFooter
                cart={anim.baseCart}
                isQuickSaleMode={Boolean(isQuickSaleMode)}
                onCancelTableOrder={onCancelTableOrder}
                onCheckout={onCheckout}
                onSendToKitchen={onSendToKitchen}
                tableSession={anim.baseTableSession}
              />
            </div>
          </div>
        )}
      </div>

      {anim.enterSnapshot && (
        <CartOverlay
          animClass="animate-[cart-slide-in_300ms_ease-out_both]"
          cart={cart}
          isQuickSaleMode={Boolean(isQuickSaleMode)}
          onCheckout={onCheckout}
          onClearCart={onClearCart}
          onExitTable={onExitTable}
          onSendToKitchen={onSendToKitchen}
          tableSession={tableSession}
          totalItems={totalItems}
          totals={totals}
        />
      )}

      {anim.exitSnapshot && (
        <CartOverlay
          animClass="animate-[cart-slide-out_300ms_ease-out_forwards]"
          cart={anim.exitSnapshot.cart}
          isQuickSaleMode={Boolean(isQuickSaleMode)}
          onCheckout={onCheckout}
          onClearCart={onClearCart}
          onExitTable={onExitTable}
          onSendToKitchen={onSendToKitchen}
          tableSession={anim.exitSnapshot.tableSession}
          totalItems={anim.exitSnapshot.totalItems}
          totals={anim.exitSnapshot.totals}
        />
      )}

      {anim.mesasSnapshot && anim.animClass === "mesas-slide-out" && (
        <CartOverlay
          animClass="animate-[cart-slide-out_350ms_ease-out_forwards]"
          cart={anim.mesasSnapshot.cart}
          isQuickSaleMode={Boolean(isQuickSaleMode)}
          onCheckout={onCheckout}
          onClearCart={onClearCart}
          onExitTable={onExitTable}
          onSendToKitchen={onSendToKitchen}
          totalItems={anim.mesasSnapshot.totalItems}
          totals={anim.mesasSnapshot.totals}
        />
      )}

      {anim.mesasSnapshot && anim.animClass === "mesas-slide-in" && (
        <CartOverlay
          animClass="animate-[cart-slide-in_350ms_ease-out_both]"
          cart={anim.mesasSnapshot.cart}
          isQuickSaleMode={Boolean(isQuickSaleMode)}
          onCheckout={onCheckout}
          onClearCart={onClearCart}
          onExitTable={onExitTable}
          onSendToKitchen={onSendToKitchen}
          totalItems={anim.mesasSnapshot.totalItems}
          totals={anim.mesasSnapshot.totals}
        />
      )}

      <SaleSuccessNotice token={saleSuccessToken} />
    </div>
  );
}
