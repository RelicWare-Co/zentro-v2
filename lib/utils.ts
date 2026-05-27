import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const moneyInputDisplayFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

export function sanitizeMoneyInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function parseMoneyInput(value: string | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  const sanitizedValue = sanitizeMoneyInput(value);
  if (!sanitizedValue) {
    return 0;
  }

  const parsedValue = Number(sanitizedValue);
  return Number.isFinite(parsedValue)
    ? Math.max(0, Math.round(parsedValue))
    : 0;
}

export function formatMoneyInput(value: string | number) {
  const parsedValue = parseMoneyInput(value);
  return parsedValue === 0
    ? ""
    : moneyInputDisplayFormatter.format(parsedValue);
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
