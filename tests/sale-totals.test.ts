import { describe, expect, test } from "bun:test";
import {
  buildPreparedItems,
  calculateAppliedPayments,
  calculateSaleTotals,
  canSettleCompletedSaleWithCashChange,
  normalizeAndValidatePayments,
  type ProductInfo,
  validatePaymentRules,
  validateReceiptTotals,
} from "@/features/sales/sale-totals.shared";

function makeProduct(overrides: Partial<ProductInfo> = {}): ProductInfo {
  return {
    id: "prod-1",
    isModifier: false,
    name: "Test Product",
    price: 1000,
    stock: 100,
    taxRate: 10,
    trackInventory: true,
    ...overrides,
  };
}

describe("canSettleCompletedSaleWithCashChange", () => {
  test("returns true when cash overpayment covers the difference", () => {
    const result = canSettleCompletedSaleWithCashChange(
      [
        { method: "card", amount: 5000 },
        { method: "cash", amount: 3000 },
      ],
      7000
    );
    expect(result).toBe(true);
  });

  test("returns false when paid amount equals total", () => {
    const result = canSettleCompletedSaleWithCashChange(
      [{ method: "cash", amount: 5000 }],
      5000
    );
    expect(result).toBe(false);
  });

  test("returns false when no cash payment", () => {
    const result = canSettleCompletedSaleWithCashChange(
      [{ method: "card", amount: 6000 }],
      5000
    );
    expect(result).toBe(false);
  });

  test("returns false when non-cash payments alone exceed total", () => {
    const result = canSettleCompletedSaleWithCashChange(
      [
        { method: "card", amount: 6000 },
        { method: "cash", amount: 1000 },
      ],
      5000
    );
    expect(result).toBe(false);
  });
});

describe("calculateSaleTotals", () => {
  test("computes discount and total correctly", () => {
    const result = calculateSaleTotals({
      subtotal: 10_000,
      taxAmount: 1000,
      itemDiscountAmount: 500,
      saleLevelDiscount: 500,
    });
    expect(result.discountAmount).toBe(1000);
    expect(result.totalAmount).toBe(10_000);
  });

  test("handles zero discounts", () => {
    const result = calculateSaleTotals({
      subtotal: 5000,
      taxAmount: 500,
      itemDiscountAmount: 0,
      saleLevelDiscount: 0,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.totalAmount).toBe(5500);
  });
});

describe("calculateAppliedPayments", () => {
  test("caps paid amount at total", () => {
    const result = calculateAppliedPayments(
      [{ amount: 8000 }, { amount: 3000 }],
      10_000
    );
    expect(result.paidAmount).toBe(11_000);
    expect(result.appliedPaidAmount).toBe(10_000);
    expect(result.balanceDue).toBe(0);
  });

  test("leaves balance when underpaid", () => {
    const result = calculateAppliedPayments([{ amount: 3000 }], 10_000);
    expect(result.paidAmount).toBe(3000);
    expect(result.appliedPaidAmount).toBe(3000);
    expect(result.balanceDue).toBe(7000);
  });
});

describe("buildPreparedItems", () => {
  test("builds a single item with tax and no modifiers", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 1000, taxRate: 10 })],
    ]);
    const result = buildPreparedItems(
      [
        {
          productId: "prod-1",
          quantity: 3,
          unitPrice: 1000,
        },
      ],
      productById
    );
    expect(result.preparedItems).toHaveLength(1);
    const item = result.preparedItems[0];
    expect(item.quantity).toBe(3);
    expect(item.unitPrice).toBe(1000);
    expect(item.subtotal).toBe(3000);
    expect(item.taxRate).toBe(10);
    expect(item.taxAmount).toBe(300);
    expect(item.totalAmount).toBe(3300);
    expect(item.modifiers).toEqual([]);
    expect(result.subtotal).toBe(3000);
    expect(result.taxAmount).toBe(300);
    expect(result.itemDiscountAmount).toBe(0);
    expect(result.stockDeltas.get("prod-1")).toBe(-3);
  });

  test("uses product default price when unitPrice is omitted", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 2500, taxRate: 0 })],
    ]);
    const result = buildPreparedItems(
      [{ productId: "prod-1", quantity: 2 }],
      productById
    );
    expect(result.preparedItems[0].unitPrice).toBe(2500);
    expect(result.preparedItems[0].subtotal).toBe(5000);
  });

  test("throws when product is not found", () => {
    expect(() =>
      buildPreparedItems([{ productId: "missing", quantity: 1 }], new Map())
    ).toThrow("Producto inválido en ítem 1");
  });

  test("throws when a modifier-only product is used as a base item", () => {
    const productById = new Map([
      ["mod-1", makeProduct({ id: "mod-1", isModifier: true, name: "Sauce" })],
    ]);
    expect(() =>
      buildPreparedItems([{ productId: "mod-1", quantity: 1 }], productById)
    ).toThrow("solo puede venderse como modificador");
  });

  test("builds item with modifiers and accumulates stock deltas", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ id: "prod-1", price: 2000, taxRate: 0 })],
      [
        "mod-1",
        makeProduct({
          id: "mod-1",
          isModifier: true,
          name: "Extra",
          price: 500,
        }),
      ],
    ]);
    const result = buildPreparedItems(
      [
        {
          productId: "prod-1",
          quantity: 2,
          modifiers: [
            { modifierProductId: "mod-1", quantity: 1, unitPrice: 500 },
          ],
        },
      ],
      productById
    );
    const item = result.preparedItems[0];
    expect(item.modifiers).toHaveLength(1);
    expect(item.modifiers[0].subtotal).toBe(1000);
    expect(item.subtotal).toBe(4000);
    expect(item.totalAmount).toBe(5000);
    expect(result.stockDeltas.get("prod-1")).toBe(-2);
    expect(result.stockDeltas.get("mod-1")).toBe(-2);
  });

  test("throws when item total is negative after discount", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 1000, taxRate: 0 })],
    ]);
    expect(() =>
      buildPreparedItems(
        [
          {
            productId: "prod-1",
            quantity: 1,
            unitPrice: 1000,
            discountAmount: 2000,
          },
        ],
        productById
      )
    ).toThrow("base gravable");
  });
});

