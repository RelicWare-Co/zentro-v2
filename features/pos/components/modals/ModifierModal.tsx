import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "../../types";
import { formatCurrency } from "../../utils";

interface ModifierModalProps {
	isOpen: boolean;
	onClose: () => void;
	selectedProduct: Product | null;
	modifierProducts: Product[];
	modifierQuantities: Record<string, number>;
	onUpdateModifierQuantity: (modifierId: string, delta: number) => void;
	onConfirm: () => void;
	onQuickAdd: () => void;
}

export function ModifierModal({
	isOpen,
	onClose,
	selectedProduct,
	modifierProducts,
	modifierQuantities,
	onUpdateModifierQuantity,
	onConfirm,
	onQuickAdd,
}: ModifierModalProps) {
	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<DialogContent className="bg-[#151515] border-gray-800 text-white sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						Añadir modificadores · {selectedProduct?.name}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-3 py-2">
					{modifierProducts.length === 0 ? (
						<p className="text-sm text-gray-400">
							No hay modificadores configurados para este negocio.
						</p>
					) : (
						modifierProducts.map((modifierProduct) => (
							<div
								key={modifierProduct.id}
								className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0a0a0a] p-3"
							>
								<div>
									<p className="text-sm font-medium text-white">
										{modifierProduct.name}
									</p>
									<p className="text-xs text-gray-400">
										{formatCurrency(modifierProduct.price)} c/u
									</p>
								</div>
								<div className="flex items-center bg-black/50 rounded-md border border-gray-800/80">
									<button
										type="button"
										onClick={() =>
											onUpdateModifierQuantity(modifierProduct.id, -1)
										}
										className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded-l-md transition-colors"
									>
										<Minus className="h-3 w-3" />
									</button>
									<div className="w-9 text-center text-sm font-semibold text-white">
										{modifierQuantities[modifierProduct.id] ?? 0}
									</div>
									<button
										type="button"
										onClick={() =>
											onUpdateModifierQuantity(modifierProduct.id, 1)
										}
										className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded-r-md transition-colors"
									>
										<Plus className="h-3 w-3" />
									</button>
								</div>
							</div>
						))
					)}
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={onQuickAdd}
						className="text-gray-300 hover:text-white"
					>
						Agregar sin modificadores
					</Button>
					<Button
						onClick={onConfirm}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
					>
						Confirmar selección
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
