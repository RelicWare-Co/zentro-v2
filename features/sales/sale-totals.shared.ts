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
  accountingTreatment: string;
  autoPayoutEnabled: boolean;
  autoPayoutPaymentMethod: string;
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
  accountingTreatment: string;
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

interface ItemDraft {
  baseDiscountAmount: number;
  baseProduct: ProductInfo;
  isPassthrough: boolean;
  lineSubtotal: number;
  modifiersSubtotal: number;
  preparedModifiers: PreparedModifier[];
  quantity: number;
  saleItemId: string;
  taxableBaseBeforeSaleDiscount: number;
  taxRate: number;
  unitPrice: number;
}

function buildItemDraft(
  item: CreateSaleInput["items"][number],
  itemIndex: number,
  productById: Map<string, ProductInfo>,
  addStockDelta: (productId: string, delta: number) => void
): ItemDraft {
  const baseProduct = productById.get(item.productId);

  if (!baseProduct) {
    throw new Error(`Producto inválido en ítem ${itemIndex + 1}`);
  }
  if (baseProduct.isModifier) {
    throw new Error(
      `El producto ${baseProduct.name} solo puede venderse como modificador`
    );
  }

  const isPassthrough = baseProduct.accountingTreatment === "passthrough";
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
  const baseDiscountAmount = toNonNegativeInteger(
    item.discountAmount ?? 0,
    `items[${itemIndex}].discountAmount`
  );

  if (isPassthrough) {
    if ((item.modifiers ?? []).length > 0) {
      throw new Error(
        `El producto ${baseProduct.name} es no contable y no puede tener modificadores`
      );
    }
    if (baseDiscountAmount > 0) {
      throw new Error(
        `El producto ${baseProduct.name} es no contable y no puede tener descuento`
      );
    }
  }

  const saleItemId = crypto.randomUUID();
  const { preparedModifiers, modifiersSubtotal } = buildPreparedModifiers(
    item.modifiers,
    quantity,
    itemIndex,
    productById,
    saleItemId,
    (productId, delta) => addStockDelta(productId, delta)
  );

  const lineSubtotal = quantity * unitPrice;
  const lineTaxableBaseBeforeSaleDiscount =
    lineSubtotal + modifiersSubtotal - baseDiscountAmount;
  if (lineTaxableBaseBeforeSaleDiscount < 0) {
    throw new Error(
      `La base gravable del ítem ${itemIndex + 1} no puede ser negativa`
    );
  }

  addStockDelta(baseProduct.id, -quantity);

  return {
    baseDiscountAmount,
    baseProduct,
    isPassthrough,
    lineSubtotal,
    modifiersSubtotal,
    preparedModifiers,
    quantity,
    saleItemId,
    taxRate: lineTaxRate,
    taxableBaseBeforeSaleDiscount: lineTaxableBaseBeforeSaleDiscount,
    unitPrice,
  };
}