describe("normalizeAndValidatePayments", () => {
  test("normalizes method to lowercase and validates against enabled set", () => {
    const result = normalizeAndValidatePayments(
      [{ method: "CASH", amount: 5000, reference: "ref-1" }],
      new Set(["cash"])
    );
    expect(result).toEqual([
      { method: "cash", amount: 5000, reference: "ref-1" },
    ]);
  });

  test("throws for non-enabled payment method", () => {
    expect(() =>
      normalizeAndValidatePayments(
        [{ method: "crypto", amount: 5000, reference: null }],
        new Set(["cash", "card"])
      )
    ).toThrow("Método de pago no habilitado: crypto");
  });

  test("handles null payments array", () => {
    const result = normalizeAndValidatePayments(
      null as unknown as [],
      new Set(["cash"])
    );
    expect(result).toEqual([]);
  });
});

describe("validatePaymentRules", () => {
  test("credit sale requires a customer", () => {
    expect(() => validatePaymentRules([], 5000, true, null)).toThrow(
      "requiere seleccionar un cliente"
    );
  });

  test("credit sale rejects overpayment", () => {
    expect(() =>
      validatePaymentRules(
        [{ method: "cash", amount: 6000, reference: null }],
        5000,
        true,
        "cust-1"
      )
    ).toThrow("no pueden superar el total");
  });

  test("credit sale requires a remaining balance", () => {
    expect(() =>
      validatePaymentRules(
        [{ method: "cash", amount: 5000, reference: null }],
        5000,
        true,
        "cust-1"
      )
    ).toThrow("saldo pendiente");
  });

  test("zero-total sale rejects any payments", () => {
    expect(() =>
      validatePaymentRules(
        [{ method: "cash", amount: 100, reference: null }],
        0,
        false,
        null
      )
    ).toThrow("total de la venta es 0");
  });

  test("non-zero sale requires at least one payment", () => {
    expect(() => validatePaymentRules([], 5000, false, null)).toThrow(
      "al menos un pago"
    );
  });

  test("completed sale with exact payment passes", () => {
    const result = validatePaymentRules(
      [{ method: "cash", amount: 5000, reference: null }],
      5000,
      false,
      null
    );
    expect(result.paidAmount).toBe(5000);
    expect(result.allowsCashChange).toBe(false);
  });

  test("completed sale with cash overpayment passes when cash covers change", () => {
    const result = validatePaymentRules(
      [
        { method: "card", amount: 4000, reference: null },
        { method: "cash", amount: 2000, reference: null },
      ],
      5000,
      false,
      null
    );
    expect(result.paidAmount).toBe(6000);
    expect(result.allowsCashChange).toBe(true);
  });

  test("completed sale with mismatched non-cash payment fails", () => {
    expect(() =>
      validatePaymentRules(
        [{ method: "card", amount: 6000, reference: null }],
        5000,
        false,
        null
      )
    ).toThrow("suma de los pagos debe ser igual al total");
  });
});

