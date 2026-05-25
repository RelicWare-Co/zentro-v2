import { describe, expect, test } from "bun:test";
import type { Product } from "@/features/pos/types";
import {
  buildBarcodeLookupValues,
  buildPosV2BarcodeScanPayload,
  findProductByBarcodeScan,
} from "@/features/posv2/posv2-barcode.shared";

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    name: "Producto demo",
    categoryId: null,
    categoryName: "General",
    sku: null,
    barcode: null,
    price: 1000,
    taxRate: 0,
    trackInventory: true,
    stock: 10,
    isModifier: false,
    isFavorite: false,
    ...overrides,
  };
}

describe("posv2 barcode helpers", () => {
  test("buildBarcodeLookupValues normalizes GTIN and EAN variants", () => {
    expect(buildBarcodeLookupValues("3046920029759")).toEqual([
      "3046920029759",
      "03046920029759",
    ]);
    expect(buildBarcodeLookupValues("03046920029759")).toEqual([
      "03046920029759",
      "3046920029759",
    ]);
  });

  test("buildPosV2BarcodeScanPayload prefers parsed GTIN", () => {
    const payload = buildPosV2BarcodeScanPayload({
      value: "3046920029759",
      symbology: "ean13",
      data: {
        gtin: "03046920029759",
        elements: [],
      },
    });

    expect(payload.gtin).toBe("03046920029759");
    expect(payload.lookupValues).toContain("3046920029759");
    expect(payload.lookupValues).toContain("03046920029759");
  });

  test("findProductByBarcodeScan matches barcode, GTIN, and SKU", () => {
    const products = [
      createProduct({
        id: "by-barcode",
        barcode: "3046920029759",
      }),
      createProduct({
        id: "by-sku",
        sku: "SKU-123",
      }),
    ];

    expect(findProductByBarcodeScan(products, ["03046920029759"])?.id).toBe(
      "by-barcode"
    );
    expect(findProductByBarcodeScan(products, ["SKU-123"])?.id).toBe("by-sku");
    expect(findProductByBarcodeScan(products, ["missing"])).toBeUndefined();
  });
});
