import type { ShiftWithRelations } from "@/features/shifts/shift-types.shared";
import { normalizeNumber } from "@/lib/domain-values.shared";

export interface ShiftProductSummaryPayment {
  amount: number;
  method: string;
}

export interface ShiftProductSummaryItem {
  categoryId: string;
  categoryName: string;
  payments: ShiftProductSummaryPayment[];
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  unitPrice: number;
}

export interface ShiftCategorySummary {
  categoryId: string;
  categoryName: string;
  quantity: number;
  totalAmount: number;
}

export interface ShiftProductSummary {
  categories: ShiftCategorySummary[];
  products: ShiftProductSummaryItem[];
  totalAmount: number;
  totalItems: number;
}

function buildSalePaymentMap(
  payments: ShiftWithRelations["payments"]
): Map<string, Array<{ amount: number; method: string }>> {
  const salePayments = new Map<
    string,
    Array<{ amount: number; method: string }>
  >();
  for (const payment of payments ?? []) {
    if (!payment.saleId) {
      continue;
    }
    const existing = salePayments.get(payment.saleId) ?? [];
    existing.push({
      method: payment.method,
      amount: normalizeNumber(payment.appliedAmount ?? payment.amount),
    });
    salePayments.set(payment.saleId, existing);
  }
  return salePayments;
}

interface ProductAccumulator {
  categoryId: string;
  categoryName: string;
  payments: Map<string, number>;
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  unitPrice: number;
}

function upsertProduct(
  productMap: Map<string, ProductAccumulator>,
  item: {
    accountingTreatment?: string | null;
    productId: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    product?: {
      name: string;
      categoryId: string;
      category?: { name: string } | null;
    } | null;
  }
): ProductAccumulator {
  const productId = item.productId;
  const existing = productMap.get(productId);
  const quantity = item.quantity;
  const itemTotal = item.totalAmount;

  if (existing) {
    existing.quantity += quantity;
    existing.totalAmount += itemTotal;
    return existing;
  }

  const entry: ProductAccumulator = {
    productId,
    productName: item.product?.name ?? "Producto",
    categoryId: item.product?.categoryId ?? "sin-categoria",
    categoryName: item.product?.category?.name ?? "Sin categoría",
    quantity,
    totalAmount: itemTotal,
    unitPrice: item.unitPrice,
    payments: new Map(),
  };
  productMap.set(productId, entry);
  return entry;
}

function allocatePaymentsToProduct(
  productEntry: ProductAccumulator,
  paymentsForSale: Array<{ amount: number; method: string }>,
  itemTotal: number,
  saleTotal: number
) {
  if (!(saleTotal > 0)) {
    return;
  }
  const proportion = itemTotal / saleTotal;
  for (const payment of paymentsForSale) {
    const allocated = Math.round(payment.amount * proportion);
    const current = productEntry.payments.get(payment.method) ?? 0;
    productEntry.payments.set(payment.method, current + allocated);
  }
}

function buildCategoryMap(
  products: ShiftProductSummaryItem[]
): Map<string, ShiftCategorySummary> {
  const categoryMap = new Map<string, ShiftCategorySummary>();
  for (const product of products) {
    const existing = categoryMap.get(product.categoryId);
    if (existing) {
      existing.quantity += product.quantity;
      existing.totalAmount += product.totalAmount;
    } else {
      categoryMap.set(product.categoryId, {
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        quantity: product.quantity,
        totalAmount: product.totalAmount,
      });
    }
  }
  return categoryMap;
}

export function buildShiftProductSummary(
  shift: ShiftWithRelations
): ShiftProductSummary {
  const salePayments = buildSalePaymentMap(shift.payments);
  const productMap = new Map<string, ProductAccumulator>();

  for (const sale of shift.sales ?? []) {
    if (sale.status === "cancelled") {
      continue;
    }
    const paymentsForSale = salePayments.get(sale.id) ?? [];
    const saleTotal = normalizeNumber(sale.totalAmount);

    for (const item of sale.items ?? []) {
      if (item.accountingTreatment === "passthrough") {
        continue;
      }
      const productEntry = upsertProduct(productMap, item);
      allocatePaymentsToProduct(
        productEntry,
        paymentsForSale,
        item.totalAmount,
        saleTotal
      );
    }
  }

  const products = [...productMap.values()]
    .map((p) => ({
      ...p,
      payments: [...p.payments.entries()]
        .map(([method, amount]) => ({ amount, method }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const categories = [...buildCategoryMap(products).values()].sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  return {
    products,
    categories,
    totalItems: products.reduce((sum, p) => sum + p.quantity, 0),
    totalAmount: products.reduce((sum, p) => sum + p.totalAmount, 0),
  };
}
