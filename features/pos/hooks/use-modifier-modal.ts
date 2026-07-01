import { useState } from "react";
import type { CartItemModifier, Product } from "../types";

export function useModifierModal(
  onAddToCart: (product: Product, modifiers: CartItemModifier[]) => void,
  modifierProducts: Product[],
  modalControl: {
    openModifierModal: () => void;
    closeModifierModal: () => void;
  }
) {
  const [selectedProductForModifiers, setSelectedProductForModifiers] =
    useState<Product | null>(null);
  const [modifierQuantities, setModifierQuantities] = useState<
    Record<string, number>
  >({});

  const updateModifierQuantity = (modifierId: string, delta: number) => {
    setModifierQuantities((previousQuantities) => {
      const currentValue = previousQuantities[modifierId] ?? 0;
      const nextValue = Math.max(0, currentValue + delta);
      return {
        ...previousQuantities,
        [modifierId]: nextValue,
      };
    });
  };

  const handleProductSelection = (product: Product) => {
    if (modifierProducts.length === 0) {
      onAddToCart(product, []);
      return;
    }

    setSelectedProductForModifiers(product);
    setModifierQuantities({});
    modalControl.openModifierModal();
  };

  const handleConfirmModifiers = () => {
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
    modalControl.closeModifierModal();
    setSelectedProductForModifiers(null);
    setModifierQuantities({});
  };

  const handleQuickAddWithoutModifiers = () => {
    if (!selectedProductForModifiers) {
      return;
    }

    onAddToCart(selectedProductForModifiers, []);
    modalControl.closeModifierModal();
    setSelectedProductForModifiers(null);
    setModifierQuantities({});
  };

  const handleCloseModal = () => {
    modalControl.closeModifierModal();
    setSelectedProductForModifiers(null);
    setModifierQuantities({});
  };

  return {
    selectedProductForModifiers,
    modifierQuantities,
    updateModifierQuantity,
    handleProductSelection,
    handleConfirmModifiers,
    handleQuickAddWithoutModifiers,
    handleCloseModal,
  };
}
