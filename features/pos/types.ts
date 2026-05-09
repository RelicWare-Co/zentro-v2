import type { z } from "zod";
import type {
	PosBootstrapResultSchema,
	PosProductSchema,
	SearchPosProductsResultSchema,
} from "../../schemas/pos";
import type { SearchCustomersResultSchema } from "../../schemas/customers";

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

// Resultado de búsqueda de productos
export type ProductSearchResult = z.infer<typeof SearchPosProductsResultSchema>;

// Categoría de productos
export type Category = {
	id: string;
	name: string;
};

// Modificador de un item en el carrito
export type CartItemModifier = {
	id: string;
	name: string;
	price: number;
	quantity: number;
};

// Item en el carrito
export type CartItem = {
	id: string; // ID único para permitir múltiples productos iguales con diferentes modificadores
	product: Product;
	quantity: number;
	modifiers: CartItemModifier[];
	discountAmount: number;
};

// Método de pago
export type PaymentMethod = {
	id: string;
	method: string;
	amount: string;
	reference: string;
};

// Tipo de movimiento de caja
export type CashMovementType = "expense" | "payout" | "inflow";

// Totales calculados del carrito
export type CartTotals = {
	subTotal: number;
	tax: number;
	saleDiscountAmount: number;
	itemsDiscountAmount: number;
	discountAmount: number;
	totalAmount: number;
};

// Props comunes para modales
export type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
};
