import { describe, expect, test } from "bun:test";
import { buildSaleReceiptDocument } from "@/features/pos/printing/receipt-documents";

describe("POS sale receipt", () => {
  test("uses the active organization name as the receipt business name", () => {
    const document = buildSaleReceiptDocument({
      businessName: "Tienda Central",
      documentId: "sale_123456789",
      issuedAt: new Date("2026-01-02T15:04:00-05:00"),
      status: "completed",
      customerName: "Cliente general",
      items: [
        {
          name: "Cafe",
          quantity: 1,
          unitPrice: 5000,
          totalAmount: 5000,
        },
      ],
      payments: [{ method: "cash", amount: 5000 }],
      subtotal: 5000,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 5000,
      paidAmount: 5000,
      balanceDue: 0,
    });

    expect(document.receipt.businessName).toBe("Tienda Central");
  });
});