describe("tax calculations in buildPreparedItems", () => {
  test("applies 19% tax rate correctly", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 10_000, taxRate: 19 })],
    ]);
    const result = buildPreparedItems(
      [{ productId: "prod-1", quantity: 2, unitPrice: 10_000 }],
      productById
    );
    expect(result.preparedItems[0].taxRate).toBe(19);
    expect(result.preparedItems[0].taxAmount).toBe(3800);
    expect(result.preparedItems[0].totalAmount).toBe(23_800);
    expect(result.taxAmount).toBe(3800);
  });

  test("applies 5% tax rate correctly", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 1000, taxRate: 5 })],
    ]);
    const result = buildPreparedItems(
      [{ productId: "prod-1", quantity: 3, unitPrice: 1000 }],
      productById
    );
    expect(result.preparedItems[0].taxAmount).toBe(150);
    expect(result.taxAmount).toBe(150);
  });

  test("tax-exempt product (taxRate=0) produces zero tax", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 5000, taxRate: 0 })],
    ]);
    const result = buildPreparedItems(
      [{ productId: "prod-1", quantity: 4, unitPrice: 5000 }],
      productById
    );
    expect(result.preparedItems[0].taxAmount).toBe(0);
    expect(result.preparedItems[0].totalAmount).toBe(20_000);
    expect(result.taxAmount).toBe(0);
  });

  test("rounds tax amount with Math.round", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 1003, taxRate: 19 })],
    ]);
    const result = buildPreparedItems(
      [{ productId: "prod-1", quantity: 1, unitPrice: 1003 }],
      productById
    );
    expect(result.preparedItems[0].taxAmount).toBe(
      Math.round((1003 * 19) / 100)
    );
    expect(result.preparedItems[0].taxAmount).toBe(191);
  });

  test("explicit taxRate override on item takes precedence", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 10_000, taxRate: 19 })],
    ]);
    const result = buildPreparedItems(
      [{ productId: "prod-1", quantity: 1, unitPrice: 10_000, taxRate: 5 }],
      productById
    );
    expect(result.preparedItems[0].taxRate).toBe(5);
    expect(result.preparedItems[0].taxAmount).toBe(500);
  });

  test("falls back to product taxRate when item omits taxRate", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 2000, taxRate: 10 })],
    ]);
    const result = buildPreparedItems(
      [{ productId: "prod-1", quantity: 2 }],
      productById
    );
    expect(result.preparedItems[0].taxRate).toBe(10);
    expect(result.preparedItems[0].taxAmount).toBe(400);
  });

  test("aggregates tax across multiple items with mixed rates", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ id: "prod-1", price: 10_000, taxRate: 19 })],
      ["prod-2", makeProduct({ id: "prod-2", price: 5000, taxRate: 0 })],
      ["prod-3", makeProduct({ id: "prod-3", price: 2000, taxRate: 5 })],
    ]);
    const result = buildPreparedItems(
      [
        { productId: "prod-1", quantity: 1, unitPrice: 10_000 },
        { productId: "prod-2", quantity: 2, unitPrice: 5000 },
        { productId: "prod-3", quantity: 3, unitPrice: 2000 },
      ],
      productById
    );
    expect(result.preparedItems[0].taxAmount).toBe(1900);
    expect(result.preparedItems[1].taxAmount).toBe(0);
    expect(result.preparedItems[2].taxAmount).toBe(300);
    expect(result.taxAmount).toBe(2200);
  });

  test("tax is calculated on item subtotal plus modifiers", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ id: "prod-1", price: 2000, taxRate: 10 })],
      [
        "mod-1",
        makeProduct({
          id: "mod-1",
          isModifier: true,
          name: "Extra",
          price: 500,
          taxRate: 10,
        }),
      ],
    ]);
    const result = buildPreparedItems(
      [
        {
          productId: "prod-1",
          quantity: 2,
          unitPrice: 2000,
          modifiers: [
            { modifierProductId: "mod-1", quantity: 1, unitPrice: 500 },
          ],
        },
      ],
      productById
    );
    const item = result.preparedItems[0];
    expect(item.subtotal).toBe(4000);
    expect(item.taxAmount).toBe(500);
    expect(item.modifiers[0].subtotal).toBe(1000);
    expect(item.totalAmount).toBe(4000 + 1000 + 500);
    expect(result.subtotal).toBe(5000);
    expect(result.taxAmount).toBe(500);
  });
});

