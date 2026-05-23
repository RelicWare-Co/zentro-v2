import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useCustomersSearch,
  useCreateCustomerMutation as useZeroCreateCustomerMutation,
} from "@/features/customers/hooks/use-customers";
import { orpcQuery } from "@/server/orpc/client/query";

export function usePosBootstrap() {
  return useQuery({
    ...orpcQuery.pos.bootstrap.queryOptions(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePosProducts(activeCategoryId: string, searchQuery: string) {
  const categoryId = activeCategoryId === "all" ? null : activeCategoryId;
  const normalizedSearch = searchQuery || null;

  return useInfiniteQuery({
    ...orpcQuery.pos.searchProducts.infiniteOptions({
      input: (cursor) => ({
        searchQuery: normalizedSearch,
        categoryId,
        limit: 100,
        cursor: cursor ?? 0,
      }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      maxPages: 3,
    }),
    placeholderData: keepPreviousData,
  });
}

export function usePosCustomers() {
  return useCustomersSearch("", 100);
}

export function useCreditAccounts() {
  return useQuery({
    ...orpcQuery.credit.searchAccounts.queryOptions({
      input: {
        searchQuery: null,
        limit: 100,
        cursor: 0,
      },
    }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreatePosSaleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.sales.create.mutationOptions(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["orpc", "pos", "searchProducts"],
        }),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.credit.searchAccounts.queryOptions({
            input: {
              searchQuery: null,
              limit: 100,
              cursor: 0,
            },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.sales.list.queryOptions({ input: {} }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.sales.detail.queryOptions({
            input: { saleId: "" },
          }).queryKey,
        }),
      ]);
    },
  });
}

export function useCreateCustomerMutation() {
  return useZeroCreateCustomerMutation();
}

export function useToggleProductFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.pos.toggleFavorite.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["orpc", "pos", "searchProducts"],
      });
    },
  });
}
