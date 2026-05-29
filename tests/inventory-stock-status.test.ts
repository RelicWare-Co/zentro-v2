import { describe, expect, test } from "bun:test";
import {
  getEffectiveStockThreshold,
  getStockStatus,
} from "@/features/inventory/stock-status.shared";

describe("getStockStatus", () => {
  test("returns untracked when inventory is disabled", () => {
    expect(
      getStockStatus({
        trackInventory: false,
        stock: 0,
        lowStockThreshold: 5,
      })
    ).toBe("untracked");
  });

  test("returns out when stock is zero", () => {
    expect(
      getStockStatus({
        trackInventory: true,
        stock: 0,
        minStock: 3,
        lowStockThreshold: 5,
      })
    ).toBe("out");
  });

  test("uses per-product minStock when set", () => {
    expect(
      getStockStatus({
        trackInventory: true,
        stock: 4,
        minStock: 4,
        lowStockThreshold: 10,
      })
    ).toBe("low");
    expect(
      getStockStatus({
        trackInventory: true,
        stock: 5,
        minStock: 4,
        lowStockThreshold: 10,
      })
    ).toBe("ok");
  });

  test("falls back to global threshold when minStock is null", () => {
    expect(
      getStockStatus({
        trackInventory: true,
        stock: 5,
        minStock: null,
        lowStockThreshold: 5,
      })
    ).toBe("low");
    expect(
      getStockStatus({
        trackInventory: true,
        stock: 6,
        minStock: null,
        lowStockThreshold: 5,
      })
    ).toBe("ok");
  });
});

describe("getEffectiveStockThreshold", () => {
  test("prefers minStock over global threshold", () => {
    expect(
      getEffectiveStockThreshold({
        minStock: 2,
        lowStockThreshold: 8,
      })
    ).toBe(2);
  });
});
