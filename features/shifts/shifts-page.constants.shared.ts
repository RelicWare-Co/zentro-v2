export const SHIFT_STATUS_VALUES = ["open", "closed"] as const;
export const SHIFT_DIFFERENCE_STATUS_VALUES = [
  "short",
  "over",
  "balanced",
] as const;
export const SHIFT_HAS_MOVEMENTS_VALUES = ["yes", "no"] as const;

export const SHIFT_STATUS_LABELS = {
  open: "Abierto",
  closed: "Cerrado",
} as const;

export const SHIFT_DIFFERENCE_STATUS_LABELS = {
  short: "Faltante",
  over: "Sobrante",
  balanced: "Cuadrada",
} as const;

export const SHIFT_HAS_MOVEMENTS_LABELS = {
  yes: "Con movimientos",
  no: "Sin movimientos",
} as const;
