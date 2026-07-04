import { createContext, type ReactNode, use, useCallback } from "react";
import { usePosShift } from "@/features/pos/hooks/use-pos-shift";
import { usePosCatalog } from "@/features/pos/pos-catalog-context";
import { usePosModal } from "@/features/pos/pos-modal-context";
import {
  isPosModalOpen,
  POS_MODAL_IDS,
} from "@/features/pos/pos-page-modals.shared";
import type { ActiveShift } from "@/features/pos/types";
import { useActiveShift } from "@/features/shifts/hooks/use-shifts";

export interface PosShiftContextValue {
  activeShift: ActiveShift | null;
  isActiveShift: boolean;
  isActiveShiftLoading: boolean;
  requireActiveShift: () => boolean;
  shift: ReturnType<typeof usePosShift>;
}

const PosShiftContext = createContext<PosShiftContextValue | null>(null);

export function usePosShiftContext() {
  const context = use(PosShiftContext);
  if (!context) {
    throw new Error("usePosShiftContext must be used within PosShiftProvider.");
  }
  return context;
}

export function PosShiftProvider({ children }: { children: ReactNode }) {
  const { paymentMethodOptions } = usePosCatalog();
  const {
    activeModal,
    closeActiveModal,
    openActiveModal,
    showPostCloseConfirmation,
  } = usePosModal();

  const { data: activeShiftData, isLoading: isActiveShiftLoading } =
    useActiveShift();
  const activeShift = activeShiftData?.shift ?? null;
  const isActiveShift = Boolean(activeShift);

  const shift = usePosShift(
    activeShift,
    paymentMethodOptions,
    isPosModalOpen(activeModal, POS_MODAL_IDS.CLOSE_SHIFT),
    closeActiveModal,
    showPostCloseConfirmation
  );

  const requireActiveShift = useCallback(() => {
    if (activeShift) {
      return true;
    }
    openActiveModal(POS_MODAL_IDS.SHIFT_REQUIRED);
    return false;
  }, [activeShift, openActiveModal]);

  const value: PosShiftContextValue = {
    activeShift,
    isActiveShift,
    isActiveShiftLoading,
    requireActiveShift,
    shift,
  };

  return <PosShiftContext value={value}>{children}</PosShiftContext>;
}
