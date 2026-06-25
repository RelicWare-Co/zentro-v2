import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import type { Product } from "@/features/pos/types";
import { hasOpenOverlay } from "@/lib/overlay-detection.shared";

export interface PosV2BarcodeScanPayload {
  gtin: string | null;
  lookupValues: string[];
  symbology: string | null;
  value: string;
}

const RETAIL_SYMBOLOGIES = [
  "ean13",
  "ean8",
  "upca",
  "upce",
  "code39",
  "code93",
  "code128",
  "codabar",
  "interleaved-2-of-5",
  "gs1-databar-omni",
  "gs1-databar-expanded",
  "qr-code",
  "data-matrix",
  "aztec-code",
  "pdf417",
] as const;

const NUMERIC_BARCODE_PATTERN = /^\d+$/;

export const POSV2_BARCODE_SCANNER_OPTIONS = {
  allowedSymbologies: [...RETAIL_SYMBOLOGIES],
  guessSymbology: true,
};

function addBarcodeCandidate(candidates: Set<string>, rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return;
  }

  candidates.add(trimmed);

  if (NUMERIC_BARCODE_PATTERN.test(trimmed)) {
    if (trimmed.length === 14 && trimmed.startsWith("0")) {
      candidates.add(trimmed.slice(1));
    }

    if (trimmed.length === 13) {
      candidates.add(`0${trimmed}`);
    }

    if (trimmed.length === 12) {
      candidates.add(`0${trimmed}`);
      candidates.add(`00${trimmed}`);
    }

    if (trimmed.length === 8 && trimmed.startsWith("0")) {
      candidates.add(trimmed.slice(1));
    }
  }
}

export function buildBarcodeLookupValues(
  value: string,
  gtin?: string | null
): string[] {
  const candidates = new Set<string>();
  addBarcodeCandidate(candidates, value);

  if (gtin) {
    addBarcodeCandidate(candidates, gtin);
  }

  return [...candidates];
}

export function buildPosV2BarcodeScanPayload(
  event: KeyboardBarcodeScannerEvent
): PosV2BarcodeScanPayload {
  const gtin = event.data?.gtin?.trim() || null;
  const value = event.value.trim();

  return {
    value,
    gtin,
    symbology: event.symbology ?? null,
    lookupValues: buildBarcodeLookupValues(value, gtin),
  };
}

function productMatchesLookupValues(
  product: Product,
  lookupValues: string[]
): boolean {
  const normalizedLookup = new Set(
    lookupValues.map((value) => value.trim().toLowerCase())
  );

  const barcode = product.barcode?.trim();
  if (barcode) {
    const normalizedBarcode = barcode.toLowerCase();
    if (normalizedLookup.has(normalizedBarcode)) {
      return true;
    }

    for (const candidate of buildBarcodeLookupValues(barcode)) {
      if (normalizedLookup.has(candidate.toLowerCase())) {
        return true;
      }
    }
  }

  const sku = product.sku?.trim().toLowerCase();
  if (sku && normalizedLookup.has(sku)) {
    return true;
  }

  return false;
}

export function findProductByBarcodeScan(
  products: Product[],
  lookupValues: string[]
): Product | undefined {
  if (lookupValues.length === 0) {
    return;
  }

  return products.find((product) =>
    productMatchesLookupValues(product, lookupValues)
  );
}

export function isPosV2ScannerBlocked(): boolean {
  return hasOpenOverlay();
}
