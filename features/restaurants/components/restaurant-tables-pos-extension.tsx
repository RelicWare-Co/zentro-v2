import type { PosExtensionRenderProps } from "@/features/pos/pos-extension.shared";
import { RestaurantPosTables } from "@/features/restaurants/components/restaurant-pos-overlay";
import { RESTAURANT_POS_EXTENSION_IDS } from "@/features/restaurants/restaurants-pos-extension.shared";

export function RestaurantTablesPosExtension({
  activeModal,
  onCloseModal,
  onOpenModal,
  saleMode,
}: PosExtensionRenderProps) {
  const modalId = RESTAURANT_POS_EXTENSION_IDS.TABLES;

  return (
    <RestaurantPosTables
      activeTableId={saleMode?.tableId ?? null}
      isOpen={activeModal === modalId}
      onOpenChange={(open) => {
        if (open) {
          onOpenModal(modalId);
          return;
        }
        onCloseModal();
      }}
      onSelectTable={(tableId) => saleMode?.enterMode?.(tableId)}
    />
  );
}