describe("discount validation in buildPreparedItems and calculateSaleTotals", () => {
  test("item-level discount only reduces item total", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 10_000, taxRate: 0 })],
    ]);
    const result = buildPreparedItems(
      [
        {
          productId: "prod-1",
          quantity: 1,
          unitPrice: 10_000,
          discountAmount: 2000,
        },
      ],
      productById
    );
    expect(result.preparedItems[0].discountAmount).toBe(2000);
    expect(result.preparedItems[0].totalAmount).toBe(8000);
    expect(result.itemDiscountAmount).toBe(2000);
  });

  test("sale-level discount only via calculateSaleTotals", () => {
    const result = calculateSaleTotals({
      subtotal: 10_000,
      taxAmount: 1000,
      itemDiscountAmount: 0,
      saleLevelDiscount: 3000,
    });
    expect(result.discountAmount).toBe(3000);
    expect(result.totalAmount).toBe(8000);
  });

  test("both item-level and sale-level discounts sum correctly", () => {
    const result = calculateSaleTotals({
      subtotal: 20_000,
      taxAmount: 2000,
      itemDiscountAmount: 3000,
      saleLevelDiscount: 5000,
    });
    expect(result.discountAmount).toBe(8000);
    expect(result.totalAmount).toBe(14_000);
  });

  test("multi-item sale where one item discount exceeds its subtotal throws", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ id: "prod-1", price: 1000, taxRate: 0 })],
      ["prod-2", makeProduct({ id: "prod-2", price: 5000, taxRate: 0 })],
    ]);
    expect(() =>
      buildPreparedItems(
        [
          {
            productId: "prod-1",
            quantity: 1,
            unitPrice: 1000,
            discountAmount: 2000,
          },
          { productId: "prod-2", quantity: 1, unitPrice: 5000 },
        ],
        productById
      )
    ).toThrow("base gravable");
  });

  test("zero discounts leave totals unchanged", () => {
    const result = calculateSaleTotals({
      subtotal: 10_000,
      taxAmount: 1000,
      itemDiscountAmount: 0,
      saleLevelDiscount: 0,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.totalAmount).toBe(11_000);
  });

  test("item-level discount reduces taxable base before tax", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 10_000, taxRate: 19 })],
    ]);
    const { preparedItems, subtotal, taxAmount, itemDiscountAmount } =
      buildPreparedItems(
        [
          {
            productId: "prod-1",
            quantity: 1,
            unitPrice: 10_000,
            discountAmount: 2000,
          },
        ],
        productById
      );
    expect(preparedItems[0].taxAmount).toBe(1520);
    expect(preparedItems[0].totalAmount).toBe(10_000 + 1520 - 2000);

    const totals = calculateSaleTotals({
      subtotal,
      taxAmount,
      itemDiscountAmount,
      saleLevelDiscount: 0,
    });
    expect(totals.totalAmount).toBe(9520);
  });

  test("item-level discount reduces modifier-inclusive taxable base", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ id: "prod-1", price: 10_000, taxRate: 19 })],
      [
        "mod-1",
        makeProduct({
          id: "mod-1",
          isModifier: true,
          name: "Extra",
          price: 2000,
        }),
      ],
    ]);
    const { preparedItems, taxAmount } = buildPreparedItems(
      [
        {
          productId: "prod-1",
          quantity: 1,
          unitPrice: 10_000,
          discountAmount: 3000,
          modifiers: [
            { modifierProductId: "mod-1", quantity: 1, unitPrice: 2000 },
          ],
        },
      ],
      productById
    );

    expect(preparedItems[0].taxAmount).toBe(1710);
    expect(preparedItems[0].totalAmount).toBe(10_000 + 2000 + 1710 - 3000);
    expect(taxAmount).toBe(1710);
  });

  test("sale-level discount is distributed before tax is calculated", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ id: "prod-1", price: 10_000, taxRate: 19 })],
      ["prod-2", makeProduct({ id: "prod-2", price: 5000, taxRate: 5 })],
    ]);

    const result = buildPreparedItems(
      [
        { productId: "prod-1", quantity: 1, unitPrice: 10_000 },
        { productId: "prod-2", quantity: 1, unitPrice: 5000 },
      ],
      productById,
      { saleLevelDiscount: 3000 }
    );

    expect(result.preparedItems[0].discountAmount).toBe(2000);
    expect(result.preparedItems[0].taxAmount).toBe(1520);
    expect(result.preparedItems[1].discountAmount).toBe(1000);
    expect(result.preparedItems[1].taxAmount).toBe(200);
    expect(result.itemDiscountAmount).toBe(3000);
    expect(result.taxAmount).toBe(1720);
  });

  test("sale-level discount includes modifier subtotal in distribution base", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ id: "prod-1", price: 10_000, taxRate: 19 })],
      ["prod-2", makeProduct({ id: "prod-2", price: 6000, taxRate: 19 })],
      [
        "mod-1",
        makeProduct({
          id: "mod-1",
          isModifier: true,
          name: "Extra",
          price: 2000,
        }),
      ],
    ]);

    const result = buildPreparedItems(
      [
        {
          productId: "prod-1",
          quantity: 1,
          unitPrice: 10_000,
          modifiers: [
            { modifierProductId: "mod-1", quantity: 1, unitPrice: 2000 },
          ],
        },
        { productId: "prod-2", quantity: 1, unitPrice: 6000 },
      ],
      productById,
      { saleLevelDiscount: 3000 }
    );

    expect(result.preparedItems[0].discountAmount).toBe(2000);
    expect(result.preparedItems[0].taxAmount).toBe(1900);
    expect(result.preparedItems[1].discountAmount).toBe(1000);
    expect(result.preparedItems[1].taxAmount).toBe(950);
    expect(result.itemDiscountAmount).toBe(3000);
    expect(result.taxAmount).toBe(2850);
  });

  test("throws when item-level discount makes taxable base negative", () => {
    const productById = new Map([
      ["prod-1", makeProduct({ price: 1000, taxRate: 19 })],
    ]);

    expect(() =>
      buildPreparedItems(
        [
          {
            productId: "prod-1",
            quantity: 1,
            unitPrice: 1000,
            discountAmount: 1100,
          },
        ],
        productById
      )
    ).toThrow("base gravable");
  });
});

