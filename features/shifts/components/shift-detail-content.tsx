import { Badge } from "@mantine/core";
import {
  Banknote,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Hash,
  Landmark,
  MonitorSmartphone,
  Receipt,
  Tag,
  User,
} from "lucide-react";
import { useState } from "react";
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

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg border border-zinc-800 bg-black/30 p-2">
        <Icon className="size-4 text-zinc-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate font-medium text-sm text-white">{value}</p>
      </div>
    </div>
  );
}

function ProductRow({
  name,
  payments,
  quantity,
  unitPrice,
}: {
  name: string;
  payments: ShiftProductSummaryItem["payments"];
  quantity: number;
  unitPrice: number;
}) {
  return (
    <div className="flex items-center justify-between border-zinc-800/50 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-200">{name}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {formatShiftCount(quantity)} unidades × {formatCurrency(unitPrice)}
        </p>
      </div>
      {payments.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {payments.map((payment) => (
            <span
              className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400"
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
    </div>
  );
}

function CategorySection({
  category,
  products,
  totalAmount,
}: {
  category: {
    categoryId: string;
    categoryName: string;
    quantity: number;
    totalAmount: number;
  };
  products: ShiftProductSummaryItem[];
  totalAmount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const percentage =
    totalAmount > 0
      ? Math.round((category.totalAmount / totalAmount) * 100)
      : 0;
  const productCount = products.filter(
    (p) => p.categoryId === category.categoryId
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black/20">
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-white">
              {category.categoryName}
            </p>
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 rotate-180 text-zinc-500 transition-transform" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {formatShiftCount(category.quantity)} unidades · {productCount}{" "}
            {productCount === 1 ? "producto" : "productos"} · {percentage}% del
            total
          </p>
        </div>
        <p className="shrink-0 pl-4 font-semibold text-[var(--color-voltage)] text-sm">
          {formatCurrency(category.totalAmount)}
        </p>
      </button>
      {expanded ? (
        <div className="border-zinc-800 border-t px-4">
          {products
            .filter((p) => p.categoryId === category.categoryId)
            .map((product) => (
              <ProductRow
                key={product.productId}
                name={product.productName}
                payments={product.payments}
                quantity={product.quantity}
                unitPrice={product.unitPrice}
              />
            ))}
        </div>
      ) : null}
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
  const totalSold = productSummary.totalAmount;
  const creditAmount = shift.operations.creditSalesAmount;
  const paidAmount = Math.max(totalSold - creditAmount, 0);
  const totalDebtPayments = shift.debtPaymentBreakdown.reduce(
    (sum, entry) => sum + entry.amount,
    0
  );
  const paidPercentage =
    totalSold > 0 ? Math.round((paidAmount / totalSold) * 100) : 0;
  const creditPercentage =
    totalSold > 0 ? Math.round((creditAmount / totalSold) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">ID del turno</p>
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

      <div className="grid grid-cols-2 gap-4">
        <InfoField
          icon={Hash}
          label="ID del turno"
          value={`#${shift.id.slice(0, 8)}`}
        />
        <InfoField
          icon={Landmark}
          label="Base inicial"
          value={formatCurrency(shift.startingCash)}
        />
        <InfoField icon={User} label="Cajero" value={shift.cashierName} />
        <InfoField
          icon={MonitorSmartphone}
          label="Terminal"
          value={shift.terminalName ?? "Caja Principal"}
        />
        <div className="col-span-2">
          <InfoField
            icon={CalendarClock}
            label="Horario"
            value={formatShiftRange(shift.openedAt, shift.closedAt)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black/20 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-zinc-500">Total vendido</p>
            <p className="mt-1 font-bold text-3xl text-white">
              {formatCurrency(totalSold)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
            <Tag className="size-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-300">
              {formatShiftCount(productSummary.totalItems)} artículos
            </span>
          </div>
        </div>

        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="rounded-l-full bg-emerald-500 transition-all"
            style={{ width: `${paidPercentage}%` }}
          />
          <div
            className="rounded-r-full bg-orange-500 transition-all"
            style={{ width: `${creditPercentage}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-emerald-400" />
              <span className="text-emerald-300/80 text-xs">
                Recibido de contado
              </span>
            </div>
            <p className="mt-1.5 font-semibold text-emerald-300 text-lg">
              {formatCurrency(paidAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-orange-400" />
              <span className="text-orange-300/80 text-xs">
                Recibido a crédito
              </span>
            </div>
            <p className="mt-1.5 font-semibold text-lg text-orange-300">
              {formatCurrency(creditAmount)}
            </p>
          </div>
        </div>
      </div>

      {shift.debtPaymentBreakdown.filter((e) => e.amount !== 0).length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-amber-400" />
            <h4 className="font-medium text-amber-200 text-sm">
              Abonos recibidos
            </h4>
          </div>
          <p className="mt-1 text-amber-300/50 text-xs">
            Pagos a deuda existente registrados durante el turno.
          </p>
          <div className="mt-3 space-y-2">
            {shift.debtPaymentBreakdown
              .filter((e) => e.amount !== 0)
              .map((entry) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-amber-500/10 bg-black/20 px-3 py-2"
                  key={entry.method}
                >
                  <span className="text-amber-200/80 text-sm">
                    {formatPaymentMethodLabel(entry.method, {})}
                  </span>
                  <span className="font-semibold text-amber-300 text-sm">
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
              ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-amber-500/10 border-t pt-3">
            <span className="text-amber-300/60 text-xs">Total abonos</span>
            <span className="font-bold text-amber-300 text-sm">
              {formatCurrency(totalDebtPayments)}
            </span>
          </div>
        </div>
      ) : null}

      {productSummary.categories.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm text-zinc-200">
              Productos por categoría
            </h4>
            <p className="mt-0.5 text-xs text-zinc-500">
              Toca una categoría para ver los productos vendidos.
            </p>
          </div>
          <div className="space-y-2">
            {productSummary.categories.map((category) => (
              <CategorySection
                category={category}
                key={category.categoryId}
                products={productSummary.products}
                totalAmount={totalSold}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 italic">
          No hay productos vendidos en este turno.
        </p>
      )}
    </div>
  );
}
