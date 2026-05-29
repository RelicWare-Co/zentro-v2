import { buildBarcodeLookupValues } from "@/features/posv2/posv2-barcode.shared";

const EAN13_LENGTH = 13;
const EAN13_PATTERN = /^\d{13}$/;

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
