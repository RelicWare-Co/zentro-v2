import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import { hasOpenOverlay } from "@/lib/overlay-detection.shared";

const EAN13_LENGTH = 13;
const EAN13_PATTERN = /^\d{13}$/;
const NUMERIC_BARCODE_PATTERN = /^\d+$/;
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

export interface BarcodeScanPayload {
  gtin: string | null;
  lookupValues: string[];
  symbology: string | null;
  value: string;
}

export const KEYBOARD_BARCODE_SCANNER_OPTIONS = {
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

export function buildBarcodeScanPayload(
  event: KeyboardBarcodeScannerEvent
): BarcodeScanPayload {
  const gtin = event.data?.gtin?.trim() || null;
  const value = event.value.trim();

  return {
    value,
    gtin,
    symbology: event.symbology ?? null,
    lookupValues: buildBarcodeLookupValues(value, gtin),
  };
}

export function isBarcodeScannerBlocked(): boolean {
  return hasOpenOverlay();
}

function calculateEan13CheckDigit(digits12: string) {
  let sum = 0;
  for (let index = 0; index < digits12.length; index += 1) {
    const digit = Number(digits12[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

function randomDigits(length: number) {
  let digits = "";
  for (let index = 0; index < length; index += 1) {
    digits += String(Math.floor(Math.random() * 10));
  }
  return digits;
}

export function generateEan13Barcode() {
  const body = randomDigits(12);
  const checkDigit = calculateEan13CheckDigit(body);
  return `${body}${checkDigit}`;
}

export function isValidEan13Barcode(value: string) {
  const trimmed = value.trim();
  if (!EAN13_PATTERN.test(trimmed)) {
    return false;
  }
  const checkDigit = calculateEan13CheckDigit(trimmed.slice(0, 12));
  return checkDigit === Number(trimmed[12]);
}

export function normalizeCatalogBarcode(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export { EAN13_LENGTH };

export interface BarcodeScannableProduct {
  barcode?: string | null;
  id: string;
  sku?: string | null;
}

function productMatchesBarcodeLookup(
  product: BarcodeScannableProduct,
  lookupValues: string[]
) {
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
  return Boolean(sku && normalizedLookup.has(sku));
}

export function findCatalogProductByBarcodeScan<
  T extends BarcodeScannableProduct,
>(products: T[], lookupValues: string[]): T | undefined {
  if (lookupValues.length === 0) {
    return;
  }
  return products.find((product) =>
    productMatchesBarcodeLookup(product, lookupValues)
  );
}
