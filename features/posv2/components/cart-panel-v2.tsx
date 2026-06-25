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
  posV2AccentText,
  posV2ButtonOutlineClassName,
  posV2IconText,
  posV2MutedColor,
  posV2MutedText,
  posV2OrderBorder,
  posV2OrderBorderSubtle,
  posV2OrderPanelBg,
  posV2PlaceholderText,
  posV2SurfaceButtonClassName,
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
              className={cn("size-4 shrink-0", posV2AccentText)}
            />
            <h2 className="truncate font-semibold text-base text-white leading-none">
              {tableSession.tableName}
            </h2>
          </div>
          <p className={cn("mt-1 truncate text-xs", posV2MutedText)}>
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
        <p className={cn("mt-1 text-xs", posV2MutedText)}>
          {totalItems} artículos
        </p>
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
        className={posV2ButtonOutlineClassName}
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
        input: `resize-none text-white text-xs ${posV2PlaceholderText} ${posV2OrderBorder} ${posV2OrderPanelBg}`,
      }}
      id="pos-v2-delivery-info"
      label="Info domicilio"
      maxLength={280}
      minRows={2}
      onChange={(event) => actions.setDeliveryInfo(event.target.value)}
      placeholder="Dirección, referencia o instrucciones"
      styles={{
        label: { color: posV2MutedColor, fontSize: "0.75rem" },
      }}
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
        "grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-l",
        posV2OrderBorderSubtle,
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
            <div
              className={cn(
                "flex h-40 flex-col items-center justify-center gap-2",
                posV2MutedText
              )}
            >
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border bg-[color-mix(in_srgb,white_4%,transparent)]",
                  posV2OrderBorderSubtle
                )}
              >
                {tableSession ? (
                  <UtensilsCrossed className={cn("size-4", posV2IconText)} />
                ) : (
                  <Search className={cn("size-4", posV2IconText)} />
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
            "border-t shadow-[0_-4px_16px_color-mix(in_srgb,black_25%,transparent)]",
            posV2OrderBorder,
            posV2OrderPanelBg
          )}
        >
          <div className="space-y-2.5 px-3 pt-3 pb-2">
            <div className="space-y-1.5">
              <div
                className={cn("flex justify-between text-sm", posV2MutedText)}
              >
                <span>Subtotal</span>
                <span className="text-white tabular-nums">
                  {formatCurrency(subTotal)}
                </span>
              </div>
              <div
                className={cn("flex justify-between text-sm", posV2MutedText)}
              >
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
                <span
                  className={cn(
                    "font-bold text-lg tabular-nums",
                    posV2AccentText
                  )}
                >
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            <CartPanelV2FooterAction tableSession={tableSession} />

            <CheckoutSectionV2 />
          </div>

          <div className="px-3 pb-2">
            <Button
              className={posV2SurfaceButtonClassName}
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
