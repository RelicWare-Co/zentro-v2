import type { z } from "zod";
import type { SearchCustomersResultSchema } from "../../schemas/customers";
import type {
  PosBootstrapResultSchema,
  PosProductSchema,
} from "../../schemas/pos";

// Producto retornado por la búsqueda POS
export type Product = z.infer<typeof PosProductSchema>;

// Cliente retornado por la búsqueda POS
export type PosCustomer = z.infer<
  typeof SearchCustomersResultSchema
>["data"][number];

// Datos del bootstrap del POS
export type PosBootstrap = z.infer<typeof PosBootstrapResultSchema>;

// Turno activo
export type ActiveShift = PosBootstrap["activeShift"];

// Categoría de productos
export interface Category {
  id: string;
  name: string;
}

// Modificador de un item en el carrito
export interface CartItemModifier {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// Item en el carrito
export interface CartItem {
  discountAmount: number;
  id: string; // ID único para permitir múltiples productos iguales con diferentes modificadores
  modifiers: CartItemModifier[];
  product: Product;
  quantity: number;
}

// Método de pago
export interface PaymentMethod {
  amount: string;
  id: string;
  method: string;
  reference: string;
}

// Tipo de movimiento de caja
export type CashMovementType = "expense" | "payout" | "inflow";

// Totales calculados del carrito
export interface CartTotals {
  discountAmount: number;
  itemsDiscountAmount: number;
  saleDiscountAmount: number;
  subTotal: number;
  tax: number;
  totalAmount: number;
}
