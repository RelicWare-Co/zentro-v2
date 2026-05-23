import { useZero, useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
import {
  buildCreditAccountListItem,
  buildCreditTransactionListItem,
  type CreditAccount,
  type CreditAccountWithCustomer,
  filterCreditAccountRows,
  paginateCreditAccounts,
  paginateCreditTransactions,
} from "@/features/credit/credit.shared";
import type { RegisterCreditPaymentSchema } from "@/schemas/credit";
import { orpcQuery } from "@/server/orpc/client/query";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";

export type {
  CreditAccount,
  CreditTransaction,
} from "@/features/credit/credit.shared";

type RegisterCreditPaymentInput = z.infer<typeof RegisterCreditPaymentSchema>;

type ZeroMutationDetails =
  | { readonly type: "success" }
  | {
      readonly error: { readonly message: string };
      readonly type: "error";
    };

interface ZeroMutationResult {
  readonly client: Promise<ZeroMutationDetails>;
  readonly server: Promise<ZeroMutationDetails>;
}

function toError(details: Extract<ZeroMutationDetails, { type: "error" }>) {
  return new Error(details.error.message || "La mutación de Zero falló");
}

async function waitForZeroMutation(result: ZeroMutationResult) {
  const clientResult = await result.client;
  if (clientResult.type === "error") {
    throw toError(clientResult);
  }

  const serverResult = await result.server;
  if (serverResult.type === "error") {
    throw toError(serverResult);
  }
}

function getQueryError(status: { type: string; error?: { message?: string } }) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

export function useOrganizationSettings() {
  return useQuery({
    ...orpcQuery.settings.get.queryOptions(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreditAccountsSearch(searchQuery: string) {
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [accountRows, status] = useZeroQuery(queries.credit.accounts());
  const error = getQueryError(status);

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
    })
  );
  const error = getQueryError(status);
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
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: RegisterCreditPaymentInput) => {
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
    },
  });
}
