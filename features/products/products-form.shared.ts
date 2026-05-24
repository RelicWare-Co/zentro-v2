import type { Product } from "@/features/products/hooks/use-products";

export interface ProductFormState {
  barcode: string;
  categoryId: string;
  cost: string;
  isModifier: boolean;
  name: string;
  price: string;
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
  trackInventory: true,
  isModifier: false,
};

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
    trackInventory: product.trackInventory,
    isModifier: product.isModifier,
  };
}
