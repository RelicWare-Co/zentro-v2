import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useDeferredValue } from "react";
import type { z } from "zod";
import type {
  CreditAccountSchema,
  CreditTransactionSchema,
} from "@/schemas/credit";
import { orpcQuery } from "@/server/orpc/client/query";

export type CreditAccount = z.infer<typeof CreditAccountSchema>;
export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;

export function useOrganizationSettings() {
  return useQuery({
    ...orpcQuery.settings.get.queryOptions(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

function getCreditAccountsSearchQueryKey(searchQuery: string | null) {
  return orpcQuery.credit.searchAccounts.queryOptions({
    input: {
      searchQuery,
      limit: 50,
      cursor: 0,
    },
  }).queryKey;
}

function getCreditTransactionsQueryKey(creditAccountId: string) {
  return orpcQuery.credit.transactions.queryOptions({
    input: {
      creditAccountId,
      limit: 100,
      cursor: 0,
    },
  }).queryKey;
}

export function useCreditAccountsSearch(searchQuery: string) {
  const deferredSearchQuery = useDeferredValue(searchQuery);
  return useQuery({
    ...orpcQuery.credit.searchAccounts.queryOptions({
      input: {
        searchQuery: deferredSearchQuery.trim() || null,
        limit: 50,
        cursor: 0,
      },
    }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

export function useCreditTransactions(creditAccountId: string | null) {
  return useQuery({
    ...orpcQuery.credit.transactions.queryOptions({
      input: {
        creditAccountId: creditAccountId ?? "",
        limit: 100,
        cursor: 0,
      },
    }),
    enabled: Boolean(creditAccountId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useRegisterCreditPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpcQuery.credit.registerPayment.mutationOptions(),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getCreditAccountsSearchQueryKey(null),
        }),
        queryClient.invalidateQueries({
          queryKey: getCreditTransactionsQueryKey(data.creditAccountId),
        }),
      ]);
    },
  });
}
