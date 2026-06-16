import { Button, Textarea } from "@mantine/core";
import {
  Check,
  LogOut,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { buildTableItemStatusBadge } from "@/features/pos/components/table-item-status.shared";
import {
  type PosTableSessionState,
  usePosPage,
} from "@/features/pos/pos-page-context";
import { formatCurrency } from "@/features/pos/utils";
import { CheckoutSectionV2 } from "@/features/posv2/components/checkout-section-v2";
import {
  posV2OrderBorder,
  posV2OrderPanelBg,
} from "@/features/posv2/components/pos-v2-order-styles";
import { cn } from "@/lib/utils";
import { CartItemCardV2 } from "./cart-item-card-v2";

interface CartPanelV2Props {
  className?: string;
}

function CartPanelV2Header({
  hasItems,
  onClearCart,
  onExitTable,
  tableSession,
  totalItems,
}: {
  hasItems: boolean;
  onClearCart: () => void;
  onExitTable: () => void;
  tableSession: PosTableSessionState | null;
  totalItems: number;
}) {
  if (tableSession) {
    return (
      <>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UtensilsCrossed
              aria-hidden="true"
              className="size-4 shrink-0 text-[#dfff06]"
            />
            <h2 className="truncate font-semibold text-base text-white leading-none">
              {tableSession.tableName}
            </h2>
          </div>
          <p className="mt-1 truncate text-[#6b6b6b] text-xs">
            {tableSession.areaName}
            {tableSession.orderNumber
              ? ` · Orden #${tableSession.orderNumber}`
              : ""}
            {` · ${totalItems} artículos`}
          </p>
        </div>
        <Button
          aria-label="Salir de la mesa"
          className="shrink-0 text-zinc-400 hover:bg-white/5 hover:text-white"
          leftSection={<LogOut className="size-4" />}
          onClick={onExitTable}
          size="compact-sm"
          variant="subtle"
        >
          Salir
        </Button>
      </>
    );
  }

  return (
    <>
      <div>
        <h2 className="font-semibold text-base text-white leading-none">
          Orden Actual
        </h2>
        <p className="mt-1 text-[#6b6b6b] text-xs">{totalItems} artículos</p>
      </div>
      <Button
        aria-label="Limpiar carrito"
        className="text-red-400 hover:bg-red-400/10 hover:text-red-300"
        color="red"
        disabled={!hasItems}
        leftSection={<Trash2 className="size-4" />}
        onClick={onClearCart}
        size="compact-sm"
        variant="subtle"
      >
        Limpiar
      </Button>
    </>
  );
}

function CartPanelV2FooterAction({
  tableSession,
}: {
  tableSession: PosTableSessionState | null;
}) {
  const { state, actions } = usePosPage();

  if (tableSession) {
    return (
      <Button
        className="border-[rgba(255,255,255,0.12)] bg-transparent font-semibold text-white hover:border-[rgba(255,255,255,0.2)] hover:bg-[#1a1a1a]"
        disabled={
          tableSession.draftItemsCount === 0 || tableSession.isSendingToKitchen
        }
        fullWidth
        leftSection={<Send className="size-3.5" />}
        onClick={actions.sendTableOrderToKitchen}
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
    );
  }

  return (
    <Textarea
      classNames={{
        input:
          "resize-none border-[rgba(255,255,255,0.08)] bg-[#101010] text-white text-xs placeholder:text-[#4b4b4b]",
      }}
      id="pos-v2-delivery-info"
      label="Info domicilio"
      maxLength={280}
      minRows={2}
      onChange={(event) => actions.setDeliveryInfo(event.target.value)}
      placeholder="Dirección, referencia o instrucciones"
      styles={{ label: { color: "#6b6b6b", fontSize: "0.75rem" } }}
      value={state.deliveryInfo}
    />
  );
}

export function CartPanelV2({ className }: CartPanelV2Props) {
  const { state, actions } = usePosPage();
  const { subTotal, tax, discountAmount, totalAmount } = state.totals;
  const hasDiscount = discountAmount > 0;
  const tableSession = state.tableSession;

  let emptyCartMessage = "Escanea o selecciona un producto";
  if (tableSession) {
    emptyCartMessage = tableSession.isLoading
      ? "Cargando la cuenta de la mesa…"
      : "Agrega productos a la mesa";
  }

  return (
    <div
      className={cn(
        "grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-[rgba(255,255,255,0.06)] border-l",
        posV2OrderPanelBg,
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b p-3",
          posV2OrderBorder,
          posV2OrderPanelBg
        )}
      >
        <CartPanelV2Header
          hasItems={state.cart.length > 0}
          onClearCart={actions.clearCart}
          onExitTable={actions.exitTableMode}
          tableSession={tableSession}
          totalItems={state.totalItems}
        />
      </div>

      <div
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain",
          posV2OrderPanelBg
        )}
      >
        <div className="space-y-1.5 px-2 py-2">
          {state.cart.map((item) => {
            const itemStatus = tableSession?.itemStatusById[item.id];
            return (
              <CartItemCardV2
                item={item}
                key={item.id}
                onRemove={() => actions.removeFromCart(item.id)}
                onUpdateDiscount={(value) =>
                  actions.updateItemDiscount(item.id, value)
                }
                onUpdateQuantity={(delta) =>
                  actions.updateQuantity(item.id, delta)
                }
                readOnly={Boolean(itemStatus && itemStatus !== "draft")}
                showDiscount={!tableSession}
                statusBadge={buildTableItemStatusBadge(itemStatus)}
              />
            );
          })}

          {state.cart.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-[#6b6b6b]">
              <div className="flex size-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)]">
                {tableSession ? (
                  <UtensilsCrossed className="size-4 text-[#3d3d3d]" />
                ) : (
                  <Search className="size-4 text-[#3d3d3d]" />
                )}
              </div>
              <p className="text-sm">{emptyCartMessage}</p>
            </div>
          )}
        </div>
      </div>

      {state.cart.length > 0 ? (
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

            <CartPanelV2FooterAction tableSession={tableSession} />

            <CheckoutSectionV2 />
          </div>

          <div className="px-3 pb-2">
            <Button
              className="border-[rgba(255,255,255,0.12)] bg-[#151515] font-semibold text-white hover:border-[rgba(255,255,255,0.2)] hover:bg-[#1a1a1a]"
              disabled={!state.canFinalizeSale}
              fullWidth
              leftSection={<Check className="size-3.5" />}
              loading={state.isProcessingCheckout}
              onClick={actions.finalizeSale}
              type="button"
            >
              {`${tableSession ? "Cobrar mesa" : "Cobrar"} — ${formatCurrency(totalAmount)}`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
