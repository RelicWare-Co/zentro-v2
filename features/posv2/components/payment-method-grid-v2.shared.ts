import { Banknote, Building2, CreditCard, Layers, Wallet } from "lucide-react";

export type PosV2PaymentMode =
  | "cash"
  | "transfer"
  | "card"
  | "accountCredit"
  | "multiple";

const PAYMENT_MODE_CONFIG: Record<
  PosV2PaymentMode,
  { icon: typeof Banknote; label: string }
> = {
  cash: { icon: Banknote, label: "Efectivo" },
  transfer: { icon: Building2, label: "Transferencia" },
  card: { icon: CreditCard, label: "Tarjeta" },
  accountCredit: { icon: Wallet, label: "Crédito" },
  multiple: { icon: Layers, label: "Múltiple" },
};

export function getPaymentModeConfig(mode: PosV2PaymentMode) {
  return PAYMENT_MODE_CONFIG[mode];
}

export function resolveAvailablePaymentModes(
  paymentMethodOptions: Array<{ id: string }>,
  allowCreditSales = false
): PosV2PaymentMode[] {
  const enabledIds = new Set(
    paymentMethodOptions.map((option) => option.id.toLowerCase())
  );
  const modes: PosV2PaymentMode[] = [];

  if (enabledIds.has("cash")) {
    modes.push("cash");
  }

  if (
    [...enabledIds].some(
      (id) => id.startsWith("transfer") || id.includes("transfer")
    )
  ) {
    modes.push("transfer");
  }

  if (enabledIds.has("card")) {
    modes.push("card");
  }

  if (allowCreditSales) {
    modes.push("accountCredit");
  }

  const paymentMethodCount = paymentMethodOptions.length;
  if (paymentMethodCount >= 2) {
    modes.push("multiple");
  }

  return modes;
}

export function resolveMethodIdForMode(
  mode: PosV2PaymentMode,
  paymentMethodOptions: Array<{ id: string }>
): string {
  if (mode === "cash" || mode === "accountCredit") {
    return (
      paymentMethodOptions.find((option) => option.id.toLowerCase() === "cash")
        ?.id ?? "cash"
    );
  }

  if (mode === "card") {
    return (
      paymentMethodOptions.find((option) => option.id.toLowerCase() === "card")
        ?.id ?? "card"
    );
  }

  if (mode === "transfer") {
    return (
      paymentMethodOptions.find((option) =>
        option.id.toLowerCase().startsWith("transfer")
      )?.id ??
      paymentMethodOptions[0]?.id ??
      "cash"
    );
  }

  return paymentMethodOptions[0]?.id ?? "cash";
}

export function inferPaymentModeFromPayments(
  payments: Array<{ method: string }>,
  paymentMethodOptions: Array<{ id: string }>,
  isCreditSale = false,
  allowCreditSales = false
): PosV2PaymentMode {
  if (isCreditSale && allowCreditSales) {
    return "accountCredit";
  }

  if (payments.length > 1) {
    return "multiple";
  }

  const methodId = payments[0]?.method.toLowerCase() ?? "cash";

  if (methodId === "cash") {
    return "cash";
  }
  if (methodId === "card") {
    return "card";
  }
  if (methodId.startsWith("transfer")) {
    return "transfer";
  }

  const matchedOption = paymentMethodOptions.find(
    (option) => option.id.toLowerCase() === methodId
  );
  if (matchedOption?.id.toLowerCase().startsWith("transfer")) {
    return "transfer";
  }

  return "cash";
}
