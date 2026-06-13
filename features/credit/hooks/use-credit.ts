import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
import type { RegisterCreditPaymentSchema } from "@/features/credit/credit.schema";
import {
  buildCreditAccountListItem,
  buildCreditTransactionListItem,
  type CreditAccount,
  type CreditAccountWithCustomer,
  filterCreditAccountRows,
  paginateCreditAccounts,
  paginateCreditTransactions,
} from "@/features/credit/credit.shared";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import { mutators } from "@/zero/mutators";
import { queries } from "@/zero/queries";

export type {
  CreditAccount,
  CreditTransaction,
} from "@/features/credit/credit.shared";

type RegisterCreditPaymentInput = z.infer<typeof RegisterCreditPaymentSchema>;

export function useCreditAccountsSearch(searchQuery: string) {
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [accountRows, status] = useZeroQuery(queries.credit.accounts());
  const error = getZeroQueryError(status);

  const paginatedAccounts = useMemo(() => {
    const filteredRows = filterCreditAccountRows(
      accountRows as CreditAccountWithCustomer[],
      {
        searchQuery: deferredSearchQuery.trim() || null,
      }
    );
    const accounts = filteredRows
      .map((row) => buildCreditAccountListItem(row))
      .filter((account): account is CreditAccount => account !== null);
    return paginateCreditAccounts(accounts, {
      searchQuery: deferredSearchQuery.trim() || null,
      limit: 50,
      cursor: 0,
    });
  }, [accountRows, deferredSearchQuery]);

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef(paginatedAccounts);
  const isQueryLoading = status.type === "unknown" && accountRows.length === 0;

  if (!isQueryLoading) {
    staleDataRef.current = paginatedAccounts;
    hasLoadedRef.current = true;
  }

  const displayData = isQueryLoading ? staleDataRef.current : paginatedAccounts;

  return {
    data: displayData,
    error,
    isError: Boolean(error),
    isPending: isQueryLoading && !hasLoadedRef.current,
    isLoading: isQueryLoading && !hasLoadedRef.current,
    isPlaceholderData: deferredSearchQuery !== searchQuery,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useCreditTransactions(creditAccountId: string | null) {
  const [transactionRows, status] = useZeroQuery(
    queries.credit.transactions({
      creditAccountId: creditAccountId ?? null,
      limit: 100,
    })
  );
  const error = getZeroQueryError(status);
  const enabled = Boolean(creditAccountId);

  const paginatedTransactions = useMemo(() => {
    const transactions = transactionRows.map(buildCreditTransactionListItem);
    return paginateCreditTransactions(transactions, {
      limit: 100,
      cursor: 0,
    });
  }, [transactionRows]);

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef(paginatedTransactions);
  const isQueryLoading =
    enabled &&
    status.type === "unknown" &&
    transactionRows.length === 0 &&
    !error;

  if (!isQueryLoading) {
    staleDataRef.current = paginatedTransactions;
    hasLoadedRef.current = true;
  }

  const displayData = isQueryLoading
    ? staleDataRef.current
    : paginatedTransactions;

  return {
    data: enabled ? displayData : undefined,
    error,
    isError: Boolean(error),
    isPending: enabled && isQueryLoading && !hasLoadedRef.current,
    isLoading: enabled && isQueryLoading && !hasLoadedRef.current,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useRegisterCreditPaymentMutation() {
  return useZeroMutation(async (input: RegisterCreditPaymentInput, zero) => {
    const paymentId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    await waitForZeroMutation(
      zero.mutate(
        mutators.credit.registerPayment({
          ...input,
          paymentId,
          transactionId,
        })
      )
    );

    return {
      creditAccountId: input.creditAccountId,
      saleId: input.saleId ?? null,
      paymentId,
      transactionId,
      amount: input.amount,
      newBalance: 0,
    };
  });
}
