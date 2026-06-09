import { describe, expect, test } from "bun:test";
import { buildSaleReceiptDocument } from "@/features/pos/printing/receipt-documents";
import {
  getThermalReceiptCssMetrics,
  getThermalReceiptEncoderColumns,
  getThermalReceiptEncoderHeight,
} from "@/features/pos/printing/receipt-layout.shared";

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

  test("maps 58mm receipt settings to narrow paper and larger text", () => {
    expect(
      getThermalReceiptEncoderColumns({
        receiptPaperWidth: "58mm",
        receiptFontScale: "large",
      })
    ).toBe(32);
    expect(
      getThermalReceiptEncoderHeight({
        receiptPaperWidth: "58mm",
        receiptFontScale: "large",
      })
    ).toBe(2);
    expect(
      getThermalReceiptCssMetrics({
        receiptPaperWidth: "58mm",
        receiptFontScale: "large",
      })
    ).toMatchObject({
      paperWidthMm: 58,
      pageMarginMm: 3,
      contentWidthMm: 52,
      bodyFontPx: 13,
    });
  });
});
