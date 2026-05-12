import { useCallback, useState } from "react";
import type { CartItemModifier, Product } from "../types";

export function useModifierModal(
	onAddToCart: (product: Product, modifiers: CartItemModifier[]) => void,
	modifierProducts: Product[],
) {
	const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
	const [selectedProductForModifiers, setSelectedProductForModifiers] =
		useState<Product | null>(null);
	const [modifierQuantities, setModifierQuantities] = useState<
		Record<string, number>
	>({});

	const updateModifierQuantity = useCallback(
		(modifierId: string, delta: number) => {
			setModifierQuantities((previousQuantities) => {
				const currentValue = previousQuantities[modifierId] ?? 0;
				const nextValue = Math.max(0, currentValue + delta);
				return {
					...previousQuantities,
					[modifierId]: nextValue,
				};
			});
		},
		[],
	);

	const handleProductSelection = useCallback(
		(product: Product) => {
			if (modifierProducts.length === 0) {
				onAddToCart(product, []);
				return;
			}

			setSelectedProductForModifiers(product);
			setModifierQuantities({});
			setIsModifierModalOpen(true);
		},
		[modifierProducts.length, onAddToCart],
	);

	const handleConfirmModifiers = useCallback(() => {
		if (!selectedProductForModifiers) {
			return;
		}

		const selectedModifiers = modifierProducts.reduce<
			Array<{ id: string; name: string; price: number; quantity: number }>
		>((acc, modifierProduct) => {
			const quantity = modifierQuantities[modifierProduct.id] ?? 0;
			if (quantity > 0) {
				acc.push({
					id: modifierProduct.id,
					name: modifierProduct.name,
					price: modifierProduct.price,
					quantity,
				});
			}
			return acc;
		}, []);

		onAddToCart(selectedProductForModifiers, selectedModifiers);
		setIsModifierModalOpen(false);
		setSelectedProductForModifiers(null);
		setModifierQuantities({});
	}, [
		modifierProducts,
		modifierQuantities,
		onAddToCart,
		selectedProductForModifiers,
	]);

	const handleQuickAddWithoutModifiers = useCallback(() => {
		if (!selectedProductForModifiers) {
			return;
		}

		onAddToCart(selectedProductForModifiers, []);
		setIsModifierModalOpen(false);
		setSelectedProductForModifiers(null);
		setModifierQuantities({});
	}, [onAddToCart, selectedProductForModifiers]);

	const handleCloseModal = useCallback(() => {
		setIsModifierModalOpen(false);
		setSelectedProductForModifiers(null);
		setModifierQuantities({});
	}, []);

	return {
		isModifierModalOpen,
		setIsModifierModalOpen,
		selectedProductForModifiers,
		modifierQuantities,
		updateModifierQuantity,
		handleProductSelection,
		handleConfirmModifiers,
		handleQuickAddWithoutModifiers,
		handleCloseModal,
	};
}
