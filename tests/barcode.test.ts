import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import {
  type BarcodeScannableProduct,
  buildBarcodeLookupValues,
  buildBarcodeScanPayload,
  findCatalogProductByBarcodeScan,
  isBarcodeScannerBlocked,
} from "@/features/products/barcode.shared";
import { hasOpenOverlay } from "@/lib/overlay-detection.shared";

function createProduct(
  overrides: Partial<BarcodeScannableProduct> = {}
): BarcodeScannableProduct {
  return {
    id: "product-1",
    sku: null,
    barcode: null,
    ...overrides,
  };
}

describe("barcode helpers", () => {
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

  test("buildBarcodeScanPayload prefers parsed GTIN", () => {
    const payload = buildBarcodeScanPayload({
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

  test("findCatalogProductByBarcodeScan matches barcode, GTIN, and SKU", () => {
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

    expect(
      findCatalogProductByBarcodeScan(products, ["03046920029759"])?.id
    ).toBe("by-barcode");
    expect(findCatalogProductByBarcodeScan(products, ["SKU-123"])?.id).toBe(
      "by-sku"
    );
    expect(
      findCatalogProductByBarcodeScan(products, ["missing"])
    ).toBeUndefined();
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

  test("isBarcodeScannerBlocked returns false without overlay", () => {
    document.body.innerHTML = "<div><p>No overlays</p></div>";
    expect(isBarcodeScannerBlocked()).toBe(false);
  });

  test("isBarcodeScannerBlocked returns true when overlay is open", () => {
    document.body.innerHTML =
      '<div class="zentro-overlay" role="dialog">Modal content</div>';
    expect(isBarcodeScannerBlocked()).toBe(true);
  });

  test("handleBarcode guard skips onScan when overlay is open (mirrors use-keyboard-barcode-scanner)", () => {
    document.body.innerHTML =
      '<div class="zentro-overlay" role="dialog">Modal content</div>';

    let onScanCalled = false;
    const onScan = (_event: KeyboardBarcodeScannerEvent) => {
      onScanCalled = true;
    };

    const handleBarcode = (_event: KeyboardBarcodeScannerEvent) => {
      if (isBarcodeScannerBlocked()) {
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
      if (isBarcodeScannerBlocked()) {
        return;
      }
      onScan(_event);
    };

    handleBarcode({} as KeyboardBarcodeScannerEvent);
    expect(onScanCalled).toBe(true);
  });
});
