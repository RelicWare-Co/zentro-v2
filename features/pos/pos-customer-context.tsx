import { createContext, type ReactNode, use, useMemo, useState } from "react";
import { useCreditAccountsSearch } from "@/features/credit/hooks/use-credit";
import { useCreateCustomerModal } from "@/features/pos/hooks/use-create-customer-modal";
import { usePosCustomers } from "@/features/pos/hooks/use-pos-queries";
import { usePosModal } from "@/features/pos/pos-modal-context";
import type { PosCustomer } from "@/features/pos/types";

export interface PosCustomerContextValue {
  confirmCreateCustomer: () => void;
  createCustomerModal: ReturnType<typeof useCreateCustomerModal>;
  customers: PosCustomer[];
  selectedCustomerCreditAccount: { balance: number } | null;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
}

const PosCustomerContext = createContext<PosCustomerContextValue | null>(null);

export function usePosCustomer() {
  const context = use(PosCustomerContext);
  if (!context) {
    throw new Error("usePosCustomer must be used within PosCustomerProvider.");
  }
  return context;
}

export function PosCustomerProvider({ children }: { children: ReactNode }) {
  const { closeActiveModal } = usePosModal();

  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const { data: customersData } = usePosCustomers();
  const { data: creditAccountsData } = useCreditAccountsSearch("");

  const customers = customersData?.data ?? [];
  const creditAccounts = creditAccountsData?.data ?? [];

  const createCustomerModal = useCreateCustomerModal((customerId) => {
    setSelectedCustomerId(customerId);
  }, closeActiveModal);

  const selectedCustomerCreditAccount = useMemo(() => {
    if (!selectedCustomerId) {
      return null;
    }
    return (
      creditAccounts.find(
        (account) => account.customerId === selectedCustomerId
      ) ?? null
    );
  }, [creditAccounts, selectedCustomerId]);

  const value: PosCustomerContextValue = {
    confirmCreateCustomer: createCustomerModal.handleCreateCustomer,
    createCustomerModal,
    customers,
    selectedCustomerCreditAccount,
    selectedCustomerId,
    setSelectedCustomerId,
  };

  return <PosCustomerContext value={value}>{children}</PosCustomerContext>;
}
