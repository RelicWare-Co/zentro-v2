import type { Product } from "@/features/products/hooks/use-products";

export interface ProductFormIngredientEntry {
  ingredientId: string;
  quantity: string;
}

export interface ProductFormState {
  accountingTreatment: string;
  autoPayoutEnabled: boolean;
  autoPayoutPaymentMethod: string;
  barcode: string;
  categoryId: string;
  cost: string;
  ingredients: ProductFormIngredientEntry[];
  isIngredient: boolean;
  isModifier: boolean;
  minStock: string;
  name: string;
  price: string;
  reorderQuantity: string;
  sku: string;
  stock: string;
  taxRate: string;
  trackInventory: boolean;
}

export const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  categoryId: "",
  sku: "",
  barcode: "",
  price: "",
  cost: "0",
  taxRate: "0",
  stock: "0",
  minStock: "",
  reorderQuantity: "",
  trackInventory: true,
  isModifier: false,
  isIngredient: false,
  ingredients: [],
  accountingTreatment: "revenue",
  autoPayoutEnabled: false,
  autoPayoutPaymentMethod: "cash",
};

export function parseOptionalStockField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.trunc(parsed);
}

export function getProductFormInitialValue(
  product: Product | null
): ProductFormState {
  if (!product) {
    return EMPTY_PRODUCT_FORM;
  }

  return {
    name: product.name,
    categoryId: product.categoryId ?? "",
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    price: String(product.price),
    cost: String(product.cost ?? 0),
    taxRate: String(product.taxRate ?? 0),
    stock: String(product.stock ?? 0),
    minStock:
      product.minStock === null || product.minStock === undefined
        ? ""
        : String(product.minStock),
    reorderQuantity:
      product.reorderQuantity === null || product.reorderQuantity === undefined
        ? ""
        : String(product.reorderQuantity),
    trackInventory: product.trackInventory,
    isModifier: product.isModifier,
    isIngredient: product.isIngredient ?? false,
    ingredients: [],
    accountingTreatment: product.accountingTreatment ?? "revenue",
    autoPayoutEnabled: product.autoPayoutEnabled ?? false,
    autoPayoutPaymentMethod: product.autoPayoutPaymentMethod ?? "cash",
  };
}
