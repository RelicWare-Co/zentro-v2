import { Heart } from "lucide-react";
import type { Product } from "../types";
import { formatCurrency } from "../utils";

interface ProductCardProps {
	product: Product;
	quantity: number;
	isOutOfStock: boolean;
	isActiveShift: boolean;
	onSelect: () => void;
	onToggleFavorite?: (productId: string) => void;
	isTogglingFavorite?: boolean;
}

export function ProductCard({
	product,
	quantity,
	isOutOfStock,
	isActiveShift,
	onSelect,
	onToggleFavorite,
	isTogglingFavorite,
}: ProductCardProps) {
	const outOfStockAlert = isOutOfStock && isActiveShift;
	const noShiftAlert = !isActiveShift;

	return (
		<div className="relative">
			<button
				type="button"
				onClick={onSelect}
				className={`
					text-left
					bg-[#151515]
					rounded-xl
					p-3
					border
					border-zinc-800/80
					block
					w-full
					relative
					overflow-hidden
					transition-all
					hover:border-[var(--color-voltage)]/50
					hover:bg-[#1a1a1a]
					focus-visible:outline-none
					focus-visible:ring-2
					focus-visible:ring-[var(--color-voltage)]
					cursor-pointer
					group
					${!isActiveShift ? "ring-1 ring-amber-500/20" : ""}
				`}
			>
				{quantity > 0 && (
					<div className="absolute top-0 right-0 bg-[var(--color-voltage)] text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-xl z-10">
						x{quantity}
					</div>
				)}

				<div className="w-full mt-3">
					<h3
						className="font-semibold text-sm text-white line-clamp-2 leading-snug group-hover:text-[var(--color-voltage)] transition-colors"
						title={product.name}
					>
						{product.name}
					</h3>
					<p className="text-[11px] text-zinc-500 mt-1 font-medium">
						{product.categoryName}
					</p>
					{product.trackInventory && (
						<p
							className={`text-[10px] mt-1 font-medium ${
								isOutOfStock ? "text-red-400" : "text-zinc-500"
							}`}
						>
							Stock: {product.stock}
						</p>
					)}
				</div>

				<div className="mt-3">
					<p className="font-bold text-[15px] text-white tracking-tight tabular-nums">
						{formatCurrency(product.price)}
					</p>
					{outOfStockAlert && (
						<p className="mt-1 text-[10px] font-medium text-amber-400">
							La venta puede dejar stock negativo
						</p>
					)}
					{noShiftAlert && (
						<p className="mt-1 text-[10px] font-medium text-amber-400">
							Abre el turno para vender
						</p>
					)}
				</div>
			</button>

			{onToggleFavorite && (
				<button
					type="button"
					aria-label={
						product.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
					}
					aria-pressed={product.isFavorite}
					disabled={isTogglingFavorite}
					className={`absolute top-1.5 left-1.5 z-10 p-1 rounded-md hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)] disabled:opacity-50 disabled:cursor-not-allowed`}
					onClick={(e) => {
						e.stopPropagation();
						onToggleFavorite(product.id);
					}}
				>
					<Heart
						className={`size-4 transition-colors ${
							product.isFavorite
								? "fill-red-500 text-red-500"
								: "text-zinc-600 hover:text-red-400"
							}`}
					/>
				</button>
			)}
		</div>
	);
}
