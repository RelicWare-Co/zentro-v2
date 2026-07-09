import {
  SALE_BALANCE_STATUS_VALUES,
  SALE_STATUS_VALUES,
  type SalesView,
} from "@/features/sales/sales-page.constants.shared";
import { formatCurrency } from "@/lib/format-currency.shared";
import { parseMoneyInput } from "@/lib/utils";

export const salesDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const salesDayFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
});

export function getCurrentSalesDateFilterValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatSalesCurrency(amount: number): string {
  return formatCurrency(amount);
}

export function formatSaleStatus(status: string) {
  if (status === "credit") {
    return "Credito";
  }
  if (status === "completed") {
    return "Pagada";
  }
  if (status === "cancelled") {
    return "Cancelada";
  }
  return status;
}

export function getSaleStatusBadgeClass(status: string) {
  if (status === "credit") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/10";
  }
  if (status === "completed") {
    return "border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10";
  }
  if (status === "cancelled") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/10";
  }
  return "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800/80";
}

export function formatPaymentSummary(
  sale: { status: string; paymentMethods: string[] },
  labelMap?: Record<string, string>
) {
  if (sale.status === "cancelled") {
    return "Venta anulada";
  }
  if (sale.paymentMethods.length === 0) {
    return sale.status === "credit" ? "Venta a credito" : "Sin pagos";
  }
  return sale.paymentMethods
    .map((method) => labelMap?.[method] ?? method)
    .join(" + ");
}

export function formatItemCountLabel(itemCount: number) {
  return `${itemCount} item${itemCount === 1 ? "" : "s"}`;
}

export function resolveSalesDateFilters(
  activeView: SalesView,
  todayDate: string,
  startDate: string,
  endDate: string
) {
  if (activeView === "today") {
    return { startDate: todayDate, endDate: todayDate };
  }
  return { startDate: startDate || null, endDate: endDate || null };
}

export function resolveAmountRange(amountMin: string, amountMax: string) {
  const resolvedMin = amountMin.trim() ? parseMoneyInput(amountMin) : null;
  const resolvedMax = amountMax.trim() ? parseMoneyInput(amountMax) : null;
  if (
    resolvedMin !== null &&
    resolvedMax !== null &&
    resolvedMin > resolvedMax
  ) {
    return { min: resolvedMax, max: resolvedMin };
  }
  return { min: resolvedMin, max: resolvedMax };
}

export function resolveSaleStatus(status: string) {
  if ((SALE_STATUS_VALUES as readonly string[]).includes(status)) {
    return status as "completed" | "credit" | "cancelled";
  }
  return null;
}

export function resolveBalanceStatus(balanceStatus: string) {
  if (
    (SALE_BALANCE_STATUS_VALUES as readonly string[]).includes(balanceStatus)
  ) {
    return balanceStatus as "with_balance" | "settled";
  }
  return null;
}
