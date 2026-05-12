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
				"w-[380px] bg-[var(--color-carbon)] flex flex-col shrink-0 min-h-0 overflow-hidden border-l border-zinc-800",
				className,
			)}
		>
			{/* Header */}
			<div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-[#0f0f0f]">
				<div>
					<h2 className="text-lg font-semibold text-white leading-none">
						Orden Actual
					</h2>
					<p className="text-xs text-zinc-400 mt-1">{totalItems} artículos</p>
				</div>
				<Button
					variant="ghost"
					onClick={onClearCart}
					disabled={cart.length === 0}
					className="text-red-400 hover:text-red-300 hover:bg-red-400/10 font-medium h-8 px-2 text-xs rounded-md transition-all"
					aria-label="Limpiar carrito"
				>
					<Trash2 className="size-4 mr-1" />
					Limpiar
				</Button>
			</div>

			{/* Items */}
			<div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 bg-[#0f0f0f]">
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
						<div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
							<div className="size-12 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
								<Search className="size-5 text-zinc-600" />
							</div>
							<p className="text-sm">Escanea o selecciona un producto</p>
						</div>
					)}
				</div>
			</div>

			{/* Payment Summary */}
			<div className="p-4 bg-[#0a0a0a] border-t border-zinc-800 shrink-0">
				<div className="space-y-3">
					<div className="space-y-1.5">
						<div className="flex justify-between text-sm text-zinc-400">
							<span>Subtotal</span>
							<span className="text-zinc-200 tabular-nums">
								{formatCurrency(subTotal)}
							</span>
						</div>
						<div className="flex justify-between text-sm text-zinc-400">
							<span>Impuestos</span>
							<span className="text-zinc-200 tabular-nums">
								{formatCurrency(tax)}
							</span>
						</div>
						{hasDiscount && (
							<div className="flex justify-between text-sm text-red-400">
								<span>Descuento</span>
								<span className="tabular-nums">
									-{formatCurrency(discountAmount)}
								</span>
							</div>
						)}

						<div className="flex justify-between items-center pt-2 border-t border-zinc-800/80 mt-2">
							<span className="font-bold text-base text-white">Total</span>
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
