import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import type {
  CreditAccount,
  CreditTransaction,
} from "@/features/credit/credit.shared";
import {
  useCreditAccountsSearch,
  useCreditTransactions,
  useRegisterCreditPaymentMutation,
} from "@/features/credit/hooks/use-credit";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { useActiveShift } from "@/features/shifts/hooks/use-shifts";

export type CreditPageOverlay =
  | { type: "ledger"; accountId: string }
  | { type: "payment"; accountId: string };

export interface CreditPageState {
  accounts: CreditAccount[];
  activeOverlay: CreditPageOverlay | null;
  isError: boolean;
  isPending: boolean;
  searchQuery: string;
  selectedAccount: CreditAccount | null;
  totalAccounts: number;
  totalBalance: number;
}

export interface CreditPageActions {
  closeOverlay: () => void;
  openLedger: (account: CreditAccount) => void;
  openPayment: (account: CreditAccount) => void;
  openPaymentFromLedger: () => void;
  registerPayment: (payload: {
    amount: number;
    method: string;
    saleId: string;
    reference: string;
    notes: string;
  }) => Promise<void>;
  setSearchQuery: (value: string) => void;
}

export interface CreditPageMeta {
  accountsError: unknown;
  activeShift: { id: string; terminalName: string | null } | null;
  isPaymentPending: boolean;
  paymentError: unknown;
  paymentMethods: Array<{
    id: string;
    label: string;
    requiresReference: boolean;
  }>;
  transactions: CreditTransaction[];
  transactionsError: unknown;
  transactionsLoading: boolean;
}

export interface CreditPageContextValue {
  actions: CreditPageActions;
  meta: CreditPageMeta;
  state: CreditPageState;
}

const CreditPageContext = createContext<CreditPageContextValue | null>(null);

export function useCreditPage() {
  const context = use(CreditPageContext);
  if (!context) {
    throw new Error("useCreditPage must be used within CreditPageProvider.");
  }
  return context;
}

function findAccountById(
  accounts: CreditAccount[],
  accountId: string | undefined
) {
  if (!accountId) {
    return null;
  }
  return accounts.find((account) => account.id === accountId) ?? null;
}

export function CreditPageProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeOverlay, setActiveOverlay] = useState<CreditPageOverlay | null>(
    null
  );

  const accountsQuery = useCreditAccountsSearch(searchQuery);
  const accounts = accountsQuery.data?.data ?? [];
  const totalAccounts = accountsQuery.data?.total ?? 0;
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );

  const selectedAccount = findAccountById(accounts, activeOverlay?.accountId);

  const ledgerAccountId =
    activeOverlay?.type === "ledger" ? activeOverlay.accountId : null;
  const transactionsQuery = useCreditTransactions(ledgerAccountId);

  const activeShiftQuery = useActiveShift();
  const activeShift = activeShiftQuery.data?.shift ?? null;

  const settingsQuery = useSettings();
  const paymentMethods =
    settingsQuery.data?.settings.pos.paymentMethods.filter(
      (method) => method.enabled
    ) ?? [];

  const registerPaymentMutation = useRegisterCreditPaymentMutation();

  const openLedger = useCallback((account: CreditAccount) => {
    setActiveOverlay({ type: "ledger", accountId: account.id });
  }, []);

  const openPayment = useCallback((account: CreditAccount) => {
    setActiveOverlay({ type: "payment", accountId: account.id });
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const openPaymentFromLedger = useCallback(() => {
    if (selectedAccount && selectedAccount.balance > 0) {
      setActiveOverlay({ type: "payment", accountId: selectedAccount.id });
    }
  }, [selectedAccount]);

  const registerPayment = useCallback(
    async (payload: {
      amount: number;
      method: string;
      saleId: string;
      reference: string;
      notes: string;
    }) => {
      if (!(selectedAccount && activeShift)) {
        return;
      }
      await registerPaymentMutation.mutateAsync({
        shiftId: activeShift.id,
        creditAccountId: selectedAccount.id,
        amount: payload.amount,
        method: payload.method,
        saleId: payload.saleId || null,
        reference: payload.reference || null,
        notes: payload.notes || null,
      });
      setActiveOverlay(null);
    },
    [activeShift, registerPaymentMutation, selectedAccount]
  );

  const value = useMemo<CreditPageContextValue>(
    () => ({
      state: {
        accounts,
        activeOverlay,
        isError: accountsQuery.isError,
        isPending: accountsQuery.isPending,
        searchQuery,
        selectedAccount,
        totalAccounts,
        totalBalance,
      },
      actions: {
        closeOverlay,
        openLedger,
        openPayment,
        openPaymentFromLedger,
        registerPayment,
        setSearchQuery,
      },
      meta: {
        accountsError: accountsQuery.error,
        activeShift,
        isPaymentPending: registerPaymentMutation.isPending,
        paymentError: registerPaymentMutation.error,
        paymentMethods,
        transactionsError: transactionsQuery.error,
        transactionsLoading: transactionsQuery.isLoading,
        transactions: transactionsQuery.data?.data ?? [],
      },
    }),
    [
      accounts,
      accountsQuery.error,
      accountsQuery.isError,
      accountsQuery.isPending,
      activeOverlay,
      activeShift,
      closeOverlay,
      openLedger,
      openPayment,
      openPaymentFromLedger,
      paymentMethods,
      registerPayment,
      registerPaymentMutation.error,
      registerPaymentMutation.isPending,
      searchQuery,
      selectedAccount,
      totalAccounts,
      totalBalance,
      transactionsQuery.data?.data,
      transactionsQuery.error,
      transactionsQuery.isLoading,
    ]
  );

  return <CreditPageContext value={value}>{children}</CreditPageContext>;
}
