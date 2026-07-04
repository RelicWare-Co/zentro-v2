import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useState,
} from "react";
import { POS_MODAL_IDS } from "@/features/pos/pos-page-modals.shared";

export interface PosModalContextValue {
  activeModal: string | null;
  closeActiveModal: () => void;
  closedShiftId: string | null;
  dismissPostCloseConfirmation: () => void;
  isMobileCartOpen: boolean;
  isQuickSaleMode: boolean;
  openActiveModal: (modal: string) => void;
  openCashMovementModal: () => void;
  openCheckoutDetails: () => void;
  openCloseShiftModal: () => void;
  openCreateCustomerModal: () => void;
  openShiftFromRequired: () => void;
  openShiftModal: () => void;
  setIsMobileCartOpen: (open: boolean) => void;
  showPostCloseConfirmation: (shiftId: string) => void;
  toggleQuickSaleMode: () => void;
}

const PosModalContext = createContext<PosModalContextValue | null>(null);

export function usePosModal() {
  const context = use(PosModalContext);
  if (!context) {
    throw new Error("usePosModal must be used within PosModalProvider.");
  }
  return context;
}

export function PosModalProvider({ children }: { children: ReactNode }) {
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isQuickSaleMode, setIsQuickSaleMode] = useState(false);
  const [closedShiftId, setClosedShiftId] = useState<string | null>(null);

  const closeActiveModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const openActiveModal = useCallback((modal: string) => {
    setActiveModal(modal);
  }, []);

  const toggleQuickSaleMode = useCallback(() => {
    setIsQuickSaleMode((prev) => !prev);
  }, []);

  const openShiftFromRequired = useCallback(() => {
    setActiveModal(POS_MODAL_IDS.OPEN_SHIFT);
  }, []);

  const openShiftModal = useCallback(() => {
    setActiveModal(POS_MODAL_IDS.OPEN_SHIFT);
  }, []);

  const openCloseShiftModal = useCallback(() => {
    setActiveModal(POS_MODAL_IDS.CLOSE_SHIFT);
  }, []);

  const openCashMovementModal = useCallback(() => {
    setActiveModal(POS_MODAL_IDS.CASH_MOVEMENT);
  }, []);

  const openCreateCustomerModal = useCallback(() => {
    setActiveModal(POS_MODAL_IDS.CREATE_CUSTOMER);
  }, []);

  const openCheckoutDetails = useCallback(() => {
    setActiveModal(POS_MODAL_IDS.CHECKOUT_DETAILS);
  }, []);

  const showPostCloseConfirmation = useCallback((shiftId: string) => {
    setClosedShiftId(shiftId);
    setActiveModal(POS_MODAL_IDS.POST_CLOSE_CONFIRMATION);
  }, []);

  const dismissPostCloseConfirmation = useCallback(() => {
    setClosedShiftId(null);
    setActiveModal(null);
  }, []);

  const value: PosModalContextValue = {
    activeModal,
    closeActiveModal,
    closedShiftId,
    dismissPostCloseConfirmation,
    isMobileCartOpen,
    isQuickSaleMode,
    openActiveModal,
    openCashMovementModal,
    openCheckoutDetails,
    openCloseShiftModal,
    openCreateCustomerModal,
    openShiftFromRequired,
    openShiftModal,
    setIsMobileCartOpen,
    showPostCloseConfirmation,
    toggleQuickSaleMode,
  };

  return <PosModalContext value={value}>{children}</PosModalContext>;
}
