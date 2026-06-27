// Pure sale calculation helpers — isomorphic, no DB imports.
//
// These functions are extracted from create-sale.server.ts to enable
// unit testing without a database. They accept pre-loaded product data
// and return prepared structures ready for DB insertion.

import type { z } from "zod";
import type { CreateSaleInputSchema } from "@/features/sales/sales.schema";
import {
  normalizeOptionalString,
  normalizeRequiredString,
  toNonNegativeInteger,
  toPositiveInteger,
} from "@/lib/domain-values.shared";

type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;

export interface ProductInfo {
  id: string;
  isModifier: boolean;
  name: string;
  price: number;
  stock: number;
  taxRate: number;
  trackInventory: boolean;
}

export interface PreparedModifier {
  id: string;
  modifierProductId: string;
  quantity: number;
  saleItemId: string;
  subtotal: number;
  totalQuantitySold: number;
  unitPrice: number;
}

export interface PreparedItem {
  discountAmount: number;
  id: string;
  modifiers: PreparedModifier[];
  productId: string;
  quantity: number;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  totalAmount: number;
  unitPrice: number;
}

export interface NormalizedPayment {
  amount: number;
  method: string;
  reference: string | null;
}

export function canSettleCompletedSaleWithCashChange(
  payments: Array<{ method: string; amount: number }>,
  totalAmount: number
) {
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  if (paidAmount <= totalAmount) {
    return false;
  }
  const hasCashPayment = payments.some(
    (payment) => payment.method === "cash" && payment.amount > 0
  );
  if (!hasCashPayment) {
    return false;
  }
  const nonCashPaid = payments.reduce(
    (sum, payment) => (payment.method === "cash" ? sum : sum + payment.amount),
    0
  );
  return nonCashPaid <= totalAmount;
}

export function calculateSaleTotals(input: {
  subtotal: number;
  taxAmount: number;
  itemDiscountAmount: number;
  saleLevelDiscount: number;
}) {
  const discountAmount = input.itemDiscountAmount + input.saleLevelDiscount;
  const totalAmount = input.subtotal + input.taxAmount - discountAmount;
  return { discountAmount, totalAmount };
}

export function calculateAppliedPayments(
  payments: Array<{ amount: number }>,
  totalAmount: number
) {
  const paidAmount = payments.reduce(
    (total, payment) => total + payment.amount,
    0
  );
  const appliedPaidAmount = Math.min(paidAmount, totalAmount);
  const balanceDue = Math.max(totalAmount - appliedPaidAmount, 0);
  return { paidAmount, appliedPaidAmount, balanceDue };
}

export function buildPreparedModifiers(
  modifiers: CreateSaleInput["items"][number]["modifiers"],
  quantity: number,
  itemIndex: number,
  productById: Map<string, ProductInfo>,
  saleItemId: string,
  onStockDelta: (productId: string, delta: number) => void
) {
  let modifiersSubtotal = 0;
  const preparedModifiers: PreparedModifier[] = [];

  for (
    let modifierIndex = 0;
    modifierIndex < (modifiers ?? []).length;
    modifierIndex += 1
  ) {
    const modifier = modifiers?.[modifierIndex];
    if (!modifier) {
      continue;
    }

    const modifierProduct = productById.get(modifier.modifierProductId);
    if (!modifierProduct) {
      throw new Error(
        `Modificador inválido en items[${itemIndex}].modifiers[${modifierIndex}]`
      );
    }
    if (!modifierProduct.isModifier) {
      throw new Error(
        `El producto ${modifierProduct.name} no está configurado como modificador`
      );
    }

    const modifierQuantity = toPositiveInteger(
      modifier.quantity,
      `items[${itemIndex}].modifiers[${modifierIndex}].quantity`
    );
    const modifierUnitPrice = toNonNegativeInteger(
      modifier.unitPrice ?? modifierProduct.price,
      `items[${itemIndex}].modifiers[${modifierIndex}].unitPrice`
    );
    const soldModifierQuantity = quantity * modifierQuantity;
    const modifierSubtotal = soldModifierQuantity * modifierUnitPrice;
    modifiersSubtotal += modifierSubtotal;
    onStockDelta(modifierProduct.id, -soldModifierQuantity);

    preparedModifiers.push({
      id: crypto.randomUUID(),
      saleItemId,
      modifierProductId: modifierProduct.id,
      quantity: modifierQuantity,
      unitPrice: modifierUnitPrice,
      subtotal: modifierSubtotal,
      totalQuantitySold: soldModifierQuantity,
    });
  }

  return { preparedModifiers, modifiersSubtotal };
}

