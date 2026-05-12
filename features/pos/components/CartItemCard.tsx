import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";
import type { CartItem } from "../types";
import { calculateItemTotal, formatCurrency } from "../utils";

interface CartItemCardProps {
	item: CartItem;
	onUpdateQuantity: (delta: number) => void;
	onRemove: () => void;
	onUpdateDiscount: (value: string) => void;
}

export function CartItemCard({
	item,
	onUpdateQuantity,
	onRemove,
	onUpdateDiscount,
}: CartItemCardProps) {
	return (
		<div className="bg-[#151515] p-3 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors group">
			<div className="flex flex-col gap-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<h4 className="font-medium text-sm text-white truncate leading-tight">
							{item.product.name}
						</h4>
						<div className="text-xs text-zinc-500 font-medium mt-0.5 tabular-nums">
							{formatCurrency(item.product.price)} / un
						</div>
						{item.modifiers.length > 0 && (
							<div className="mt-1 flex flex-wrap gap-1.5">
								{item.modifiers.map((modifier) => (
									<span
										key={`${item.id}-${modifier.id}`}
										className="text-[10px] bg-black/50 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300"
									>
										x{modifier.quantity} {modifier.name}
									</span>
									))}
							</div>
						)}
					</div>
					<div className="font-bold text-sm text-white text-right shrink-0 tabular-nums">
						{formatCurrency(calculateItemTotal(item))}
					</div>
				</div>

				<div className="mt-1">
					<label
						htmlFor={`item-discount-${item.id}`}
						className="text-[10px] text-zinc-500"
					>
						Descuento ítem
					</label>
					<div className="relative mt-1">
						<span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
							$
						</span>
						<Input
							id={`item-discount-${item.id}`}
							type="text"
							inputMode="numeric"
							autoComplete="off"
							value={formatMoneyInput(item.discountAmount)}
							onChange={(event) =>
								onUpdateDiscount(sanitizeMoneyInput(event.target.value))
							}
							className="h-9 touch-manipulation border-zinc-800/80 bg-black/50 pl-6 text-base md:h-8 md:text-xs"
						/>
					</div>
				</div>

				<div className="flex items-center justify-between mt-1">
					<div className="flex items-center bg-black/50 rounded-md border border-zinc-800/80">
						<button
							type="button"
							onClick={() => onUpdateQuantity(-1)}
							className="h-7 w-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-l-md transition-colors disabled:opacity-50"
							aria-label="Disminuir cantidad"
						>
							<Minus className="size-3" />
						</button>
						<div className="w-8 text-center text-sm font-semibold text-white">
							{item.quantity}
						</div>
						<button
							type="button"
							onClick={() => onUpdateQuantity(1)}
							className="h-7 w-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-r-md transition-colors"
							aria-label="Aumentar cantidad"
						>
							<Plus className="size-3" />
						</button>
					</div>
					<button
						type="button"
						onClick={onRemove}
						className="text-red-300 hover:text-red-100 p-1.5 rounded-md hover:bg-red-400/10 transition-colors"
						aria-label="Eliminar producto"
					>
						<Trash2 className="size-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
