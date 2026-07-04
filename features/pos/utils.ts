import { allocateProportionalDiscount } from "@/features/sales/sale-totals.shared";
import {
  buildPaymentMethodLabelMap,
  formatPaymentMethodIdLabel,
  normalizePaymentMethodId,
} from "@/features/settings/settings.shared";
import { parseMoneyInput } from "@/lib/utils";
import type { CartItem, CartTotals, Product } from "./types";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/**
 * Formatea un número como moneda colombiana (COP)
 */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * Calcula el precio de un producto con impuestos incluidos
 */
export function calculatePriceWithTax(product: Product): number {
  return Math.round(product.price + (product.price * product.taxRate) / 100);
}

/**
 * Retorna el label legible para un método de pago
 */
export function formatPaymentMethodLabel(
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

export function createPaymentMethodLabelMap(
  paymentMethods: Array<{ id: string; label: string }>
) {
  return buildPaymentMethodLabelMap(paymentMethods);
}

/**
 * Calcula el subtotal del carrito (sin impuestos ni descuentos)
 */
function calculateSubTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotal = item.product.price * item.quantity;
    const modifiersTotal = item.modifiers.reduce(
      (modifierTotal, modifier) =>
        modifierTotal + modifier.price * modifier.quantity * item.quantity,
      0
    );
    return sum + itemTotal + modifiersTotal;
  }, 0);
}

/**
 * Calcula el descuento total de los items del carrito
 */
function calculateItemsDiscount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.discountAmount, 0);
}

/**
 * Calcula el total a pagar considerando todos los factores
 */
function calculateTotal(
  subTotal: number,
  tax: number,
  discountAmount: number
): number {
  return Math.max(0, subTotal + tax - discountAmount);
}

/**
 * Calcula todos los totales del carrito en una sola operación.
 * Los impuestos se calculan sobre la base gravable neta
 * (subtotal + modificadores − descuento de ítem − descuento de venta prorrateado),
 * igual que el servidor en `buildPreparedItems`.
 */
export function calculateCartTotals(
  items: CartItem[],
  discountInput: string
): CartTotals {
  const subTotal = calculateSubTotal(items);
  const saleDiscountAmount = parseMoneyInput(discountInput);
  const itemsDiscountAmount = calculateItemsDiscount(items);

  const taxableBasesBeforeSaleDiscount = items.map((item) => {
    const lineSubtotal = item.product.price * item.quantity;
    const modifiersSubtotal = item.modifiers.reduce(
      (sum, modifier) =>
        sum + modifier.price * modifier.quantity * item.quantity,
      0
    );
    return lineSubtotal + modifiersSubtotal - item.discountAmount;
  });

  const saleDiscountAllocations = allocateProportionalDiscount(
    taxableBasesBeforeSaleDiscount,
    saleDiscountAmount
  );

  let tax = 0;
  let totalLineDiscount = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const lineSubtotal = item.product.price * item.quantity;
    const modifiersSubtotal = item.modifiers.reduce(
      (sum, modifier) =>
        sum + modifier.price * modifier.quantity * item.quantity,
      0
    );
    const lineDiscountAmount =
      item.discountAmount + (saleDiscountAllocations[index] ?? 0);
    const taxableBase = lineSubtotal + modifiersSubtotal - lineDiscountAmount;
    tax += Math.round((taxableBase * item.product.taxRate) / 100);
    totalLineDiscount += lineDiscountAmount;
  }

  const discountAmount = totalLineDiscount;
  const totalAmount = calculateTotal(subTotal, tax, discountAmount);

  return {
    subTotal,
    tax,
    saleDiscountAmount,
    itemsDiscountAmount,
    discountAmount,
    totalAmount,
  };
}

/**
 * Calcula el precio total de un item del carrito (incluyendo modificadores y descuento)
 */
export function calculateItemTotal(item: CartItem): number {
  const basePrice = item.product.price * item.quantity;
  const modifiersTotal = item.modifiers.reduce(
    (sum, modifier) => sum + modifier.price * modifier.quantity * item.quantity,
    0
  );
  return basePrice + modifiersTotal - item.discountAmount;
}

/**
 * Calcula el monto base de un item (para validar descuentos máximos)
 */
export function calculateItemBaseAmount(item: CartItem): number {
  const basePrice = item.product.price * item.quantity;
  const modifiersTotal = item.modifiers.reduce(
    (sum, modifier) => sum + modifier.price * modifier.quantity * item.quantity,
    0
  );
  return basePrice + modifiersTotal;
}

/** Stable key for cart lines that share the same modifier selection. */
export function buildModifierFingerprint(
  modifiers: CartItem["modifiers"]
): string {
  return modifiers
    .slice()
    .sort((modifierA, modifierB) => modifierA.id.localeCompare(modifierB.id))
    .map((modifier) => `${modifier.id}:${modifier.quantity}`)
    .join("|");
}
