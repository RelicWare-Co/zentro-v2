import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useDeferredValue } from "react";
import type { z } from "zod";
import type { CustomerSchema } from "@/schemas/customers";
import { orpcQuery } from "@/server/orpc/client/query";

export type Customer = z.infer<typeof CustomerSchema>;
function getCustomersSearchQueryKey(searchQuery: string | null) {
  return orpcQuery.customers.search.queryOptions({
    input: {
      searchQuery,
      limit: 50,
      cursor: 0,
    },
  }).queryKey;
}

function invalidateCustomersSearch(
  queryClient: ReturnType<typeof useQueryClient>,
  searchQuery: string | null
) {
  queryClient
    .invalidateQueries({
      queryKey: getCustomersSearchQueryKey(searchQuery),
    })
    .catch(() => undefined);
}

export function useCustomersSearch(searchQuery: string) {
  const deferredSearchQuery = useDeferredValue(searchQuery);
  return useQuery({
    ...orpcQuery.customers.search.queryOptions({
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
    retry: false,
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpcQuery.customers.create.mutationOptions(),
    onSuccess: () => {
      invalidateCustomersSearch(queryClient, null);
    },
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpcQuery.customers.update.mutationOptions(),
    onSuccess: () => {
      invalidateCustomersSearch(queryClient, null);
    },
  });
}

export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpcQuery.customers.delete.mutationOptions(),
    onSuccess: () => {
      invalidateCustomersSearch(queryClient, null);
    },
  });
}
