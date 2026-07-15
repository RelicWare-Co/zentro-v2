export type PosActiveModal = string;

export const POS_MODAL_IDS = {
  CASH_MOVEMENT: "cash-movement",
  CHECKOUT: "checkout",
  CLOSE_SHIFT: "close-shift",
  CREATE_CUSTOMER: "create-customer",
  MODIFIER: "modifier",
  OPEN_SHIFT: "open-shift",
  POST_CLOSE_CONFIRMATION: "post-close-confirmation",
  SHIFT_REQUIRED: "shift-required",
} as const;

export function isPosModalOpen(
  activeModal: PosActiveModal | null,
  type: string
) {
  return activeModal === type;
}

export function isAnyPosModalOpen(activeModal: PosActiveModal | null) {
  return activeModal !== null;
}
