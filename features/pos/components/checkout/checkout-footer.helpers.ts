export function getFooterLabel(
  isCreditSale: boolean,
  canReturnCashChange: boolean
): string {
  if (isCreditSale) {
    return "Saldo que quedará a crédito:";
  }
  if (canReturnCashChange) {
    return "Cambio a devolver:";
  }
  return "Diferencia de pago:";
}

export function getFooterValue(
  isCreditSale: boolean,
  canReturnCashChange: boolean,
  paymentDifference: number,
  cashChangeDue: number
): number {
  if (isCreditSale) {
    return Math.abs(paymentDifference);
  }
  if (canReturnCashChange) {
    return cashChangeDue;
  }
  return Math.abs(paymentDifference);
}

export function getFooterValueClassName(
  isCreditSale: boolean,
  shouldCreateCreditBalance: boolean,
  canReturnCashChange: boolean,
  paymentDifference: number
): string {
  if (isCreditSale) {
    if (shouldCreateCreditBalance) {
      return "text-[var(--color-voltage)]";
    }
    return "text-green-400";
  }
  if (canReturnCashChange) {
    return "text-[var(--color-voltage)]";
  }
  if (paymentDifference === 0) {
    return "text-[var(--color-voltage)]";
  }
  if (paymentDifference > 0) {
    return "text-red-400";
  }
  return "text-amber-400";
}

export function getConfirmButtonText(
  isProcessing: boolean,
  shouldCreateCreditBalance: boolean
): string {
  if (isProcessing) {
    return "Procesando...";
  }
  if (shouldCreateCreditBalance) {
    return "Registrar Venta con Saldo";
  }
  return "Finalizar Venta";
}