describe("cash change edge cases", () => {
  test("exact cash payment does not allow cash change", () => {
    const result = validatePaymentRules(
      [{ method: "cash", amount: 5000, reference: null }],
      5000,
      false,
      null
    );
    expect(result.allowsCashChange).toBe(false);
  });

  test("pure cash overpayment allows change", () => {
    const result = validatePaymentRules(
      [{ method: "cash", amount: 7000, reference: null }],
      5000,
      false,
      null
    );
    expect(result.allowsCashChange).toBe(true);
    expect(result.paidAmount).toBe(7000);
  });

  test("two cash payments that together overpay allow change", () => {
    const result = validatePaymentRules(
      [
        { method: "cash", amount: 3000, reference: null },
        { method: "cash", amount: 3000, reference: null },
      ],
      5000,
      false,
      null
    );
    expect(result.allowsCashChange).toBe(true);
    expect(result.paidAmount).toBe(6000);
  });

  test("cash overpayment with exact non-cash split allows change", () => {
    const result = validatePaymentRules(
      [
        { method: "card", amount: 5000, reference: null },
        { method: "cash", amount: 3000, reference: null },
      ],
      5000,
      false,
      null
    );
    expect(result.allowsCashChange).toBe(true);
  });

  test("zero-total sale rejects any cash payment", () => {
    expect(() =>
      validatePaymentRules(
        [{ method: "cash", amount: 100, reference: null }],
        0,
        false,
        null
      )
    ).toThrow("total de la venta es 0");
  });
});

describe("validateReceiptTotals", () => {
  const serverTotals = {
    subtotal: 10_000,
    taxAmount: 1900,
    discountAmount: 2000,
    totalAmount: 9900,
  };

  test("passes when all fields match", () => {
    expect(() =>
      validateReceiptTotals({ ...serverTotals }, serverTotals)
    ).not.toThrow();
  });

  test("passes when receiptTotals is undefined", () => {
    expect(() => validateReceiptTotals(undefined, serverTotals)).not.toThrow();
  });

  test("throws when subtotal differs", () => {
    expect(() =>
      validateReceiptTotals({ ...serverTotals, subtotal: 9999 }, serverTotals)
    ).toThrow("subtotal");
  });

  test("throws when taxAmount differs", () => {
    expect(() =>
      validateReceiptTotals({ ...serverTotals, taxAmount: 0 }, serverTotals)
    ).toThrow("taxAmount");
  });

  test("throws when discountAmount differs", () => {
    expect(() =>
      validateReceiptTotals(
        { ...serverTotals, discountAmount: 0 },
        serverTotals
      )
    ).toThrow("discountAmount");
  });

  test("throws when totalAmount differs", () => {
    expect(() =>
      validateReceiptTotals({ ...serverTotals, totalAmount: 0 }, serverTotals)
    ).toThrow("totalAmount");
  });
});
