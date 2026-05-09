import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import type { CartItem, CartTotals } from "../types";
import { formatCurrency } from "../utils";
import { CartItemCard } from "./CartItemCard";

interface CartPanelProps {
	cart: CartItem[];
	totalItems: number;
	totals: CartTotals;
	isActiveShift: boolean;
	onUpdateQuantity: (cartItemId: string, delta: number) => void;
	onRemoveItem: (cartItemId: string) => void;
	onUpdateItemDiscount: (cartItemId: string, value: string) => void;
	onClearCart: () => void;
	onCheckout: () => void;
	className?: string;
}

export function CartPanel({
	cart,
	totalItems,
	totals,
	isActiveShift,
	onUpdateQuantity,
	onRemoveItem,
	onUpdateItemDiscount,
	onClearCart,
	onCheckout,
	className,
}: CartPanelProps) {
	const { subTotal, tax, discountAmount, totalAmount } = totals;
	const hasDiscount = discountAmount > 0;

	return (
		<div
			className={cn(
				"w-[380px] bg-[var(--color-card)] flex flex-col shrink-0 min-h-0 overflow-hidden border-l border-[var(--color-border)]",
				className,
			)}
		>
			{/* Header */}
			<div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between shrink-0 bg-[var(--color-card)]">
				<div>
					<h2 className="text-lg font-bold text-[var(--color-foreground)] leading-none">
						Orden Actual
					</h2>
					<p className="text-xs text-[var(--color-muted-foreground)] mt-1">{totalItems} artículos</p>
				</div>
				<Button
					variant="ghost"
					onClick={onClearCart}
					disabled={cart.length === 0}
					className="text-red-500 hover:text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300 font-medium h-8 px-2 text-xs rounded-md transition-all"
					aria-label="Limpiar carrito"
				>
					<Trash2 className="h-4 w-4 mr-1" />
					Limpiar
				</Button>
			</div>

			{/* Items */}
			<div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 bg-[var(--color-background)]">
				<div className="space-y-1 py-2">
					{cart.map((item) => (
						<CartItemCard
							key={item.id}
							item={item}
							onUpdateQuantity={(delta) => onUpdateQuantity(item.id, delta)}
							onRemove={() => onRemoveItem(item.id)}
							onUpdateDiscount={(value) => onUpdateItemDiscount(item.id, value)}
						/>
					))}

					{cart.length === 0 && (
						<div className="flex flex-col items-center justify-center h-40 text-[var(--color-muted-foreground)] space-y-2">
							<div className="w-12 h-12 rounded-full bg-[var(--color-muted)] flex items-center justify-center border border-[var(--color-border)]">
								<Search className="h-5 w-5 text-[var(--color-muted-foreground)]" />
							</div>
							<p className="text-sm">Escanea o selecciona un producto</p>
						</div>
					)}
				</div>
			</div>

			{/* Payment Summary */}
			<div className="p-4 bg-[var(--color-background)] border-t border-[var(--color-border)] shrink-0">
				<div className="space-y-3">
					<div className="space-y-1.5">
						<div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
							<span>Subtotal</span>
							<span className="text-[var(--color-foreground)] tabular-nums">
								{formatCurrency(subTotal)}
							</span>
						</div>
						<div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
							<span>Impuestos</span>
							<span className="text-[var(--color-foreground)] tabular-nums">
								{formatCurrency(tax)}
							</span>
						</div>
						{hasDiscount && (
							<div className="flex justify-between text-sm text-red-500 dark:text-red-400">
								<span>Descuento</span>
								<span className="tabular-nums">
									-{formatCurrency(discountAmount)}
								</span>
							</div>
						)}

						<div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)] mt-2">
							<span className="font-bold text-base text-[var(--color-foreground)]">Total</span>
							<span className="font-bold text-xl text-[var(--color-voltage)] tabular-nums">
								{formatCurrency(totalAmount)}
							</span>
						</div>
					</div>

					<Button
						className="w-full h-12 bg-[var(--color-voltage)] hover:bg-[#c9e605] text-black font-bold text-base rounded-xl mt-2 transition-all shadow-[0_4px_14px_rgba(201,230,5,0.2)] hover:shadow-[0_6px_20px_rgba(201,230,5,0.3)]"
						disabled={cart.length === 0 || !isActiveShift}
						onClick={onCheckout}
					>
						Cobrar
					</Button>
				</div>
			</div>
		</div>
	);
}
