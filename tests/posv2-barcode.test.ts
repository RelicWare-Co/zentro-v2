import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import type { Product } from "@/features/pos/types";
import {
  buildBarcodeLookupValues,
  buildPosV2BarcodeScanPayload,
  findProductByBarcodeScan,
  isPosV2ScannerBlocked,
} from "@/features/posv2/posv2-barcode.shared";
import { hasOpenOverlay } from "@/lib/overlay-detection.shared";

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

describe("overlay detection for scanner blocking", () => {
  let originalBody: string;

  beforeAll(() => {
    originalBody = document.body.innerHTML;
  });

  afterEach(() => {
    document.body.innerHTML = originalBody;
  });

  test("hasOpenOverlay returns false when no overlay is present", () => {
    document.body.innerHTML = "<div><p>No overlays here</p></div>";
    expect(hasOpenOverlay()).toBe(false);
  });

  test("hasOpenOverlay returns true when a zentro-overlay element exists", () => {
    document.body.innerHTML =
      '<div class="zentro-overlay" role="dialog">Modal content</div>';
    expect(hasOpenOverlay()).toBe(true);
  });

  test("isPosV2ScannerBlocked returns false without overlay", () => {
    document.body.innerHTML = "<div><p>No overlays</p></div>";
    expect(isPosV2ScannerBlocked()).toBe(false);
  });

  test("isPosV2ScannerBlocked returns true when overlay is open", () => {
    document.body.innerHTML =
      '<div class="zentro-overlay" role="dialog">Modal content</div>';
    expect(isPosV2ScannerBlocked()).toBe(true);
  });

  test("handleBarcode guard skips onScan when overlay is open (mirrors use-keyboard-barcode-scanner)", () => {
    document.body.innerHTML =
      '<div class="zentro-overlay" role="dialog">Modal content</div>';

    let onScanCalled = false;
    const onScan = (_event: KeyboardBarcodeScannerEvent) => {
      onScanCalled = true;
    };

    // This mirrors the handleBarcode guard in use-keyboard-barcode-scanner.client.ts:
    //   const handleBarcode = (event) => {
    //     if (isPosV2ScannerBlocked()) return;
    //     onScanRef.current(event);
    //   };
    const handleBarcode = (_event: KeyboardBarcodeScannerEvent) => {
      if (isPosV2ScannerBlocked()) {
        return;
      }
      onScan(_event);
    };

    handleBarcode({} as KeyboardBarcodeScannerEvent);
    expect(onScanCalled).toBe(false);
  });

  test("handleBarcode guard calls onScan when no overlay is open", () => {
    document.body.innerHTML = "<div><p>No overlays</p></div>";

    let onScanCalled = false;
    const onScan = (_event: KeyboardBarcodeScannerEvent) => {
      onScanCalled = true;
    };

    const handleBarcode = (_event: KeyboardBarcodeScannerEvent) => {
      if (isPosV2ScannerBlocked()) {
        return;
      }
      onScan(_event);
    };

    handleBarcode({} as KeyboardBarcodeScannerEvent);
    expect(onScanCalled).toBe(true);
  });
});
