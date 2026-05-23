import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { z } from "zod";
import type { ListSalesInputSchema } from "@/schemas/sales";
import { orpcQuery } from "@/server/orpc/client/query";

export type SalesListParams = z.infer<typeof ListSalesInputSchema>;

export function useSalesList(params: SalesListParams = {}) {
  return useQuery({
    ...orpcQuery.sales.list.queryOptions({ input: params }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

export function useSaleDetail(saleId: string | null) {
  return useQuery({
    ...orpcQuery.sales.detail.queryOptions(
      saleId ? { input: { saleId } } : { input: { saleId: "" } }
    ),
    enabled: Boolean(saleId),
  });
}

export function useCancelSaleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpcQuery.sales.cancel.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.sales.list.queryOptions({ input: {} }).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.sales.detail.queryOptions({
          input: { saleId: "" },
        }).queryKey,
      });
    },
  });
}
