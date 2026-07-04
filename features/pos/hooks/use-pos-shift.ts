import { useCallback, useMemo, useState } from "react";
import {
  useCloseShiftMutation,
  useOpenShiftMutation,
  useRegisterCashMovementMutation,
  useShiftCloseSummary,
} from "@/features/shifts/hooks/use-shifts";
import { parseMoneyInput } from "@/lib/utils";
import type { ActiveShift } from "../types";

function getDefaultMovementPaymentMethodId(
  paymentMethodOptions: Array<{ id: string }>
) {
  return (
    paymentMethodOptions.find((paymentMethod) => paymentMethod.id === "cash")
      ?.id ??
    paymentMethodOptions[0]?.id ??
    "cash"
  );
}

export function usePosShift(
  activeShift: ActiveShift | null,
  paymentMethodOptions: Array<{ id: string }>,
  isCloseShiftModalOpen: boolean,
  closeModal: () => void,
  onCloseShiftSuccess?: (shiftId: string) => void
) {
  // Open shift form state
  const [startingCash, setStartingCash] = useState("");
  const [openShiftNotes, setOpenShiftNotes] = useState("");

  // Cash movement form state
  const [movementType, setMovementType] = useState("inflow");
  const [movementPaymentMethod, setMovementPaymentMethod] = useState(() =>
    getDefaultMovementPaymentMethodId(paymentMethodOptions)
  );
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");

  // Close shift form state
  const [closeShiftNotes, setCloseShiftNotes] = useState("");
  const [closureAmounts, setClosureAmounts] = useState<Record<string, string>>(
    {}
  );

  // Queries and mutations
  const openShiftMutation = useOpenShiftMutation();
  const registerCashMovementMutation = useRegisterCashMovementMutation();
  const closeShiftMutation = useCloseShiftMutation();

  const { data: shiftCloseSummary, isFetching: isShiftSummaryFetching } =
    useShiftCloseSummary(activeShift?.id, isCloseShiftModalOpen);

  const effectiveMovementPaymentMethod = useMemo(() => {
    const hasCurrentMethod = paymentMethodOptions.some(
      (paymentMethod) => paymentMethod.id === movementPaymentMethod
    );
    return hasCurrentMethod
      ? movementPaymentMethod
      : getDefaultMovementPaymentMethodId(paymentMethodOptions);
  }, [movementPaymentMethod, paymentMethodOptions]);

  // Open shift handler
  const handleOpenShift = useCallback(() => {
    const parsedStartingCash = parseMoneyInput(startingCash);
    if (!Number.isFinite(parsedStartingCash) || parsedStartingCash < 0) {
      return;
    }

    openShiftMutation.mutate(
      {
        startingCash: parsedStartingCash,
        notes: openShiftNotes.trim() || null,
      },
      {
        onSuccess: () => {
          closeModal();
          setStartingCash("");
          setOpenShiftNotes("");
        },
      }
    );
  }, [closeModal, openShiftMutation, openShiftNotes, startingCash]);

  // Cash movement handler
  const handleCashMovement = useCallback(() => {
    if (!activeShift) {
      return;
    }

    const parsedAmount = parseMoneyInput(movementAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }
    if (!movementDescription.trim()) {
      return;
    }

    registerCashMovementMutation.mutate(
      {
        shiftId: activeShift.id,
        type: movementType as "expense" | "payout" | "inflow",
        paymentMethod: effectiveMovementPaymentMethod,
        amount: parsedAmount,
        description: movementDescription.trim(),
      },
      {
        onSuccess: () => {
          closeModal();
          setMovementAmount("");
          setMovementDescription("");
          setMovementType("inflow");
          setMovementPaymentMethod(
            getDefaultMovementPaymentMethodId(paymentMethodOptions)
          );
        },
      }
    );
  }, [
    activeShift,
    movementAmount,
    movementDescription,
    effectiveMovementPaymentMethod,
    movementType,
    paymentMethodOptions,
    registerCashMovementMutation,
    closeModal,
  ]);

  // Close shift handler
  const handleCloseShift = useCallback(() => {
    if (!(activeShift && shiftCloseSummary)) {
      return;
    }

    const closures = shiftCloseSummary.summaryByMethod.map((summaryRow) => ({
      paymentMethod: summaryRow.paymentMethod,
      actualAmount: parseMoneyInput(
        closureAmounts[summaryRow.paymentMethod] ?? 0
      ),
    }));

    if (
      closures.some(
        (closure) =>
          !Number.isFinite(closure.actualAmount) || closure.actualAmount < 0
      )
    ) {
      return;
    }

    closeShiftMutation.mutate(
      {
        shiftId: activeShift.id,
        closures,
        notes: closeShiftNotes.trim() || null,
      },
      {
        onSuccess: () => {
          closeModal();
          setClosureAmounts({});
          setCloseShiftNotes("");
          onCloseShiftSuccess?.(activeShift.id);
        },
      }
    );
  }, [
    activeShift,
    closeShiftMutation,
    closeShiftNotes,
    closureAmounts,
    shiftCloseSummary,
    closeModal,
    onCloseShiftSuccess,
  ]);

  // Computed values
  const canOpenShift =
    startingCash.trim().length > 0 && parseMoneyInput(startingCash) >= 0;

  const canRegisterCashMovement =
    Boolean(activeShift) &&
    effectiveMovementPaymentMethod.trim().length > 0 &&
    movementDescription.trim().length > 0 &&
    parseMoneyInput(movementAmount) > 0;

  const hasInvalidCloseAmounts =
    shiftCloseSummary?.summaryByMethod.some((summaryRow) => {
      const amount = parseMoneyInput(
        closureAmounts[summaryRow.paymentMethod] ?? ""
      );
      return !Number.isFinite(amount) || amount < 0;
    }) ?? false;

  const cashSummary = shiftCloseSummary?.summaryByMethod.find(
    (summaryRow) => summaryRow.paymentMethod === "cash"
  );

  return {
    // Form states - Open shift
    startingCash,
    setStartingCash,
    openShiftNotes,
    setOpenShiftNotes,

    // Form states - Cash movement
    movementType,
    setMovementType,
    movementPaymentMethod: effectiveMovementPaymentMethod,
    setMovementPaymentMethod,
    movementAmount,
    setMovementAmount,
    movementDescription,
    setMovementDescription,

    // Form states - Close shift
    closeShiftNotes,
    setCloseShiftNotes,
    closureAmounts,
    setClosureAmounts,

    // Data
    shiftCloseSummary,
    isShiftSummaryFetching,
    cashSummary,

    // Loading states
    isOpeningShift: openShiftMutation.isPending,
    isRegisteringMovement: registerCashMovementMutation.isPending,
    isClosingShift: closeShiftMutation.isPending,

    // Errors
    openShiftError: openShiftMutation.error,
    cashMovementError: registerCashMovementMutation.error,
    closeShiftError: closeShiftMutation.error,

    // Handlers
    handleOpenShift,
    handleCashMovement,
    handleCloseShift,

    // Computed
    canOpenShift,
    canRegisterCashMovement,
    hasInvalidCloseAmounts,
  };
}