export function buildPreparedItems(
  items: CreateSaleInput["items"],
  productById: Map<string, ProductInfo>
) {
  const stockDeltas = new Map<string, number>();
  const addStockDelta = (productId: string, delta: number) => {
    stockDeltas.set(productId, (stockDeltas.get(productId) ?? 0) + delta);
  };

  const preparedItems: PreparedItem[] = [];
  let subtotal = 0;
  let taxAmount = 0;
  let itemDiscountAmount = 0;

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const baseProduct = productById.get(item.productId);

    if (!baseProduct) {
      throw new Error(`Producto inválido en ítem ${itemIndex + 1}`);
    }
    if (baseProduct.isModifier) {
      throw new Error(
        `El producto ${baseProduct.name} solo puede venderse como modificador`
      );
    }

    const quantity = toPositiveInteger(
      item.quantity,
      `items[${itemIndex}].quantity`
    );
    const unitPrice = toNonNegativeInteger(
      item.unitPrice ?? baseProduct.price,
      `items[${itemIndex}].unitPrice`
    );
    const lineTaxRate = toNonNegativeInteger(
      item.taxRate ?? baseProduct.taxRate,
      `items[${itemIndex}].taxRate`
    );
    const lineDiscountAmount = toNonNegativeInteger(
      item.discountAmount ?? 0,
      `items[${itemIndex}].discountAmount`
    );

    const lineSubtotal = quantity * unitPrice;
    const lineTaxAmount = Math.round((lineSubtotal * lineTaxRate) / 100);

    const saleItemId = crypto.randomUUID();
    const { preparedModifiers, modifiersSubtotal } = buildPreparedModifiers(
      item.modifiers,
      quantity,
      itemIndex,
      productById,
      saleItemId,
      (productId, delta) => addStockDelta(productId, delta)
    );

    const lineTotalAmount =
      lineSubtotal + modifiersSubtotal + lineTaxAmount - lineDiscountAmount;
    if (lineTotalAmount < 0) {
      throw new Error(
        `El total del ítem ${itemIndex + 1} no puede ser negativo`
      );
    }

    preparedItems.push({
      id: saleItemId,
      productId: baseProduct.id,
      quantity,
      unitPrice,
      subtotal: lineSubtotal,
      taxRate: lineTaxRate,
      taxAmount: lineTaxAmount,
      discountAmount: lineDiscountAmount,
      totalAmount: lineTotalAmount,
      modifiers: preparedModifiers,
    });

    addStockDelta(baseProduct.id, -quantity);
    subtotal += lineSubtotal + modifiersSubtotal;
    taxAmount += lineTaxAmount;
    itemDiscountAmount += lineDiscountAmount;
  }

  return {
    preparedItems,
    stockDeltas,
    subtotal,
    taxAmount,
    itemDiscountAmount,
  };
}

export function normalizeAndValidatePayments(
  payments: CreateSaleInput["payments"],
  enabledPaymentMethodIds: Set<string>
): NormalizedPayment[] {
  const normalizedPayments = (payments ?? []).map(
    (registeredPayment, index) => ({
      method: normalizeRequiredString(
        registeredPayment.method,
        `payments[${index}].method`
      ).toLowerCase(),
      amount: toPositiveInteger(
        registeredPayment.amount,
        `payments[${index}].amount`
      ),
      reference: normalizeOptionalString(registeredPayment.reference),
    })
  );
  for (const registeredPayment of normalizedPayments) {
    if (!enabledPaymentMethodIds.has(registeredPayment.method)) {
      throw new Error(
        `Método de pago no habilitado: ${registeredPayment.method}`
      );
    }
  }
  return normalizedPayments;
}

export function validatePaymentRules(
  normalizedPayments: NormalizedPayment[],
  totalAmount: number,
  isCreditSale: boolean,
  customerId: string | null
) {
  const paidAmount = normalizedPayments.reduce(
    (total, registeredPayment) => total + registeredPayment.amount,
    0
  );
  const allowsCashChange = canSettleCompletedSaleWithCashChange(
    normalizedPayments,
    totalAmount
  );

  if (isCreditSale) {
    if (!customerId) {
      throw new Error(
        "Una venta a crédito requiere seleccionar un cliente registrado"
      );
    }
    if (paidAmount > totalAmount) {
      throw new Error(
        "Los pagos no pueden superar el total en una venta a crédito"
      );
    }
    if (totalAmount - paidAmount <= 0) {
      throw new Error(
        "La venta marcada como crédito debe dejar un saldo pendiente por cobrar"
      );
    }
  } else if (totalAmount === 0) {
    if (normalizedPayments.length > 0) {
      throw new Error(
        "No debes registrar pagos cuando el total de la venta es 0"
      );
    }
  } else {
    if (normalizedPayments.length === 0) {
      throw new Error(
        "Debes registrar al menos un pago para finalizar la venta"
      );
    }
    if (paidAmount !== totalAmount && !allowsCashChange) {
      throw new Error(
        "La suma de los pagos debe ser igual al total de la venta, salvo excedente en efectivo para devolver cambio"
      );
    }
  }

  return { paidAmount, allowsCashChange };
}
