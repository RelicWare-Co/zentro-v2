import {
  normalizeOptionalString,
  toNonNegativeInteger,
} from "@/lib/domain-values.shared";

export interface CreateProductValueInput {
  accountingTreatment?: "passthrough" | "revenue";
  autoPayoutEnabled?: boolean;
  autoPayoutPaymentMethod?: string;
  barcode?: null | string;
  cost?: number;
  isIngredient?: boolean;
  isModifier?: boolean;
  minStock?: null | number;
  name: string;
  price: number;
  reorderQuantity?: null | number;
  sku?: null | string;
  stock?: number;
  taxRate?: number;
  trackInventory?: boolean;
}

export interface NormalizedCreateProductValues {
  accountingTreatment: "passthrough" | "revenue";
  autoPayoutEnabled: boolean;
  autoPayoutPaymentMethod: string;
  barcode: null | string;
  cost: number;
  isFavorite: false;
  isIngredient: boolean;
  isModifier: boolean;
  minStock: null | number;
  name: string;
  price: number;
  reorderQuantity: null | number;
  sku: null | string;
  stock: number;
  taxRate: number;
  trackInventory: boolean;
}

function normalizeOptionalNonNegativeInteger(
  value: null | number | undefined,
  field: string
) {
  if (value === undefined || value === null) {
    return null;
  }
  return toNonNegativeInteger(value, field);
}

function resolveAccountingTreatment(input: CreateProductValueInput) {
  if (input.isIngredient) {
    return "revenue" as const;
  }
  return input.accountingTreatment ?? "revenue";
}

export function normalizeCreateProductValues(
  input: CreateProductValueInput
): NormalizedCreateProductValues {
  const name = input.name.trim();
  if (!name) {
    throw new Error("El nombre del producto es obligatorio");
  }

  const isIngredient = input.isIngredient ?? false;
  const accountingTreatment = resolveAccountingTreatment(input);
  const isPassthrough = accountingTreatment === "passthrough";
  const trackInventory = isPassthrough ? false : (input.trackInventory ?? true);

  return {
    accountingTreatment,
    autoPayoutEnabled:
      isPassthrough && !isIngredient
        ? (input.autoPayoutEnabled ?? false)
        : false,
    autoPayoutPaymentMethod:
      normalizeOptionalString(input.autoPayoutPaymentMethod) ?? "cash",
    barcode: normalizeOptionalString(input.barcode),
    cost: toNonNegativeInteger(input.cost ?? 0, "cost"),
    isFavorite: false,
    isIngredient,
    isModifier:
      isPassthrough || isIngredient ? false : (input.isModifier ?? false),
    minStock: normalizeOptionalNonNegativeInteger(input.minStock, "minStock"),
    name,
    price: isIngredient ? 0 : toNonNegativeInteger(input.price, "price"),
    reorderQuantity: normalizeOptionalNonNegativeInteger(
      input.reorderQuantity,
      "reorderQuantity"
    ),
    sku: normalizeOptionalString(input.sku),
    stock: trackInventory ? toNonNegativeInteger(input.stock ?? 0, "stock") : 0,
    taxRate: toNonNegativeInteger(input.taxRate ?? 0, "taxRate"),
    trackInventory,
  };
}
