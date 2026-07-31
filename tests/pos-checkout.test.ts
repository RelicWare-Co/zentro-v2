import { describe, expect, test } from "bun:test";
import {
  buildCartSignature,
  buildQuickSalePayments,
} from "@/features/pos/hooks/use-pos-checkout";
import type { CartItem } from "@/features/pos/types";

function buildTestCart(): CartItem[] {
  return [
    {
      id: "item-1",
      product: {
        id: "product-1",
        name: "Hamburguesa",
        categoryId: null,
        categoryName: "",
        sku: null,
        barcode: null,
        price: 18_000,
        taxRate: 19,
        trackInventory: false,
        stock: 0,
        isModifier: false,
        isFavorite: false,
        accountingTreatment: "revenue",
      },
      quantity: 2,
      modifiers: [
        { id: "salsa-2", name: "BBQ", price: 1000, quantity: 1 },
        { id: "salsa-1", name: "Picante", price: 500, quantity: 2 },
      ],
      discountAmount: 1500,
      notes: "Sin cebolla",
    },
  ];
}

describe("POS checkout helpers", () => {
  test("cart signature ignores recreated projections with the same content", () => {
    const cart = buildTestCart();
    const recreatedCart = cart.map((item) => ({
      ...item,
      product: { ...item.product },
      modifiers: [...item.modifiers]
        .reverse()
        .map((modifier) => ({ ...modifier })),
    }));

    expect(buildCartSignature(recreatedCart)).toBe(buildCartSignature(cart));
  });

  test("cart signature changes when cart semantics change", () => {
    const cart = buildTestCart();
    const changedCart = cart.map((item) => ({
      ...item,
      quantity: item.quantity + 1,
    }));

    expect(buildCartSignature(changedCart)).not.toBe(buildCartSignature(cart));
  });

  test("quick-sale omits payment when total is zero", () => {
    expect(buildQuickSalePayments(0)).toEqual([]);
  });

  test("quick-sale creates a cash payment when total is positive", () => {
    expect(buildQuickSalePayments(12_000)).toEqual([
      {
        amount: 12_000,
        method: "cash",
        reference: null,
      },
    ]);
  });
});
