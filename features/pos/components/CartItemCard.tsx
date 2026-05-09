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
		<div className="bg-[var(--color-card)] p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border)]/80 transition-colors group">
			<div className="flex flex-col gap-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<h4 className="font-medium text-sm text-[var(--color-foreground)] truncate leading-tight">
							{item.product.name}
						</h4>
						<div className="text-xs text-[var(--color-muted-foreground)] font-medium mt-0.5 tabular-nums">
							{formatCurrency(item.product.price)} / un
						</div>
						{item.modifiers.length > 0 && (
							<div className="mt-1 flex flex-wrap gap-1.5">
								{item.modifiers.map((modifier) => (
									<span
										key={`${item.id}-${modifier.id}`}
										className="text-[10px] bg-[var(--color-muted)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-muted-foreground)]"
									>
										x{modifier.quantity} {modifier.name}
									</span>
									))}
							</div>
						)}
					</div>
					<div className="font-bold text-sm text-[var(--color-foreground)] text-right shrink-0 tabular-nums">
						{formatCurrency(calculateItemTotal(item))}
					</div>
				</div>

				<div className="mt-1">
					<label
						htmlFor={`item-discount-${item.id}`}
						className="text-[10px] text-[var(--color-muted-foreground)]"
					>
						Descuento ítem
					</label>
					<div className="relative mt-1">
						<span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] text-xs">
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
							className="h-9 touch-manipulation border-[var(--color-border)] bg-[var(--color-background)] pl-6 text-base md:h-8 md:text-xs"
						/>
					</div>
				</div>

				<div className="flex items-center justify-between mt-1">
					<div className="flex items-center bg-[var(--color-muted)] rounded-md border border-[var(--color-border)]">
						<button
							type="button"
							onClick={() => onUpdateQuantity(-1)}
							className="h-7 w-8 flex items-center justify-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] rounded-l-md transition-colors disabled:opacity-50"
							aria-label="Disminuir cantidad"
						>
							<Minus className="h-3 w-3" />
						</button>
						<div className="w-8 text-center text-sm font-semibold text-[var(--color-foreground)]">
							{item.quantity}
						</div>
						<button
							type="button"
							onClick={() => onUpdateQuantity(1)}
							className="h-7 w-8 flex items-center justify-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] rounded-r-md transition-colors"
							aria-label="Aumentar cantidad"
						>
							<Plus className="h-3 w-3" />
						</button>
					</div>
					<button
						type="button"
						onClick={onRemove}
						className="text-[var(--color-muted-foreground)] hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 dark:hover:bg-red-400/10 transition-colors"
						aria-label="Eliminar producto"
					>
						<Trash2 className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
