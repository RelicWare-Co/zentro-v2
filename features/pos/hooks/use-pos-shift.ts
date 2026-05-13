import { useCallback, useEffect, useState } from "react";
import { parseMoneyInput } from "@/lib/utils";
import type { ActiveShift } from "../types";
import {
  useCloseShiftMutation,
  useOpenShiftMutation,
  useRegisterCashMovementMutation,
  useShiftCloseSummary,
} from "./use-pos-queries";

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
  paymentMethodOptions: Array<{ id: string }>
) {
  // Modals state
  const [isShiftOpenModalOpen, setIsShiftOpenModalOpen] = useState(false);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);

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

  useEffect(() => {
    const defaultMovementMethod =
      getDefaultMovementPaymentMethodId(paymentMethodOptions);
    const hasCurrentMethod = paymentMethodOptions.some(
      (paymentMethod) => paymentMethod.id === movementPaymentMethod
    );

    if (!hasCurrentMethod) {
      setMovementPaymentMethod(defaultMovementMethod);
    }
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
          setIsShiftOpenModalOpen(false);
          setStartingCash("");
          setOpenShiftNotes("");
        },
      }
    );
  }, [openShiftMutation, openShiftNotes, startingCash]);

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
        paymentMethod: movementPaymentMethod,
        amount: parsedAmount,
        description: movementDescription.trim(),
      },
      {
        onSuccess: () => {
          setIsCashMovementModalOpen(false);
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
    movementPaymentMethod,
    movementType,
    paymentMethodOptions,
    registerCashMovementMutation,
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
          setIsCloseShiftModalOpen(false);
          setClosureAmounts({});
          setCloseShiftNotes("");
        },
      }
    );
  }, [
    activeShift,
    closeShiftMutation,
    closeShiftNotes,
    closureAmounts,
    shiftCloseSummary,
  ]);

  // Computed values
  const canOpenShift =
    startingCash.trim().length > 0 && parseMoneyInput(startingCash) >= 0;

  const canRegisterCashMovement =
    Boolean(activeShift) &&
    movementPaymentMethod.trim().length > 0 &&
    movementDescription.trim().length > 0 &&
    parseMoneyInput(movementAmount) > 0;

  const hasInvalidCloseAmounts =
    shiftCloseSummary?.summaryByMethod.some((summaryRow) => {
      const rawAmount = closureAmounts[summaryRow.paymentMethod];
      const amount = parseMoneyInput(rawAmount);
      return !Number.isFinite(amount) || amount < 0;
    }) ?? false;

  const cashSummary = shiftCloseSummary?.summaryByMethod.find(
    (summaryRow) => summaryRow.paymentMethod === "cash"
  );

  return {
    // Modal states
    isShiftOpenModalOpen,
    setIsShiftOpenModalOpen,
    isCashMovementModalOpen,
    setIsCashMovementModalOpen,
    isCloseShiftModalOpen,
    setIsCloseShiftModalOpen,

    // Form states - Open shift
    startingCash,
    setStartingCash,
    openShiftNotes,
    setOpenShiftNotes,

    // Form states - Cash movement
    movementType,
    setMovementType,
    movementPaymentMethod,
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
