import { buildSaleReceiptDocument } from "@/features/pos/printing/receipt-documents";
import type { CartItem, PosCustomer } from "@/features/pos/types";
import {
  calculateItemTotal,
  createPaymentMethodLabelMap,
} from "@/features/pos/utils";

interface PrintSaleReceiptParams {
  activeOrganizationId: string | null;
  customer: PosCustomer | undefined;
  defaultTerminalName: string;
  paymentMethods: Array<{ id: string; label: string }>;
  result: {
    saleId: string;
    status: string;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
  };
  snapshot: {
    cart: CartItem[];
    deliveryInfo?: string | null;
    payments: Array<{
      method: string;
      amount: number;
      reference: string | null;
    }>;
  };
}

export async function printSaleReceipt({
  activeOrganizationId,
  customer,
  defaultTerminalName,
  paymentMethods,
  result,
  snapshot,
}: PrintSaleReceiptParams) {
  const document = buildSaleReceiptDocument({
    documentId: result.saleId,
    issuedAt: Date.now(),
    status: result.status,
    customerName: customer?.name ?? "Cliente general",
    customerMeta: customer?.phone ?? null,
    deliveryInfo: snapshot.deliveryInfo,
    cashierName: null,
    terminalName: defaultTerminalName,
    items: snapshot.cart.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      totalAmount: calculateItemTotal(item),
      discountAmount: item.discountAmount,
      modifiers: item.modifiers.map((m) => ({
        name: m.name,
        quantity: m.quantity,
        unitPrice: m.price,
      })),
    })),
    payments: snapshot.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference,
    })),
    subtotal: result.subtotal,
    taxAmount: result.taxAmount,
    discountAmount: result.discountAmount,
    totalAmount: result.totalAmount,
    paidAmount: result.paidAmount,
    balanceDue: result.balanceDue,
    paymentMethodLabels: createPaymentMethodLabelMap(paymentMethods),
  });

  const { printThermalReceipt } = await import(
    "@/features/pos/printing/print-thermal-receipt.client"
  );
  await printThermalReceipt(document, activeOrganizationId);
}

export async function openPosCashDrawer(activeOrganizationId: string | null) {
  const { openPosCashDrawer: openDrawer } = await import(
    "@/features/pos/printing/print-thermal-receipt.client"
  );
  await openDrawer(activeOrganizationId);
}
