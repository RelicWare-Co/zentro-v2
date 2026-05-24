import { formatCurrency } from "@/features/pos/utils";
import {
  SHIFT_DIFFERENCE_STATUS_VALUES,
  SHIFT_HAS_MOVEMENTS_VALUES,
  SHIFT_STATUS_VALUES,
} from "@/features/shifts/shifts-page.constants.shared";

export const shiftsDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const countFormatter = new Intl.NumberFormat("es-CO");

export function formatShiftCount(value: number) {
  return countFormatter.format(value);
}

export function formatShiftStatus(status: string) {
  return status === "open" ? "Abierto" : "Cerrado";
}

export function formatShiftRange(openedAt: number, closedAt: number | null) {
  return closedAt
    ? `${shiftsDateTimeFormatter.format(openedAt)} - ${shiftsDateTimeFormatter.format(closedAt)}`
    : `${shiftsDateTimeFormatter.format(openedAt)} - En curso`;
}

export function getShiftStatusBadgeClass(status: string) {
  return status === "open"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
    : "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800/80";
}

export function getDifferenceClassName(value: number) {
  if (value > 0) {
    return "text-sm font-medium text-emerald-300";
  }
  if (value < 0) {
    return "text-sm font-medium text-rose-300";
  }
  return "text-sm font-medium text-zinc-300";
}

export function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCurrency(value)}`;
}

export function formatMovementType(type: string) {
  const labels: Record<string, string> = {
    inflow: "Ingreso manual",
    expense: "Gasto operativo",
    payout: "Pago a proveedor",
  };
  return labels[type] ?? type;
}

export function resolveShiftStatus(status: string) {
  if ((SHIFT_STATUS_VALUES as readonly string[]).includes(status)) {
    return status as "open" | "closed";
  }
  return null;
}

export function resolveDifferenceStatus(differenceStatus: string) {
  if (
    (SHIFT_DIFFERENCE_STATUS_VALUES as readonly string[]).includes(
      differenceStatus
    )
  ) {
    return differenceStatus as "short" | "over" | "balanced";
  }
  return null;
}

export function resolveHasMovements(hasMovements: string) {
  if (
    (SHIFT_HAS_MOVEMENTS_VALUES as readonly string[]).includes(hasMovements)
  ) {
    return hasMovements as "yes" | "no";
  }
  return null;
}
