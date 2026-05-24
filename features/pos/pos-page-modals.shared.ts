export type PosActiveModal =
  | { type: "cash-movement" }
  | { type: "checkout" }
  | { type: "checkout-details" }
  | { type: "close-shift" }
  | { type: "create-customer" }
  | { type: "modifier" }
  | { type: "open-shift" }
  | { type: "shift-required" };

export function isPosModalOpen(
  activeModal: PosActiveModal | null,
  type: PosActiveModal["type"]
) {
  return activeModal?.type === type;
}

export function isAnyPosModalOpen(activeModal: PosActiveModal | null) {
  return activeModal !== null;
}

export function isPosOverlayBlockingCatalog(
  activeModal: PosActiveModal | null,
  isMobileCartOpen: boolean
) {
  return (
    isMobileCartOpen ||
    isPosModalOpen(activeModal, "modifier") ||
    isPosModalOpen(activeModal, "create-customer") ||
    isPosModalOpen(activeModal, "open-shift") ||
    isPosModalOpen(activeModal, "cash-movement") ||
    isPosModalOpen(activeModal, "close-shift") ||
    isPosModalOpen(activeModal, "checkout") ||
    isPosModalOpen(activeModal, "checkout-details") ||
    isPosModalOpen(activeModal, "shift-required")
  );
}