export function buildPreparedItems(
  items: CreateSaleInput["items"],
  productById: Map<string, ProductInfo>,
  options: { saleLevelDiscount?: number } = {}
) {
  const stockDeltas = new Map<string, number>();
  const addStockDelta = (productId: string, delta: number) => {
    stockDeltas.set(productId, (stockDeltas.get(productId) ?? 0) + delta);
  };

  const saleLevelDiscount = toNonNegativeInteger(
    options.saleLevelDiscount ?? 0,
    "saleLevelDiscount"
  );
  const drafts: ItemDraft[] = [];
  let subtotal = 0;
  let revenueTaxableBaseBeforeSaleDiscount = 0;

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const draft = buildItemDraft(
      items[itemIndex],
      itemIndex,
      productById,
      addStockDelta
    );
    drafts.push(draft);
    subtotal += draft.lineSubtotal + draft.modifiersSubtotal;
    if (!draft.isPassthrough) {
      revenueTaxableBaseBeforeSaleDiscount +=
        draft.taxableBaseBeforeSaleDiscount;
    }
  }

  if (saleLevelDiscount > revenueTaxableBaseBeforeSaleDiscount) {
    throw new Error(
      "El descuento no puede superar el total de productos contables"
    );
  }

  // Allocate sale-level discount only among revenue items.
  // Passthrough items receive 0 allocation.
  const revenueBases = drafts.map((draft) =>
    draft.isPassthrough ? 0 : draft.taxableBaseBeforeSaleDiscount
  );
  const saleDiscountAllocations = allocateProportionalDiscount(
    revenueBases,
    saleLevelDiscount
  );

  const preparedItems: PreparedItem[] = [];
  let taxAmount = 0;
  let itemDiscountAmount = 0;
  let passThroughSubtotal = 0;
  let passThroughTaxAmount = 0;
  let passThroughTotalAmount = 0;

  for (let itemIndex = 0; itemIndex < drafts.length; itemIndex += 1) {
    const draft = drafts[itemIndex];
    const lineDiscountAmount =
      draft.baseDiscountAmount + (saleDiscountAllocations[itemIndex] ?? 0);
    const taxableBase =
      draft.lineSubtotal + draft.modifiersSubtotal - lineDiscountAmount;
    const lineTaxAmount = Math.round((taxableBase * draft.taxRate) / 100);
    const lineTotalAmount =
      draft.lineSubtotal +
      draft.modifiersSubtotal +
      lineTaxAmount -
      lineDiscountAmount;

    preparedItems.push({
      accountingTreatment: draft.baseProduct.accountingTreatment,
      id: draft.saleItemId,
      productId: draft.baseProduct.id,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      subtotal: draft.lineSubtotal,
      taxRate: draft.taxRate,
      taxAmount: lineTaxAmount,
      discountAmount: lineDiscountAmount,
      totalAmount: lineTotalAmount,
      modifiers: draft.preparedModifiers,
    });

    taxAmount += lineTaxAmount;
    itemDiscountAmount += lineDiscountAmount;

    if (draft.isPassthrough) {
      passThroughSubtotal += draft.lineSubtotal + draft.modifiersSubtotal;
      passThroughTaxAmount += lineTaxAmount;
      passThroughTotalAmount += lineTotalAmount;
    }
  }

  return {
    preparedItems,
    stockDeltas,
    subtotal,
    taxAmount,
    itemDiscountAmount,
    passThroughSubtotal,
    passThroughTaxAmount,
    passThroughTotalAmount,
  };
}

export function allocateProportionalDiscount(
  bases: number[],
  discountAmount: number
) {
  if (discountAmount === 0) {
    return bases.map(() => 0);
  }

  const totalBase = bases.reduce((sum, base) => sum + base, 0);
  if (totalBase <= 0) {
    return bases.map(() => 0);
  }

  const allocations = bases.map((base) =>
    Math.floor((discountAmount * base) / totalBase)
  );
  let remaining =
    discountAmount - allocations.reduce((sum, amount) => sum + amount, 0);

  for (let index = 0; index < allocations.length && remaining > 0; index += 1) {
    if (bases[index] <= allocations[index]) {
      continue;
    }
    allocations[index] += 1;
    remaining -= 1;
  }

  return allocations;
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

export function validateReceiptTotals(
  receiptTotals:
    | {
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
      }
    | undefined,
  serverTotals: {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
  }
): void {
  if (!receiptTotals) {
    return;
  }

  const fields: Array<keyof typeof serverTotals> = [
    "subtotal",
    "taxAmount",
    "discountAmount",
    "totalAmount",
  ];
  for (const field of fields) {
    if (receiptTotals[field] !== serverTotals[field]) {
      throw new Error(
        `El total reportado por el cliente (${field}: ${receiptTotals[field]}) no coincide con el calculado por el servidor (${field}: ${serverTotals[field]})`
      );
    }
  }
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
