export const creditDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatCreditTransactionType(type: string) {
  if (type === "charge") {
    return "Cargo";
  }
  if (type === "payment") {
    return "Abono";
  }
  if (type === "interest") {
    return "Interés";
  }
  return type;
}

export function getCreditTransactionAmountClass(type: string) {
  if (type === "payment") {
    return "text-emerald-300";
  }
  if (type === "charge") {
    return "text-rose-300";
  }
  return "text-amber-300";
}

export function getCreditTransactionTypeBadgeClass(type: string) {
  if (type === "charge") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  }
  if (type === "payment") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (type === "interest") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }
  return "border-zinc-700 bg-zinc-800/80 text-zinc-300";
}
