import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { useSaleDetail } from "@/features/sales/hooks/use-sales";
import {
  formatSaleStatus,
  formatSalesCurrency,
  getSaleStatusBadgeClass,
  salesDateTimeFormatter,
} from "@/features/sales/sales-formatters.shared";

export function SaleDetailContent({
  sale,
  onRequestCancel,
  isCancelling,
  activeShiftId,
}: {
  sale: NonNullable<ReturnType<typeof useSaleDetail>["data"]>;
  onRequestCancel: () => void;
  isCancelling: boolean;
  activeShiftId?: string;
}) {
  const canCancelSale =
    sale.status !== "cancelled" &&
    Boolean(activeShiftId) &&
    sale.shift?.id === activeShiftId &&
    !isCancelling;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-400">ID</p>
          <p className="font-mono text-sm text-white">{sale.id}</p>
        </div>
        <Badge
          className={`${getSaleStatusBadgeClass(sale.status)} border-0 px-2 py-0.5 text-xs`}
        >
          {formatSaleStatus(sale.status)}
          {sale.status === "credit" && sale.balanceDue > 0
            ? ` • Pendiente ${formatSalesCurrency(sale.balanceDue)}`
            : null}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-zinc-400">Fecha</p>
          <p className="text-sm text-white">
            {salesDateTimeFormatter.format(sale.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Cajero</p>
          <p className="text-sm text-white">
            {sale.cashier?.name ?? "Sin cajero"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Terminal</p>
          <p className="text-sm text-white">
            {sale.shift?.terminalName ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Cliente</p>
          <p className="text-sm text-white">
            {sale.customer?.name ?? "Cliente mostrador"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-zinc-200">Items</h4>
        <div className="space-y-2">
          {sale.items.map((item) => (
            <div
              className="rounded-lg border border-zinc-800 bg-black/10 p-3"
              key={item.id}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{item.name}</p>
                <p className="text-sm text-zinc-300">
                  {item.quantity} x {formatSalesCurrency(item.unitPrice)}
                </p>
              </div>
              {item.modifiers.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {item.modifiers.map((modifier) => (
                    <div
                      className="flex items-center justify-between text-xs text-zinc-400"
                      key={modifier.id}
                    >
                      <span>+ {modifier.name}</span>
                      <span>
                        {modifier.quantity} x{" "}
                        {formatSalesCurrency(modifier.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  Subtotal {formatSalesCurrency(item.subtotal)}
                  {item.taxAmount > 0
                    ? ` • Imp ${formatSalesCurrency(item.taxAmount)}`
                    : null}
                  {item.discountAmount > 0
                    ? ` • Desc ${formatSalesCurrency(item.discountAmount)}`
                    : null}
                </span>
                <span className="font-medium text-[var(--color-voltage)]">
                  {formatSalesCurrency(item.totalAmount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-zinc-200">Pagos</h4>
        {sale.payments.length === 0 ? (
          <p className="text-sm text-zinc-400">Sin pagos registrados</p>
        ) : (
          <div className="space-y-2">
            {sale.payments.map((payment) => (
              <div
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/10 p-3"
                key={payment.id}
              >
                <div>
                  <p className="text-sm text-white capitalize">
                    {payment.method}
                  </p>
                  {payment.reference ? (
                    <p className="text-xs text-zinc-400">
                      Ref: {payment.reference}
                    </p>
                  ) : null}
                </div>
                <p className="font-medium text-[var(--color-voltage)]">
                  {formatSalesCurrency(payment.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black/10 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Subtotal</span>
          <span className="text-white">
            {formatSalesCurrency(sale.subtotal)}
          </span>
        </div>
        {sale.taxAmount > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Impuestos</span>
            <span className="text-white">
              {formatSalesCurrency(sale.taxAmount)}
            </span>
          </div>
        ) : null}
        {sale.discountAmount > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Descuentos</span>
            <span className="text-white">
              -{formatSalesCurrency(sale.discountAmount)}
            </span>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between border-zinc-800 border-t pt-2">
          <span className="font-medium text-white">Total</span>
          <span className="font-bold text-[var(--color-voltage)] text-lg">
            {formatSalesCurrency(sale.totalAmount)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Pagado</span>
          <span className="text-white">
            {formatSalesCurrency(sale.paidAmount)}
          </span>
        </div>
        {sale.balanceDue > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Saldo pendiente</span>
            <span className="text-sky-300">
              {formatSalesCurrency(sale.balanceDue)}
            </span>
          </div>
        ) : null}
      </div>

      {canCancelSale ? (
        <Button
          className="w-full border-rose-500/30 bg-transparent text-rose-200 hover:bg-rose-500/10"
          disabled={isCancelling}
          onClick={onRequestCancel}
          variant="outline"
        >
          {isCancelling ? "Anulando…" : "Anular venta"}
        </Button>
      ) : null}
    </div>
  );
}
