import { describe, expect, test } from "bun:test";
import type { CartItem, CartItemModifier, Product } from "@/features/pos/types";
import { calculateCartTotals } from "@/features/pos/utils";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    name: "Test Product",
    categoryId: null,
    categoryName: "",
    sku: null,
    barcode: null,
    price: 10_000,
    taxRate: 19,
    trackInventory: false,
    stock: 0,
    isModifier: false,
    isFavorite: false,
    ...overrides,
  };
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: crypto.randomUUID(),
    product: makeProduct(),
    quantity: 1,
    modifiers: [] as CartItemModifier[],
    discountAmount: 0,
    ...overrides,
  };
}

describe("calculateCartTotals", () => {
  test("single item, no discount — tax on gross base", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 10_000, taxRate: 19 }),
        quantity: 1,
      }),
    ];
    const totals = calculateCartTotals(items, "0");
    expect(totals.subTotal).toBe(10_000);
    expect(totals.tax).toBe(1900);
    expect(totals.totalAmount).toBe(11_900);
  });

  test("single item with sale-level discount — tax on discounted base (the reported bug)", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 10_000, taxRate: 19 }),
        quantity: 1,
      }),
    ];
    const totals = calculateCartTotals(items, "2000");
    expect(totals.subTotal).toBe(10_000);
    expect(totals.tax).toBe(1520);
    expect(totals.discountAmount).toBe(2000);
    expect(totals.totalAmount).toBe(9520);
  });

  test("single item with item-level discount — tax on discounted base", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 10_000, taxRate: 19 }),
        quantity: 1,
        discountAmount: 2000,
      }),
    ];
    const totals = calculateCartTotals(items, "0");
    expect(totals.tax).toBe(1520);
    expect(totals.discountAmount).toBe(2000);
    expect(totals.totalAmount).toBe(9520);
  });

  test("item with modifiers — tax includes modifier subtotal", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 2000, taxRate: 10 }),
        quantity: 2,
        modifiers: [{ id: "mod-1", name: "Extra", price: 500, quantity: 1 }],
      }),
    ];
    const totals = calculateCartTotals(items, "0");
    expect(totals.subTotal).toBe(5000);
    expect(totals.tax).toBe(500);
    expect(totals.totalAmount).toBe(5500);
  });

  test("multi-item with sale-level discount — proration matches server", () => {
    const items = [
      makeItem({
        product: makeProduct({ id: "p1", price: 10_000, taxRate: 19 }),
        quantity: 1,
      }),
      makeItem({
        product: makeProduct({ id: "p2", price: 5000, taxRate: 5 }),
        quantity: 1,
      }),
    ];
    const totals = calculateCartTotals(items, "3000");
    expect(totals.tax).toBe(1720);
    expect(totals.discountAmount).toBe(3000);
    expect(totals.totalAmount).toBe(13_720);
  });

  test("multi-item with mixed tax rates + sale-level discount + modifiers", () => {
    const items = [
      makeItem({
        product: makeProduct({ id: "p1", price: 10_000, taxRate: 19 }),
        quantity: 1,
        modifiers: [{ id: "mod-1", name: "Extra", price: 2000, quantity: 1 }],
      }),
      makeItem({
        product: makeProduct({ id: "p2", price: 6000, taxRate: 19 }),
        quantity: 1,
      }),
    ];
    const totals = calculateCartTotals(items, "3000");
    expect(totals.tax).toBe(2850);
    expect(totals.discountAmount).toBe(3000);
    expect(totals.totalAmount).toBe(17_850);
  });

  test("product 10.000 + modifier 2.000 at 19% — tax includes modifier (regression for P1)", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 10_000, taxRate: 19 }),
        quantity: 1,
        modifiers: [{ id: "mod-1", name: "Extra", price: 2000, quantity: 1 }],
      }),
    ];
    const totals = calculateCartTotals(items, "0");
    expect(totals.subTotal).toBe(12_000);
    expect(totals.tax).toBe(2280);
    expect(totals.totalAmount).toBe(14_280);
  });

  test("tax-exempt product produces zero tax", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 5000, taxRate: 0 }),
        quantity: 4,
      }),
    ];
    const totals = calculateCartTotals(items, "0");
    expect(totals.tax).toBe(0);
    expect(totals.totalAmount).toBe(20_000);
  });

  test("both item-level and sale-level discounts combine", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 10_000, taxRate: 19 }),
        quantity: 1,
        discountAmount: 1000,
      }),
    ];
    const totals = calculateCartTotals(items, "1000");
    expect(totals.tax).toBe(1520);
    expect(totals.discountAmount).toBe(2000);
    expect(totals.totalAmount).toBe(9520);
  });

  test("sale-level discount that can't fully distribute — discountAmount equals allocated sum, not raw input", () => {
    const items = [
      makeItem({
        product: makeProduct({ id: "p1", price: 1, taxRate: 0 }),
        quantity: 1,
      }),
      makeItem({
        product: makeProduct({ id: "p2", price: 1, taxRate: 0 }),
        quantity: 1,
      }),
    ];
    const totals = calculateCartTotals(items, "3");
    expect(totals.discountAmount).toBe(2);
    expect(totals.totalAmount).toBe(0);
  });

  test("sale-level discount exceeds taxable base — maxSaleDiscount exposes the limit, totalAmount clamps to 0", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 10_000, taxRate: 19 }),
        quantity: 1,
      }),
    ];
    const totals = calculateCartTotals(items, "15000");
    expect(totals.maxSaleDiscount).toBe(10_000);
    expect(totals.saleDiscountAmount).toBe(15_000);
    expect(totals.totalAmount).toBe(0);
  });

  test("sale-level discount exceeds taxable base with item-level discounts — maxSaleDiscount reflects net base", () => {
    const items = [
      makeItem({
        product: makeProduct({ price: 10_000, taxRate: 0 }),
        quantity: 1,
        discountAmount: 3000,
      }),
    ];
    const totals = calculateCartTotals(items, "8000");
    expect(totals.maxSaleDiscount).toBe(7000);
    expect(totals.saleDiscountAmount).toBe(8000);
    expect(totals.totalAmount).toBe(0);
  });
});
