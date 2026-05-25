import {
  formatPaymentMethodIdLabel,
  normalizePaymentMethodId,
} from "@/features/settings/settings.shared";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const countFormatter = new Intl.NumberFormat("es-CO");

const compactNumberFormatter = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dayFormatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
});

export const dashboardDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function getPercentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}

export function formatDelta(value: number | null, suffix: string) {
  if (value === null) {
    return `Sin base ${suffix}`;
  }

  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded}% ${suffix}`;
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value: number) {
  return `$${compactNumberFormatter.format(value)}`;
}

export function formatCount(value: number) {
  return countFormatter.format(value);
}

export function formatShortDay(dateKey: string) {
  return dayFormatter
    .format(new Date(`${dateKey}T12:00:00`))
    .replace(".", "")
    .toUpperCase();
}

export function formatPaymentMethod(
  method: string,
  paymentMethodLabels?: Record<string, string>
) {
  const normalizedMethodId = normalizePaymentMethodId(method);

  if (
    paymentMethodLabels &&
    Object.hasOwn(paymentMethodLabels, normalizedMethodId)
  ) {
    return (
      paymentMethodLabels[normalizedMethodId] ??
      formatPaymentMethodIdLabel(method)
    );
  }

  return formatPaymentMethodIdLabel(method);
}
