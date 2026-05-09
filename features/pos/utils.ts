import {
	buildPaymentMethodLabelMap,
	formatPaymentMethodIdLabel,
	normalizePaymentMethodId,
} from "@/features/settings/settings.shared";
import { parseMoneyInput } from "@/lib/utils";
import type { CartItem, CartTotals } from "./types";

/**
 * Formatea un número como moneda colombiana (COP)
 */
export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("es-CO", {
		style: "currency",
		currency: "COP",
		maximumFractionDigits: 0,
	}).format(amount);
}

/**
 * Retorna el label legible para un método de pago
 */
export function formatPaymentMethodLabel(
	method: string,
	paymentMethodLabels?: Record<string, string>,
) {
	const normalizedMethodId = normalizePaymentMethodId(method);

	if (
		paymentMethodLabels &&
		Object.hasOwn(paymentMethodLabels, normalizedMethodId)
	) {
		return (
			paymentMethodLabels[normalizedMethodId] ??
			formatPaymentMethodIdLabel(method)
		);
	}

	return formatPaymentMethodIdLabel(method);
}

export function createPaymentMethodLabelMap(
	paymentMethods: Array<{ id: string; label: string }>,
) {
	return buildPaymentMethodLabelMap(paymentMethods);
}

/**
 * Calcula el subtotal del carrito (sin impuestos ni descuentos)
 */
export function calculateSubTotal(items: CartItem[]): number {
	return items.reduce((sum, item) => {
		const itemTotal = item.product.price * item.quantity;
		const modifiersTotal = item.modifiers.reduce(
			(modifierTotal, modifier) =>
				modifierTotal + modifier.price * modifier.quantity * item.quantity,
			0,
		);
		return sum + itemTotal + modifiersTotal;
	}, 0);
}

/**
 * Calcula los impuestos totales del carrito
 */
export function calculateTax(items: CartItem[]): number {
	return items.reduce(
		(sum, item) =>
			sum +
			Math.round(
				(item.product.price * item.quantity * item.product.taxRate) / 100,
			),
		0,
	);
}

/**
 * Calcula el descuento total de los items del carrito
 */
export function calculateItemsDiscount(items: CartItem[]): number {
	return items.reduce((sum, item) => sum + item.discountAmount, 0);
}

/**
 * Calcula el total a pagar considerando todos los factores
 */
export function calculateTotal(
	subTotal: number,
	tax: number,
	discountAmount: number,
): number {
	return Math.max(0, subTotal + tax - discountAmount);
}

/**
 * Calcula todos los totales del carrito en una sola operación
 */
export function calculateCartTotals(
	items: CartItem[],
	discountInput: string,
): CartTotals {
	const subTotal = calculateSubTotal(items);
	const tax = calculateTax(items);
	const saleDiscountAmount = parseMoneyInput(discountInput);
	const itemsDiscountAmount = calculateItemsDiscount(items);
	const discountAmount = saleDiscountAmount + itemsDiscountAmount;
	const totalAmount = calculateTotal(subTotal, tax, discountAmount);

	return {
		subTotal,
		tax,
		saleDiscountAmount,
		itemsDiscountAmount,
		discountAmount,
		totalAmount,
	};
}

/**
 * Calcula el precio total de un item del carrito (incluyendo modificadores y descuento)
 */
export function calculateItemTotal(item: CartItem): number {
	const basePrice = item.product.price * item.quantity;
	const modifiersTotal = item.modifiers.reduce(
		(sum, modifier) => sum + modifier.price * modifier.quantity * item.quantity,
		0,
	);
	return basePrice + modifiersTotal - item.discountAmount;
}

/**
 * Calcula el monto base de un item (para validar descuentos máximos)
 */
export function calculateItemBaseAmount(item: CartItem): number {
	const basePrice = item.product.price * item.quantity;
	const modifiersTotal = item.modifiers.reduce(
		(sum, modifier) => sum + modifier.price * modifier.quantity * item.quantity,
		0,
	);
	return basePrice + modifiersTotal;
}

/**
 * Genera una firma única para identificar items con los mismos modificadores
 */
export function buildModifierSignature(
	modifiers: CartItem["modifiers"],
): string {
	return modifiers
		.slice()
		.sort((modifierA, modifierB) => modifierA.id.localeCompare(modifierB.id))
		.map((modifier) => `${modifier.id}:${modifier.quantity}`)
		.join("|");
}
