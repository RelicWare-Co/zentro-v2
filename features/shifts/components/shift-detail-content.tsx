import { Badge } from "@mantine/core";
import { formatCurrency, formatPaymentMethodLabel } from "@/features/pos/utils";
import type {
  ShiftListItem,
  ShiftProductSummary,
  ShiftProductSummaryItem,
} from "@/features/shifts/shifts.shared";
import {
  formatShiftCount,
  formatShiftRange,
  formatShiftStatus,
  getShiftStatusBadgeClass,
} from "@/features/shifts/shifts-formatters.shared";

function ProductRow({
  name,
  payments,
  quantity,
  totalAmount,
  unitPrice,
}: {
  name: string;
  payments: ShiftProductSummaryItem["payments"];
  quantity: number;
  totalAmount: number;
  unitPrice: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/10 p-3">
      <div className="flex items-center justify-between">
        <p className="truncate font-medium text-white">{name}</p>
        <p className="shrink-0 text-sm text-zinc-300">
          {formatShiftCount(quantity)} x {formatCurrency(unitPrice)}
        </p>
      </div>
      {payments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {payments.map((payment) => (
            <span
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400"
              key={payment.method}
            >
              {formatPaymentMethodLabel(payment.method, {})}:{" "}
              <span className="font-medium text-zinc-300">
                {formatCurrency(payment.amount)}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-zinc-400">Subtotal</span>
        <span className="font-medium text-[var(--color-voltage)]">
          {formatCurrency(totalAmount)}
        </span>
      </div>
    </div>
  );
}

function CategoryRow({
  name,
  quantity,
  totalAmount,
}: {
  name: string;
  quantity: number;
  totalAmount: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/10 p-3">
      <div>
        <p className="font-medium text-white">{name}</p>
        <p className="text-xs text-zinc-400">
          {formatShiftCount(quantity)} unidades
        </p>
      </div>
      <p className="font-medium text-[var(--color-voltage)]">
        {formatCurrency(totalAmount)}
      </p>
    </div>
  );
}

export function ShiftDetailContent({
  shift,
  productSummary,
}: {
  shift: ShiftListItem;
  productSummary: ShiftProductSummary;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-400">ID</p>
          <p className="font-mono text-sm text-white">
            #{shift.id.slice(0, 8)}
          </p>
        </div>
        <Badge
          className={`${getShiftStatusBadgeClass(shift.status)} border-0`}
          size="sm"
          tt="none"
        >
          {formatShiftStatus(shift.status)}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-zinc-400">Cajero</p>
          <p className="text-sm text-white">{shift.cashierName}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Terminal</p>
          <p className="text-sm text-white">
            {shift.terminalName ?? "Caja principal"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Horario</p>
          <p className="text-sm text-white">
            {formatShiftRange(shift.openedAt, shift.closedAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Base inicial</p>
          <p className="text-sm text-white">
            {formatCurrency(shift.startingCash)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black/10 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Total vendido</span>
          <span className="font-bold text-[var(--color-voltage)] text-lg">
            {formatCurrency(productSummary.totalAmount)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Total artículos</span>
          <span className="text-white">
            {formatShiftCount(productSummary.totalItems)}
          </span>
        </div>
      </div>

      {productSummary.categories.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-zinc-200">Por categoría</h4>
          <div className="space-y-2">
            {productSummary.categories.map((category) => (
              <CategoryRow
                key={category.categoryId}
                name={category.categoryName}
                quantity={category.quantity}
                totalAmount={category.totalAmount}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 italic">
          No hay productos vendidos en este turno.
        </p>
      )}

      {productSummary.products.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-zinc-200">
            Productos individuales
          </h4>
          <div className="space-y-2">
            {productSummary.products.map((product) => (
              <ProductRow
                key={product.productId}
                name={product.productName}
                payments={product.payments}
                quantity={product.quantity}
                totalAmount={product.totalAmount}
                unitPrice={product.unitPrice}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
