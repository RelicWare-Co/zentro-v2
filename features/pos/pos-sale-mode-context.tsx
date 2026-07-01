import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useState,
} from "react";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { usePosSaleModeAdapters } from "@/features/modules/hooks/use-pos-sale-mode-adapters";
import { usePosCatalog } from "@/features/pos/pos-catalog-context";
import { usePosCustomer } from "@/features/pos/pos-customer-context";
import { usePosModal } from "@/features/pos/pos-modal-context";
import { usePosShiftContext } from "@/features/pos/pos-shift-context";
import { printSaleReceipt } from "@/features/pos/printing/print-sale-receipt.client";
import type {
  SaleFinalizeOptions,
  SaleModeAdapter,
  SaleReceiptPayload,
} from "@/features/pos/sale-modes/types";

export interface PosSaleModeContextValue {
  activeMode: SaleModeAdapter;
  buildFinalizeOptions: (shiftId: string) => SaleFinalizeOptions;
  handleSaleCompleted: (payload: SaleReceiptPayload) => Promise<void>;
  saleModeAdapters: [SaleModeAdapter, ...SaleModeAdapter[]];
  saleSuccessToken: number | null;
}

const PosSaleModeContext = createContext<PosSaleModeContextValue | null>(null);

export function usePosSaleMode() {
  const context = use(PosSaleModeContext);
  if (!context) {
    throw new Error("usePosSaleMode must be used within PosSaleModeProvider.");
  }
  return context;
}

export function PosSaleModeProvider({ children }: { children: ReactNode }) {
  const {
    activeOrganizationId,
    activeOrganizationName,
    allowCreditSales,
    defaultTerminalName,
    paymentMethodOptions,
    paymentMethodsForReceipt,
  } = usePosCatalog();
  const { activeShift } = usePosShiftContext();
  const { closeActiveModal } = usePosModal();
  const { customers, selectedCustomerId } = usePosCustomer();

  const [saleSuccessToken, setSaleSuccessToken] = useState<number | null>(null);

  const printReceiptForSale = useCallback(
    async (payload: SaleReceiptPayload) => {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      await printSaleReceipt({
        activeOrganizationId,
        activeOrganizationName,
        customer,
        defaultTerminalName,
        paymentMethods: paymentMethodsForReceipt,
        result: payload.result,
        snapshot: payload.snapshot,
      });
    },
    [
      customers,
      selectedCustomerId,
      activeOrganizationId,
      activeOrganizationName,
      defaultTerminalName,
      paymentMethodsForReceipt,
    ]
  );

  const handleSaleCompleted = useCallback(
    (payload: SaleReceiptPayload) => {
      setSaleSuccessToken(Date.now());
      return printReceiptForSale(payload);
    },
    [printReceiptForSale]
  );

  const moduleCapabilities = useModuleCapabilities();
  const saleModeAdapters = usePosSaleModeAdapters({
    activeOrganizationId,
    activeShiftId: activeShift?.id,
    allowCreditSales,
    closeActiveModal,
    moduleAccess: moduleCapabilities.data?.modules,
    paymentMethodOptions,
    printReceiptForSale: handleSaleCompleted,
    selectedCustomerId,
  });
  const activeMode =
    saleModeAdapters.find(
      (mode) => mode.modeId !== "counter" && mode.isActive
    ) ?? saleModeAdapters[0];

  const buildFinalizeOptions = useCallback(
    (shiftId: string): SaleFinalizeOptions => ({
      shiftId,
      customerId: selectedCustomerId || null,
      closeModal: closeActiveModal,
      printReceipt: handleSaleCompleted,
    }),
    [selectedCustomerId, closeActiveModal, handleSaleCompleted]
  );

  const value: PosSaleModeContextValue = {
    activeMode,
    buildFinalizeOptions,
    handleSaleCompleted,
    saleModeAdapters,
    saleSuccessToken,
  };

  return <PosSaleModeContext value={value}>{children}</PosSaleModeContext>;
}
